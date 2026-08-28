import type { AliasHit, Contradiction, KcnState, Person, VerifyStatus } from "./store";

export function caseDigest(s: KcnState, cap = 6000): string {
  const parts = [
    `CASE: ${s.cases.map((c) => c.title + " [" + c.status + "]").join("; ")}`,
    s.people.length ? `PEOPLE: ${s.people.map((p) => p.name + " (" + p.role + ")").join("; ")}` : "",
    s.orgs.length ? `ORGS: ${s.orgs.map((o) => o.name).join("; ")}` : "",
    s.locations.length ? `PLACES: ${s.locations.map((l) => l.name).join("; ")}` : "",
    s.findings.length ? `FINDINGS:\n${s.findings.slice(0, 12).map((f) => `- [${f.verify || "generated"}] ${f.t}`).join("\n")}` : "",
    s.events.length ? `TIMELINE:\n${s.events.slice(0, 12).map((e) => `- ${e.when}: ${e.what}`).join("\n")}` : "",
    s.contradictions.length ? `FLAGS: ${s.contradictions.map((c) => c.left.slice(0, 80)).join(" | ")}` : "",
    s.reading ? `SOURCE TEXT:\n${s.reading}` : "",
  ].filter(Boolean);
  return parts.join("\n\n").slice(0, cap);
}

function normName(n: string) {
  return n.toLowerCase().replace(/[.]/g, "").replace(/\s+/g, " ").trim();
}

function parts(n: string) {
  const bits = normName(n).split(" ").filter(Boolean);
  return { first: bits[0] || "", last: bits[bits.length - 1] || "", bits };
}

export function resolveEntities(people: Person[]): AliasHit[] {
  const hits: AliasHit[] = [];
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const a = people[i].name;
      const b = people[j].name;
      const na = normName(a);
      const nb = normName(b);
      if (!na || !nb) continue;
      let confidence = 0;
      let why = "";
      if (na === nb) {
        confidence = 0.96;
        why = "Exact match after normalization.";
      } else {
        const pa = parts(a);
        const pb = parts(b);
        if (pa.last && pa.last === pb.last && pa.first && pb.first) {
          if (pa.first[0] === pb.first[0] && (pa.first.length <= 2 || pb.first.length <= 2)) {
            confidence = 0.74;
            why = `Same surname, matching first initial (${pa.first[0].toUpperCase()}). Human review required.`;
          } else if (Math.abs(pa.first.length - pb.first.length) <= 2 && pa.first.slice(0, 3) === pb.first.slice(0, 3)) {
            confidence = 0.62;
            why = "Same surname, first names share a prefix.";
          }
        }
      }
      if (confidence >= 0.6) {
        hits.push({
          id: `${people[i].id}-${people[j].id}`,
          a,
          b,
          confidence,
          why,
          status: "candidate",
        });
      }
    }
  }
  return hits.sort((x, y) => y.confidence - x.confidence).slice(0, 24);
}

const NEG = /\b(not|never|no|denied|wasn't|was not|weren't|did not|didn't|untrue|false|contradict)\b/i;

export function findContradictions(s: KcnState): Contradiction[] {
  const lines = [
    ...s.findings.map((f) => ({ t: f.t, src: f.source })),
    ...s.notes.map((n) => ({ t: n.t, src: "note" })),
    ...s.events.map((e) => ({ t: `${e.when} ${e.what}`, src: "timeline" })),
  ].filter((x) => x.t && x.t.length > 18);
  const out: Contradiction[] = [];
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const A = lines[i].t;
      const B = lines[j].t;
      const negA = NEG.test(A);
      const negB = NEG.test(B);
      if (negA === negB) continue;
      const wordsA = new Set(A.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 4));
      const shared = B.toLowerCase().split(/[^a-z0-9]+/).filter((w) => wordsA.has(w));
      if (shared.length < 2) continue;
      out.push({
        id: `c-${i}-${j}`,
        left: A,
        right: B,
        severity: shared.length >= 4 ? "high" : shared.length >= 3 ? "medium" : "low",
        sources: `${lines[i].src} vs ${lines[j].src}`,
        status: "flagged",
      });
    }
  }
  return out.slice(0, 20);
}

