import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentPerson } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { Card, Chip, Eyebrow, PageHeader } from "@/components/ui";
import { PeerRatingCard } from "@/components/peer-rating-card";
import { PEER_CRITERIA } from "@/lib/peer-criteria";
import { currentLocale, t, tNode } from "@/lib/i18n";

async function submitPeerRating(formData: FormData) {
  "use server";
  const me = await currentPerson();
  if (!me || me.role !== "employee") throw new Error("not authenticated");

  const cycle = await db.cycle.findFirst({
    where: { tenantId: me.tenantId, status: { in: ["OPEN", "CALIBRATION"] } },
    orderBy: { startsAt: "desc" },
  });
  if (!cycle) throw new Error("no active cycle");

  const projectMap = new Map<string, string>();
  const ratings: Array<{ personId: string; criterion: string; rating: number }> = [];

  for (const [key, value] of formData.entries()) {
    const v = String(value);
    if (key.startsWith("pair__")) {
      const [, personId] = key.split("__");
      projectMap.set(personId, v);
    } else if (key.startsWith("rating__")) {
      const [, personId, criterion] = key.split("__");
      const n = parseInt(v, 10);
      if (!Number.isFinite(n) || n < 1 || n > 5) continue;
      ratings.push({ personId, criterion, rating: n });
    }
  }

  const partnerIds = [...projectMap.keys()];
  const collabs = await db.collaboration.findMany({
    where: {
      cycleId: cycle.id,
      OR: [
        { personAId: me.id, personBId: { in: partnerIds } },
        { personBId: me.id, personAId: { in: partnerIds } },
      ],
    },
  });
  const strengthFor = (id: string) => {
    const c = collabs.find((x) =>
      (x.personAId === me.id && x.personBId === id) ||
      (x.personBId === me.id && x.personAId === id),
    );
    return Math.min(2, (c?.interactionStrength ?? 1) / 5);
  };

  let writes = 0;
  for (const r of ratings) {
    await db.feedbackEvent.create({
      data: {
        tenantId: me.tenantId,
        cycleId: cycle.id,
        ratedPersonId: r.personId,
        raterPersonId: me.id,
        context: "project_close",
        contextRefId: projectMap.get(r.personId) ?? null,
        dimension: r.criterion,
        rating: r.rating,
        weight: strengthFor(r.personId),
        vcnVerified: true,
        occurredAt: new Date(),
      },
    });
    writes++;
  }

  await db.auditEntry.create({
    data: {
      tenantId: me.tenantId, actorId: me.id, actorRole: me.role,
      action: "PEER_RATINGS_SUBMITTED", subjectKind: "peer_feedback", subjectId: `${cycle.id}:${me.id}`,
      context: JSON.stringify({ writes }),
    },
  });

  revalidatePath("/peer-feedback");
}

