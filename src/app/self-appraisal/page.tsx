import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentPerson } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { Card, Chip, Eyebrow, PageHeader } from "@/components/ui";
import { scoreSelfAppraisal } from "@/lib/ai/self-appraisal";
import { hasApiKey } from "@/lib/ai/client";
import { currentLocale, t, tFormat } from "@/lib/i18n";

// Criterion metadata. Labels / helpers / prompts come from i18n at render time.
const CRITERIA = [
  { key: "personalGoalAchievement" as const, dictKey: "goal",       max: 6, icon: "🎯" },
  { key: "selfIdentifiedGrowth"    as const, dictKey: "growth",     max: 5, icon: "🔍" },
  { key: "careerDevelopment"       as const, dictKey: "career",     max: 5, icon: "🧭" },
  { key: "selfReflectionAccountability" as const, dictKey: "reflection", max: 4, icon: "⚖️" },
];

const MAX_TOTAL = CRITERIA.reduce((s, c) => s + c.max, 0); // = 20

async function submitSelfAppraisal(formData: FormData) {
  "use server";
  const me = await currentPerson();
  if (!me || me.role !== "employee") throw new Error("not authenticated");

  const cycle = await db.cycle.findFirst({
    where: { tenantId: me.tenantId, status: { in: ["OPEN", "CALIBRATION"] } },
    orderBy: { startsAt: "desc" },
  });
  if (!cycle) throw new Error("no active cycle");

  const answers = {
    personalGoalAchievement: (formData.get("personalGoalAchievement") as string)?.trim() ?? "",
    selfIdentifiedGrowth: (formData.get("selfIdentifiedGrowth") as string)?.trim() ?? "",
    careerDevelopment: (formData.get("careerDevelopment") as string)?.trim() ?? "",
    selfReflectionAccountability: (formData.get("selfReflectionAccountability") as string)?.trim() ?? "",
  };

  // Build Reflection Brief from PKG
  const [tasks, feedback, achievements] = await Promise.all([
    db.taskAssignment.findMany({
      where: { personId: me.id, task: { closedAt: { not: null } } },
      include: { task: true },
    }),
    db.feedbackEvent.findMany({ where: { ratedPersonId: me.id, cycleId: cycle.id } }),
    db.achievement.findMany({
      where: { personId: me.id, cycleId: cycle.id, status: { in: ["EMPLOYEE_CONFIRMED", "MANAGER_CONFIRMED"] } },
      orderBy: { proposedAt: "desc" },
      take: 5,
    }),
  ]);
  const avgQA = tasks.length ? tasks.reduce((sum: number, ta) => sum + (ta.task.qaScore ?? 0), 0) / tasks.length : 0;
  const missedDeadlines = tasks.filter((ta) => ta.task.deadlineMet === false).length;
  const positiveFB = feedback.filter((f) => f.rating >= 4).length;
  const criticalFB = feedback.filter((f) => f.rating === 2).length;
  const hostileFB = feedback.filter((f) => f.rating === 1).length;
  const brief = {
    cycleLabel: cycle.label,
    tasksClosed: tasks.length,
    averageQA: avgQA,
    missedDeadlines,
    topAchievements: achievements.map((a) => a.description),
    peerSummary: `${feedback.length} ratings — ${positiveFB} positive, ${criticalFB} critical, ${hostileFB} hostile.`,
  };

  let score = {
    personalGoalAchievement: { score: 0, rationale: "" },
    selfIdentifiedGrowth: { score: 0, rationale: "" },
    careerDevelopment: { score: 0, rationale: "" },
    selfReflectionAccountability: { score: 0, rationale: "" },
    selfAwarenessMultiplier: 0,
    twinNote: "",
  };
  let promptVersion = "manual-v1";

  if (hasApiKey()) {
    try {
      const result = await scoreSelfAppraisal({
        person: { name: me.fullName, jobTitle: me.jobTitle },
        brief,
        answers,
      });
      score = result.score;
      promptVersion = result.promptVersion;
    } catch (e) {
      // Fall back to length-based heuristic when AI is unavailable
      const lenScore = (text: string, max: number) => {
        const len = text.length;
        if (len < 80) return max * 0.4;
        if (len < 220) return max * 0.7;
        if (len < 500) return max * 0.85;
        return max * 0.95;
      };
      score = {
        personalGoalAchievement: { score: lenScore(answers.personalGoalAchievement, 6), rationale: "Length-based fallback (no AI key)." },
        selfIdentifiedGrowth: { score: lenScore(answers.selfIdentifiedGrowth, 5), rationale: "Length-based fallback." },
        careerDevelopment: { score: lenScore(answers.careerDevelopment, 5), rationale: "Length-based fallback." },
        selfReflectionAccountability: { score: lenScore(answers.selfReflectionAccountability, 4), rationale: "Length-based fallback." },
        selfAwarenessMultiplier: 0.5,
        twinNote: `Submission received. AI scoring unavailable: ${e instanceof Error ? e.message : "unknown"}.`,
      };
    }
  }

  const total =
    score.personalGoalAchievement.score +
    score.selfIdentifiedGrowth.score +
    score.careerDevelopment.score +
    score.selfReflectionAccountability.score;

  // Save SelfAppraisal record
  await db.selfAppraisal.upsert({
    where: { id: `${cycle.id}__${me.id}` },
    create: {
      id: `${cycle.id}__${me.id}`,
      cycleId: cycle.id,
      personId: me.id,
      language: me.preferredLang,
      transcriptRef: "",
      scoredCriteria: JSON.stringify({ answers, score, promptVersion, total }),
      selfAwarenessMult: score.selfAwarenessMultiplier,
      reflectionBriefRef: "",
      completedAt: new Date(),
    },
    update: {
      scoredCriteria: JSON.stringify({ answers, score, promptVersion, total }),
      selfAwarenessMult: score.selfAwarenessMultiplier,
      completedAt: new Date(),
    },
  });

  // Update Cycle Score
  await db.cycleScore.update({
    where: { cycleId_personId: { cycleId: cycle.id, personId: me.id } },
    data: {
      selfAppraisal: Math.round(total * 10) / 10,
      selfAwarenessMultiplier: score.selfAwarenessMultiplier,
      computedAt: new Date(),
    },
  });

  await db.auditEntry.create({
    data: {
      tenantId: me.tenantId, actorId: me.id, actorRole: me.role,
      action: "SELF_APPRAISAL_SUBMITTED", subjectKind: "self_appraisal", subjectId: me.id,
    },
  });

  revalidatePath("/self-appraisal");
  revalidatePath("/dashboard");
}

