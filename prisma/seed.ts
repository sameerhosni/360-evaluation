/**
 * Pulse360 seed — T2 Marketing department, H1 2026 cycle.
 *
 * Goal: realistic enough that every surface (Lina dashboard, Khalid cockpit,
 * Maha bias sentinel) has something genuinely interesting to look at.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Deterministic PRNG so repeated seeds yield identical data
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260511);
const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const gauss = (mean: number, sd: number) => {
  // Box-Muller
  const u = 1 - rand();
  const v = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const CYCLE_START = new Date("2026-01-01T00:00:00Z");
const CYCLE_END = new Date("2026-06-30T23:59:59Z");
const TODAY = new Date("2026-05-11T00:00:00Z");

async function main() {
  console.log("→ Wiping existing data");
  // Order matters because of FK constraints
  await prisma.auditEntry.deleteMany();
  await prisma.discrepancyFlag.deleteMany();
  await prisma.managerJustification.deleteMany();
  await prisma.twinAdvocateBrief.deleteMany();
  await prisma.biasPattern.deleteMany();
  await prisma.feedbackEvent.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.collaboration.deleteMany();
  await prisma.cycleScore.deleteMany();
  await prisma.livePulse.deleteMany();
  await prisma.taskAssignment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.cycle.deleteMany();
  await prisma.person.deleteMany();
  await prisma.tenant.deleteMany();

  // -------- Tenant --------
  console.log("→ Tenant: T2");
  const tenant = await prisma.tenant.create({
    data: { name: "T2", region: "KSA" },
  });

  // -------- People --------
  console.log("→ People: 1 HRBP + 1 Manager + 11 directs + 5 cross-fn");

  const maha = await prisma.person.create({
    data: {
      tenantId: tenant.id,
      fullName: "Maha Al-Otaibi",
      preferredName: "Maha",
      email: "maha.alotaibi@t2.sa",
      preferredLang: "en",
      role: "hrbp",
      jobTitle: "HR Business Partner",
      department: "People",
      hiredAt: new Date("2022-03-15"),
      gender: "F",
      nationality: "SA",
    },
  });

  const khalid = await prisma.person.create({
    data: {
      tenantId: tenant.id,
      fullName: "Khalid Al-Rashid",
      preferredName: "Khalid",
      email: "khalid.alrashid@t2.sa",
      preferredLang: "en",
      role: "manager",
      jobTitle: "Operations Manager",
      department: "Marketing",
      hiredAt: new Date("2020-08-01"),
      gender: "M",
      nationality: "SA",
    },
  });

  // Khalid's 11 direct reports. Mix of gender, nationality, tenure for bias scenario.
  const directDefs = [
    { first: "Lina",     last: "Al-Ahmadi",     g: "F", nat: "SA",   title: "Senior Marketing Specialist", lang: "en", hiredYears: 4 },
    { first: "Yusuf",    last: "Al-Rashid",     g: "M", nat: "SA",   title: "Product Manager",             lang: "en", hiredYears: 3 },
    { first: "Sara",     last: "Khoury",        g: "F", nat: "LB",   title: "Marketing Specialist",        lang: "ar", hiredYears: 2 },
    { first: "Mohammed", last: "Hadi",          g: "M", nat: "SA",   title: "Senior Specialist",           lang: "ar", hiredYears: 5 },
    { first: "Noura",    last: "Shami",         g: "F", nat: "SA",   title: "Designer",                    lang: "ar", hiredYears: 3 },
    { first: "Fatima",   last: "Al-Anzi",       g: "F", nat: "SA",   title: "Content Strategist",          lang: "ar", hiredYears: 2 },
    { first: "Omar",     last: "Al-Mutairi",    g: "M", nat: "SA",   title: "Performance Marketer",        lang: "ar", hiredYears: 1 },
    { first: "Hala",     last: "Saleh",         g: "F", nat: "JO",   title: "Brand Specialist",            lang: "en", hiredYears: 2 },
    { first: "Tariq",    last: "Karim",         g: "M", nat: "EG",   title: "Analytics Lead",              lang: "en", hiredYears: 4 },
    { first: "Reem",     last: "Al-Faisal",     g: "F", nat: "SA",   title: "Junior Specialist",           lang: "ar", hiredYears: 1 },
    { first: "Jamal",    last: "Al-Sayed",      g: "M", nat: "SA",   title: "Senior Specialist",           lang: "ar", hiredYears: 6 },
  ];

  const directs = await Promise.all(
    directDefs.map((d) =>
      prisma.person.create({
        data: {
          tenantId: tenant.id,
          fullName: `${d.first} ${d.last}`,
          preferredName: d.first,
          email: `${d.first.toLowerCase()}.${d.last.toLowerCase().replace(/[^a-z]/g, "")}@t2.sa`,
          preferredLang: d.lang,
          role: "employee",
          jobTitle: d.title,
          department: "Marketing",
          managerId: khalid.id,
          hiredAt: new Date(2026 - d.hiredYears, 0, 1),
          gender: d.g,
          nationality: d.nat,
        },
      }),
    ),
  );

  const lina = directs[0];
  const yusuf = directs[1];
  const sara = directs[2];
  const mohammed = directs[3];
  const noura = directs[4];

  // 5 cross-functional collaborators (other depts)
  const crossFnDefs = [
    { first: "Dalia",   last: "Al-Subaie",   g: "F", nat: "SA", dept: "Product",     title: "Product Designer" },
    { first: "Rashid",  last: "Al-Qahtani",  g: "M", nat: "SA", dept: "Engineering", title: "Senior Engineer" },
    { first: "Tala",    last: "Khan",        g: "F", nat: "PK", dept: "Sales",       title: "Account Executive" },
    { first: "Khaled",  last: "Al-Sayegh",   g: "M", nat: "BH", dept: "Finance",     title: "Financial Analyst" },
    { first: "Dina",    last: "Al-Khalifa",  g: "F", nat: "SA", dept: "Customer",    title: "CX Lead" },
  ];
  const crossFn = await Promise.all(
    crossFnDefs.map((d) =>
      prisma.person.create({
        data: {
          tenantId: tenant.id,
          fullName: `${d.first} ${d.last}`,
          preferredName: d.first,
          email: `${d.first.toLowerCase()}.${d.last.toLowerCase().replace(/[^a-z]/g, "")}@t2.sa`,
          role: "employee",
          jobTitle: d.title,
          department: d.dept,
          hiredAt: new Date("2023-01-01"),
          gender: d.g,
          nationality: d.nat,
        },
      }),
    ),
  );

  // -------- Cycles --------
  // Two prior LOCKED cycles + the active one. Gives the cockpit Period filter
  // real history to switch between.
  console.log("→ Cycles: H1 2025, H2 2025 (locked) + H1 2026 (calibration)");
  await prisma.cycle.create({
    data: {
      tenantId: tenant.id,
      label: "H1 2025",
      startsAt: new Date("2025-01-01"),
      endsAt: new Date("2025-06-30"),
      status: "LOCKED",
    },
  });
  await prisma.cycle.create({
    data: {
      tenantId: tenant.id,
      label: "H2 2025",
      startsAt: new Date("2025-07-01"),
      endsAt: new Date("2025-12-31"),
      status: "LOCKED",
    },
  });
  const cycle = await prisma.cycle.create({
    data: {
      tenantId: tenant.id,
      label: "H1 2026",
      startsAt: CYCLE_START,
      endsAt: CYCLE_END,
      status: "CALIBRATION",
    },
  });

  // -------- Projects --------
  console.log("→ Projects");
  const projects = await Promise.all(
    [
      { name: "Riyadh Campaign",   startedAt: new Date("2026-02-01"), closedAt: new Date("2026-04-30"), status: "closed" },
      { name: "Q2 Launch",         startedAt: new Date("2026-03-15"), closedAt: new Date("2026-05-05"), status: "closed" },
      { name: "Customer Onboarding Refresh", startedAt: new Date("2026-01-15"), closedAt: new Date("2026-03-15"), status: "closed" },
      { name: "Product Demo Series", startedAt: new Date("2026-04-01"), closedAt: null, status: "active" },
    ].map((p) => prisma.project.create({ data: { ...p, tenantId: tenant.id } })),
  );

  // -------- Tasks --------
  console.log("→ Tasks (with QA scores, deadline adherence)");
  const all = [khalid, maha, ...directs, ...crossFn];
  const taskTitles = [
    "Campaign creative review",
    "Q2 budget reconciliation",
    "Stakeholder presentation deck",
    "Customer interview synthesis",
    "Onboarding flow A/B test",
    "Conversion funnel audit",
    "Brand guidelines update",
    "Demo script revision",
    "Performance report draft",
    "Vendor RFP evaluation",
    "Content calendar planning",
    "Analytics dashboard build",
    "Customer feedback summary",
    "Launch checklist coordination",
    "Cross-team sync notes",
  ];

  let taskCounter = 4800;
  for (const person of directs) {
    const taskCount = between(28, 52);
    // Distribution: Lina and top performers slightly higher QA, more tasks
    const isTop = person.id === lina.id || person.id === yusuf.id;
    for (let i = 0; i < taskCount; i++) {
      const closedDays = between(1, 130);
      const closedAt = new Date(TODAY.getTime() - closedDays * 86400000);
      const project = pick(projects);
      const qaBase = isTop ? 87 : 80;
      const qaScore = Math.max(60, Math.min(99, gauss(qaBase, 6)));
      const deadlineMet = rand() > (isTop ? 0.1 : 0.18);

      const task = await prisma.task.create({
        data: {
          tenantId: tenant.id,
          externalId: `TASK-${taskCounter++}`,
          title: pick(taskTitles),
          status: "closed",
          priority: between(1, 3),
          createdAt: new Date(closedAt.getTime() - between(1, 14) * 86400000),
          closedAt,
          qaScore: Math.round(qaScore * 10) / 10,
          deadlineMet,
          projectId: project.id,
        },
      });

      // Person is owner; maybe 1-2 contributors
      await prisma.taskAssignment.create({
        data: { taskId: task.id, personId: person.id, roleOnTask: "owner", assignedAt: task.createdAt },
      });
      if (rand() > 0.5) {
        const collab = pick(rand() > 0.5 ? directs : crossFn);
        if (collab.id !== person.id) {
          await prisma.taskAssignment.create({
            data: { taskId: task.id, personId: collab.id, roleOnTask: "contributor", assignedAt: task.createdAt },
          });
        }
      }
    }
  }

  // -------- Collaborations (VCN) --------
  console.log("→ Collaborations (VCN)");
  // Lina has a strong network: Yusuf (28), Sara (21), Noura (18), Fatima (15), Mohammed (14) etc.
  const linaNetwork: Array<[string, number, string]> = [
    [yusuf.id, 28, "Riyadh Campaign, Product Demo Series, Q2 Launch"],
    [sara.id, 21, "Riyadh Campaign, Customer Onboarding Refresh"],
    [noura.id, 18, "Product Demo Series, Q2 Launch"],
    [directs[5].id /* Fatima */, 15, "Q2 Launch"],
    [mohammed.id, 14, "Customer Onboarding Refresh"],
    [directs[7].id /* Hala */, 11, "Riyadh Campaign"],
    [directs[8].id /* Tariq */, 9, "Q2 Launch"],
    [crossFn[0].id /* Dalia */, 13, "Product Demo Series"],
    [crossFn[1].id /* Rashid */, 7, "Customer Onboarding Refresh"],
    [crossFn[2].id /* Tala */, 6, "Riyadh Campaign"],
    [crossFn[4].id /* Dina */, 5, "Customer Onboarding Refresh"],
  ];
  for (const [otherId, ev, projs] of linaNetwork) {
    await prisma.collaboration.create({
      data: {
        tenantId: tenant.id,
        cycleId: cycle.id,
        personAId: lina.id,
        personBId: otherId,
        interactionStrength: Math.min(10, ev / 3),
        evidenceCount: ev,
        sharedProjects: projs,
      },
    });
  }
  // Generate collaboration edges for other directs too (sparser)
  for (const d of directs.slice(1)) {
    const peers = directs.filter((x) => x.id !== d.id).slice(0, between(5, 9));
    for (const peer of peers) {
      const ev = between(3, 22);
      // avoid duplicate pair (lina already covered)
      if (d.id === lina.id || peer.id === lina.id) continue;
      const exists = await prisma.collaboration.findFirst({
        where: {
          cycleId: cycle.id,
          OR: [
            { personAId: d.id, personBId: peer.id },
            { personAId: peer.id, personBId: d.id },
          ],
        },
      });
      if (exists) continue;
      await prisma.collaboration.create({
        data: {
          tenantId: tenant.id,
          cycleId: cycle.id,
          personAId: d.id,
          personBId: peer.id,
          interactionStrength: Math.min(10, ev / 3),
          evidenceCount: ev,
          sharedProjects: pick(projects).name,
        },
      });
    }
  }

  // -------- Feedback events (cross-functional micro-feedback) --------
  console.log("→ Feedback events (cross-functional micro-feedback)");
  const dimensions = ["team_spirit", "responsiveness", "professionalism", "cross_dept_support"];
  // For Lina: ~12 positive ratings across project closes
  for (const dim of dimensions) {
    for (const [otherId, ev] of linaNetwork) {
      if (ev < 5) continue;
      // Lina rated by collaborator (anonymous to peer at read time)
      await prisma.feedbackEvent.create({
        data: {
          tenantId: tenant.id,
          cycleId: cycle.id,
          ratedPersonId: lina.id,
          raterPersonId: otherId,
          context: "project_close",
          contextRefId: pick(projects).id,
          dimension: dim,
          rating: gauss(4.3, 0.5) > 4.5 ? 5 : 4,
          weight: Math.min(2, ev / 14),
          vcnVerified: true,
          occurredAt: new Date(TODAY.getTime() - between(7, 80) * 86400000),
        },
      });
    }
  }
  // For other directs: ratings with a subtle gender skew on "professionalism" criterion
  // (this is the bias scenario Maha will discover)
  for (const d of directs.slice(1)) {
    const otherDirects = directs.filter((x) => x.id !== d.id);
    const raters = otherDirects.slice(0, between(4, 8));
    for (const dim of dimensions) {
      for (const r of raters) {
        // Subtle bias: female directs systematically receive 0.4 lower on professionalism
        // from Khalid's department culture (the scenario)
        const biasOffset = dim === "professionalism" && d.gender === "F" ? -0.4 : 0;
        const base = 3.9 + biasOffset;
        const rating = Math.max(1, Math.min(5, Math.round(gauss(base, 0.7))));
        await prisma.feedbackEvent.create({
          data: {
            tenantId: tenant.id,
            cycleId: cycle.id,
            ratedPersonId: d.id,
            raterPersonId: r.id,
            context: "project_close",
            contextRefId: pick(projects).id,
            dimension: dim,
            rating,
            weight: 1,
            vcnVerified: true,
            occurredAt: new Date(TODAY.getTime() - between(7, 80) * 86400000),
          },
        });
      }
    }
  }

  // -------- Achievements --------
  console.log("→ Achievements (mix of confirmed and pending)");
  // Lina: 3 confirmed, 3 pending (for AAD inbox)
  const linaAchievements = [
    {
      cat: "cross_functional_leadership",
      pts: 4,
      status: "MANAGER_CONFIRMED",
      desc: "Mentored Sara and Mohammed through their first independent campaigns — both shipped on time.",
      evidence: JSON.stringify([
        { kind: "task", id: "TASK-4912", summary: "Sara's first solo campaign closed with QA 91" },
        { kind: "mention", summary: "Khalid acknowledged mentoring in 1:1 notes" },
      ]),
    },
    {
      cat: "project_milestone",
      pts: 5,
      status: "MANAGER_CONFIRMED",
      desc: "Led Riyadh campaign to 92% client satisfaction (vs 78% baseline).",
      evidence: JSON.stringify([
        { kind: "task", id: "TASK-4801", summary: "Campaign launch task closed, QA 96" },
        { kind: "project", id: "Riyadh Campaign", summary: "Client survey: 92% sat score" },
      ]),
    },
    {
      cat: "process_improvement",
      pts: 3,
      status: "MANAGER_CONFIRMED",
      desc: "Reduced support-ticket backlog by 34% via prioritization framework.",
      evidence: JSON.stringify([
        { kind: "metric", summary: "Backlog: 47 → 31 over the cycle" },
      ]),
    },
    // Pending — these will show in the AAD inbox
    {
      cat: "process_improvement",
      pts: 3,
      status: "PROPOSED",
      source: "AAD",
      desc: "Closed 4 high-priority tickets this week.",
      evidence: JSON.stringify([
        { kind: "task", id: "TASK-4827", summary: "Closed with QA 92" },
        { kind: "task", id: "TASK-4828", summary: "Closed with QA 88" },
        { kind: "task", id: "TASK-4831", summary: "Closed with QA 95" },
        { kind: "task", id: "TASK-4834", summary: "Closed with QA 90" },
      ]),
    },
    {
      cat: "project_milestone",
      pts: 4,
      status: "PROPOSED",
      source: "AAD",
      desc: "Delivered Riyadh campaign deck to client with phase-two sign-off.",
      evidence: JSON.stringify([
        { kind: "calendar", summary: "Client meeting 2026-05-09" },
        { kind: "doc", summary: "campaign-v3.pdf" },
      ]),
    },
    {
      cat: "cross_functional_leadership",
      pts: 2,
      status: "PROPOSED",
      source: "PEER_WITNESSED",
      desc: "Coordinated product team during the launch crisis.",
      evidence: JSON.stringify([
        { kind: "mention", summary: "Yusuf's project review notes: praised coordination" },
      ]),
    },
  ];
  for (const a of linaAchievements) {
    await prisma.achievement.create({
      data: {
        tenantId: tenant.id,
        personId: lina.id,
        cycleId: cycle.id,
        category: a.cat,
        proposedPoints: a.pts,
        awardedPoints: a.status === "MANAGER_CONFIRMED" ? a.pts : null,
        status: a.status,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        source: (a as any).source ?? "MANAGER",
        description: a.desc,
        language: "en",
        evidenceEvents: a.evidence,
        twinConfidence: 0.85,
        proposedAt: new Date(TODAY.getTime() - between(5, 90) * 86400000),
        confirmedAt: a.status === "MANAGER_CONFIRMED" ? new Date(TODAY.getTime() - between(2, 30) * 86400000) : null,
        managerId: a.status === "MANAGER_CONFIRMED" ? khalid.id : null,
      },
    });
  }
  // Other directs: 2-4 confirmed achievements each
  for (const d of directs.slice(1)) {
    const n = between(2, 4);
    for (let i = 0; i < n; i++) {
      await prisma.achievement.create({
        data: {
          tenantId: tenant.id,
          personId: d.id,
          cycleId: cycle.id,
          category: pick(["project_milestone", "process_improvement", "cross_functional_leadership"]),
          proposedPoints: between(2, 4),
          awardedPoints: between(2, 4),
          status: "MANAGER_CONFIRMED",
          source: "MANAGER",
          description: `Confirmed achievement on ${pick(projects).name}.`,
          language: d.preferredLang,
          evidenceEvents: JSON.stringify([{ kind: "task", summary: "Closed with QA " + between(82, 96) }]),
          twinConfidence: 0.75,
          proposedAt: new Date(TODAY.getTime() - between(10, 90) * 86400000),
          confirmedAt: new Date(TODAY.getTime() - between(5, 30) * 86400000),
          managerId: khalid.id,
        },
      });
    }
  }

  // -------- Live Pulse + Cycle Score (system pre-computed) --------
  console.log("→ Live Pulse + Cycle Scores (pre-computed)");
  for (const d of directs) {
    // Components — derived rough math based on tasks/feedback/achievements
    const isLina = d.id === lina.id;
    const managerEval = isLina ? 22.5 : Math.max(15, Math.min(28, gauss(22, 3)));
    const crossFn = isLina ? 26.6 : Math.max(15, Math.min(29, gauss(23, 3)));
    const self = isLina ? 15.9 : Math.max(10, Math.min(19, gauss(14, 2.5)));
    const ach = isLina ? 17.4 : Math.max(6, Math.min(20, gauss(12, 3)));
    const total = managerEval + crossFn + self + ach;
    const conf = isLina ? 64 : between(58, 92);

    const score = await prisma.cycleScore.create({
      data: {
        cycleId: cycle.id,
        personId: d.id,
        managerEval: Math.round(managerEval * 10) / 10,
        crossFunctionalEval: Math.round(crossFn * 10) / 10,
        selfAppraisal: Math.round(self * 10) / 10,
        achievementPoints: Math.round(ach * 10) / 10,
        selfAwarenessMultiplier: isLina ? 0.8 : Math.round(gauss(0.7, 0.5) * 10) / 10,
        totalScore: Math.round(total * 10) / 10,
        calibrationConfidence: conf,
        componentEvidence: JSON.stringify({}),
        computedAt: TODAY,
      },
    });

    await prisma.livePulse.create({
      data: {
        personId: d.id,
        liveScore: score.totalScore,
        delta24h: Math.round(gauss(0.5, 0.8) * 10) / 10,
        delta7d: Math.round(gauss(1.0, 1.5) * 10) / 10,
        recomputedAt: TODAY,
      },
    });
  }

  // -------- Bias Pattern (the scenario Maha discovers) --------
  console.log("→ Bias Pattern (Marketing dept · gender × professionalism)");
  await prisma.biasPattern.create({
    data: {
      tenantId: tenant.id,
      detectedAt: new Date(TODAY.getTime() - 3 * 86400000),
      axis: "gender",
      scope: "department",
      scopeRef: "Marketing",
      scopeLabel: "Marketing",
      criterion: "professionalism",
      effectSize: -1.4,
      ciLow: -2.1,
      ciHigh: -0.7,
      sampleSize: 28,
      pValue: 0.008,
      severity: "HIGH",
      explanations: JSON.stringify({
        neutral: "Sample of female reviewees skews toward client-facing roles where pressure exposure is higher.",
        cautious: "Manager-specific scoring style amplifies the gap; calibration coaching may help.",
        urgent: "Systemic bias across multiple managers; immediate calibration review and policy attention required.",
      }),
      recommended: "Calibration coaching with affected managers + dept-wide audit",
      status: "OPEN",
    },
  });

  // Two additional medium-severity flags to populate the queue
  await prisma.biasPattern.create({
    data: {
      tenantId: tenant.id,
      detectedAt: new Date(TODAY.getTime() - 1 * 86400000),
      axis: "reciprocity",
      scope: "peer_cluster",
      scopeRef: "ENG-cluster-4",
      scopeLabel: "Engineering dept",
      criterion: null,
      effectSize: 0.9,
      ciLow: 0.3,
      ciHigh: 1.5,
      sampleSize: 16,
      pValue: 0.03,
      severity: "MEDIUM",
      explanations: JSON.stringify({
        neutral: "Tight working cluster on shared product surface; mutual high ratings may reflect genuine collaboration.",
        cautious: "Reciprocity 2.8σ above org mean — worth a calibration coaching check-in.",
        urgent: "Closed reciprocity pattern suggests rating coordination; require human review before score impact.",
      }),
      recommended: "Anti-Collusion deep-scan; HRBP review before cycle close",
      status: "OPEN",
    },
  });
  await prisma.biasPattern.create({
    data: {
      tenantId: tenant.id,
      detectedAt: new Date(TODAY.getTime() - 2 * 86400000),
      axis: "self_awareness",
      scope: "department",
      scopeRef: "Sales",
      scopeLabel: "Sales dept",
      criterion: null,
      effectSize: -0.6,
      ciLow: -1.0,
      ciHigh: -0.2,
      sampleSize: 24,
      pValue: 0.04,
      severity: "MEDIUM",
      explanations: JSON.stringify({
        neutral: "Self-appraisal completion compressed; multipliers cluster near zero by chance.",
        cautious: "Department-wide self-appraisal avoidance — coaching opportunity.",
        urgent: "Signals systematic disengagement from the self-appraisal flow; investigate manager support.",
      }),
      recommended: "Dept-wide AI HR check-in + manager 1:1s",
      status: "INVESTIGATING",
    },
  });

  console.log("✓ Seed complete");
  console.log(`   Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`   Lina:    ${lina.email}     (employee persona)`);
  console.log(`   Khalid:  ${khalid.email}   (manager persona)`);
  console.log(`   Maha:    ${maha.email}     (hrbp persona)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
