import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { currentPerson } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { Avatar, Card, Chip, PageHeader } from "@/components/ui";
import { CockpitFilters } from "@/components/cockpit-filters";
import { DEFAULT_SORT, SORT_OPTIONS } from "@/lib/cockpit-filters";
import { tierForValue, TIER_TEXT } from "@/lib/tiers";
import { currentLocale, t, tFormat, tNode } from "@/lib/i18n";

type SearchParams = Promise<{ q?: string; sort?: string; cycle?: string }>;

export default async function Cockpit({ searchParams }: { searchParams: SearchParams }) {
  const me = await currentPerson();
  if (!me) redirect("/");
  if (me.role !== "manager") redirect("/");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const sortId = SORT_OPTIONS.find((s) => s.id === sp.sort)?.id ?? DEFAULT_SORT;
  const cycleParam = sp.cycle ?? "";

  // All cycles for this tenant (newest first) — drives the period filter
  const cycles = await db.cycle.findMany({
    where: { tenantId: me.tenantId },
    orderBy: { startsAt: "desc" },
  });
  if (cycles.length === 0) return <AppShell me={me}><Card>No cycles found.</Card></AppShell>;

  const activeCycle = cycles.find((c) => c.status === "OPEN" || c.status === "CALIBRATION") ?? cycles[0];
  const selectedCycle = cycles.find((c) => c.id === cycleParam) ?? activeCycle;

  const directs = await db.person.findMany({
    where: { managerId: me.id },
    orderBy: { fullName: "asc" },
  });
  const directIds = directs.map((d) => d.id);
  const scores = await db.cycleScore.findMany({
    where: { cycleId: selectedCycle.id, personId: { in: directIds } },
  });
  const scoreByPerson = new Map(scores.map((s) => [s.personId, s]));

  // Filter by name first
  const filtered = q
    ? directs.filter((d) =>
        d.fullName.toLowerCase().includes(q) ||
        (d.preferredName?.toLowerCase().includes(q) ?? false) ||
        d.jobTitle.toLowerCase().includes(q),
      )
    : directs;

  // Then sort
  const ordered = [...filtered].sort((a, b) => {
    const sa = scoreByPerson.get(a.id);
    const sb = scoreByPerson.get(b.id);
    const pulseA = sa?.totalScore ?? -1;
    const pulseB = sb?.totalScore ?? -1;
    const confA = sa?.calibrationConfidence ?? 0;
    const confB = sb?.calibrationConfidence ?? 0;
    switch (sortId) {
      case "pulse_desc": return pulseB - pulseA;
      case "pulse_asc":  return pulseA - pulseB;
      case "conf_asc":   return confA - confB;
      case "conf_desc":  return confB - confA;
      case "name_desc":  return b.fullName.localeCompare(a.fullName);
      case "name_asc":   return a.fullName.localeCompare(b.fullName);
      default:           return confA - confB;
    }
  });

  const justifications = await db.managerJustification.findMany({
    where: { cycleId: selectedCycle.id, managerId: me.id },
    select: { personId: true },
  });
  const calibratedIds = new Set(justifications.map((j) => j.personId));

  const lowConf = directs.filter((d) => (scoreByPerson.get(d.id)?.calibrationConfidence ?? 100) < 70).length;
  const isLockedCycle = selectedCycle.status === "LOCKED" || selectedCycle.status === "ARCHIVED";

  const locale = await currentLocale();
  const sortLabels = (tNode(locale, "cockpit.sort") as Record<string, string>) ?? {};
  const localizedSortOptions = SORT_OPTIONS.map((s) => ({ id: s.id, label: sortLabels[s.id] ?? s.label }));

  return (
    <AppShell me={me}>
      <PageHeader
        eyebrow={tFormat(
          isLockedCycle ? t(locale, "cockpit.eyebrowLocked") : t(locale, "cockpit.eyebrowOpen"),
          { cycle: selectedCycle.label },
        )}
        title={t(locale, "cockpit.title")}
        subtitle={
          isLockedCycle
            ? tFormat(t(locale, "cockpit.subtitleLocked"), { cycle: selectedCycle.label })
            : tFormat(t(locale, "cockpit.subtitleOpen"), { count: directs.length })
        }
        actions={
          <div className="card px-5 py-3 min-w-[200px]">
            <div className="text-[11px] text-ink-500 uppercase tracking-wider mb-1">{t(locale, "cockpit.progress")}</div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-2xl text-ink-900">{calibratedIds.size}</span>
              <span className="text-[13px] text-ink-400">{t(locale, "cockpit.progressOf")} {directs.length}</span>
            </div>
            <div className="h-1.5 mt-2 rounded-full bg-ink-100 overflow-hidden">
              <div
                className="h-full bg-gold-600 rounded-full transition-all"
                style={{ width: `${(calibratedIds.size / Math.max(1, directs.length)) * 100}%` }}
              />
            </div>
          </div>
        }
      />

      {lowConf > 0 && !q && (
        <div className="card p-4 mb-6 bg-warn-50 border-warn-500/20 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-warn-100 flex items-center justify-center text-warn-700 flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 9v4M12 17h.01" /><circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <div className="text-[13px] text-ink-800">
            <span className="font-semibold">
              {tFormat(lowConf === 1 ? t(locale, "cockpit.lowConfTitle") : t(locale, "cockpit.lowConfTitlePlural"), { n: lowConf })}
            </span>{" "}
            <span className="text-ink-600">{t(locale, "cockpit.lowConfHelper")}</span>
          </div>
        </div>
      )}

      <CockpitFilters
        cycles={cycles.map((c) => ({
          id: c.id,
          label: `${c.label}${c.status === "OPEN" || c.status === "CALIBRATION" ? ` · ${t(locale, "cockpit.periodCurrent")}` : c.status === "LOCKED" ? ` · ${t(locale, "cockpit.periodLocked")}` : ""}`,
        }))}
        activeCycleId={activeCycle.id}
        totalReports={directs.length}
        filteredCount={ordered.length}
        labels={{
          searchPlaceholder: t(locale, "cockpit.searchPlaceholder"),
          sort: t(locale, "cockpit.sortLabel"),
          period: t(locale, "cockpit.periodLabel"),
          noCycles: t(locale, "cockpit.noCycles"),
          reports: t(locale, "cockpit.reportsSuffix"),
          reset: t(locale, "common.reset"),
          sortOptions: localizedSortOptions,
        }}
      />

      {ordered.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <div className="text-[15px] text-ink-700 mb-1">{t(locale, "cockpit.noMatchTitle")}</div>
            <div className="text-[13px] text-ink-400">{t(locale, "cockpit.noMatchHelper")}</div>
          </div>
        </Card>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-6 py-3 border-b border-soft bg-surface-75 flex items-center text-[11px] text-ink-500 uppercase tracking-wider font-semibold">
            <div className="flex-1">{t(locale, "cockpit.colName")}</div>
            <div className="hidden md:grid grid-cols-4 gap-8 text-end" style={{ width: "440px" }}>
              <div>{t(locale, "cockpit.colMgr")}</div>
              <div>{t(locale, "cockpit.colCrossFn")}</div>
              <div>{t(locale, "cockpit.colPulse")}</div>
              <div>{t(locale, "cockpit.colConf")}</div>
            </div>
            <div className="w-8" />
          </div>
          <div className="divide-soft">
            {ordered.map((d) => {
              const s = scoreByPerson.get(d.id);
              const conf = s?.calibrationConfidence ?? null;
              const confTone =
                conf == null ? "default" : conf >= 80 ? "good" : conf >= 65 ? "warn" : "bad";
              const calibrated = calibratedIds.has(d.id);
              return (
                <Link
                  key={d.id}
                  href={`/cockpit/${d.id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-ink-50 transition group"
                >
                  <Avatar name={d.fullName} role="employee" size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-[15px] text-ink-900 font-semibold">
                        <HighlightedText text={d.fullName} query={q} />
                      </div>
                      {calibrated && <Chip tone="good">{t(locale, "cockpit.calibratedBadge")}</Chip>}
                    </div>
                    <div className="text-[12px] text-ink-500">
                      <HighlightedText text={d.jobTitle} query={q} />
                    </div>
                  </div>
                  <div className="hidden md:grid grid-cols-4 gap-8 text-end" style={{ width: "440px" }}>
                    <Metric value={s?.managerEval} max={30} />
                    <Metric value={s?.crossFunctionalEval} max={30} />
                    <div>
                      {s ? (
                        <div className={`font-display text-xl font-semibold ${TIER_TEXT[tierForValue(s.totalScore, 100)]}`}>
                          {s.totalScore.toFixed(1)}
                        </div>
                      ) : (
                        <div className="font-display text-xl text-ink-300">—</div>
                      )}
                    </div>
                    <div>
                      <span className={`font-mono text-[14px] font-semibold ${
                        confTone === "good" ? "text-good-700" :
                        confTone === "warn" ? "text-warn-700" :
                        confTone === "bad"  ? "text-bad-700"  : "text-ink-500"
                      }`}>
                        {conf ?? "—"}
                      </span>
                    </div>
                  </div>
                  <div className="text-ink-300 group-hover:text-ink-700 transition">→</div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Metric({ value, max }: { value?: number; max: number }) {
  if (value == null) return <span className="text-ink-300">—</span>;
  const tier = tierForValue(value, max);
  return (
    <div className="font-mono text-[13px]">
      <span className={`font-semibold ${TIER_TEXT[tier]}`}>{value.toFixed(1)}</span>
      <span className="text-ink-400 text-[11px]"> / {max}</span>
    </div>
  );
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const i = text.toLowerCase().indexOf(query);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-gold-100 text-ink-900 rounded px-0.5">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}