export default async function SelfAppraisalPage() {
  const me = await currentPerson();
  if (!me) redirect("/");
  if (me.role !== "employee") redirect("/");

  const cycle = await db.cycle.findFirst({
    where: { tenantId: me.tenantId, status: { in: ["OPEN", "CALIBRATION"] } },
    orderBy: { startsAt: "desc" },
  });
  if (!cycle) return <AppShell me={me}><Card>No active cycle.</Card></AppShell>;

  const [existing, tasks, feedback, confirmedAchievements] = await Promise.all([
    db.selfAppraisal.findUnique({ where: { id: `${cycle.id}__${me.id}` } }),
    db.taskAssignment.findMany({
      where: { personId: me.id, task: { closedAt: { not: null } } },
      include: { task: true },
    }),
    db.feedbackEvent.findMany({ where: { ratedPersonId: me.id, cycleId: cycle.id } }),
    db.achievement.findMany({
      where: { personId: me.id, cycleId: cycle.id, status: { in: ["EMPLOYEE_CONFIRMED", "MANAGER_CONFIRMED"] } },
      orderBy: { proposedAt: "desc" },
      take: 5,
    }),
  ]);

  const avgQA = tasks.length ? tasks.reduce((sum: number, ta) => sum + (ta.task.qaScore ?? 0), 0) / tasks.length : 0;
  const missedDeadlines = tasks.filter((ta) => ta.task.deadlineMet === false).length;
  const positiveFB = feedback.filter((f) => f.rating >= 4).length;

  // Hydrate prior submission
  let priorAnswers: Record<string, string> = {};
  let priorScore: { score?: number; rationale?: string }[] | null = null;
  let priorTotal = 0;
  let priorMultiplier = 0;
  let priorNote = "";
  if (existing) {
    try {
      const parsed = JSON.parse(existing.scoredCriteria);
      priorAnswers = parsed.answers ?? {};
      const s = parsed.score;
      if (s) {
        priorScore = [s.personalGoalAchievement, s.selfIdentifiedGrowth, s.careerDevelopment, s.selfReflectionAccountability];
        priorMultiplier = s.selfAwarenessMultiplier ?? 0;
        priorNote = s.twinNote ?? "";
      }
      priorTotal = parsed.total ?? 0;
    } catch { /* empty */ }
  }

  const locale = await currentLocale();

  return (
    <AppShell me={me}>
      <PageHeader
        eyebrow={tFormat(t(locale, "selfAppraisal.eyebrow"), { cycle: cycle.label })}
        title={t(locale, "selfAppraisal.title")}
        subtitle={t(locale, "selfAppraisal.subtitle")}
      />

      {existing && (
        <div className="card p-5 mb-6 bg-good-50/60 border-good-500/30">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-good-100 flex items-center justify-center text-good-700 flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div className="flex-1">
              <div className="flex items-baseline justify-between gap-4 mb-1">
                <div className="font-display text-lg text-ink-900">
                  {t(locale, "selfAppraisal.submittedTitle")} · {priorTotal.toFixed(1)} / 20
                </div>
                <div className="text-[12px] text-ink-500">+{priorMultiplier.toFixed(1)} {t(locale, "selfAppraisal.multiplierLabel")}</div>
              </div>
              {priorNote && <p className="text-[13px] text-ink-700 leading-relaxed italic">&ldquo;{priorNote}&rdquo;</p>}
              <div className="text-[11px] text-ink-400 mt-2">{t(locale, "selfAppraisal.editNote")}</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4">
          <div className="sticky top-20 space-y-4">
            <Card>
              <Eyebrow muted>{t(locale, "selfAppraisal.briefEyebrow")}</Eyebrow>
              <div className="font-display text-lg text-ink-900 mt-1 mb-4">{t(locale, "selfAppraisal.briefTitle")}</div>

              <div className="space-y-4">
                <Stat
                  label={t(locale, "selfAppraisal.tasksClosedLabel")}
                  value={tasks.length.toString()}
                  helper={tFormat(t(locale, "selfAppraisal.tasksClosedHelp"), { qa: avgQA.toFixed(0), missed: missedDeadlines })}
                />
                <div className="border-t border-soft" />
                <Stat
                  label={t(locale, "selfAppraisal.peerSignalsLabel")}
                  value={feedback.length.toString()}
                  helper={tFormat(t(locale, "selfAppraisal.peerSignalsHelp"), { positive: positiveFB, other: feedback.length - positiveFB })}
                />
                <div className="border-t border-soft" />
                <div>
                  <Eyebrow muted className="mb-2 !text-[10px]">{t(locale, "selfAppraisal.topAchievements")}</Eyebrow>
                  <ol className="space-y-1.5">
                    {confirmedAchievements.length === 0 ? (
                      <li className="text-[12px] text-ink-400 italic">{t(locale, "selfAppraisal.noAchievements")}</li>
                    ) : (
                      confirmedAchievements.slice(0, 3).map((a, i) => (
                        <li key={a.id} className="text-[12px] text-ink-700 leading-snug flex gap-2">
                          <span className="text-gold-700 font-mono">{i + 1}</span>
                          <span>{a.description}</span>
                        </li>
                      ))
                    )}
                  </ol>
                </div>
              </div>
            </Card>

            <Card className="bg-gold-50/40 border-gold-200">
              <Eyebrow className="mb-1">{t(locale, "selfAppraisal.honestyTitle")}</Eyebrow>
              <p className="text-[12px] text-ink-700 leading-relaxed">
                {t(locale, "selfAppraisal.honestyBody")}
              </p>
            </Card>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8">
          <form action={submitSelfAppraisal} className="space-y-5">
            {CRITERIA.map((c, idx) => {
              const prior = priorScore?.[idx];
              const label = t(locale, `selfAppraisal.criteria.${c.dictKey}.label` as never);
              const helper = t(locale, `selfAppraisal.criteria.${c.dictKey}.helper` as never);
              const prompt = t(locale, `selfAppraisal.criteria.${c.dictKey}.prompt` as never);
              return (
                <Card key={c.key} className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-gold-50 border border-gold-200 flex items-center justify-center text-2xl flex-shrink-0">
                      {c.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <h3 className="font-display text-lg text-ink-900">{label}</h3>
                        <div className="flex items-center gap-2">
                          {prior && (
                            <Chip tone="gold">
                              {prior.score?.toFixed(1)} / {c.max}
                            </Chip>
                          )}
                          <span className="text-[11px] font-mono text-ink-400">{t(locale, "selfAppraisal.max")} {c.max}</span>
                        </div>
                      </div>
                      <div className="text-[12px] text-ink-500 leading-relaxed">{helper}</div>
                    </div>
                  </div>
                  <div className="text-[13px] text-ink-700 italic leading-relaxed mb-3">
                    &ldquo;{prompt}&rdquo;
                  </div>
                  <textarea
                    name={c.key}
                    defaultValue={priorAnswers[c.key] ?? ""}
                    rows={5}
                    className="w-full bg-surface-50 border border-soft rounded-md p-3 text-[14px] text-ink-900 placeholder-ink-400 leading-relaxed focus:bg-white focus:border-gold-500 transition"
                    placeholder={t(locale, "selfAppraisal.placeholder")}
                  />
                  {prior?.rationale && (
                    <div className="mt-3 px-3 py-2 rounded-md bg-ink-50 border-l-2 border-gold-500">
                      <div className="text-[10px] uppercase tracking-wider text-gold-700 font-semibold mb-1">{t(locale, "selfAppraisal.twinRationale")}</div>
                      <div className="text-[12px] text-ink-700 italic">{prior.rationale}</div>
                    </div>
                  )}
                </Card>
              );
            })}

            <div className="card p-5 flex items-center justify-between gap-4">
              <div className="text-[12px] text-ink-600">
                {t(locale, "selfAppraisal.pointsRange")} <span className="font-semibold text-ink-900">{MAX_TOTAL}</span> {t(locale, "selfAppraisal.pointsAcross")}
                + <span className="font-semibold text-gold-700">2</span> {t(locale, "selfAppraisal.bonus")}
              </div>
              <button type="submit" className="btn-primary">
                {existing ? t(locale, "selfAppraisal.updateButton") : t(locale, "selfAppraisal.submitButton")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div>
      <div className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold">{label}</div>
      <div className="font-mono text-2xl text-ink-900 font-light mt-0.5">{value}</div>
      {helper && <div className="text-[11px] text-ink-400 mt-0.5">{helper}</div>}
    </div>
  );
}
