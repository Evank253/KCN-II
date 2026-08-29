import { createServerFn } from "@tanstack/react-start";

const MAX_B64 = 6_000_000;

export const transcribeAudio = createServerFn({ method: "POST" })
  .validator((input: { name: string; mime: string; base64: string }) => input)
  .handler(async ({ data }): Promise<{ ok: boolean; text: string; error?: string }> => {
    const apiKey = process.env.XAI_API_KEY;
    const b64 = String(data.base64 || "");
    if (!b64) return { ok: false, text: "", error: "No audio." };
    if (b64.length > MAX_B64) return { ok: false, text: "", error: "Audio is too large to transcribe here." };
    if (!apiKey) return { ok: false, text: "", error: "Transcription is not available here." };
    try {
      const bin = Buffer.from(b64, "base64");
      const blob = new Blob([bin], { type: data.mime || "audio/mpeg" });
      const form = new FormData();
      form.append("file", blob, data.name || "memo.mp3");
      const res = await fetch("https://api.x.ai/v1/stt", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      if (!res.ok) return { ok: false, text: "", error: `Transcription failed (${res.status}).` };
      const body = (await res.json()) as { text?: string; transcript?: string };
      const text = String(body.text || body.transcript || "").trim();
      return text ? { ok: true, text } : { ok: false, text: "", error: "No speech detected." };
    } catch {
      return { ok: false, text: "", error: "Transcription did not finish." };
    }
  });
