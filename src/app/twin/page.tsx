import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentPerson } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { Card, PageHeader } from "@/components/ui";
import { AdvocateBriefCard } from "@/components/advocate-brief";
import type { AdvocateBrief } from "@/lib/ai/schemas";
import { currentLocale, t } from "@/lib/i18n";

export default async function TwinConsole() {
  const me = await currentPerson();
  if (!me) redirect("/");
  if (me.role !== "employee") redirect("/");
  const locale = await currentLocale();

  const cycle = await db.cycle.findFirst({
    where: { tenantId: me.tenantId, status: { in: ["OPEN", "CALIBRATION"] } },
    orderBy: { startsAt: "desc" },
  });
  if (!cycle) return <AppShell me={me}><Card>No active cycle.</Card></AppShell>;

  const stored = await db.twinAdvocateBrief.findUnique({
    where: { cycleId_personId: { cycleId: cycle.id, personId: me.id } },
  });

  let brief: AdvocateBrief | null = null;
  if (stored) {
    try {
      brief = {
        topAchievements: JSON.parse(stored.topAchievements),
        peerSummary: stored.peerSummary,
        growthSignals: JSON.parse(stored.growthSignals),
        counterEvidence: JSON.parse(stored.flagged),
      };
    } catch { brief = null; }
  }

  return (
    <AppShell me={me}>
      <PageHeader
        eyebrow={t(locale, "twin.eyebrow")}
        title={t(locale, "twin.title")}
        subtitle={t(locale, "twin.subtitle")}
      />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4">
          <Card className="p-6">
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-gold-200 via-gold-400 to-gold-600 twin-glow mb-5" />
              <div className="font-display text-2xl text-ink-900 italic mb-1">
                {t(locale, "twin.orbLine1")}
              </div>
              <div className="font-display text-2xl text-gold-700 italic">
                {t(locale, "twin.orbLine2")}
              </div>
            </div>

            <div className="border-t border-soft pt-5 space-y-3">
              <CovenantItem ok>{t(locale, "twin.covenant1")}</CovenantItem>
              <CovenantItem ok>{t(locale, "twin.covenant2")}</CovenantItem>
              <CovenantItem ok>{t(locale, "twin.covenant3")}</CovenantItem>
            </div>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-8 space-y-4">
          <div>
            <div className="text-[13px] text-ink-500 mb-1">
              {t(locale, "twin.cycleOpensIn")}
            </div>
            <h2 className="font-display text-2xl text-ink-900">
              {t(locale, "twin.whatManagerSees")}
            </h2>
            <p className="text-[14px] text-ink-500 mt-1 max-w-2xl">
              {t(locale, "twin.briefIntro")}
            </p>
          </div>

          {brief ? (
            <AdvocateBriefCard
              brief={brief}
              promptVersion={stored?.promptVersion}
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
          ) : (
            <Card>
              <div className="text-center py-12">
                <div className="text-[15px] text-ink-700 mb-2">
                  {t(locale, "twin.emptyTitle")}
                </div>
                <div className="text-[13px] text-ink-400 max-w-md mx-auto">
                  {t(locale, "twin.emptyHelper")}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function CovenantItem({ ok, children }: { ok?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-[13px] text-ink-700 leading-relaxed">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${ok ? "bg-good-50 border border-good-100 text-good-700" : "bg-bad-50 border border-bad-100 text-bad-700"}`}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          {ok ? <polyline points="20 6 9 17 4 12" /> : <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>}
        </svg>
      </div>
      <span>{children}</span>
    </div>
  );
}
