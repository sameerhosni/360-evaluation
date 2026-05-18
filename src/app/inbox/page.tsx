import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentPerson } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { Card, Chip, Eyebrow, PageHeader } from "@/components/ui";
import { currentLocale, t, tFormat, tNode } from "@/lib/i18n";

async function confirmAchievement(formData: FormData) {
  "use server";
  const me = await currentPerson();
  if (!me) throw new Error("not authenticated");
  const id = formData.get("id") as string;

  await db.achievement.update({
    where: { id },
    data: { status: "EMPLOYEE_CONFIRMED", confirmedAt: new Date() },
  });
  await db.auditEntry.create({
    data: {
      tenantId: me.tenantId, actorId: me.id, actorRole: me.role,
      action: "ACHIEVEMENT_CONFIRMED", subjectKind: "achievement", subjectId: id,
    },
  });
  revalidatePath("/inbox");
  revalidatePath("/dashboard");
}

async function skipAchievement(formData: FormData) {
  "use server";
  const me = await currentPerson();
  if (!me) throw new Error("not authenticated");
  const id = formData.get("id") as string;

  await db.achievement.update({ where: { id }, data: { status: "SKIPPED" } });
  await db.auditEntry.create({
    data: {
      tenantId: me.tenantId, actorId: me.id, actorRole: me.role,
      action: "ACHIEVEMENT_SKIPPED", subjectKind: "achievement", subjectId: id,
    },
  });
  revalidatePath("/inbox");
  revalidatePath("/dashboard");
}

// Step 1 of the deck workflow — manual employee submission.
// The result is EMPLOYEE_CONFIRMED so it heads straight to the manager queue.
async function submitManualAchievement(formData: FormData) {
  "use server";
  const me = await currentPerson();
  if (!me || me.role !== "employee") throw new Error("not authenticated");

  const cycle = await db.cycle.findFirst({
    where: { tenantId: me.tenantId, status: { in: ["OPEN", "CALIBRATION"] } },
    orderBy: { startsAt: "desc" },
  });
  if (!cycle) throw new Error("no active cycle");

  const description = (formData.get("description") as string)?.trim();
  const category = (formData.get("category") as string) || "exceptional_performance";
  const proposedPoints = Math.max(1, Math.min(5, parseInt(formData.get("proposedPoints") as string, 10) || 2));
  const evidenceText = (formData.get("evidence") as string)?.trim() ?? "";

  if (!description || description.length < 10) {
    throw new Error("Description must be at least 10 characters");
  }

  const evidence = evidenceText
    ? [{ kind: "note", summary: evidenceText }]
    : [];

  const created = await db.achievement.create({
    data: {
      tenantId: me.tenantId,
      personId: me.id,
      cycleId: cycle.id,
      category,
      proposedPoints,
      status: "EMPLOYEE_CONFIRMED",
      source: "SELF",
      description,
      language: me.preferredLang,
      evidenceEvents: JSON.stringify(evidence),
      twinConfidence: 0.6,
      proposedAt: new Date(),
      confirmedAt: new Date(),
    },
  });
  await db.auditEntry.create({
    data: {
      tenantId: me.tenantId, actorId: me.id, actorRole: me.role,
      action: "ACHIEVEMENT_SUBMITTED_MANUAL", subjectKind: "achievement", subjectId: created.id,
    },
  });

  revalidatePath("/inbox");
  revalidatePath("/dashboard");
}

// fall-back labels in English when the locale lookup fails
const FALLBACK_CATEGORY: Record<string, string> = {
  project_milestone: "Project milestone",
  process_improvement: "Process improvement",
  exceptional_performance: "Exceptional performance",
  cross_functional_leadership: "Cross-functional leadership",
  peer_witnessed: "Peer-witnessed",
};
const FALLBACK_SOURCE: Record<string, string> = {
  AAD: "AI-detected",
  PEER_WITNESSED: "Peer-witnessed",
  SELF: "Self-captured",
  MANAGER: "Manager-flagged",
};

type EvidenceItem = { kind: string; id?: string; summary: string };

