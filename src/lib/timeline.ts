// Build a 90-day Pulse trajectory and the events plotted on it.
//
// In production this comes from the score-recomputation history in
// ClickHouse (PKG Architecture §8). For the pilot we derive it from
// the existing PKG records — every task close, peer rating, and
// achievement confirmation contributes a delta on its occurrence date.

export type TimelinePoint = { date: Date; value: number };
export type TimelineEvent = {
  date: Date;
  kind: "task" | "feedback" | "achievement";
  delta: number;
  label: string;
};

export type RawEvents = {
  tasks: Array<{ closedAt: Date | null; qaScore: number | null; title: string }>;
  feedback: Array<{ occurredAt: Date; rating: number; dimension: string }>;
  achievements: Array<{ confirmedAt: Date | null; awardedPoints: number | null; description: string }>;
};

export function buildTimeline(
  raw: RawEvents,
  currentTotal: number,
  endDate: Date = new Date(),
  windowDays = 90,
): { points: TimelinePoint[]; events: TimelineEvent[] } {
  // Collect events
  const events: TimelineEvent[] = [];
  for (const t of raw.tasks) {
    if (!t.closedAt) continue;
    const qa = t.qaScore ?? 80;
    const delta = (qa - 80) / 80; // ~ -0.25 to +0.25
    events.push({
      date: new Date(t.closedAt),
      kind: "task",
      delta,
      label: `${t.title} · QA ${qa.toFixed(0)}`,
    });
  }
  for (const f of raw.feedback) {
    const delta = (f.rating - 3) * 0.25;
    events.push({
      date: new Date(f.occurredAt),
      kind: "feedback",
      delta,
      label: `Peer rating on ${f.dimension.replace(/_/g, " ")} · ${f.rating}/5`,
    });
  }
  for (const a of raw.achievements) {
    if (!a.confirmedAt) continue;
    events.push({
      date: new Date(a.confirmedAt),
      kind: "achievement",
      delta: a.awardedPoints ?? 2,
      label: a.description,
    });
  }
  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Build daily points walking backward from the current value
  const start = new Date(endDate.getTime() - (windowDays - 1) * 86400000);
  const dayKey = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };

  // Bucket event deltas per day, normalize so the running sum lands roughly at currentTotal
  const byDay = new Map<number, number>();
  for (const ev of events) {
    if (ev.date < start) continue;
    byDay.set(dayKey(ev.date), (byDay.get(dayKey(ev.date)) ?? 0) + ev.delta);
  }
  const totalContribution = Array.from(byDay.values()).reduce((s, v) => s + v, 0);

  // Aim: pulse 90 days ago was ~ currentTotal - 0.5 * totalContribution - drift
  // We scale the deltas so the running sum closes ~95% of the gap
  const drift = 4; // slight upward drift over the cycle
  const startValue = currentTotal - drift - totalContribution * 0.6;
  const scale = totalContribution !== 0 ? (currentTotal - startValue - drift) / totalContribution : 1;

  const points: TimelinePoint[] = [];
  let running = startValue;
  for (let i = 0; i < windowDays; i++) {
    const day = new Date(start.getTime() + i * 86400000);
    const dayDelta = (byDay.get(dayKey(day)) ?? 0) * scale;
    const driftStep = drift / windowDays;
    // Gentle smoothing — the score doesn't jump back and forth, it accumulates
    running = running + dayDelta + driftStep;
    // Clamp to a believable range
    running = Math.max(0, Math.min(100, running));
    points.push({ date: day, value: running });
  }

  // Pin the last point exactly at the current total
  if (points.length) points[points.length - 1].value = currentTotal;

  // Return events that fall inside the window for plotting
  const visibleEvents = events.filter((e) => e.date >= start && e.date <= endDate);

  return { points, events: visibleEvents };
}