export default async function PeerFeedbackPage() {
  const me = await currentPerson();
  if (!me) redirect("/");
  if (me.role !== "employee") redirect("/");
  const locale = await currentLocale();

  const cycle = await db.cycle.findFirst({
    where: { tenantId: me.tenantId, status: { in: ["OPEN", "CALIBRATION"] } },
    orderBy: { startsAt: "desc" },
  });
  if (!cycle) return <AppShell me={me}><Card>No active cycle.</Card></AppShell>;

  const myCollabs = await db.collaboration.findMany({
    where: {
      cycleId: cycle.id,
      OR: [{ personAId: me.id }, { personBId: me.id }],
    },
    orderBy: { interactionStrength: "desc" },
  });

  const closedProjects = await db.project.findMany({
    where: { tenantId: me.tenantId, status: "closed" },
    orderBy: { closedAt: "desc" },
  });

  const collaboratorIds = myCollabs.map((c) => (c.personAId === me.id ? c.personBId : c.personAId));
  const collaborators = await db.person.findMany({ where: { id: { in: collaboratorIds } } });
  const personById = new Map(collaborators.map((p) => [p.id, p]));

  const myRatings = await db.feedbackEvent.findMany({
    where: { raterPersonId: me.id, cycleId: cycle.id },
    select: { ratedPersonId: true, contextRefId: true, dimension: true },
  });

  type Pair = {
    collaboratorId: string;
    projectId: string;
    projectName: string;
    evidenceCount: number;
    alreadyRated: boolean;
  };

  const pairs: Pair[] = [];
  for (const collab of myCollabs) {
    const otherId = collab.personAId === me.id ? collab.personBId : collab.personAId;
    const other = personById.get(otherId);
    if (!other) continue;
    const sharedNames = collab.sharedProjects.split(",").map((s) => s.trim()).filter(Boolean);
    const project = closedProjects.find((p) => sharedNames.includes(p.name)) ?? closedProjects[0];
    if (!project) continue;
    const alreadyRated = myRatings.some(
      (r) => r.ratedPersonId === otherId && (r.contextRefId === project.id || r.contextRefId === null),
    );
    pairs.push({
      collaboratorId: otherId,
      projectId: project.id,
      projectName: project.name,
      evidenceCount: collab.evidenceCount,
      alreadyRated,
    });
  }

  const toRate = pairs.filter((p) => !p.alreadyRated);
  const completed = pairs.filter((p) => p.alreadyRated);

  // Translated criterion labels — fall back to defaults if missing
  const localizedCriteria = PEER_CRITERIA.map((c) => {
    const localizedLabel = t(locale, `peerFeedback.criteria.${c.key}.label` as never);
    const localizedHelper = t(locale, `peerFeedback.criteria.${c.key}.helper` as never);
    return {
      ...c,
      label: localizedLabel || c.label,
      helper: localizedHelper || c.helper,
    };
  });

  const ratingDescriptions = (tNode(locale, "peerFeedback.ratingDescriptions") as string[]) ?? undefined;
  const isAr = locale === "ar";

  return (
    <AppShell me={me}>
      <PageHeader
        eyebrow={`${cycle.label} · ${t(locale, "peerFeedback.eyebrow")}`}
        title={t(locale, "peerFeedback.title")}
        subtitle={t(locale, "peerFeedback.subtitle")}
      />

      {/* Criteria legend — now showing the localized labels in a compact strip */}
      <Card className="mb-6 p-5 bg-surface-75">
        <Eyebrow muted className="mb-3">{t(locale, "peerFeedback.criteriaHeading")}</Eyebrow>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {localizedCriteria.map((c) => (
            <div key={c.key} className={`flex items-start gap-3 ${isAr ? "font-ar" : ""}`}>
              <div className="w-9 h-9 rounded-md bg-gold-50 border border-gold-200 flex items-center justify-center flex-shrink-0">
                <span className="font-mono text-[12px] font-bold text-gold-700">{c.max}</span>
              </div>
              <div className="min-w-0">
                <div className="text-[13px] text-ink-900 font-semibold leading-snug">{c.label}</div>
                <div className="text-[11px] text-ink-500 leading-snug mt-0.5">{c.helper}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {toRate.length === 0 && completed.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <div className={`text-[15px] text-ink-700 mb-1 ${isAr ? "font-ar" : ""}`}>{t(locale, "peerFeedback.emptyTitle")}</div>
            <div className={`text-[13px] text-ink-400 ${isAr ? "font-ar" : ""}`}>{t(locale, "peerFeedback.emptyHelper")}</div>
          </div>
        </Card>
      ) : toRate.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <div className={`text-[15px] text-ink-700 mb-1 ${isAr ? "font-ar" : ""}`}>{t(locale, "peerFeedback.allDoneTitle")}</div>
            <div className={`text-[13px] text-ink-400 ${isAr ? "font-ar" : ""}`}>
              {completed.length} {t(locale, "peerFeedback.allDoneHelper")}
            </div>
          </div>
        </Card>
      ) : (
        <form action={submitPeerRating} className="space-y-4">
          <div className={`text-[13px] text-ink-500 mb-2 ${isAr ? "font-ar" : ""}`}>
            <span className="font-semibold text-ink-900">{toRate.length}</span>{" "}
            {t(locale, "peerFeedback.pending")} · {t(locale, "peerFeedback.pendingHelp")}
          </div>
          {toRate.map((pair) => {
            const collaborator = personById.get(pair.collaboratorId);
            if (!collaborator) return null;
            return (
              <PeerRatingCard
                key={pair.collaboratorId}
                collaborator={{
                  id: collaborator.id,
                  fullName: collaborator.fullName,
                  jobTitle: collaborator.jobTitle,
                  department: collaborator.department,
                  role: collaborator.role,
                }}
                projectId={pair.projectId}
                sharedProjectName={pair.projectName}
                evidenceCount={pair.evidenceCount}
                labels={{
                  project: t(locale, "peerFeedback.project"),
                  sharedEvents: t(locale, "peerFeedback.sharedEvents"),
                  rated: t(locale, "peerFeedback.rated"),
                  anonNote: t(locale, "common.anonymousNote"),
                  ratingDescriptions,
                }}
              />
            );
          })}

          {/* Sticky submit footer */}
          <div className="sticky bottom-4 z-10">
            <div className={`card p-4 flex items-center justify-between gap-3 bg-gold-50 border-gold-200 shadow-lg ${isAr ? "font-ar" : ""}`}>
              <div className="text-[13px] text-ink-700 min-w-0 truncate">
                {t(locale, "peerFeedback.submitNote")}
              </div>
              <button type="submit" className={`btn-primary flex-shrink-0 ${isAr ? "font-ar" : ""}`}>
                {t(locale, "peerFeedback.submitButton")}
              </button>
            </div>
          </div>
        </form>
      )}

      {completed.length > 0 && (
        <div className="mt-12">
          <h2 className={`font-display text-xl text-ink-900 mb-3 ${isAr ? "font-ar" : ""}`}>
            {t(locale, "peerFeedback.completedHeading")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {completed.map((p) => {
              const c = personById.get(p.collaboratorId);
              if (!c) return null;
              return (
                <div key={p.collaboratorId} className="card p-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-good-50 border border-good-100 flex items-center justify-center text-good-700 flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <div className={`flex-1 min-w-0 ${isAr ? "font-ar" : ""}`}>
                    <div className="text-[13px] text-ink-900 font-medium">{c.fullName}</div>
                    <div className="text-[11px] text-ink-500">{p.projectName}</div>
                  </div>
                  <Chip tone="good">{t(locale, "peerFeedback.rated")}</Chip>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AppShell>
  );
}
