import { createServerFn } from "@tanstack/react-start";
import { classifyText, type Packed } from "./classify";

export type IntelPull = Packed & {
  links: { a: string; rel: string; b: string }[];
  from: "ai" | "local";
};

function localPull(text: string): IntelPull {
  const packed = classifyText(text);
  const links: { a: string; rel: string; b: string }[] = [];
  if (packed.names[0] && packed.locations[0]) links.push({ a: packed.names[0], rel: "associated with", b: packed.locations[0] });
  if (packed.names[0] && packed.orgs[0]) links.push({ a: packed.names[0], rel: "linked to", b: packed.orgs[0] });
  if (packed.names[0] && packed.dates[0]) links.push({ a: packed.names[0], rel: "dated", b: packed.dates[0] });
  if (packed.names[1] && packed.names[0]) links.push({ a: packed.names[0], rel: "named with", b: packed.names[1] });
  return { ...packed, links, from: "local" };
}

export const extractIntel = createServerFn({ method: "POST" })
  .validator((input: { text: string; sourceName: string }) => input)
  .handler(async ({ data }): Promise<IntelPull> => {
    const text = String(data.text || "").slice(0, 8000);
    const local = localPull(text);
    if (!text.trim()) return local;
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return local;
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(12000),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "grok-4.5",
          max_tokens: 900,
          temperature: 0,
          messages: [
            {
              role: "system",
              content:
                "You extract investigative entities from source text. Return ONLY JSON. No markdown. Human review required. Do not invent.",
            },
            {
              role: "user",
              content: `SOURCE: ${data.sourceName || "ingest"}\n\nTEXT:\n${text}\n\nJSON shape:\n{"names":[],"locations":[],"dates":[],"times":[],"orgs":[],"things":[],"findings":[],"links":[{"a":"","rel":"","b":""}]}`,
            },
          ],
        }),
      });
      if (!res.ok) return local;
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = body.choices?.[0]?.message?.content || "";
      const json = raw.replace(/^```json\s*|\s*```$/g, "").trim();
      const start = json.indexOf("{");
      const end = json.lastIndexOf("}");
      if (start < 0 || end <= start) return local;
      const parsed = JSON.parse(json.slice(start, end + 1)) as Partial<IntelPull>;
      const arr = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x || "").trim()).filter(Boolean) : []);
      const links = Array.isArray(parsed.links)
        ? parsed.links
            .map((l) => ({
              a: String((l as { a?: string }).a || "").trim(),
              rel: String((l as { rel?: string }).rel || "linked to").trim(),
              b: String((l as { b?: string }).b || "").trim(),
            }))
            .filter((l) => l.a && l.b)
        : [];
      return {
        names: [...new Set([...arr(parsed.names), ...local.names])].slice(0, 24),
        locations: [...new Set([...arr(parsed.locations), ...local.locations])].slice(0, 20),
        dates: [...new Set([...arr(parsed.dates), ...local.dates])].slice(0, 16),
        times: [...new Set([...arr(parsed.times), ...local.times])].slice(0, 12),
        orgs: [...new Set([...arr(parsed.orgs), ...local.orgs])].slice(0, 16),
        things: [...new Set([...arr(parsed.things), ...local.things])].slice(0, 16),
        findings: [...new Set([...arr(parsed.findings), ...local.findings])].slice(0, 16),
        links: [...links, ...local.links].slice(0, 24),
        from: "ai",
      };
    } catch {
      return local;
    }
  });
