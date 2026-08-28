import { createServerFn } from "@tanstack/react-start";

export type InspectResult = {
  ok: boolean;
  briefing: string;
  searches: string[];
  error?: string;
};

export const inspectCapture = createServerFn({ method: "POST" })
  .validator((input: { instruction: string; ocrText: string; imageDataUrl: string }) => input)
  .handler(async ({ data }): Promise<InspectResult> => {
    const apiKey = process.env.XAI_API_KEY;
    const instruction = (data.instruction || "").trim() ||
      "Look this up. Identify what the photo shows and gather useful public information.";
    const ocr = (data.ocrText || "").trim();
    const imageDataUrl = (data.imageDataUrl || "").trim();

    if (!apiKey) {
      return {
        ok: false,
        briefing: "",
        searches: fallbackSearches(instruction, ocr),
        error: "Lookup AI is not available in this environment. Public-source searches are still ready.",
      };
    }

    const prompt = [
      "You are KCN-II, a source-aware investigative desk.",
      "The operator captured a photo (or page) and told you what to do with it.",
      "Follow their instruction. If they asked to look it up, identify the subject, extract names, places, dates, and identifiers, and suggest public-source searches.",
      "Treat OCR as noisy. Human review is required. Do not claim special access. Do not invent facts.",
      "",
      `OPERATOR INSTRUCTION: ${instruction}`,
      ocr ? `OCR TEXT (may be messy):\n${ocr.slice(0, 4000)}` : "OCR TEXT: none",
      "",
      "Reply in this exact shape:",
      "WHAT THIS APPEARS TO BE:",
      "EXTRACTED MARKS:",
      "LOOKUP ANGLES:",
      "FILE INTO THE CASE:",
      "CAUTION:",
      "SEARCH_QUERIES: query one | query two | query three",
    ].join("\n");

    const content: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    > = [{ type: "text", text: prompt }];

    if (imageDataUrl.startsWith("data:image/")) {
      content.push({ type: "image_url", image_url: { url: imageDataUrl } });
    }

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 1200,
        messages: [{ role: "user", content }],
      }),
    });

    if (!res.ok) {
      return {
        ok: false,
        briefing: "",
        searches: fallbackSearches(instruction, ocr),
        error: `Lookup failed (${res.status}). Public-source searches are still ready.`,
      };
    }

    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const briefing = body.choices?.[0]?.message?.content?.trim() || "";
    const searches = parseQueries(briefing);
    return {
      ok: true,
      briefing,
      searches: searches.length ? searches : fallbackSearches(instruction, ocr),
    };
  });

function parseQueries(briefing: string): string[] {
  const line = briefing.split("\n").find((l) => /^SEARCH_QUERIES:/i.test(l));
  if (!line) return [];
  return line
    .replace(/^SEARCH_QUERIES:\s*/i, "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function fallbackSearches(instruction: string, ocr: string): string[] {
  const blob = `${instruction} ${ocr}`.replace(/\s+/g, " ").trim();
  if (!blob) return [];
  const clip = blob.slice(0, 120);
  return [clip, `${instruction}`.trim()].filter(Boolean).slice(0, 4);
}
