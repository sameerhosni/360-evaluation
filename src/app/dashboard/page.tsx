import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { currentPerson } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { Card, Chip, DimensionBar, Eyebrow, ScoreRing } from "@/components/ui";
import { PerformanceTimeline } from "@/components/performance-timeline";
import { PulseLedger, type LedgerEntry } from "@/components/pulse-ledger";
import { buildTimeline } from "@/lib/timeline";
import { currentLocale, t, tFormat } from "@/lib/i18n";

export default async function Dashboard() {
  const me = await currentPerson();
  if (!me) redirect("/");
  if (me.role !== "employee") {
    if (me.role === "manager") redirect("/cockpit");
    if (me.role === "hrbp") redirect("/sentinel");
  }

  const cycle = await db.cycle.findFirst({
    where: { tenantId: me.tenantId, status: { in: ["OPEN", "CALIBRATION"] } },
    orderBy: { startsAt: "desc" },
  });
  if (!cycle) {
    return (
      <AppShell me={me}>
        <Card>No active cycle.</Card>
      </AppShell>
    );
  }

  const [score, livePulse, pendingAchievements, tasks, feedback, confirmedAchievements] = await Promise.all([
    db.cycleScore.findUnique({ where: { cycleId_personId: { cycleId: cycle.id, personId: me.id } } }),
    db.livePulse.findUnique({ where: { personId: me.id } }),
    db.achievement.findMany({
      where: { personId: me.id, cycleId: cycle.id, status: "PROPOSED" },
      orderBy: { proposedAt: "desc" },
    }),
    db.taskAssignment.findMany({
      where: { personId: me.id, task: { closedAt: { not: null } } },
      include: { task: true },
    }),
    db.feedbackEvent.findMany({
      where: { ratedPersonId: me.id, cycleId: cycle.id },
    }),
    db.achievement.findMany({
      where: { personId: me.id, cycleId: cycle.id, status: { in: ["EMPLOYEE_CONFIRMED", "MANAGER_CONFIRMED"] } },
    }),
  ]);

  const total = score?.totalScore ?? 0;
  const trend = livePulse?.delta24h ?? 0;
  const firstName = me.preferredName ?? me.fullName.split(" ")[0];

  // Build the 90-day timeline + event list
  const { points, events } = buildTimeline(
    {
      tasks: tasks.map((ta) => ({
        closedAt: ta.task.closedAt,
        qaScore: ta.task.qaScore,
        title: ta.task.title,
      })),
      feedback: feedback.map((f) => ({
        occurredAt: f.occurredAt,
        rating: f.rating,
        dimension: f.dimension,
      })),
      achievements: confirmedAchievements.map((a) => ({
        confirmedAt: a.confirmedAt,
        awardedPoints: a.awardedPoints,
        description: a.description,
      })),
    },
    total,
    new Date("2026-05-13"),
  );

  // Compose the ledger from the same raw events (full set, not just last 90)
  const ledger: LedgerEntry[] = [
    ...tasks.flatMap((ta) =>
      ta.task.closedAt
        ? [{
            date: ta.task.closedAt,
            kind: "task" as const,
            delta: ((ta.task.qaScore ?? 80) - 80) / 80,
            label: `${ta.task.title} · QA ${(ta.task.qaScore ?? 80).toFixed(0)}`,
          }]
        : [],
    ),
    ...feedback.map((f) => ({
      date: f.occurredAt,
      kind: "feedback" as const,
      delta: (f.rating - 3) * 0.25,
      label: `Peer rating · ${f.dimension.replace(/_/g, " ")} · ${f.rating}/5`,
    })),
    ...confirmedAchievements
      .filter((a) => a.confirmedAt)
      .map((a) => ({
        date: a.confirmedAt!,
        kind: "achievement" as const,
        delta: a.awardedPoints ?? 2,
        label: a.description,
      })),
  ];

  // Serialize Date → string for the client component
  const timelinePointsSer = points.map((p) => ({ date: p.date.toISOString(), value: p.value }));
  const timelineEventsSer = events.map((e) => ({ date: e.date.toISOString(), kind: e.kind, delta: e.delta, label: e.label }));

  const locale = await currentLocale();
  const dateStr = new Date("2026-05-15").toLocaleDateString(locale === "ar" ? "ar-SA" : "en-GB", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <AppShell me={me}>
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[13px] text-ink-500 mb-1">{dateStr} · {cycle.label}</div>
          <h1 className="font-display text-4xl text-ink-900">
            {t(locale, "dashboard.morning")}, {firstName}.
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {trend !== 0 && (
            <Chip tone={trend >= 0 ? "good" : "bad"}>
              <span className={`w-1.5 h-1.5 rounded-full ${trend >= 0 ? "bg-good-500" : "bg-bad-500"}`} />
              {trend >= 0 ? "+" : ""}{trend.toFixed(1)} {t(locale, "dashboard.todayDelta")}
            </Chip>
          )}
          <Link href="/inbox" className="btn-secondary">
            {pendingAchievements.length} {t(locale, "dashboard.pendingButton")}
          </Link>
        </div>
      </div>

      {/* Performance Timeline */}
      <div className="mb-6">
        <PerformanceTimeline
          points={timelinePointsSer}
          events={timelineEventsSer}
          cycleLabel={cycle.label}
          labels={{
            eyebrow: t(locale, "dashboard.timelineEyebrow"),
            title: t(locale, "dashboard.timelineTitle"),
            legendTask: t(locale, "dashboard.timelineLegend.task"),
            legendFeedback: t(locale, "dashboard.timelineLegend.feedback"),
            legendAchievement: t(locale, "dashboard.timelineLegend.achievement"),
          }}
        />
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-5 space-y-6">
          <Card className="p-7">
            <div className="flex items-baseline justify-between mb-4">
              <Eyebrow muted>{t(locale, "dashboard.pulseLabel")}</Eyebrow>
              <div className="text-[11px] text-ink-400 font-mono">
                {score?.calibrationConfidence ?? "—"}/100 {t(locale, "dashboard.confidenceSuffix")}
              </div>
            </div>
            <div className="flex justify-center my-2">
              <ScoreRing
                total={total}
                managerEval={score?.managerEval ?? 0}
                crossFunctional={score?.crossFunctionalEval ?? 0}
                selfAppraisal={score?.selfAppraisal ?? 0}
                achievement={score?.achievementPoints ?? 0}
                size={220}
              />
            </div>
            <div className="space-y-3.5 mt-5">
              <DimensionBar
                label={t(locale, "dashboard.dim.managerEval")}
                helper={t(locale, "dashboard.dim.managerEvalHelp")}
                value={score?.managerEval ?? null}
                max={30}
              />
              <DimensionBar
                label={t(locale, "dashboard.dim.crossFn")}
                helper={t(locale, "dashboard.dim.crossFnHelp")}
                value={score?.crossFunctionalEval ?? null}
                max={30}
              />
              <DimensionBar
                label={t(locale, "dashboard.dim.self")}
                helper={t(locale, "dashboard.dim.selfHelp")}
                value={score?.selfAppraisal ?? null}
                max={20}
              />
              <DimensionBar
                label={t(locale, "dashboard.dim.achievement")}
                helper={t(locale, "dashboard.dim.achievementHelp")}
                value={score?.achievementPoints ?? null}
                max={20}
              />
            </div>
          </Card>

          <div className="card p-5 bg-gold-50/60 border-gold-200">
            <div className="eyebrow mb-1">{t(locale, "dashboard.comingUp")}</div>
            <div className="font-display text-lg text-ink-900 mb-1.5">
              {t(locale, "dashboard.cycleOpensIn")}
            </div>
            <p className="text-[13px] text-ink-700 leading-relaxed mb-3">
              {t(locale, "dashboard.twinPrep")}
            </p>
            <Link href="/twin" className="text-[12px] text-gold-700 hover:text-gold-600 font-semibold">
              {t(locale, "dashboard.viewBrief")} →
            </Link>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7">
          <PulseLedger
            entries={ledger}
            labels={{
              eyebrow: t(locale, "dashboard.ledgerEyebrow"),
              title: t(locale, "dashboard.ledgerTitle"),
              subtitle: tFormat(t(locale, "dashboard.ledgerSubtitle"), { n: ledger.length }),
              kinds: {
                task: t(locale, "dashboard.timelineLegend.task"),
                feedback: t(locale, "dashboard.timelineLegend.feedback"),
                achievement: t(locale, "dashboard.timelineLegend.achievement"),
              },
            }}
            locale={locale}
          />
        </div>
      </div>
    </AppShell>
  );
}
