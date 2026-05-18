"use client";

import { useState } from "react";
import { Chip } from "@/components/ui";
import {
  tierForPct,
  TIER_BG,
  TIER_TEXT,
  TIER_BORDER as TIER_THUMB,
  TIER_LABEL_EN as TIER_LABEL,
} from "@/lib/tiers";

export function CalibrationCriterion({
  criterionKey,
  label,
  helper,
  max,
  anchor,
  initialValue,
  initialJustification,
  labels,
}: {
  criterionKey: string;
  label: string;
  helper: string;
  max: number;
  anchor: number;
  initialValue: number;
  initialJustification?: string;
  labels?: {
    system?: string;
    you?: string;
    rate?: string;
    justificationRequired?: string;
    justificationPlaceholder?: string;
    ptVsSystem?: string;
  };
}) {
  const L = {
    system: labels?.system ?? "System",
    you: labels?.you ?? "You",
    rate: labels?.rate ?? "Rate",
    justificationRequired: labels?.justificationRequired ?? "Justification required",
    justificationPlaceholder: labels?.justificationPlaceholder ?? "In one or two sentences, what shaped this adjustment?",
    ptVsSystem: labels?.ptVsSystem ?? "pt vs system",
  };
  const [value, setValue] = useState(initialValue);
  const delta = value - anchor;
  const beyondFreeRange = Math.abs(delta) > 2;
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const anchorPct = Math.max(0, Math.min(100, (anchor / max) * 100));
  const tier = tierForPct(pct);

  const setClamped = (v: number) => {
    if (Number.isFinite(v)) setValue(Math.max(0, Math.min(max, Math.round(v * 10) / 10)));
  };

  return (
    <div>
      {/* Header row */}
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <div className="min-w-0">
          <div className="text-[14px] text-ink-900 font-semibold">{label}</div>
          <div className="text-[11px] text-ink-400 mt-0.5">{helper}</div>
        </div>
        <div className="flex items-baseline gap-5 flex-shrink-0">
          <div className="text-end">
            <div className="text-[10px] text-ink-400 uppercase tracking-wider">{L.system}</div>
            <div className="font-mono text-[12px] text-ink-500">{anchor.toFixed(1)}</div>
          </div>
          <div className="text-end">
            <div className="text-[10px] text-ink-400 uppercase tracking-wider">{L.you}</div>
            <div
              className={`font-mono text-[14px] font-semibold ${
                delta > 0 ? "text-good-700" : delta < 0 ? "text-bad-700" : "text-ink-900"
              }`}
            >
              {value.toFixed(1)}
              {delta !== 0 && (
                <span className="text-[10px] font-normal ms-1">
                  ({delta > 0 ? "+" : ""}
                  {delta.toFixed(1)})
                </span>
              )}
              <span className="text-ink-400 text-[10px]"> / {max}</span>
            </div>
          </div>
          <div className="text-end">
            <div className="text-[10px] text-ink-400 uppercase tracking-wider">{L.rate}</div>
            <div className={`font-mono text-[14px] font-semibold ${TIER_TEXT[tier]}`}>
              {pct.toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* Interactive slider */}
      <div className="relative my-3 h-7 select-none">
        {/* Track */}
        <div className="absolute top-1/2 left-0 right-0 h-2 -translate-y-1/2 rounded-full bg-ink-100" />

        {/* Colored fill 0 → value */}
        <div
          className={`absolute top-1/2 left-0 h-2 -translate-y-1/2 rounded-full ${TIER_BG[tier]} transition-all`}
          style={{ width: `${pct}%` }}
        />

        {/* System anchor tick */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[3px] h-5 bg-gold-600 rounded-full pointer-events-none"
          style={{ left: `${anchorPct}%` }}
          title={`System anchor · ${anchor.toFixed(1)}`}
        />

        {/* Interactive range input (transparent) */}
        <input
          type="range"
          min={0}
          max={max}
          step={0.1}
          value={value}
          onChange={(e) => setClamped(parseFloat(e.target.value))}
          aria-label={`${label} score`}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer range-invisible"
        />

        {/* Thumb visual */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white border-[3px] ${TIER_THUMB[tier]} shadow-md pointer-events-none`}
          style={{ left: `${pct}%` }}
        />
      </div>

      {/* Scale tick labels (0, mid, max) */}
      <div className="flex justify-between text-[10px] font-mono text-ink-300 -mt-1 mb-3 select-none">
        <span>0</span>
        <span>{(max / 2).toFixed(1)}</span>
        <span>{max.toFixed(1)}</span>
      </div>

      {/* Hidden field — what submits */}
      <input type="hidden" name={`score_${criterionKey}`} value={value.toFixed(1)} />

      {/* Number entry + tier label + justification chip */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="number"
          value={value.toFixed(1)}
          onChange={(e) => setClamped(parseFloat(e.target.value))}
          step={0.1}
          min={0}
          max={max}
          className="w-20 bg-white border border-soft rounded-md px-3 py-1.5 text-[13px] text-ink-900 font-mono font-medium"
        />
        <Chip tone={tier === "good" ? "good" : tier === "sky" ? "sky" : tier === "warn" ? "warn" : "bad"}>
          {TIER_LABEL[tier]}
        </Chip>
        {beyondFreeRange && (
          <Chip tone="warn">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.27 3 1.73 3z" />
            </svg>
            {L.justificationRequired} ({delta > 0 ? "+" : ""}
            {delta.toFixed(1)} {L.ptVsSystem})
          </Chip>
        )}
      </div>

      {beyondFreeRange && (
        <textarea
          name={`justification_${criterionKey}`}
          defaultValue={initialJustification}
          placeholder={L.justificationPlaceholder}
          rows={2}
          className="w-full mt-3 bg-warn-50 border border-warn-500/30 rounded-md p-3 text-[13px] text-ink-900 placeholder-ink-400 focus:bg-white focus:border-warn-500"
        />
      )}
    </div>
  );
}
