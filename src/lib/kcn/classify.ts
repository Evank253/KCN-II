export type Packed = {
  names: string[];
  locations: string[];
  dates: string[];
  times: string[];
  orgs: string[];
  things: string[];
  findings: string[];
};

const MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December";
const MONTHS_SHORT = "Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec";
const STOP = new Set(
  `The This That These Those Dear From Subject Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April May June July August September October November December North South East West New Old Inc Llc Corp Street St Avenue Ave Road Rd Boulevard Blvd Lane Drive Court Way Highway County Parish City Township Airport Hospital Jail Prison Park Lake River Bridge Plaza Circle Place Department Dept Agency Company School Church University Sheriff Police Office News Tribune Index Journal Post Herald Times Press Gazette Daily Weekly Machine Hammer Who Am Could Co Id DNA Metal Metalcore Wikipedia Google Wayback Superior Plant Center National Power Children Exploited List Unsolved`.split(
    " ",
  ),
);

function uniq(list: string[], cap: number) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const s = String(raw || "").replace(/\s+/g, " ").trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= cap) break;
  }
  return out;
}

export function looksLikePerson(n: string) {
  const s = String(n || "").replace(/\s+/g, " ").trim();
  if (!s) return false;
  const bits = s.split(/[\s,]+/).filter(Boolean);
  if (bits.length < 2 || bits.length > 3) return false;
  if (bits.some((b) => STOP.has(b) || STOP.has(b.charAt(0) + b.slice(1).toLowerCase()))) return false;
  if (bits.some((b) => b.length < 3 && !/^(Jr|Sr|II|IV)$/.test(b))) return false;
  if (/News|Tribune|Index|Journal|Herald|Times|Post|Press|Gazette|Wikipedia|Google|Machine|Plant|Center|National|Power|Children|Exploited|List|Unsolved|County|Court/i.test(s)) return false;
  return /^[A-Z][a-z]+(?:[\s,]+[A-Z][a-z]+){1,2}$/.test(s);
}

export function classifyText(text: string): Packed {
  try {
    const src = String(text || "");
    const nameHits = [
      ...(src.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g) || []),
      ...(src.match(/\b[A-Z]{2,}(?:\s+[A-Z]{2,}){1,3}\b/g) || []),
      ...(src.match(/\b[A-Z][a-z]+,\s+[A-Z][a-z]+\b/g) || []),
    ];
    const names = uniq(nameHits.filter((n) => looksLikePerson(n)), 24);

    const locRe =
      /\b(?:(?:\d{1,5}\s)?[A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)*\s(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Lane|Ln\.?|Drive|Dr\.?|Court|Ct\.?|Way|Highway|Hwy\.?|County|Parish|City|Township|Airport|Hospital|Jail|Prison|Park|Lake|River|Bridge|Plaza|Circle|Place))|(?:City of\s[A-Z][A-Za-z]+)|(?:[A-Z][a-z]+(?:\s[A-Z][a-z]+)?,\s?[A-Z]{2})\b/g;
    const locations = uniq((src.match(locRe) || []).map((s) => s.replace(/\s+/g, " ").trim()), 20);

    const dateRe = new RegExp(
      `\\b(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2}/\\d{2,4}|(?:${MONTHS}|${MONTHS_SHORT})\\.?\\s+\\d{1,2},?\\s+\\d{2,4}|\\d{1,2}\\s+(?:${MONTHS}|${MONTHS_SHORT})\\.?\\s+\\d{2,4})\\b`,
      "g",
    );
    const dates = uniq(src.match(dateRe) || [], 16);

    const times = uniq(src.match(/\b(?:[01]?\d|2[0-3]):[0-5]\d(?:\s?(?:AM|PM|am|pm))?\b/g) || [], 12);

    const orgs = uniq(
      src.match(
        /\b[A-Z][A-Za-z0-9&.\-']+(?:\s+[A-Z][A-Za-z0-9&.\-']+){0,4}\s(?:Inc\.?|LLC|Corp\.?|Company|Agency|Department|Dept\.?|Church|School|Hospital|University|PD|Sheriff|Police|Office)\b/g,
      ) || [],
      16,
    );

    const things = uniq(
      [
        ...(src.match(/\b(?:case|file|report|warrant|badge|plate|vin|ssn|dob)\s*[:#]?\s*[A-Za-z0-9\-]{3,}\b/gi) || []),
        ...(src.match(/\b[A-Z]{1,3}[-\s]?\d{3,4}[A-Z]?\b/g) || []),
        ...(src.match(/\b(?:\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4})\b/g) || []),
      ],
      16,
    );

    const findings = uniq(
      src
        .split(/(?<=[.!?])\s+|\n+/)
        .map((s) => s.trim())
        .filter(
          (s) =>
            s.length > 18 &&
            /found|stated|reported|witness|autopsy|concluded|determined|alleged|missing|last seen|cause of|ruled|contradict|timeline|location|interview|said|told|died|death|body|suspect|victim|arrest|warrant|vehicle|phone|address|occurred|between|around|approximately/i.test(
              s,
            ),
        ),
      16,
    );

    return { names, locations, dates, times, orgs, things, findings };
  } catch {
    return { names: [], locations: [], dates: [], times: [], orgs: [], things: [], findings: [] };
  }
}

export function compressImage(source: CanvasImageSource, maxW = 960): string {
  try {
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
  } catch {
    return "";
  }
}

export function enhanceDoc(ctx: CanvasRenderingContext2D, w: number, h: number) {
  try {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      const v = g > 150 ? 255 : Math.max(0, (g - 40) * 1.35);
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
  } catch {
    /* tainted or detached canvas */
  }
}
