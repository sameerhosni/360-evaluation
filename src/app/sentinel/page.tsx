import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentPerson } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { Card, Chip, Eyebrow, PageHeader, StatCard } from "@/components/ui";
import { describeBiasPattern } from "@/lib/ai/bias";
import { hasApiKey } from "@/lib/ai/client";
import type { BiasExplanations } from "@/lib/ai/schemas";
import { currentLocale, t, tFormat } from "@/lib/i18n";

async function setPatternStatus(formData: FormData) {
  "use server";
  const me = await currentPerson();
  if (!me || me.role !== "hrbp") throw new Error("not authorized");
  const id = formData.get("id") as string;
  const status = formData.get("status") as string;
  const hrNote = (formData.get("hrNote") as string | null)?.trim() || null;

  await db.biasPattern.update({
    where: { id },
    data: { status, hrNote: hrNote ?? undefined },
  });
  await db.auditEntry.create({
    data: {
      tenantId: me.tenantId, actorId: me.id, actorRole: me.role,
      action: `BIAS_${status}`, subjectKind: "bias_pattern", subjectId: id,
    },
  });
  revalidatePath("/sentinel");
}

export default async function Sentinel() {
  const me = await currentPerson();
  if (!me) redirect("/");
  if (me.role !== "hrbp" && me.role !== "hr_admin") redirect("/");

  const patterns = await db.biasPattern.findMany({
    where: { tenantId: me.tenantId },
    orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
  });

  const open = patterns.filter((p) => p.status === "OPEN");
  const investigating = patterns.filter((p) => p.status === "INVESTIGATING" || p.status === "ACK");
  const resolved = patterns.filter((p) => p.status === "RESOLVED");

  // Use seeded explanations when present; otherwise call Claude
  const explanationByPattern: Record<string, BiasExplanations | null> = {};
  if (hasApiKey() || patterns.some((p) => p.explanations)) {
    await Promise.all(
      patterns.slice(0, 6).map(async (p) => {
        try {
          const seeded = JSON.parse(p.explanations) as Partial<BiasExplanations>;
          if (seeded.neutral && seeded.cautious && seeded.urgent) {
            explanationByPattern[p.id] = {
              oneSentence: seeded.oneSentence ?? `${p.scopeLabel} · ${p.axis} pattern at ${p.severity.toLowerCase()} severity.`,
              magnitudeInEverydayTerms:
                seeded.magnitudeInEverydayTerms ??
                `${Math.abs(p.effectSize).toFixed(1)}-point ${p.effectSize < 0 ? "gap" : "lift"} on ${p.criterion ?? p.axis} across ${p.sampleSize} cases (95% CI ${p.ciLow.toFixed(1)} to ${p.ciHigh.toFixed(1)}).`,
              neutral: seeded.neutral,
              cautious: seeded.cautious,
              urgent: seeded.urgent,
              recommendedAction: seeded.recommendedAction ?? p.recommended,
            };
          } else if (hasApiKey()) {
            const out = await describeBiasPattern({
              axis: p.axis, scope: p.scope, scopeLabel: p.scopeLabel,
              criterion: p.criterion, effectSize: p.effectSize,
              ciLow: p.ciLow, ciHigh: p.ciHigh, sampleSize: p.sampleSize,
              pValue: p.pValue,
              severity: p.severity as "LOW" | "MEDIUM" | "HIGH",
            });
            explanationByPattern[p.id] = out.explanations;
          }
        } catch {
          explanationByPattern[p.id] = null;
        }
      }),
    );
  }

  const fairness = Math.max(50, 100 - open.length * 8 - investigating.length * 3);
  const locale = await currentLocale();

  return (
    <AppShell me={me}>
      <PageHeader
        eyebrow={tFormat(t(locale, "sentinel.eyebrow"), { date: formatDate(new Date(), locale) })}
        title={t(locale, "sentinel.title")}
        subtitle={t(locale, "sentinel.subtitle")}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label={t(locale, "sentinel.statOpen")} value={open.length} tone={open.length > 0 ? "bad" : "good"} />
        <StatCard label={t(locale, "sentinel.statUnderReview")} value={investigating.length} tone={investigating.length > 0 ? "warn" : "good"} />
        <StatCard label={t(locale, "sentinel.statResolved")} value={resolved.length} tone="good" />
        <StatCard label={t(locale, "sentinel.statOrgFairness")} value={`${fairness}/100`} helper={t(locale, "sentinel.statHelper")} />
      </div>

      {!hasApiKey() && (
        <div className="card p-4 mb-6 bg-warn-50 border-warn-500/20 flex items-start gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#BF8120" strokeWidth="2" className="flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
          <div className="text-[13px] text-ink-800">
            <span className="font-semibold text-warn-700">{t(locale, "sentinel.aiDisabledTitle")}</span>{" "}
            <span className="text-ink-600">{t(locale, "sentinel.aiDisabledBody")}</span>
          </div>
        </div>
      )}

      <div className="space-y-5 mb-10">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl text-ink-900">{t(locale, "sentinel.openHeading")}</h2>
          <span className="text-[12px] text-ink-500">{tFormat(t(locale, "sentinel.openHelper"), { n: open.length })}</span>
        </div>

        {open.length === 0 ? (
          <Card>
            <div className="text-center py-10">
              <div className="text-[15px] text-ink-700 mb-1">{t(locale, "sentinel.allClearTitle")}</div>
              <div className="text-[13px] text-ink-400">{t(locale, "sentinel.allClearHelper")}</div>
            </div>
          </Card>
        ) : (
          open.map((p) => {
            const e = explanationByPattern[p.id];
            const severityTone = p.severity === "HIGH" ? "bad" : p.severity === "MEDIUM" ? "warn" : "default";
            const severityRing =
              p.severity === "HIGH" ? "bg-bad-50 border-bad-100 text-bad-700" :
              p.severity === "MEDIUM" ? "bg-warn-50 border-warn-100 text-warn-700" :
              "bg-ink-50 border-ink-100 text-ink-600";
            return (
              <Card key={p.id} className="overflow-hidden p-0">
                <div className="px-6 py-5 border-b border-soft">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 font-bold ${severityRing}`}>!</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Chip tone={severityTone}>{p.severity}</Chip>
                        <Chip>{p.axis}</Chip>
                        {p.criterion && <Chip>{p.criterion}</Chip>}
                        <span className="ms-auto text-[11px] text-ink-400 font-mono">
                          {t(locale, "sentinel.detectedAgo")} {formatRelative(p.detectedAt, locale)}
                        </span>
                      </div>
                      <h3 className="font-display text-xl text-ink-900 leading-snug">
                        {e?.oneSentence ?? `${p.scopeLabel} · ${p.axis}`}
                      </h3>
                      <div className="text-[13px] text-ink-500 mt-2">
                        {e?.magnitudeInEverydayTerms ??
                          `effect size ${p.effectSize.toFixed(2)} · 95% CI [${p.ciLow.toFixed(2)}, ${p.ciHigh.toFixed(2)}] · n=${p.sampleSize} · p=${p.pValue.toFixed(3)}`}
                      </div>
                    </div>
                  </div>
                </div>

                {e && (
                  <div className="px-6 py-5 border-b border-soft">
                    <Eyebrow muted className="mb-4">{t(locale, "sentinel.threeExplanations")}</Eyebrow>
                    <div className="space-y-3">
                      <ExplanationRow tone="neutral" text={e.neutral} label={t(locale, "sentinel.neutralLabel")} />
                      <ExplanationRow tone="cautious" text={e.cautious} label={t(locale, "sentinel.cautiousLabel")} />
                      <ExplanationRow tone="urgent" text={e.urgent} label={t(locale, "sentinel.urgentLabel")} />
                    </div>
                  </div>
                )}

                <div className="px-6 py-4 bg-surface-75 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-ink-500 uppercase tracking-wider mb-1">{t(locale, "sentinel.recommendedAction")}</div>
                    <div className="text-[13px] text-ink-900 font-medium">
                      {e?.recommendedAction ?? p.recommended}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <form action={setPatternStatus}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="status" value="ACK" />
                      <button type="submit" className="btn-secondary">{t(locale, "sentinel.acknowledge")}</button>
                    </form>
                    <form action={setPatternStatus}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="status" value="INVESTIGATING" />
                      <button type="submit" className="btn-primary">{t(locale, "sentinel.investigate")}</button>
                    </form>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {investigating.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-2xl text-ink-900">{t(locale, "sentinel.underReviewHeading")}</h2>
          {investigating.map((p) => (
            <Card key={p.id} className="p-5 flex items-center gap-3">
              <Chip tone="warn">{p.status === "ACK" ? t(locale, "sentinel.acknowledged") : t(locale, "sentinel.investigating")}</Chip>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] text-ink-900 font-medium">
                  {p.scopeLabel} · {p.axis}{p.criterion ? ` · ${p.criterion}` : ""}
                </div>
                <div className="text-[11px] text-ink-400 mt-0.5">
                  {t(locale, "sentinel.detectedAgo")} {formatRelative(p.detectedAt, locale)}
                </div>
              </div>
              <form action={setPatternStatus}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="status" value="RESOLVED" />
                <button type="submit" className="btn-ghost text-good-700">{t(locale, "sentinel.markResolved")}</button>
              </form>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function ExplanationRow({ tone, text, label }: { tone: "neutral" | "cautious" | "urgent"; text: string; label: string }) {
  const map = {
    neutral:  { chip: "default" as const, color: "text-ink-700" },
    cautious: { chip: "warn"    as const, color: "text-ink-800" },
    urgent:   { chip: "bad"     as const, color: "text-ink-900" },
  };
  const m = map[tone];
  return (
    <div className="flex items-start gap-3">
      <Chip tone={m.chip} className="!text-[10px] mt-0.5 min-w-[64px] justify-center">{label}</Chip>
      <span className={`text-[13px] flex-1 leading-relaxed ${m.color}`}>{text}</span>
    </div>
  );
}

function formatDate(d: Date, locale: "en" | "ar" = "en") {
  return d.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function formatRelative(d: Date, locale: "en" | "ar" = "en") {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (locale === "ar") {
    if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} س`;
    return `قبل ${Math.floor(diff / 86400)} يوم`;
  }
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
