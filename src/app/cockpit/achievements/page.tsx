import { redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentPerson } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { Avatar, Card, Chip, Eyebrow, PageHeader } from "@/components/ui";
import { currentLocale, t, tFormat, tNode } from "@/lib/i18n";

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

async function approveAchievement(formData: FormData) {
  "use server";
  const me = await currentPerson();
  if (!me || me.role !== "manager") throw new Error("not authorized");
  const id = formData.get("id") as string;
  const pointsRaw = formData.get("awardedPoints") as string;
  let points = parseInt(pointsRaw, 10);
  if (!Number.isFinite(points)) points = 0;
  points = Math.max(1, Math.min(5, points));

  const achievement = await db.achievement.findUnique({ where: { id } });
  if (!achievement) throw new Error("not found");
  // Verify the achievement is for one of THIS manager's directs
  const subject = await db.person.findUnique({ where: { id: achievement.personId } });
  if (!subject || subject.managerId !== me.id) throw new Error("not authorized for this achievement");

  await db.achievement.update({
    where: { id },
    data: {
      status: "MANAGER_CONFIRMED",
      awardedPoints: points,
      confirmedAt: new Date(),
      managerId: me.id,
    },
  });

  // Recompute achievementPoints on the CycleScore — sum of awardedPoints, capped at 20
  const allConfirmed = await db.achievement.findMany({
    where: { personId: achievement.personId, cycleId: achievement.cycleId, status: "MANAGER_CONFIRMED" },
  });
  const totalAch = Math.min(20, allConfirmed.reduce((s, a) => s + (a.awardedPoints ?? 0), 0));
  await db.cycleScore.update({
    where: { cycleId_personId: { cycleId: achievement.cycleId, personId: achievement.personId } },
    data: { achievementPoints: totalAch, computedAt: new Date() },
  });

  await db.auditEntry.create({
    data: {
      tenantId: me.tenantId, actorId: me.id, actorRole: me.role,
      action: "ACHIEVEMENT_APPROVED", subjectKind: "achievement", subjectId: id,
      context: JSON.stringify({ awardedPoints: points }),
    },
  });

  revalidatePath("/cockpit/achievements");
  revalidatePath(`/cockpit/${achievement.personId}`);
}

async function rejectAchievement(formData: FormData) {
  "use server";
  const me = await currentPerson();
  if (!me || me.role !== "manager") throw new Error("not authorized");
  const id = formData.get("id") as string;
  const achievement = await db.achievement.findUnique({ where: { id } });
  if (!achievement) throw new Error("not found");
  const subject = await db.person.findUnique({ where: { id: achievement.personId } });
  if (!subject || subject.managerId !== me.id) throw new Error("not authorized");

  await db.achievement.update({ where: { id }, data: { status: "REJECTED", managerId: me.id } });
  await db.auditEntry.create({
    data: {
      tenantId: me.tenantId, actorId: me.id, actorRole: me.role,
      action: "ACHIEVEMENT_REJECTED", subjectKind: "achievement", subjectId: id,
    },
  });

  revalidatePath("/cockpit/achievements");
}

