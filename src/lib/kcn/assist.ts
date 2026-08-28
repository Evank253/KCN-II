import { createServerFn } from "@tanstack/react-start";

export const askCase = createServerFn({ method: "POST" })
  .validator((input: { question: string; digest: string }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    const question = (data.question || "").trim().slice(0, 500);
    const digest = (data.digest || "").slice(0, 6000);
    if (!question) return { ok: false as const, text: "No question." };
    if (!apiKey) {
      return {
        ok: false as const,
        text: "AI assistant is not available here. Local case analysis is still on the board.",
      };
    }
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 900,
        messages: [
          {
            role: "system",
            content:
              "You are KCN-II, a source-aware investigative assistant. Use only the case digest. Flag uncertainty. Human review is required. Do not invent sources. Do not claim official status.",
          },
          {
            role: "user",
            content: `CASE DIGEST:\n${digest || "(empty)"}\n\nOPERATOR QUESTION:\n${question}`,
          },
        ],
      }),
    });
    if (!res.ok) return { ok: false as const, text: `Assistant failed (${res.status}).` };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content?.trim() || "No answer.";
    return { ok: true as const, text };
  });
