import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { tierForValue, TIER_GRADIENT, TIER_TEXT } from "@/lib/tiers";

export function Card({
  children,
  className,
  hover,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      className={cn("card p-6", hover && "card-hover transition", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Eyebrow({
  children,
  muted,
  className,
}: {
  children: ReactNode;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(muted ? "eyebrow-muted" : "eyebrow", className)}>
      {children}
    </div>
  );
}

export function Chip({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "good" | "warn" | "bad" | "gold" | "sky";
  className?: string;
}) {
  const tones: Record<string, string> = {
    default: "",
    good: "!bg-good-50 !border-good-500/30 !text-good-700",
    warn: "!bg-warn-50 !border-warn-500/30 !text-warn-700",
    bad:  "!bg-bad-50 !border-bad-500/30 !text-bad-700",
    gold: "!bg-gold-50 !border-gold-600/30 !text-gold-700",
    sky:  "!bg-sky-50 !border-sky-500/30 !text-sky-700",
  };
  return <span className={cn("chip", tones[tone], className)}>{children}</span>;
}

const AVATAR_PALETTES: Record<string, string> = {
  employee: "from-gold-300 to-gold-500 text-ink-900",
  manager:  "from-sky-400 to-sky-600 text-white",
  hrbp:     "from-ink-700 to-ink-900 text-white",
  hr_admin: "from-ink-700 to-ink-900 text-white",
};

export function Avatar({
  name,
  role = "employee",
  size = 40,
  className,
}: {
  name: string;
  role?: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className={cn(
        "rounded-full bg-gradient-to-br flex items-center justify-center font-semibold font-display shrink-0",
        AVATAR_PALETTES[role] ?? AVATAR_PALETTES.employee,
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}

export function DimensionBar({
  label,
  helper,
  value,
  max,
}: {
  label: string;
  helper?: string;
  value: number | null;
  max: number;
}) {
  const pct = value === null ? 0 : Math.min(100, (value / max) * 100);
  const tier = value === null ? null : tierForValue(value, max);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2 gap-2">
        <div className="min-w-0">
          <div className="text-[13px] text-ink-800 font-medium">{label}</div>
          {helper && <div className="text-[11px] text-ink-400 mt-0.5">{helper}</div>}
        </div>
        <div className="text-end flex-shrink-0">
          {value === null ? (
            <span className="text-[12px] text-ink-400 italic">pending</span>
          ) : (
            <span className="font-mono text-[13px]">
              <span className={cn("font-semibold", tier && TIER_TEXT[tier])}>{value.toFixed(1)}</span>
              <span className="text-ink-400"> / {max}</span>
            </span>
          )}
        </div>
      </div>
      <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
        {value !== null && tier && (
          <div
            className={cn("h-full rounded-full transition-all", TIER_GRADIENT[tier])}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Four nested score-ring arcs: Manager (30) outermost, then Cross-Functional (30),
 * Self (20), Achievement (20). PRD §4.3.
 *
 * Adapted for light backgrounds with stronger contrast on the track and
 * a deep-navy total label.
 */
export function ScoreRing({
  total,
  managerEval,
  crossFunctional,
  selfAppraisal,
  achievement,
  size = 220,
  breathe = true,
}: {
  total: number;
  managerEval: number;
  crossFunctional: number;
  selfAppraisal: number;
  achievement: number;
  size?: number;
  breathe?: boolean;
}) {
  const cx = size / 2;
  const arcLen = (val: number, max: number, radius: number) => {
    const circ = 2 * Math.PI * radius;
    return (val / max) * circ;
  };
  const r1 = size * 0.43;
  const r2 = size * 0.37;
  const r3 = size * 0.32;
  const r4 = size * 0.27;
  const TIER_HEX: Record<string, string> = {
    bad: "#B83943",  // bad-600
    warn: "#BF8120", // warn-600
    sky: "#2F60BB",  // sky-600
    good: "#2F9A60", // good-600
  };
  const totalTier = tierForValue(total, 100);
  const totalColor = TIER_HEX[totalTier];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={breathe ? "breath" : undefined}>
      {/* Track */}
      <circle cx={cx} cy={cx} r={r1} fill="none" stroke="#EBEEF3" strokeWidth={10} />
      <circle cx={cx} cy={cx} r={r2} fill="none" stroke="#F4F6FB" strokeWidth={6} />
      <circle cx={cx} cy={cx} r={r3} fill="none" stroke="#F4F6FB" strokeWidth={6} />
      <circle cx={cx} cy={cx} r={r4} fill="none" stroke="#F4F6FB" strokeWidth={6} />
      {/* Arcs */}
      <circle
        cx={cx} cy={cx} r={r1}
        fill="none" stroke="#2F60BB" strokeWidth={10} strokeLinecap="round"
        strokeDasharray={`${arcLen(managerEval, 30, r1)} ${2 * Math.PI * r1}`}
        transform={`rotate(-90 ${cx} ${cx})`}
      />
      <circle
        cx={cx} cy={cx} r={r2}
        fill="none" stroke="#7AA0E8" strokeWidth={6} strokeLinecap="round"
        strokeDasharray={`${arcLen(crossFunctional, 30, r2)} ${2 * Math.PI * r2}`}
        transform={`rotate(-90 ${cx} ${cx})`}
      />
      <circle
        cx={cx} cy={cx} r={r3}
        fill="none" stroke="#A88A4D" strokeWidth={6} strokeLinecap="round"
        strokeDasharray={`${arcLen(selfAppraisal, 20, r3)} ${2 * Math.PI * r3}`}
        transform={`rotate(-90 ${cx} ${cx})`}
      />
      <circle
        cx={cx} cy={cx} r={r4}
        fill="none" stroke="#D9BD7A" strokeWidth={6} strokeLinecap="round"
        strokeDasharray={`${arcLen(achievement, 20, r4)} ${2 * Math.PI * r4}`}
        transform={`rotate(-90 ${cx} ${cx})`}
      />
      <text x={cx} y={cx - 2} textAnchor="middle" fill={totalColor} fontFamily="Fraunces" fontSize={size * 0.2} fontWeight={600}>
        {total.toFixed(1)}
      </text>
      <text x={cx} y={cx + 18} textAnchor="middle" fill="#8B96A8" fontFamily="Manrope" fontSize={10} letterSpacing={2}>
        YOUR PULSE
      </text>
    </svg>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
      <div>
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="font-display text-4xl text-ink-900 leading-tight">{title}</h1>
        {subtitle && <p className="text-ink-500 text-[15px] mt-2 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone,
  helper,
}: {
  label: string;
  value: string | number;
  tone?: "good" | "warn" | "bad";
  helper?: string;
}) {
  const toneClass =
    tone === "good" ? "text-good-700" :
    tone === "warn" ? "text-warn-700" :
    tone === "bad"  ? "text-bad-700"  : "text-ink-900";
  return (
    <div className="card px-5 py-4">
      <div className="eyebrow-muted">{label}</div>
      <div className={cn("font-display text-3xl mt-1", toneClass)}>{value}</div>
      {helper && <div className="text-[11px] text-ink-400 mt-1">{helper}</div>}
    </div>
  );
}
