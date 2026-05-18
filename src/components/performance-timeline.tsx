"use client";

import { useMemo, useState } from "react";
import type { TimelineEvent, TimelinePoint } from "@/lib/timeline";

type SerializedPoint = { date: string; value: number };
type SerializedEvent = { date: string; kind: TimelineEvent["kind"]; delta: number; label: string };

const KIND_COLOR: Record<TimelineEvent["kind"], string> = {
  task: "#4F7FD9",
  feedback: "#C9A961",
  achievement: "#3FB87A",
};

export function PerformanceTimeline({
  points: rawPoints,
  events: rawEvents,
  cycleLabel,
  labels,
}: {
  points: SerializedPoint[];
  events: SerializedEvent[];
  cycleLabel: string;
  labels?: {
    eyebrow?: string;
    title?: string;
    legendTask?: string;
    legendFeedback?: string;
    legendAchievement?: string;
  };
}) {
  const KIND_LABEL: Record<TimelineEvent["kind"], string> = {
    task: labels?.legendTask ?? "Task close",
    feedback: labels?.legendFeedback ?? "Peer feedback",
    achievement: labels?.legendAchievement ?? "Achievement",
  };
  const points: TimelinePoint[] = useMemo(
    () => rawPoints.map((p) => ({ date: new Date(p.date), value: p.value })),
    [rawPoints],
  );
  const events: TimelineEvent[] = useMemo(
    () => rawEvents.map((e) => ({ ...e, date: new Date(e.date) })),
    [rawEvents],
  );

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hoverEvent, setHoverEvent] = useState<number | null>(null);

  if (points.length === 0) return null;

  // Plot
  const W = 1000;
  const H = 200;
  const padL = 40;
  const padR = 16;
  const padT = 20;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const minV = Math.max(0, Math.floor(Math.min(...points.map((p) => p.value)) - 4));
  const maxV = Math.min(100, Math.ceil(Math.max(...points.map((p) => p.value)) + 4));
  const xScale = (i: number) => padL + (i / (points.length - 1)) * innerW;
  const yScale = (v: number) => padT + (1 - (v - minV) / Math.max(1, maxV - minV)) * innerH;

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(p.value).toFixed(1)}`).join(" ");
  const areaPath = `${path} L ${xScale(points.length - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${xScale(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

  // Event positions — bucket to nearest point index
  const eventDots = events.map((e, idx) => {
    const dayMs = points[0].date.getTime();
    const lastMs = points[points.length - 1].date.getTime();
    const t = (e.date.getTime() - dayMs) / Math.max(1, lastMs - dayMs);
    const i = Math.max(0, Math.min(points.length - 1, Math.round(t * (points.length - 1))));
    const x = xScale(i);
    const y = yScale(points[i].value);
    return { ...e, idx, x, y, pointIdx: i };
  });

  // X-axis labels (3 markers: -90d, -45d, today)
  const xLabels = [
    { label: formatDateShort(points[0].date), x: xScale(0), align: "start" },
    { label: formatDateShort(points[Math.floor(points.length / 2)].date), x: xScale(Math.floor(points.length / 2)), align: "middle" },
    { label: "Today", x: xScale(points.length - 1), align: "end" },
  ];

  const hovered = hoverIdx != null ? points[hoverIdx] : null;
  const hoveredEv = hoverEvent != null ? eventDots[hoverEvent] : null;

  return (
    <div className="card p-6">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="eyebrow">{labels?.eyebrow ?? "90-day performance timeline"}</div>
          <div className="font-display text-xl text-ink-900 mt-1">{labels?.title ?? "Your Pulse over time"}</div>
        </div>
        <div className="hidden md:flex items-center gap-4 text-[11px]">
          <Legend color={KIND_COLOR.task} label={KIND_LABEL.task} />
          <Legend color={KIND_COLOR.feedback} label={KIND_LABEL.feedback} />
          <Legend color={KIND_COLOR.achievement} label={KIND_LABEL.achievement} />
          <span className="text-ink-400">{cycleLabel}</span>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          onMouseLeave={() => { setHoverIdx(null); setHoverEvent(null); }}
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * W;
            if (x < padL || x > W - padR) { setHoverIdx(null); return; }
            const t = (x - padL) / innerW;
            const i = Math.max(0, Math.min(points.length - 1, Math.round(t * (points.length - 1))));
            setHoverIdx(i);
          }}
        >
          <defs>
            <linearGradient id="pulse-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C9A961" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#C9A961" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y gridlines */}
          {[minV, Math.round((minV + maxV) / 2), maxV].map((v) => (
            <g key={v}>
              <line x1={padL} x2={W - padR} y1={yScale(v)} y2={yScale(v)} stroke="#EBEEF3" strokeDasharray="3,3" />
              <text x={padL - 8} y={yScale(v) + 4} textAnchor="end" fill="#8B96A8" fontSize={10} fontFamily="JetBrains Mono">{v}</text>
            </g>
          ))}

          {/* Area + line */}
          <path d={areaPath} fill="url(#pulse-area)" />
          <path d={path} fill="none" stroke="#A88A4D" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

          {/* Event dots */}
          {eventDots.map((e) => (
            <g
              key={e.idx}
              onMouseEnter={() => setHoverEvent(e.idx)}
              onMouseLeave={() => setHoverEvent(null)}
              style={{ cursor: "pointer" }}
            >
              <circle cx={e.x} cy={e.y} r={hoverEvent === e.idx ? 7 : 4} fill={KIND_COLOR[e.kind]} stroke="#fff" strokeWidth={2} />
            </g>
          ))}

          {/* Hover crosshair */}
          {hovered && hoverIdx != null && (
            <g pointerEvents="none">
              <line x1={xScale(hoverIdx)} x2={xScale(hoverIdx)} y1={padT} y2={padT + innerH} stroke="#0F1E3D" strokeOpacity={0.2} strokeDasharray="2,3" />
              <circle cx={xScale(hoverIdx)} cy={yScale(hovered.value)} r={5} fill="#fff" stroke="#0F1E3D" strokeWidth={2} />
            </g>
          )}

          {/* X labels */}
          {xLabels.map((l, i) => (
            <text key={i} x={l.x} y={H - 8} textAnchor={l.align as "start" | "middle" | "end"} fill="#8B96A8" fontSize={10} fontFamily="JetBrains Mono">{l.label}</text>
          ))}
        </svg>

        {/* Hover tooltip */}
        {hoveredEv && (
          <div
            className="absolute pointer-events-none bg-white border border-soft rounded-lg shadow-lg p-3 text-[12px] max-w-[280px] z-10"
            style={{
              left: `${(hoveredEv.x / W) * 100}%`,
              top: `${(hoveredEv.y / H) * 100}%`,
              transform: "translate(-50%, calc(-100% - 12px))",
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: KIND_COLOR[hoveredEv.kind] }} />
              <span className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">{KIND_LABEL[hoveredEv.kind]}</span>
              <span className="ml-auto text-[10px] font-mono text-ink-400">{formatDateShort(hoveredEv.date)}</span>
            </div>
            <div className="text-ink-900 leading-snug mb-1">{hoveredEv.label}</div>
            <div className={`font-mono text-[11px] font-semibold ${hoveredEv.delta >= 0 ? "text-good-700" : "text-bad-700"}`}>
              {hoveredEv.delta >= 0 ? "+" : ""}{hoveredEv.delta.toFixed(2)} pt
            </div>
          </div>
        )}
        {hovered && !hoveredEv && hoverIdx != null && (
          <div
            className="absolute pointer-events-none bg-white border border-soft rounded-lg shadow-md px-3 py-2 text-[11px] z-10"
            style={{
              left: `${(xScale(hoverIdx) / W) * 100}%`,
              top: `${(yScale(hovered.value) / H) * 100}%`,
              transform: "translate(-50%, calc(-100% - 10px))",
            }}
          >
            <div className="font-mono text-ink-400 text-[10px]">{formatDateShort(hovered.date)}</div>
            <div className="font-mono text-ink-900 font-semibold">Pulse {hovered.value.toFixed(1)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-ink-500">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function formatDateShort(d: Date) {
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}
