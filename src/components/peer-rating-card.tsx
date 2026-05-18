"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui";
import { PEER_CRITERIA } from "@/lib/peer-criteria";
import {
  tierForRating5,
  TIER_BG,
  TIER_TEXT,
  TIER_BORDER,
  RATING_LABEL_EN,
} from "@/lib/tiers";

export function PeerRatingCard({
  collaborator,
  projectId,
  sharedProjectName,
  evidenceCount,
  labels,
}: {
  collaborator: { id: string; fullName: string; jobTitle: string; department: string; role: string };
  projectId: string;
  sharedProjectName: string;
  evidenceCount: number;
  labels?: {
    project?: string;
    sharedEvents?: string;
    rated?: string;
    anonNote?: string;
    ratingDescriptions?: string[]; // 1..5 (index 0 unused; index 1..5 = labels)
  };
}) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const filledCount = Object.values(ratings).filter((r) => r > 0).length;
  const complete = filledCount === PEER_CRITERIA.length;
  // labels.ratingDescriptions can either be 5-length (0..4 maps to 1..5)
  // or 6-length (index 0 unused). Normalise to 6 with index 0 empty.
  const descs = (() => {
    const provided = labels?.ratingDescriptions;
    if (!provided) return RATING_LABEL_EN;
    if (provided.length === 5) return ["", ...provided];
    return provided;
  })();

  return (
    <div
      className={`card overflow-hidden transition ${complete ? "border-good-500/40 bg-good-50/30" : ""}`}
    >
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-4 border-b border-soft">
        <Avatar name={collaborator.fullName} role={collaborator.role} size={44} />
        <div className="flex-1 min-w-0">
          <div className="text-[14px] text-ink-900 font-semibold">{collaborator.fullName}</div>
          <div className="text-[12px] text-ink-500">{collaborator.jobTitle} · {collaborator.department}</div>
        </div>
        <div className="text-end">
          <div className="text-[10px] text-ink-400 uppercase tracking-wider">{labels?.project ?? "Project"}</div>
          <div className="text-[12px] text-ink-700 font-medium">{sharedProjectName}</div>
          <div className="text-[10px] text-ink-400 font-mono">
            {evidenceCount} {labels?.sharedEvents ?? "shared events"}
          </div>
        </div>
      </div>

      <input type="hidden" name={`pair__${collaborator.id}__projectId`} value={projectId} />

      {/* 2×2 grid of dimension ratings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 p-5">
        {PEER_CRITERIA.map((c) => {
          const rating = ratings[c.key] ?? 0;
          const tier = rating > 0 ? tierForRating5(rating) : null;
          return (
            <div key={c.key}>
              <div className="flex items-baseline justify-between mb-2 gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] text-ink-900 font-semibold">{c.label}</div>
                  <div className="text-[11px] text-ink-400 italic leading-snug">{c.helper}</div>
                </div>
                <div className="text-end flex-shrink-0">
                  <div className={`text-[10px] uppercase tracking-wider font-semibold ${tier ? TIER_TEXT[tier] : "text-ink-400"}`}>
                    {rating > 0 ? descs[rating] : "—"}
                  </div>
                  <div className="font-mono text-[12px] text-ink-500">
                    {rating > 0 ? rating : "?"} <span className="text-ink-300">/ 5</span>
                  </div>
                </div>
              </div>

              {/* 5 clickable dots — coloured by tier of the selected rating */}
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => {
                  const filled = n <= rating;
                  // When a rating is chosen, all filled dots take the tier color.
                  // Unfilled dots stay neutral so users can see how far they've moved.
                  const filledClass = tier
                    ? `${TIER_BG[tier]} ${TIER_BORDER[tier]} shadow-sm`
                    : "bg-gold-500 border-gold-600 shadow-sm";
                  return (
                    <label key={n} className="cursor-pointer group">
                      <input
                        type="radio"
                        name={`rating__${collaborator.id}__${c.key}`}
                        value={n}
                        checked={rating === n}
                        onChange={() => setRatings((p) => ({ ...p, [c.key]: n }))}
                        className="sr-only"
                      />
                      <span
                        className={`block w-7 h-7 rounded-full border-2 transition ${
                          filled
                            ? filledClass
                            : "bg-white border-soft group-hover:border-gold-500 group-hover:bg-gold-50"
                        }`}
                        title={descs[n]}
                      />
                    </label>
                  );
                })}
                {rating > 0 && (
                  <button
                    type="button"
                    onClick={() => setRatings((p) => { const n = {...p}; delete n[c.key]; return n; })}
                    className="text-[11px] text-ink-400 hover:text-ink-700 ms-2"
                    aria-label="Clear rating"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-soft bg-surface-75 flex items-center justify-between">
        <span className="text-[11px] text-ink-500">
          {labels?.anonNote ?? "Anonymous to the rated peer · identity kept by HR for audit only"}
        </span>
        <span className={`text-[12px] font-mono font-semibold ${complete ? "text-good-700" : "text-ink-500"}`}>
          {filledCount} / {PEER_CRITERIA.length} {labels?.rated ?? "rated"}
        </span>
      </div>
    </div>
  );
}
