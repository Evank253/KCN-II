export type Packed = {
  names: string[];
  locations: string[];
  dates: string[];
  findings: string[];
};

const MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December";

export function classifyText(text: string): Packed {
  const src = String(text || "");
  const names = [
    ...new Set(src.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3}\b/g) || []),
  ]
    .filter(
      (n) =>
        !new RegExp(
          `^(${MONTHS}|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|The|This|That|Dear|From|Subject)\\b`,
        ).test(n),
    )
    .slice(0, 16);

  const locRe =
    /\b(?:(?:\d{1,5}\s)?[A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)*\s(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Highway|Hwy|County|Parish|City|Township|Airport|Hospital|Jail|Prison|Park|Lake|River|Bridge|Plaza))|(?:City of\s[A-Z][A-Za-z]+)|(?:[A-Z][a-z]+,\s?[A-Z]{2})\b/g;
  const locations = [
    ...new Set((src.match(locRe) || []).map((s) => s.trim())),
  ].slice(0, 16);

  const dateRe = new RegExp(
    `\\b(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2}/\\d{2,4}|(?:${MONTHS})\\s+\\d{1,2},?\\s+\\d{2,4})\\b`,
    "g",
  );
  const dates = [...new Set(src.match(dateRe) || [])].slice(0, 12);

  const findings = src
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length > 28 &&
        /found|stated|reported|witness|autopsy|concluded|determined|alleged|missing|last seen|cause of|ruled|contradict|timeline|location|interview/i.test(
          s,
        ),
    )
    .slice(0, 10);

  return { names, locations, dates, findings };
}

export function parseSearchQueries(briefing: string): string[] {
  const line = briefing.split("\n").find((l) => l.startsWith("SEARCH_QUERIES:"));
  if (!line) return [];
  return line
    .replace(/^SEARCH_QUERIES:\s*/i, "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
}

export function compressImage(source: CanvasImageSource, maxW = 960): string {
  let sw = 960;
  let sh = 720;
  if (source instanceof HTMLVideoElement) {
    sw = source.videoWidth;
    sh = source.videoHeight;
  } else if (source instanceof HTMLImageElement) {
    sw = source.naturalWidth || source.width;
    sh = source.naturalHeight || source.height;
  } else if (source instanceof HTMLCanvasElement) {
    sw = source.width;
    sh = source.height;
  }
  const scale = Math.min(1, maxW / Math.max(sw, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

export function enhanceDoc(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    const v = g > 150 ? 255 : Math.max(0, (g - 40) * 1.35);
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}