export default async function Inbox() {
  const me = await currentPerson();
  if (!me) redirect("/");
  if (me.role !== "employee") redirect("/");

  const cycle = await db.cycle.findFirst({
    where: { tenantId: me.tenantId, status: { in: ["OPEN", "CALIBRATION"] } },
    orderBy: { startsAt: "desc" },
  });
  if (!cycle) return <AppShell me={me}><Card>No active cycle.</Card></AppShell>;

  const [pending, confirmed] = await Promise.all([
    db.achievement.findMany({
      where: { personId: me.id, cycleId: cycle.id, status: "PROPOSED" },
      orderBy: { proposedAt: "desc" },
    }),
    db.achievement.findMany({
      where: { personId: me.id, cycleId: cycle.id, status: { in: ["EMPLOYEE_CONFIRMED", "MANAGER_CONFIRMED"] } },
      orderBy: { confirmedAt: "desc" },
      take: 6,
    }),
  ]);

  const locale = await currentLocale();
  const categoryMap = (tNode(locale, "inbox.categoryLabels") as Record<string, string>) ?? FALLBACK_CATEGORY;
  const sourceMap = (tNode(locale, "inbox.sourceLabels") as Record<string, string>) ?? FALLBACK_SOURCE;
  const localCategory = (k: string) => categoryMap[k] ?? FALLBACK_CATEGORY[k] ?? k;
  const localSource = (k: string) => sourceMap[k] ?? FALLBACK_SOURCE[k] ?? k;

  return (
    <AppShell me={me}>
      <PageHeader
        eyebrow={`${tFormat(t(locale, "inbox.eyebrow"), { n: pending.length })} · ${cycle.label}`}
        title={t(locale, "inbox.title")}
        subtitle={t(locale, "inbox.subtitle")}
      />

      {/* Manual submission */}
      <details className="card mb-6 p-0 overflow-hidden group">
        <summary className="px-6 py-4 cursor-pointer flex items-center gap-3 hover:bg-ink-50 transition list-none">
          <div className="w-9 h-9 rounded-lg bg-gold-50 border border-gold-200 flex items-center justify-center text-gold-700 flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-[14px] text-ink-900 font-semibold">{t(locale, "inbox.manualTitle")}</div>
            <div className="text-[12px] text-ink-500">{t(locale, "inbox.manualSubtitle")}</div>
          </div>
          <span className="text-[12px] text-gold-700 font-medium group-open:hidden">{t(locale, "inbox.manualOpen")}</span>
          <span className="text-[12px] text-ink-500 font-medium hidden group-open:inline">{t(locale, "inbox.manualClose")}</span>
        </summary>
        <form action={submitManualAchievement} className="px-6 pb-6 pt-2 border-t border-soft space-y-4">
          <div>
            <label className="block text-[12px] text-ink-700 font-semibold mb-1">{t(locale, "inbox.formDescription")}</label>
            <textarea
              name="description"
              required
              minLength={10}
              maxLength={400}
              rows={3}
              placeholder={t(locale, "inbox.formDescriptionPlaceholder")}
              className="w-full bg-surface-50 border border-soft rounded-md p-3 text-[14px] text-ink-900 placeholder-ink-400 focus:bg-white focus:border-gold-500 transition"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[12px] text-ink-700 font-semibold mb-1">{t(locale, "inbox.formCategory")}</label>
              <select name="category" className="w-full bg-surface-50 border border-soft rounded-md px-3 py-2 text-[13px] text-ink-900 focus:bg-white focus:border-gold-500">
                <option value="project_milestone">{localCategory("project_milestone")}</option>
                <option value="process_improvement">{localCategory("process_improvement")}</option>
                <option value="exceptional_performance">{localCategory("exceptional_performance")}</option>
                <option value="cross_functional_leadership">{localCategory("cross_functional_leadership")}</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] text-ink-700 font-semibold mb-1">{t(locale, "inbox.formProposedPoints")}</label>
              <input
                type="number" name="proposedPoints" defaultValue={2} min={1} max={5}
                className="w-full bg-surface-50 border border-soft rounded-md px-3 py-2 text-[13px] font-mono text-ink-900 focus:bg-white focus:border-gold-500"
              />
            </div>
            <div className="flex items-end">
              <div className="text-[11px] text-ink-400">
                {t(locale, "inbox.formProposedPointsHelp")}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-[12px] text-ink-700 font-semibold mb-1">{t(locale, "inbox.formEvidence")} <span className="font-normal text-ink-400">{t(locale, "inbox.formEvidenceOptional")}</span></label>
            <input
              type="text" name="evidence" maxLength={200}
              placeholder={t(locale, "inbox.formEvidencePlaceholder")}
              className="w-full bg-surface-50 border border-soft rounded-md px-3 py-2 text-[13px] text-ink-900 placeholder-ink-400 focus:bg-white focus:border-gold-500"
            />
          </div>
          <div className="flex items-center justify-between pt-2">
            <div className="text-[11px] text-ink-500">{t(locale, "inbox.formNote")}</div>
            <button type="submit" className="btn-primary">{t(locale, "inbox.formSubmit")}</button>
          </div>
        </form>
      </details>

      <div className="space-y-4 mb-12">
        {pending.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <div className="text-[15px] text-ink-600 mb-1">{t(locale, "inbox.emptyTitle")}</div>
              <div className="text-[13px] text-ink-400">{t(locale, "inbox.emptyHelper")}</div>
            </div>
          </Card>
        ) : (
          pending.map((a) => {
            const evidence: EvidenceItem[] = JSON.parse(a.evidenceEvents);
            return (
              <Card key={a.id} hover>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gold-50 border border-gold-200 flex items-center justify-center flex-shrink-0">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#A88A4D" strokeWidth="2">
                      <path d="M12 2L15 8L21 9L17 14L18 21L12 18L6 21L7 14L3 9L9 8Z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] text-ink-900 font-semibold leading-snug mb-2">
                      {a.description}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip tone="gold">{localCategory(a.category)}</Chip>
                      <Chip>{localSource(a.source)}</Chip>
                      <span className="text-[12px] text-ink-500">
                        {t(locale, "inbox.proposedSuffix")} <span className="font-semibold text-ink-800">{a.proposedPoints} {t(locale, "common.pt")}</span>
                      </span>
                      <span className="text-ink-300">·</span>
                      <span className="text-[12px] text-ink-500">
                        {t(locale, "inbox.confidenceSuffix")} <span className="font-semibold text-ink-800">{Math.round(a.twinConfidence * 100)}%</span>
                      </span>
                    </div>
                  </div>
                </div>

                {evidence.length > 0 && (
                  <div className="mt-5 pt-5 border-t border-soft">
                    <Eyebrow muted className="mb-3">{t(locale, "inbox.evidenceTitle")} ({evidence.length})</Eyebrow>
                    <ul className="space-y-2">
                      {evidence.map((e, i) => (
                        <li key={i} className="flex items-start gap-3 text-[13px]">
                          <Chip className="text-[10px] !py-0.5 mt-0.5">{e.kind}</Chip>
                          <div className="flex-1">
                            {e.id && <span className="font-mono text-[11px] text-ink-500 mr-2">{e.id}</span>}
                            <span className="text-ink-700">{e.summary}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-6 pt-5 border-t border-soft flex items-center justify-end gap-3">
                  <form action={skipAchievement}>
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" className="btn-ghost">{t(locale, "inbox.cardSkip")}</button>
                  </form>
                  <form action={confirmAchievement}>
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" className="btn-secondary">{t(locale, "inbox.cardEditConfirm")}</button>
                  </form>
                  <form action={confirmAchievement}>
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" className="btn-primary">
                      {t(locale, "inbox.cardConfirm")}
                    </button>
                  </form>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {confirmed.length > 0 && (
        <div>
          <h2 className="font-display text-2xl text-ink-900 mb-4">{t(locale, "inbox.recentlyConfirmed")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {confirmed.map((a) => (
              <div key={a.id} className="card p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-good-50 border border-good-100 flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2F9A60" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-ink-800 leading-snug font-medium">{a.description}</div>
                  <div className="text-[11px] text-ink-500 mt-1">
                    {localCategory(a.category)} · {a.awardedPoints ?? a.proposedPoints} {t(locale, "common.pt")} · {a.status === "MANAGER_CONFIRMED" ? t(locale, "inbox.managerConfirmed") : t(locale, "inbox.awaitingManager")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
