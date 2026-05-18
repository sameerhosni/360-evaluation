import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { currentPerson } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { Avatar, Card, Eyebrow } from "@/components/ui";
import { AdvocateBriefCard } from "@/components/advocate-brief";
import { CalibrationCriterion } from "@/components/calibration-criterion";
import { generateAdvocateBrief, type TwinPKGSlice } from "@/lib/ai/twin";
import { currentLocale, t } from "@/lib/i18n";
import { hasApiKey } from "@/lib/ai/client";
import type { AdvocateBrief } from "@/lib/ai/schemas";

const CRITERIA: Array<{ key: string; max: number }> = [
  { key: "task_completion_quality", max: 8 },
  { key: "technical_competency",    max: 7 },
  { key: "deadline_adherence",      max: 6 },
  { key: "output_excellence",       max: 5 },
  { key: "role_specific",           max: 4 },
];

function computeAnchors(args: {
  totalManagerEval: number;
  taskCount: number;
  avgQA: number;
  missedDeadlines: number;
}): Record<string, number> {
  const { totalManagerEval, avgQA, missedDeadlines, taskCount } = args;
  const qaNorm = Math.max(0, Math.min(1, (avgQA - 70) / 25));
  const deadlineRate = taskCount > 0 ? 1 - missedDeadlines / taskCount : 0.8;
  const raw = {
    task_completion_quality: 8 * qaNorm,
    technical_competency: 7 * 0.75,
    deadline_adherence: 6 * deadlineRate,
    output_excellence: 5 * qaNorm * 0.9,
    role_specific: 4 * 0.8,
  };
  const total = Object.values(raw).reduce((s, x) => s + x, 0);
  const scale = totalManagerEval / Math.max(1, total);
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, round1(v * scale)]),
  );
}
const round1 = (n: number) => Math.round(n * 10) / 10;

