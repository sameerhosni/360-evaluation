import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentPerson } from "@/lib/session";

const CRITERIA: Array<{ key: string; label: string; max: number }> = [
  { key: "task_completion_quality", label: "Task Completion Quality", max: 8 },
  { key: "technical_competency",    label: "Technical Competency",    max: 7 },
  { key: "deadline_adherence",      label: "Deadline Adherence",      max: 6 },
  { key: "output_excellence",       label: "Output Excellence",       max: 5 },
  { key: "role_specific",           label: "Role-Specific",           max: 4 },
];

// Same anchor computation as the page — kept inline for now since the
// computation is intentionally simple. Real product moves this to the
// discrepancy-detector worker that recomputes on every score-impacting event.
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
    Object.entries(raw).map(([k, v]) => [k, Math.round(v * scale * 10) / 10]),
  );
}

export async function POST(req: NextRequest) {
  const me = await currentPerson();
  if (!me || me.role !== "manager") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const form = await req.formData();
  const personId = form.get("personId") as string;
  const cycleId = form.get("cycleId") as string;
  const action = (form.get("action") as string) ?? "save";

  const subject = await db.person.findUnique({ where: { id: personId } });
  if (!subject || subject.managerId !== me.id) {
    return NextResponse.redirect(new URL("/cockpit", req.url));
  }

  const cycle = await db.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle) {
    return NextResponse.redirect(new URL("/cockpit", req.url));
  }

  const score = await db.cycleScore.findUnique({
    where: { cycleId_personId: { cycleId, personId } },
  });
  if (!score) {
    return NextResponse.redirect(new URL("/cockpit", req.url));
  }

  // Recompute anchors so we have system-vs-manager delta for justifications
  const tasks = await db.task.findMany({
    where: {
      closedAt: { not: null },
      assignments: { some: { personId, roleOnTask: "owner" } },
    },
  });
  const avgQA = tasks.length ? tasks.reduce((s, t) => s + (t.qaScore ?? 0), 0) / tasks.length : 0;
  const missedDeadlines = tasks.filter((t) => t.deadlineMet === false).length;
  const anchors = computeAnchors({
    totalManagerEval: score.managerEval,
    taskCount: tasks.length,
    avgQA,
    missedDeadlines,
  });

  let newManagerEval = 0;
  const ops: Promise<unknown>[] = [];

  for (const c of CRITERIA) {
    const raw = form.get(`score_${c.key}`);
    if (raw == null) continue;
    const val = Number(raw);
    if (!Number.isFinite(val)) continue;
    const clamped = Math.max(0, Math.min(c.max, val));
    newManagerEval += clamped;
    const delta = clamped - anchors[c.key];
    const justification = (form.get(`justification_${c.key}`) as string | null)?.trim() || null;

    // Enforce: |delta| > 2 requires justification (PRD §7.3)
    if (Math.abs(delta) > 2 && !justification && action === "lock") {
      return NextResponse.json(
        { error: `Justification required for ${c.label} (delta ${delta.toFixed(1)})` },
        { status: 400 },
      );
    }

    ops.push(
      db.managerJustification.upsert({
        where: { id: `${cycleId}__${personId}__${c.key}` },
        create: {
          id: `${cycleId}__${personId}__${c.key}`,
          cycleId,
          personId,
          managerId: me.id,
          criterion: c.key,
          systemScore: anchors[c.key],
          managerScore: clamped,
          delta,
          justification,
        },
        update: {
          systemScore: anchors[c.key],
          managerScore: clamped,
          delta,
          justification,
        },
      }),
    );

    // Discrepancy flag — PRD §7.3 last bullet
    if (Math.abs(delta) > 2.5) {
      ops.push(
        db.discrepancyFlag.upsert({
          where: { id: `${cycleId}__${personId}__${c.key}__flag` },
          create: {
            id: `${cycleId}__${personId}__${c.key}__flag`,
            cycleId,
            personId,
            managerId: me.id,
            criterion: c.key,
            systemScore: anchors[c.key],
            managerScore: clamped,
            delta,
            severity: Math.abs(delta) > 4 ? "HIGH" : "MEDIUM",
          },
          update: {
            systemScore: anchors[c.key],
            managerScore: clamped,
            delta,
            severity: Math.abs(delta) > 4 ? "HIGH" : "MEDIUM",
          },
        }),
      );
    }
  }

  ops.push(
    db.cycleScore.update({
      where: { cycleId_personId: { cycleId, personId } },
      data: {
        managerEval: Math.round(newManagerEval * 10) / 10,
        totalScore: Math.round(
          (newManagerEval + score.crossFunctionalEval + score.selfAppraisal + score.achievementPoints) * 10,
        ) / 10,
        computedAt: new Date(),
        ...(action === "lock" ? { lockedAt: new Date(), signedOffBy: me.id } : {}),
      },
    }),
  );

  ops.push(
    db.auditEntry.create({
      data: {
        tenantId: me.tenantId,
        actorId: me.id,
        actorRole: me.role,
        action: action === "lock" ? "CALIBRATION_LOCKED" : "CALIBRATION_SAVED",
        subjectKind: "cycle_score",
        subjectId: `${cycleId}:${personId}`,
      },
    }),
  );

  await Promise.all(ops);
  return NextResponse.redirect(new URL("/cockpit", req.url), 303);
}
