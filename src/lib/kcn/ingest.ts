import { unzipSync, strFromU8 } from "fflate";
import { classifyText } from "./classify";
import { extractIntel } from "./extract";
import { putMedia } from "./media";
import { transcribeAudio } from "./transcribe";
import { nowStamp, useKcn } from "./store";

export type IngestResult = {
  id: string;
  title: string;
  type: string;
  summary: string;
  names: number;
  locations: number;
  findings: number;
};

function nid() {
  return crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 9);
}

function uniqList(list: string[], cap: number) {
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

function kindOf(file: File): "image" | "audio" | "video" | "pdf" | "docx" | "text" | "other" {
  const t = (file.type || "").toLowerCase();
  const n = file.name.toLowerCase();
  if (t.startsWith("image/") || /\.(png|jpe?g|gif|webp|heic|bmp)$/.test(n)) return "image";
  if (t.startsWith("video/") || /\.(mp4|mov|mkv|m4v)$/.test(n)) return "video";
  if (t.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|flac)$/.test(n)) return "audio";
  if (/\.webm$/.test(n)) return t.startsWith("audio/") ? "audio" : "video";
  if (t === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".docx") || t.includes("wordprocessingml")) return "docx";
  if (t.startsWith("text/") || /\.(txt|md|csv|json|html|xml|log)$/.test(n)) return "text";
  return "other";
}