export default async function CalibrationSheet({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = await params;
  const me = await currentPerson();
  if (!me) redirect("/");
  if (me.role !== "manager") redirect("/");

  const subject = await db.person.findUnique({ where: { id: personId } });
  if (!subject || subject.managerId !== me.id) notFound();

  const cycle = await db.cycle.findFirst({
    where: { tenantId: me.tenantId, status: { in: ["OPEN", "CALIBRATION"] } },
    orderBy: { startsAt: "desc" },
  });
  if (!cycle) return <AppShell me={me}><Card>No active cycle.</Card></AppShell>;

  const [score, achievements, feedback, tasks, justifications, existingBrief] = await Promise.all([
    db.cycleScore.findUnique({ where: { cycleId_personId: { cycleId: cycle.id, personId } } }),
    db.achievement.findMany({
      where: { personId, cycleId: cycle.id, status: { in: ["EMPLOYEE_CONFIRMED", "MANAGER_CONFIRMED"] } },
    }),
    db.feedbackEvent.findMany({ where: { ratedPersonId: personId, cycleId: cycle.id } }),
    db.task.findMany({
      where: {
        closedAt: { not: null },
        assignments: { some: { personId, roleOnTask: "owner" } },
      },
    }),
    db.managerJustification.findMany({
      where: { cycleId: cycle.id, personId, managerId: me.id },
    }),
    db.twinAdvocateBrief.findUnique({ where: { cycleId_personId: { cycleId: cycle.id, personId } } }),
  ]);

  const avgQA = tasks.length ? tasks.reduce((s, t) => s + (t.qaScore ?? 0), 0) / tasks.length : 0;
  const missedDeadlines = tasks.filter((t) => t.deadlineMet === false).length;

  const anchors = computeAnchors({
    totalManagerEval: score?.managerEval ?? 20,
    taskCount: tasks.length,
    avgQA,
    missedDeadlines,
  });

  const justByCriterion = new Map(justifications.map((j) => [j.criterion, j]));

  // Twin Advocate Brief — cached, or generate
  let brief: AdvocateBrief | null = null;
  let briefError: string | null = null;
  let briefVersion: string | undefined;

  if (existingBrief) {
    try {
      brief = {
        topAchievements: JSON.parse(existingBrief.topAchievements),
        peerSummary: existingBrief.peerSummary,
        growthSignals: JSON.parse(existingBrief.growthSignals),
        counterEvidence: JSON.parse(existingBrief.flagged),
      };
      briefVersion = existingBrief.promptVersion;
    } catch { brief = null; }
  }

  if (!brief && hasApiKey() && score) {
    const positiveFB = feedback.filter((f) => f.rating >= 4).length;
    const criticalFB = feedback.filter((f) => f.rating === 2).length;
    const hostileFB = feedback.filter((f) => f.rating === 1).length;
    const dimensions = ["team_spirit", "responsiveness", "professionalism", "cross_dept_support"];
    const byDimension = await Promise.all(
      dimensions.map(async (dim) => {
        const subjectAvg = average(feedback.filter((f) => f.dimension === dim).map((f) => f.rating));
        const deptFeedback = await db.feedbackEvent.findMany({
          where: { cycleId: cycle.id, dimension: dim, rated: { department: subject.department } },
          select: { rating: true },
        });
        const deptAvg = average(deptFeedback.map((f) => f.rating));
        return { dimension: dim, averageRating: subjectAvg, departmentAverage: deptAvg };
      }),
    );

    const slice: TwinPKGSlice = {
      person: {
        name: subject.fullName, jobTitle: subject.jobTitle,
        department: subject.department, cycleLabel: cycle.label,
      },
      achievements: achievements.map((a) => {
        let ev = "";
        try {
          const items = JSON.parse(a.evidenceEvents) as Array<{ summary: string }>;
          ev = items.map((i) => i.summary).join("; ");
        } catch { ev = ""; }
        return {
          category: a.category,
          points: a.awardedPoints ?? a.proposedPoints,
          description: a.description, evidence: ev,
        };
      }),
      peerFeedback: {
        totalCount: feedback.length, positiveCount: positiveFB,
        criticalCount: criticalFB, hostileCount: hostileFB, byDimension,
      },
      taskMetrics: { closedTasks: tasks.length, averageQA: avgQA, missedDeadlines },
      managerDraft: Object.fromEntries(
        CRITERIA.map((c) => {
          const j = justByCriterion.get(c.key);
          return [c.key, { systemAnchor: anchors[c.key], managerScore: j?.managerScore ?? anchors[c.key] }];
        }),
      ),
    };

    try {
      const result = await generateAdvocateBrief(slice);
      brief = result.brief;
      briefVersion = result.promptVersion;
      await db.twinAdvocateBrief.upsert({
        where: { cycleId_personId: { cycleId: cycle.id, personId } },
        create: {
          cycleId: cycle.id, personId,
          topAchievements: JSON.stringify(brief.topAchievements),
          peerSummary: brief.peerSummary,
          growthSignals: JSON.stringify(brief.growthSignals),
          flagged: JSON.stringify(brief.counterEvidence),
          promptVersion: result.promptVersion,
        },
        update: {
          topAchievements: JSON.stringify(brief.topAchievements),
          peerSummary: brief.peerSummary,
          growthSignals: JSON.stringify(brief.growthSignals),
          flagged: JSON.stringify(brief.counterEvidence),
          promptVersion: result.promptVersion,
          generatedAt: new Date(),
        },
      });
      await db.auditEntry.create({
        data: {
          tenantId: me.tenantId, actorId: me.id, actorRole: me.role,
          action: "GENERATE_TWIN_BRIEF", subjectKind: "person", subjectId: personId,
        },
      });
    } catch (e) {
      briefError = e instanceof Error ? e.message : String(e);
    }
  }

  const conf = score?.calibrationConfidence ?? null;
  const confTone =
    conf == null ? "default" : conf >= 80 ? "good" : conf >= 65 ? "warn" : "bad";

  const locale = await currentLocale();

  return (
    <AppShell me={me}>
      <div className="mb-4">
        <Link href="/cockpit" className="text-[13px] text-ink-500 hover:text-ink-900 inline-flex items-center gap-1">
          ← {t(locale, "calibration.backToCockpit")}
        </Link>
      </div>

      {/* Subject header */}
      <Card className="mb-6 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-5">
            <Avatar name={subject.fullName} role="employee" size={64} />
            <div>
              <h1 className="font-display text-3xl text-ink-900">{subject.fullName}</h1>
              <div className="text-[13px] text-ink-500">
                {subject.jobTitle} · {subject.department} · {cycle.label}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-end">
              <Eyebrow muted>{t(locale, "calibration.pulseLabel")}</Eyebrow>
              <div className="font-display text-3xl text-ink-900">
                {score?.totalScore.toFixed(1) ?? "—"}
              </div>
            </div>
            <div className="text-end">
              <Eyebrow muted>{t(locale, "calibration.confidenceLabel")}</Eyebrow>
              <div className={`font-mono text-2xl font-semibold ${
                confTone === "good" ? "text-good-700" :
                confTone === "warn" ? "text-warn-700" :
                confTone === "bad"  ? "text-bad-700"  : "text-ink-500"
              }`}>
                {conf ?? "—"}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7">
          <Card className="p-6">
            <div className="mb-6">
              <Eyebrow>{t(locale, "calibration.managerEvalEyebrow")}</Eyebrow>
              <div className="flex items-baseline justify-between mt-1">
                <h2 className="font-display text-2xl text-ink-900">
                  {score?.managerEval.toFixed(1) ?? "—"}
                  <span className="text-ink-400 text-base font-sans"> / 30</span>
                </h2>
                <div className="text-[11px] text-ink-500 uppercase tracking-wider">
                  {t(locale, "calibration.criteriaNote")}
                </div>
              </div>
              <p className="text-[13px] text-ink-500 mt-2 max-w-xl">
                {t(locale, "calibration.adjustHelper")}
              </p>
            </div>

            <form action="/api/calibration/save" method="POST" className="space-y-6">
              <input type="hidden" name="personId" value={personId} />
              <input type="hidden" name="cycleId" value={cycle.id} />
              {CRITERIA.map((c) => {
                const anchor = anchors[c.key];
                const current = justByCriterion.get(c.key)?.managerScore ?? anchor;
                const label = t(locale, `calibration.criteria.${c.key}.label` as never);
                const helper = t(locale, `calibration.criteria.${c.key}.helper` as never);
                return (
                  <CalibrationCriterion
                    key={c.key}
                    criterionKey={c.key}
                    label={label}
                    helper={helper}
                    max={c.max}
                    anchor={anchor}
                    initialValue={current}
                    initialJustification={justByCriterion.get(c.key)?.justification ?? ""}
                    labels={{
                      system: t(locale, "calibration.system"),
                      you: t(locale, "calibration.you"),
                      rate: t(locale, "calibration.rate"),
                      justificationRequired: t(locale, "calibration.justificationRequired"),
                      justificationPlaceholder: t(locale, "calibration.justificationPlaceholder"),
                      ptVsSystem: t(locale, "calibration.ptVsSystem"),
                    }}
                  />
                );
              })}

              <div className="pt-5 border-t border-soft flex items-center justify-between">
                <button type="submit" name="action" value="save" className="btn-ghost">
                  {t(locale, "calibration.saveDraft")}
                </button>
                <button type="submit" name="action" value="lock" className="btn-primary">
                  {t(locale, "calibration.lockButton")}
                </button>
              </div>
            </form>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-5 space-y-4">
          {brief ? (
            <AdvocateBriefCard
              brief={brief}
              promptVersion={briefVersion}
              labels={{
                onBehalf: t(locale, "twin.briefOnBehalf"),
                title: t(locale, "twin.briefHeader"),
                topAchievements: t(locale, "twin.briefTopAchievements"),
                peerSummary: t(locale, "twin.briefPeerSummary"),
                growthSignals: t(locale, "twin.briefGrowthSignals"),
                counterEvidence: t(locale, "twin.briefCounterEvidence"),
                pt: t(locale, "common.pt"),
              }}
            />
          ) : briefError ? (
            <Card className="bg-bad-50 border-bad-500/30">
              <Eyebrow className="!text-bad-700 mb-2">{t(locale, "calibration.twinUnavailable")}</Eyebrow>
              <div className="text-[13px] text-ink-800 mb-2">{briefError}</div>
              <div className="text-[11px] text-ink-500">
                Calibration falls back to the system-computed anchors. Set <code className="font-mono">ANTHROPIC_API_KEY</code> to enable Twin generation.
              </div>
            </Card>
          ) : !hasApiKey() ? (
            <Card className="bg-gold-50 border-gold-200">
              <Eyebrow className="mb-2">{t(locale, "twin.briefHeader")}</Eyebrow>
              <h3 className="font-display text-lg text-ink-900 mb-2">{t(locale, "calibration.twinDisabled")}</h3>
              <p className="text-[13px] text-ink-700 leading-relaxed mb-3">
                {t(locale, "calibration.twinDisabledBody")}
              </p>
              <p className="text-[12px] text-ink-500">
                {t(locale, "calibration.twinDisabledHelp")}
              </p>
            </Card>
          ) : (
            <Card>
              <div className="text-center py-10">
                <div className="text-[14px] text-ink-500">{t(locale, "calibration.generatingBrief")}</div>
              </div>
            </Card>
          )}

          <Card>
            <Eyebrow muted>{t(locale, "calibration.priorCycle")}</Eyebrow>
            <div className="font-display text-2xl text-ink-400 mt-1">—</div>
            <div className="text-[11px] text-ink-400 mt-1">{t(locale, "calibration.priorCycleNote")}</div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function average(xs: number[]) {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}
