import { Eyebrow } from "@/components/ui";

export type LedgerEntry = {
  date: Date | string;
  kind: "task" | "feedback" | "achievement";
  delta: number;
  label: string;
  source?: string;
};

const KIND_COLOR: Record<LedgerEntry["kind"], string> = {
  task: "bg-sky-500",
  feedback: "bg-gold-500",
  achievement: "bg-good-500",
};
const KIND_TEXT_TONE: Record<LedgerEntry["kind"], string> = {
  task: "text-sky-700",
  feedback: "text-gold-700",
  achievement: "text-good-700",
};
const KIND_LABEL: Record<LedgerEntry["kind"], string> = {
  task: "task",
  feedback: "peer",
  achievement: "achievement",
};

/**
 * The Pulse Ledger — every score-impacting event shown like a transaction.
 * Magnitude bar visualises the contribution; sign coloured for + vs -.
 */
export function PulseLedger({
  entries,
  labels,
  locale = "en",
}: {
  entries: LedgerEntry[];
  labels?: {
    eyebrow?: string;
    title?: string;
    subtitle?: string;
    kinds?: Partial<Record<LedgerEntry["kind"], string>>;
  };
  locale?: "en" | "ar";
}) {
  if (entries.length === 0) return null;

  const maxAbs = Math.max(0.1, ...entries.map((e) => Math.abs(e.delta)));

  const sorted = [...entries]
    .map((e) => ({ ...e, date: new Date(e.date) }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const localKind = (k: LedgerEntry["kind"]) =>
    labels?.kinds?.[k] ?? KIND_LABEL[k];

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-soft">
        <Eyebrow muted>{labels?.eyebrow ?? "Pulse ledger"}</Eyebrow>
        <div className="font-display text-xl text-ink-900 mt-1">
          {labels?.title ?? "Every event that moved your score"}
        </div>
        <div className="text-[11px] text-ink-400 mt-1">
          {labels?.subtitle ?? `${sorted.length} entries · most recent first`}
        </div>
      </div>

      <div className="max-h-[440px] overflow-y-auto">
        <ul className="divide-soft">
          {sorted.map((e, i) => {
            const pct = Math.abs(e.delta) / maxAbs;
            const positive = e.delta >= 0;
            return (
              <li key={i} className="px-6 py-3 hover:bg-ink-50/60 transition">
                <div className="flex items-start gap-3">
                  {/* Kind dot */}
                  <div className="pt-1.5">
                    <span className={`block w-2 h-2 rounded-full ${KIND_COLOR[e.kind]}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] text-ink-900 leading-snug truncate" title={e.label}>
                          {e.label}
                        </div>
                        <div className="text-[10px] text-ink-400 mt-0.5">
                          <span className={KIND_TEXT_TONE[e.kind]}>{localKind(e.kind)}</span>
                          <span className="mx-1.5 text-ink-300">·</span>
                          {formatDate(e.date as Date, locale)}
                        </div>
                      </div>
                      <div
                        className={`font-mono text-[13px] font-semibold tabular-nums flex-shrink-0 ${
                          positive ? "text-good-700" : "text-bad-700"
                        }`}
                      >
                        {positive ? "+" : ""}
                        {e.delta.toFixed(2)}
                      </div>
                    </div>

                    {/* Magnitude bar */}
                    <div className="flex items-center mt-2">
                      <div className="flex-1 relative h-1 bg-ink-100 rounded-full overflow-hidden">
                        {positive ? (
                          <div
                            className={`absolute left-1/2 top-0 bottom-0 ${KIND_COLOR[e.kind]} rounded-full`}
                            style={{ width: `${pct * 50}%` }}
                          />
                        ) : (
                          <div
                            className="absolute right-1/2 top-0 bottom-0 bg-bad-500 rounded-full"
                            style={{ width: `${pct * 50}%` }}
                          />
                        )}
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-ink-300" />
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function formatDate(d: Date, locale: "en" | "ar" = "en") {
  const diff = (Date.now() - d.getTime()) / 1000;
  if (locale === "ar") {
    if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} ساعة`;
    if (diff < 7 * 86400) return `قبل ${Math.floor(diff / 86400)} يوم`;
    return d.toLocaleDateString("ar-SA", { month: "short", day: "numeric" });
  }
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}