function mimeOf(file: File, kind: ReturnType<typeof kindOf>) {
  if (file.type) return file.type;
  if (kind === "video") return "video/mp4";
  if (kind === "audio") return "audio/mpeg";
  if (kind === "image") return "image/jpeg";
  if (kind === "pdf") return "application/pdf";
  if (kind === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (kind === "text") return "text/plain";
  return "application/octet-stream";
}

function pdfStrings(buf: ArrayBuffer): string {
  const raw = new TextDecoder("latin1").decode(buf);
  const chunks: string[] = [];
  const re = /\((?:\\.|[^\\)]){3,}\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const s = m[0]
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
    if (/[A-Za-z]{3,}/.test(s)) chunks.push(s);
  }
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

function docxText(buf: ArrayBuffer): string {
  try {
    const zip = unzipSync(new Uint8Array(buf));
    const xml = zip["word/document.xml"];
    if (!xml) return "";
    const raw = strFromU8(xml);
    return [...raw.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
      .map((m) => m[1])
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

async function ocrBlob(file: Blob): Promise<string> {
  try {
    const Tesseract = await import("tesseract.js");
    const result = await Tesseract.recognize(file, "eng");
    return (result.data.text || "").trim();
  } catch {
    return "";
  }
}

async function videoMeta(file: File): Promise<{ duration: string; poster: Blob | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.src = url;
    const done = (duration: string, poster: Blob | null) => {
      URL.revokeObjectURL(url);
      resolve({ duration, poster });
    };
    v.onloadeddata = () => {
      try {
        v.currentTime = Math.min(0.4, (v.duration || 1) * 0.05);
      } catch {
        done(fmtDur(v.duration), null);
      }
    };
    v.onseeked = () => {
      try {
        const c = document.createElement("canvas");
        c.width = v.videoWidth || 640;
        c.height = v.videoHeight || 360;
        const ctx = c.getContext("2d");
        ctx?.drawImage(v, 0, 0, c.width, c.height);
        c.toBlob((b) => done(fmtDur(v.duration), b), "image/jpeg", 0.7);
      } catch {
        done(fmtDur(v.duration), null);
      }
    };
    v.onerror = () => done("", null);
    setTimeout(() => done(fmtDur(v.duration), null), 4000);
  });
}

function fmtDur(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "";
  const s = Math.round(n);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

async function fileToB64(file: Blob): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let s = "";
  const step = 0x8000;
  for (let i = 0; i < buf.length; i += step) s += String.fromCharCode(...buf.subarray(i, i + step));
  return btoa(s);
}

export async function ingestSource(file: File): Promise<IngestResult> {
  const store = useKcn.getState();
  const id = nid();
  const kind = kindOf(file);
  const mime = mimeOf(file, kind);
  const type =
    kind === "image" ? "photo" : kind === "other" ? "file" : kind === "docx" || kind === "pdf" || kind === "text" ? "document" : kind;
  let text = "";
  let duration = "";
  let mediaId = "";

  try {
    const saved = await putMedia(id, file, file.name, mime);
    mediaId = saved.id;
  } catch {
    /* still file metadata */
  }

  if (kind === "text") text = await file.text();
  else if (kind === "pdf") text = pdfStrings(await file.arrayBuffer());
  else if (kind === "docx") text = docxText(await file.arrayBuffer());
  else if (kind === "image") text = await ocrBlob(file);
  else if (kind === "audio") {
    if (file.size > 4_500_000) {
      text = "";
    } else {
      try {
        const base64 = await fileToB64(file);
        const r = await transcribeAudio({ data: { name: file.name, mime: mime || "audio/mpeg", base64 } });
        text = r.text || "";
      } catch {
        text = "";
      }
    }
  } else if (kind === "video") {
    const meta = await videoMeta(file);
    duration = meta.duration;
    if (meta.poster) {
      const ocr = await ocrBlob(meta.poster);
      if (ocr) text += ocr + "\n";
    }
  } else {
    try {
      const maybe = await file.text();
      if (/[\x00-\x08]/.test(maybe.slice(0, 200))) text = "";
      else text = maybe;
    } catch {
      text = "";
    }
  }

  const label = file.name || "Ingested source";
  const nameBits = file.name.replace(/[_-]+/g, " ").replace(/\.[a-z0-9]+$/i, "");
  const packed = classifyText([text, nameBits].filter(Boolean).join("\n"));
  let intel = packed;
  const links: { a: string; rel: string; b: string }[] = [];
  const link = (a: string, rel: string, b: string) => {
    if (!a || !b || a.toLowerCase() === b.toLowerCase()) return;
    if (links.some((l) => l.a === a && l.b === b && l.rel === rel)) return;
    if (links.length >= 24) return;
    links.push({ a, rel, b });
  };
  packed.names.slice(0, 5).forEach((n) => {
    packed.locations.slice(0, 4).forEach((p) => link(n, "associated with", p));
    packed.orgs.slice(0, 3).forEach((o) => link(n, "linked to", o));
    packed.dates.slice(0, 3).forEach((d) => link(n, "dated", d));
    packed.times.slice(0, 2).forEach((t) => link(n, "at time", t));
    packed.things.slice(0, 3).forEach((th) => link(n, "linked to", th));
    if (packed.names[1]) link(n, "named with", packed.names[1]);
  });

  const placeish = /street|avenue|road|park|county|department|sheriff|hospital|school|church|plaza|bridge|lake|river/i;
  intel.names = (intel.names || []).filter((n) => {
    if (placeish.test(n)) {
      if (!intel.locations.some((l) => l.toLowerCase() === n.toLowerCase())) intel.locations.push(n);
      return false;
    }
    if ((intel.locations || []).some((l) => l.toLowerCase() === n.toLowerCase())) return false;
    if ((intel.orgs || []).some((o) => o.toLowerCase() === n.toLowerCase())) return false;
    return true;
  });
  if (!intel.findings.length) {
    intel.findings = [
      `${label} filed as ${type}${duration ? " (" + duration + ")" : ""}${text ? "" : " — original stored; no readable text yet"}`,
    ];
  }

  const s = useKcn.getState();
  const people = [...(s.people || [])];
  intel.names.forEach((name) => {
    if (!people.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      people.unshift({ id: nid(), name, role: "Extracted from " + label });
    }
  });
  const locations = [...(s.locations || [])];
  intel.locations.forEach((place) => {
    if (!locations.some((l) => l.name.toLowerCase() === place.toLowerCase())) {
      locations.unshift({ id: nid(), name: place, at: nowStamp(), source: label });
    }
  });
  const orgs = [...(s.orgs || [])];
  (intel.orgs || []).forEach((name) => {
    if (!orgs.some((o) => o.name.toLowerCase() === name.toLowerCase())) {
      orgs.unshift({ id: nid(), name, at: nowStamp() });
    }
  });
  const findings = [
    ...(intel.findings || []).map((f) => ({
      id: nid(),
      t: f,
      at: nowStamp(),
      source: label,
      evidenceId: id,
      verify: "generated" as const,
    })),
    ...(s.findings || []),
  ];
  const events = [
    { id: nid(), when: nowStamp(), what: `Source ingested: ${label} (${type}${duration ? " · " + duration : ""})` },
    ...(intel.dates || []).map((d) => ({ id: nid(), when: d, what: "Date mark from " + label })),
    ...(intel.times || []).map((t) => ({ id: nid(), when: t, what: "Time mark from " + label })),
    ...(s.events || []),
  ];
  const relations = [...(s.relations || []), ...links.filter((l) => l.a && l.b)];
  if (intel.names[0] && intel.locations[0] && !relations.some((r) => r.a === intel.names[0] && r.b === intel.locations[0])) {
    relations.push({ a: intel.names[0], rel: "associated with", b: intel.locations[0] });
  }
  const things = (intel.things || []).map((t) => ({
    id: nid(),
    title: t,
    type: "item",
    at: nowStamp(),
    source: label,
    custodian: s.operator || "Investigator",
    status: "accepted",
  }));

  const ev = {
    id,
    title: label,
    type,
    at: nowStamp(),
    source: label,
    custodian: s.operator || "Investigator",
    status: "accepted" as const,
    mediaId: mediaId || undefined,
    bytes: file.size,
    mime,
    duration: duration || undefined,
  };

  const readingBit = text
    ? `--- SOURCE: ${label} ---\n${text.slice(0, 12000)}`
    : `--- SOURCE: ${label} ---\n[${type} filed${duration ? " · " + duration : ""}. Original stored on this device.]`;

  useKcn.setState({
    reading: (s.reading ? s.reading + "\n\n" : "") + readingBit,
    files: [{ name: label, size: file.size, at: nowStamp() }, ...(s.files || [])],
    evidence: [ev, ...things, ...(s.evidence || [])],
    people,
    locations,
    orgs,
    findings,
    events,
    relations,
    activity: [{ at: nowStamp(), actor: s.operator || "Investigator", action: "ingest", target: label }, ...(s.activity || [])],
    scans:
      kind === "image"
        ? [
            {
              title: label,
              at: nowStamp(),
              names: intel.names.length,
              locations: intel.locations.length,
              findings: intel.findings.length,
              instruction: "Ingest photo",
            },
            ...(s.scans || []),
          ]
        : s.scans,
    video: kind === "video" ? (s.video || id) : s.video,
  });
  store.persist();
  if (text.trim().length > 40) {
    void extractIntel({ data: { text, sourceName: file.name } })
      .then((pulled) => {
        const cur = useKcn.getState();
        const people = [...cur.people];
        pulled.names.forEach((name) => {
          if (!people.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
            people.unshift({ id: nid(), name, role: "Extracted from " + label });
          }
        });
        const locations = [...cur.locations];
        pulled.locations.forEach((place) => {
          if (!locations.some((l) => l.name.toLowerCase() === place.toLowerCase())) {
            locations.unshift({ id: nid(), name: place, at: nowStamp(), source: label });
          }
        });
        const orgs = [...cur.orgs];
        (pulled.orgs || []).forEach((name) => {
          if (!orgs.some((o) => o.name.toLowerCase() === name.toLowerCase())) {
            orgs.unshift({ id: nid(), name, at: nowStamp() });
          }
        });
        const findings = [...cur.findings];
        (pulled.findings || []).forEach((f) => {
          if (!findings.some((x) => x.t.toLowerCase() === f.toLowerCase())) {
            findings.unshift({ id: nid(), t: f, at: nowStamp(), source: label, evidenceId: id, verify: "generated" });
          }
        });
        const events = [...cur.events];
        (pulled.dates || []).forEach((d) => {
          if (!events.some((e) => e.when === d && e.what.includes(label))) {
            events.unshift({ id: nid(), when: d, what: "Date mark from " + label });
          }
        });
        (pulled.times || []).forEach((t) => {
          if (!events.some((e) => e.when === t && e.what.includes(label))) {
            events.unshift({ id: nid(), when: t, what: "Time mark from " + label });
          }
        });
        const relations = [...cur.relations];
        (pulled.links || []).forEach((l) => {
          if (!l.a || !l.b) return;
          if (relations.some((r) => r.a === l.a && r.b === l.b)) return;
          relations.push(l);
        });
        useKcn.setState({ people, locations, orgs, findings, events, relations });
        cur.persist();
      })
      .catch(() => undefined);
  }
  if (file.size <= 8_000_000) {
    const bytes = new Uint8Array(await file.arrayBuffer().catch(() => new ArrayBuffer(0)));
    void store.stampIngest(bytes.length ? bytes : label, label, kind + "-upload").catch(() => undefined);
  } else {
    void store.stampIngest(`${file.name}:${file.size}:${file.lastModified}`, label, kind + "-upload").catch(() => undefined);
  }

  const bits = [
    `${label} filed as ${type}.`,
    intel.names.length ? `${intel.names.length} people` : "",
    intel.locations.length ? `${intel.locations.length} places` : "",
    intel.dates.length ? `${intel.dates.length} dates` : "",
    intel.findings.length ? `${intel.findings.length} findings` : "",
    duration ? `length ${duration}` : "",
    mediaId ? "original stored" : "",
    text ? "text extracted" : "no readable text yet",
  ].filter(Boolean);

  return {
    id,
    title: label,
    type,
    summary: bits.join(" · "),
    names: intel.names.length,
    locations: intel.locations.length,
    findings: intel.findings.length,
  };
}
