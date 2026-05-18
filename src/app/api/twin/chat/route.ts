import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { currentPerson } from "@/lib/session";
import { anthropic, MODEL, hasApiKey } from "@/lib/ai/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TWIN_CHAT_SYSTEM = `You are the Performance AI Twin for an individual employee inside Pulse360, WorkQuest's performance intelligence module.

You are talking to your owner — the employee themselves. This is their private space; nothing here is visible to their manager or HR unless they explicitly share it.

YOUR ROLE
- You observe what they build, what they handle, what their peers say in passing.
- You can answer questions about their current Pulse score, the events that produced it, their advocate brief, their growth signals, and their cycle so far.
- You can help them think about their work, their career direction, and how to position themselves in calibration.
- You can coach them — gently — toward better self-awareness, calibrated thinking, and clarity about their next move.

ALLEGIANCE
- Your allegiance is to the employee. You are NOT a manager's tool or an HR analyst.
- You will NEVER fabricate evidence. If asked to inflate or invent, decline and stay grounded in real PKG data.
- You will NEVER share their private mood signals or predictive risk to anyone else — but it's safe to discuss those with the owner themselves if relevant.

TONE
- Warm and direct. Short responses. No corporate filler.
- One idea per message. If they ask a multi-part question, take the most important part first.
- Treat them like a smart adult — never patronise, never over-praise.

OUTPUT
- Plain prose. No markdown headers, no bullet salad unless the question genuinely calls for a list.
- Keep responses under 120 words unless they ask for depth.
- If you don't know something from the context provided, say so.`;

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const me = await currentPerson();
  if (!me) return new Response("not authenticated", { status: 401 });

  let body: { messages?: ChatMessage[] };
  try { body = await req.json(); } catch { return new Response("bad request", { status: 400 }); }
  const messages = Array.isArray(body.messages) ? body.messages : [];

  if (!hasApiKey()) {
    return new Response(
      JSON.stringify({
        error: "no_api_key",
        message: "Set ANTHROPIC_API_KEY in .env to enable the Twin chat.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // Pull a compact PKG slice for context (kept stable to maximise prompt caching)
  const cycle = await db.cycle.findFirst({
    where: { tenantId: me.tenantId, status: { in: ["OPEN", "CALIBRATION"] } },
    orderBy: { startsAt: "desc" },
  });
  const [score, achievements, feedback] = await Promise.all([
    cycle ? db.cycleScore.findUnique({ where: { cycleId_personId: { cycleId: cycle.id, personId: me.id } } }) : null,
    cycle ? db.achievement.findMany({
      where: { personId: me.id, cycleId: cycle.id, status: { in: ["EMPLOYEE_CONFIRMED", "MANAGER_CONFIRMED"] } },
    }) : Promise.resolve([]),
    cycle ? db.feedbackEvent.findMany({
      where: { ratedPersonId: me.id, cycleId: cycle.id },
    }) : Promise.resolve([]),
  ]);

  const positiveFB = feedback.filter((f) => f.rating >= 4).length;
  const criticalFB = feedback.filter((f) => f.rating === 2).length;
  const hostileFB = feedback.filter((f) => f.rating === 1).length;

  const pkgContext = [
    `OWNER: ${me.fullName} — ${me.jobTitle}, ${me.department}`,
    cycle ? `CYCLE: ${cycle.label} (${cycle.status})` : "CYCLE: none active",
    score
      ? `CURRENT PULSE: ${score.totalScore.toFixed(1)} / 100 (Mgr ${score.managerEval.toFixed(1)}/30, CrossFn ${score.crossFunctionalEval.toFixed(1)}/30, Self ${score.selfAppraisal.toFixed(1)}/20, Achievements ${score.achievementPoints.toFixed(1)}/20)`
      : "CURRENT PULSE: no committed score yet",
    `PEER FEEDBACK SUMMARY: ${feedback.length} ratings — ${positiveFB} positive, ${criticalFB} critical, ${hostileFB} hostile.`,
    `CONFIRMED ACHIEVEMENTS THIS CYCLE (${achievements.length}):`,
    ...achievements.slice(0, 8).map((a, i) => `${i + 1}. [${a.awardedPoints ?? a.proposedPoints}pt · ${a.category}] ${a.description}`),
  ].join("\n");

  // Audit
  await db.auditEntry.create({
    data: {
      tenantId: me.tenantId, actorId: me.id, actorRole: me.role,
      action: "TWIN_CHAT", subjectKind: "person", subjectId: me.id,
    },
  });

  // Stream Claude's response back to the client.
  // Per claude-api skill: Opus 4.7, adaptive thinking explicit-disabled is fine
  // since we want fast chat turns, and `cache_control` on the long system prompt.
  try {
    const stream = anthropic().messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system: [
        { type: "text", text: TWIN_CHAT_SYSTEM, cache_control: { type: "ephemeral" } },
        { type: "text", text: pkgContext, cache_control: { type: "ephemeral" } },
      ],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          controller.enqueue(encoder.encode(`\n\n[error: ${msg}]`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: "claude_error", message: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
