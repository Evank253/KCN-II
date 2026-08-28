import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { gateLookupImage } from "./lookup-gate";

export type InspectResult = {
  ok: boolean;
  briefing: string;
  searches: string[];
  error?: string;
};

export const inspectCapture = createServerFn({ method: "POST" })
  .validator(
    (input: {
      instruction: string;
      ocrText: string;
      imageDataUrl: string;
      offDeviceConsent: boolean;
    }) => input,
  )
  .middleware([authMiddleware])
  .handler(async ({ data }): Promise<InspectResult> => {
    const instruction = (data.instruction || "").trim() ||
      "Look this up. Identify what the photo shows and gather useful public information.";
    const ocr = (data.ocrText || "").trim();
    const fail = (error: string): InspectResult => ({
      ok: false,
      briefing: "",
      searches: fallbackSearches(instruction, ocr),
      error,
    });
    try {
    const apiKey = process.env.XAI_API_KEY;
    const gated = gateLookupImage(data.imageDataUrl, !!data.offDeviceConsent);
    const imageDataUrl = gated.image;

    if (data.imageDataUrl && !data.offDeviceConsent) {
      return fail(gated.error || "Off-device photo transfer requires explicit operator consent.");
    }

    if (gated.error && data.imageDataUrl) {
      return fail(gated.error);
    }

    if (!apiKey) {
      return fail("Lookup AI is not available in this environment. Public-source searches are still ready.");
    }

    const prompt = [
      "You are KCN-II, a source-aware investigative desk.",
      "The operator captured a photo (or page) and told you what to do with it.",
      "Follow their instruction. If they asked to look it up, identify the subject, extract names, places, dates, and identifiers, and suggest public-source searches.",
      "Treat OCR as noisy. Human review is required. Do not claim special access. Do not invent facts.",
      "",
      `OPERATOR INSTRUCTION: ${instruction}`,
      ocr ? `OCR TEXT (may be messy):\n${ocr.slice(0, 4000)}` : "OCR TEXT: none",
      imageDataUrl ? "A captured still is attached. Camera metadata was stripped before transfer." : "No photo was authorized to leave the device.",
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
      return fail(`Lookup failed (${res.status}). Public-source searches are still ready.`);
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
    } catch {
      return fail("Lookup failed. Public-source searches are still ready.");
    }
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