export default async function CockpitAchievements() {
  const me = await currentPerson();
  if (!me) redirect("/");
  if (me.role !== "manager") redirect("/");

  const cycle = await db.cycle.findFirst({
    where: { tenantId: me.tenantId, status: { in: ["OPEN", "CALIBRATION"] } },
    orderBy: { startsAt: "desc" },
  });
  if (!cycle) return <AppShell me={me}><Card>No active cycle.</Card></AppShell>;

  const directs = await db.person.findMany({ where: { managerId: me.id } });
  const directIds = directs.map((d) => d.id);

  // Achievements employees have confirmed (EMPLOYEE_CONFIRMED) need MANAGER review
  const pending = await db.achievement.findMany({
    where: {
      personId: { in: directIds },
      cycleId: cycle.id,
      status: "EMPLOYEE_CONFIRMED",
    },
    orderBy: { confirmedAt: "asc" },
  });

  // Also surface pending PROPOSED (AI-detected) where employee hasn't acted —
  // managers can pre-approve, or wait for the employee.
  const proposed = await db.achievement.findMany({
    where: {
      personId: { in: directIds },
      cycleId: cycle.id,
      status: "PROPOSED",
    },
    orderBy: { proposedAt: "desc" },
  });

  // Recently approved (for context)
  const recent = await db.achievement.findMany({
    where: {
      personId: { in: directIds },
      cycleId: cycle.id,
      status: "MANAGER_CONFIRMED",
    },
    orderBy: { confirmedAt: "desc" },
    take: 6,
  });

  const personById = new Map(directs.map((d) => [d.id, d]));
  const locale = await currentLocale();
  const categoryMap = (tNode(locale, "inbox.categoryLabels") as Record<string, string>) ?? FALLBACK_CATEGORY;
  const sourceMap = (tNode(locale, "inbox.sourceLabels") as Record<string, string>) ?? FALLBACK_SOURCE;
  const localCategory = (k: string) => categoryMap[k] ?? FALLBACK_CATEGORY[k] ?? k;
  const localSource = (k: string) => sourceMap[k] ?? FALLBACK_SOURCE[k] ?? k;

  return (
    <AppShell me={me}>
      <PageHeader
        eyebrow={tFormat(t(locale, "achievementsQueue.eyebrow"), { cycle: cycle.label })}
        title={t(locale, "achievementsQueue.title")}
        subtitle={t(locale, "achievementsQueue.subtitle")}
        actions={
          <Link href="/cockpit" className="btn-secondary">{t(locale, "achievementsQueue.backToCockpit")}</Link>
        }
      />

      <div className="card mb-6 p-4 flex items-center gap-4 text-[12px]">
        <Tab label={t(locale, "achievementsQueue.tabAwaiting")} count={pending.length} tone="warn" active />
        <Tab label={t(locale, "achievementsQueue.tabAi")} count={proposed.length} tone="default" />
        <Tab label={t(locale, "achievementsQueue.tabApproved")} count={recent.length} tone="good" />
      </div>

      {pending.length === 0 && proposed.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <div className="text-[15px] text-ink-700 mb-1">{t(locale, "achievementsQueue.emptyTitle")}</div>
            <div className="text-[13px] text-ink-400">{t(locale, "achievementsQueue.emptyHelper")}</div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4 mb-12">
          {pending.map((a) => {
            const person = personById.get(a.personId);
            if (!person) return null;
            const evidence: EvidenceItem[] = safeJson(a.evidenceEvents, []);
            return (
              <Card key={a.id} className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <Avatar name={person.fullName} role="employee" size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <div className="text-[14px] text-ink-900 font-semibold">{person.fullName}</div>
                      <span className="text-[11px] text-ink-400">·</span>
                      <span className="text-[12px] text-ink-500">{person.jobTitle}</span>
                    </div>
                    <div className="text-[15px] text-ink-900 font-medium leading-snug mt-1">
                      {a.description}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Chip tone="gold">{localCategory(a.category)}</Chip>
                      <Chip>{localSource(a.source)}</Chip>
                      <span className="text-[11px] text-ink-500">
                        {t(locale, "achievementsQueue.proposed")} <span className="font-semibold text-ink-800">{a.proposedPoints} {t(locale, "common.pt")}</span>
                      </span>
                      <span className="text-ink-300">·</span>
                      <span className="text-[11px] text-ink-500">
                        {t(locale, "achievementsQueue.twinConfidence")} <span className="font-semibold text-ink-800">{Math.round(a.twinConfidence * 100)}%</span>
                      </span>
                      <span className="text-ink-300">·</span>
                      <span className="text-[11px] text-ink-500">
                        {t(locale, "achievementsQueue.employeeConfirmed")} {a.confirmedAt ? relativeTime(a.confirmedAt, locale) : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {evidence.length > 0 && (
                  <div className="border-t border-soft pt-4 mb-4">
                    <Eyebrow muted className="mb-2">{t(locale, "inbox.evidenceTitle")} ({evidence.length})</Eyebrow>
                    <ul className="space-y-1.5">
                      {evidence.map((e, i) => (
                        <li key={i} className="flex items-start gap-3 text-[13px]">
                          <Chip className="!text-[10px] !py-0.5 mt-0.5">{e.kind}</Chip>
                          <div className="flex-1">
                            {e.id && <span className="font-mono text-[11px] text-ink-500 me-2">{e.id}</span>}
                            <span className="text-ink-700">{e.summary}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="border-t border-soft pt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <label className="text-[12px] text-ink-700 font-medium">{t(locale, "achievementsQueue.awardPoints")}</label>
                    <form action={approveAchievement} className="flex items-center gap-2" id={`approve-${a.id}`}>
                      <input type="hidden" name="id" value={a.id} />
                      <input
                        type="number"
                        name="awardedPoints"
                        defaultValue={a.proposedPoints}
                        min={1}
                        max={5}
                        className="w-16 bg-white border border-soft rounded-md px-3 py-1.5 text-[13px] font-mono font-semibold text-ink-900"
                      />
                      <span className="text-[11px] text-ink-400">{t(locale, "achievementsQueue.pointsRange")}</span>
                    </form>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={rejectAchievement}>
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" className="btn-ghost text-bad-700">{t(locale, "achievementsQueue.reject")}</button>
                    </form>
                    <button type="submit" form={`approve-${a.id}`} className="btn-primary">
                      {t(locale, "achievementsQueue.approve")}
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}

          {proposed.length > 0 && (
            <div className="mt-10">
              <Eyebrow muted className="mb-3">{t(locale, "achievementsQueue.aiPendingHeading")}</Eyebrow>
              <div className="space-y-2">
                {proposed.map((a) => {
                  const person = personById.get(a.personId);
                  if (!person) return null;
                  return (
                    <div key={a.id} className="card p-4 flex items-center gap-3">
                      <Avatar name={person.fullName} role="employee" size={36} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-ink-900 font-medium leading-snug">{a.description}</div>
                        <div className="text-[11px] text-ink-500 mt-1">
                          {person.fullName} · {localCategory(a.category)} · {a.proposedPoints} {t(locale, "common.pt")} {t(locale, "achievementsQueue.proposed").toLowerCase()}
                        </div>
                      </div>
                      <Chip>{t(locale, "achievementsQueue.awaitingEmployee")}</Chip>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {recent.length > 0 && (
        <div className="mt-10">
          <h2 className="font-display text-xl text-ink-900 mb-3">{t(locale, "achievementsQueue.recentlyApproved")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recent.map((a) => {
              const person = personById.get(a.personId);
              if (!person) return null;
              return (
                <div key={a.id} className="card p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-md bg-good-50 border border-good-100 flex items-center justify-center text-good-700 flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-ink-800 font-medium leading-snug">{a.description}</div>
                    <div className="text-[11px] text-ink-500 mt-1">
                      {person.fullName} · {a.awardedPoints ?? a.proposedPoints} {t(locale, "common.pt")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Tab({ label, count, tone, active }: { label: string; count: number; tone: "good" | "warn" | "bad" | "default"; active?: boolean }) {
  const color =
    tone === "warn" ? "text-warn-700" :
    tone === "good" ? "text-good-700" :
    tone === "bad"  ? "text-bad-700"  : "text-ink-700";
  return (
    <div className={`flex items-center gap-2 ${active ? "" : "opacity-70"}`}>
      <span className={`font-mono text-[16px] font-semibold ${color}`}>{count}</span>
      <span className="text-ink-700">{label}</span>
    </div>
  );
}

function safeJson<T>(s: string, fallback: T): T {
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

function relativeTime(d: Date, locale: "en" | "ar" = "en") {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (locale === "ar") {
    if (diff < 3600) return `قبل ${Math.floor(diff / 60)} د`;
    if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} س`;
    return `قبل ${Math.floor(diff / 86400)} يوم`;
  }
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
