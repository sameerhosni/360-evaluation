import { Card, Chip, Eyebrow } from "@/components/ui";
import type { AdvocateBrief as Brief } from "@/lib/ai/schemas";

/**
 * Renders the Twin Advocate Brief — the artifact the Twin produces on
 * behalf of the employee, shown to the manager during calibration.
 * PRD §4.4, §7.11
 */
export function AdvocateBriefCard({
  brief,
  promptVersion,
  labels,
}: {
  brief: Brief;
  promptVersion?: string;
  labels?: {
    onBehalf?: string;
    title?: string;
    topAchievements?: string;
    peerSummary?: string;
    growthSignals?: string;
    counterEvidence?: string;
    pt?: string;
  };
}) {
  const L = {
    onBehalf: labels?.onBehalf ?? "On behalf of the employee",
    title: labels?.title ?? "Twin Advocate Brief",
    topAchievements: labels?.topAchievements ?? "Top achievements",
    peerSummary: labels?.peerSummary ?? "Peer summary",
    growthSignals: labels?.growthSignals ?? "Growth signals",
    counterEvidence: labels?.counterEvidence ?? "Please reconsider",
    pt: labels?.pt ?? "pt",
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-soft bg-gold-50/60">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 twin-glow" />
        </div>
        <div className="flex-1">
          <Eyebrow>{L.onBehalf}</Eyebrow>
          <div className="font-display text-xl text-ink-900">{L.title}</div>
        </div>
        {promptVersion && (
          <div className="font-mono text-[10px] text-ink-400">{promptVersion}</div>
        )}
      </div>

      <div className="p-6 space-y-6">
        <div>
          <Eyebrow muted className="mb-3">{L.topAchievements}</Eyebrow>
          <ol className="space-y-3">
            {brief.topAchievements.map((a) => (
              <li key={a.rank} className="flex items-start gap-3">
                <span className="num-badge !bg-gold-600 mt-0.5">{a.rank}</span>
                <div className="flex-1">
                  <div className="text-[14px] text-ink-900 font-medium leading-snug">{a.summary}</div>
                  <div className="text-[12px] text-ink-500 mt-1 italic">{a.evidence}</div>
                </div>
                <Chip tone="gold">{a.points} {L.pt}</Chip>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <Eyebrow muted className="mb-2">{L.peerSummary}</Eyebrow>
          <p className="text-[14px] text-ink-700 leading-relaxed">{brief.peerSummary}</p>
        </div>

        {brief.growthSignals.length > 0 && (
          <div>
            <Eyebrow muted className="mb-3">{L.growthSignals}</Eyebrow>
            <ul className="space-y-2">
              {brief.growthSignals.map((g, i) => (
                <li key={i} className="text-[13px] text-ink-700 leading-relaxed flex items-start gap-2">
                  <span className="text-gold-600 mt-0.5">●</span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {brief.counterEvidence.length > 0 && (
          <div className="rounded-lg bg-bad-50 border border-bad-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B83943" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
              </svg>
              <Eyebrow className="!text-bad-700">{L.counterEvidence}</Eyebrow>
            </div>
            <div className="space-y-3">
              {brief.counterEvidence.map((c, i) => (
                <div key={i} className="text-[13px]">
                  <div className="font-semibold text-ink-900 mb-1">{c.criterion}</div>
                  <div className="text-ink-800 mb-1">{c.concern}</div>
                  <div className="text-ink-500 italic">{c.evidence}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