export function swarmBrief(s: KcnState): { agent: string; text: string }[] {
  const names = s.people.map((p) => p.name);
  const flags = findContradictions(s);
  const aliases = resolveEntities(s.people);
  return [
    {
      agent: "DOC-ANALYST",
      text: s.files.length
        ? `${s.files.length} sources on file. Latest: ${s.files[0].name}. Extracted text length ${s.reading.length} characters.`
        : "No documents ingested yet.",
    },
    {
      agent: "ENTITY-ANALYST",
      text: names.length
        ? `Board holds ${names.length} people, ${s.orgs.length} organizations, ${s.locations.length} locations.`
        : "No entities on the board.",
    },
    {
      agent: "RESOLVER",
      text: aliases.length
        ? `${aliases.length} possible identity overlaps, top confidence ${(aliases[0].confidence * 100).toFixed(0)}% (${aliases[0].a} / ${aliases[0].b}).`
        : "No alias candidates from current names.",
    },
    {
      agent: "REL-GRAPH",
      text: s.relations.length
        ? `${s.relations.length} mapped links. Example: ${s.relations[0].a} ${s.relations[0].rel} ${s.relations[0].b}.`
        : "Relationship map is empty.",
    },
    {
      agent: "TIMELINE",
      text: s.events.length
        ? `${s.events.length} dated marks. First logged: ${s.events[s.events.length - 1]?.when}.`
        : "No timeline events yet.",
    },
    {
      agent: "CONTRADICTION",
      text: flags.length
        ? `${flags.length} possible conflicts flagged for human review. Highest severity: ${flags[0].severity}.`
        : "No automatic contradictions flagged.",
    },
    {
      agent: "EVIDENCE",
      text: s.evidence.length
        ? `${s.evidence.length} evidence items, ${s.acquisitions.length} acquisitions, ${s.custody.length} custody events.`
        : "No evidence logged.",
    },
    {
      agent: "OSINT",
      text: s.swarmLog.length
        ? `Last public-source sweep: ${s.swarmLog[0].q}`
        : "No OSINT sweep has been launched.",
    },
    {
      agent: "SYNTHESIS",
      text: [
        "Human review required.",
        s.findings.filter((f) => f.verify === "verified").length
          ? `${s.findings.filter((f) => f.verify === "verified").length} findings marked verified.`
          : "No findings have been verified yet.",
      ].join(" "),
    },
  ];
}

export function buildReport(s: KcnState): string {
  const flags = findContradictions(s);
  const aliases = resolveEntities(s.people);
  const verified = s.findings.filter((f) => f.verify === "verified");
  const open = s.findings.filter((f) => !f.verify || f.verify === "generated" || f.verify === "unreviewed");
  return [
    "KCN-II INVESTIGATIVE REPORT",
    `Generated: ${new Date().toISOString()}`,
    "Classification: INVESTIGATOR SENSITIVE — human review required",
    "",
    "1. CASE IDENTIFICATION",
    ...s.cases.map((c) => `  - ${c.title} [${c.status}] ${c.summary}`),
    "",
    "2. EXECUTIVE SUMMARY",
    `  Sources ${s.files.length} · People ${s.people.length} · Locations ${s.locations.length} · Findings ${s.findings.length} · Evidence ${s.evidence.length} · Custody events ${s.custody.length}.`,
    "",
    "3. SCOPE",
    "  Independent review workspace. Not a court finding. Not law enforcement.",
    "",
    "4. METHODOLOGY",
    "  Collect (camera, files, interview, video, OSINT) → ingest (OCR, hash) → preserve (vault, custody) → analyze (entities, timeline, contradictions, swarm) → verify (human).",
    "",
    "5. FINDINGS",
    ...(s.findings.length ? s.findings.map((f) => `  - [${f.verify || "generated"}] ${f.t}  (source: ${f.source})`) : ["  None logged."]),
    "",
    "6. EVIDENCE",
    ...(s.evidence.length
      ? s.evidence.map((e) => `  - ${e.id}  ${e.title}  type=${e.type}  hash=${e.hash || "n/a"}  custodian=${e.custodian || "operator"}  status=${e.status || "accepted"}`)
      : ["  None logged."]),
    "",
    "7. TIMELINE",
    ...(s.events.length ? s.events.map((e) => `  - ${e.when} — ${e.what}`) : ["  None logged."]),
    "",
    "8. RELATIONSHIPS",
    ...(s.relations.length ? s.relations.map((r) => `  - ${r.a} ${r.rel} ${r.b}`) : ["  None mapped."]),
    "",
    "9. CONTRADICTIONS (UNREVIEWED LEADS)",
    ...(flags.length ? flags.map((c) => `  - [${c.severity}] ${c.left.slice(0, 140)}  vs  ${c.right.slice(0, 140)}`) : ["  None flagged."]),
    "",
    "10. ENTITY RESOLUTION CANDIDATES",
    ...(aliases.length ? aliases.map((a) => `  - ${a.a} ~ ${a.b}  (${Math.round(a.confidence * 100)}%) ${a.why}`) : ["  None."]),
    "",
    "11. UNRESOLVED LEADS",
    `  Unverified findings: ${open.length}. Verified: ${verified.length}.`,
    "",
    "12. LIMITATIONS",
    "  OCR is noisy. Lookups use public sources and optional AI. Output is not testimony.",
    "",
    "13. INVESTIGATOR REVIEW",
    "  Status: draft. Human review required before publication.",
  ].join("\n");
}

export const VERIFY_FLOW: VerifyStatus[] = [
  "generated",
  "unreviewed",
  "corroborated",
  "verified",
  "disputed",
  "rejected",
];
