import type { AliasHit, Contradiction, KcnState, Person, VerifyStatus } from "./store";

export function caseDigest(s: KcnState, cap = 6000): string {
  const people = s.people || [];
  const cases = s.cases || [];
  const orgs = s.orgs || [];
  const locations = s.locations || [];
  const findings = s.findings || [];
  const events = s.events || [];
  const contradictions = s.contradictions || [];
  const parts = [
    `CASE: ${cases.map((c) => c.title + " [" + c.status + "]").join("; ")}`,
    people.length ? `PEOPLE: ${people.map((p) => p.name + " (" + p.role + ")").join("; ")}` : "",
    orgs.length ? `ORGS: ${orgs.map((o) => o.name).join("; ")}` : "",
    locations.length ? `PLACES: ${locations.map((l) => l.name).join("; ")}` : "",
    findings.length ? `FINDINGS:\n${findings.slice(0, 12).map((f) => `- [${f.verify || "generated"}] ${f.t}`).join("\n")}` : "",
    events.length ? `TIMELINE:\n${events.slice(0, 12).map((e) => `- ${e.when}: ${e.what}`).join("\n")}` : "",
    contradictions.length ? `FLAGS: ${contradictions.map((c) => c.left.slice(0, 80)).join(" | ")}` : "",
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
  const list = people || [];
  const hits: AliasHit[] = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i].name;
      const b = list[j].name;
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
          id: `${list[i].id}-${list[j].id}`,
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
    ...(s.findings || []).map((f) => ({ t: f.t, src: f.source })),
    ...(s.notes || []).map((n) => ({ t: n.t, src: "note" })),
    ...(s.events || []).map((e) => ({ t: `${e.when} ${e.what}`, src: "timeline" })),
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
  const names = (s.people || []).map((p) => p.name);
  const flags = findContradictions(s);
  const aliases = resolveEntities(s.people || []);
  const files = s.files || [];
  const orgs = s.orgs || [];
  const locations = s.locations || [];
  const relations = s.relations || [];
  const events = s.events || [];
  const evidence = s.evidence || [];
  const acquisitions = s.acquisitions || [];
  const custody = s.custody || [];
  const swarmLog = s.swarmLog || [];
  const findings = s.findings || [];
  return [
    {
      agent: "DOC-ANALYST",
      text: files.length
        ? `${files.length} sources on file. Latest: ${files[0].name}. Extracted text length ${(s.reading || "").length} characters.`
        : "No documents ingested yet.",
    },
    {
      agent: "ENTITY-ANALYST",
      text: names.length
        ? `Board holds ${names.length} people, ${orgs.length} organizations, ${locations.length} locations.`
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
      text: relations.length
        ? `${relations.length} mapped links. Example: ${relations[0].a} ${relations[0].rel} ${relations[0].b}.`
        : "Relationship map is empty.",
    },
    {
      agent: "TIMELINE",
      text: events.length
        ? `${events.length} dated marks. First logged: ${events[events.length - 1]?.when}.`
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
      text: evidence.length
        ? `${evidence.length} evidence items, ${acquisitions.length} acquisitions, ${custody.length} custody events.`
        : "No evidence logged.",
    },
    {
      agent: "OSINT",
      text: swarmLog.length
        ? `Last public-source sweep: ${swarmLog[0].q}${(swarmLog[0].hits || []).length ? ` · ${(swarmLog[0].hits || []).length} hits` : ""}.`
        : "No OSINT sweep has been launched.",
    },
    {
      agent: "SYNTHESIS",
      text: [
        "Human review required.",
        findings.filter((f) => f.verify === "verified").length
          ? `${findings.filter((f) => f.verify === "verified").length} findings marked verified.`
          : "No findings have been verified yet.",
      ].join(" "),
    },
  ];
}

export function buildReport(s: KcnState): string {
  const findings = s.findings || [];
  const people = s.people || [];
  const cases = s.cases || [];
  const files = s.files || [];
  const locations = s.locations || [];
  const evidence = s.evidence || [];
  const custody = s.custody || [];
  const events = s.events || [];
  const relations = s.relations || [];
  const flags = findContradictions(s);
  const aliases = resolveEntities(people);
  const verified = findings.filter((f) => f.verify === "verified");
  const open = findings.filter((f) => !f.verify || f.verify === "generated" || f.verify === "unreviewed");
  return [
    "KCN-II INVESTIGATIVE REPORT",
    `Generated: ${new Date().toISOString()}`,
    "Classification: INVESTIGATOR SENSITIVE — human review required",
    "",
    "1. CASE IDENTIFICATION",
    ...cases.map((c) => `  - ${c.title} [${c.status}] ${c.summary}`),
    "",
    "2. EXECUTIVE SUMMARY",
    `  Sources ${files.length} · People ${people.length} · Locations ${locations.length} · Findings ${findings.length} · Evidence ${evidence.length} · Custody events ${custody.length}.`,
    "",
    "3. SCOPE",
    "  Independent review workspace. Not a court finding. Not law enforcement.",
    "",
    "4. METHODOLOGY",
    "  Collect (camera, files, interview, video, OSINT) → ingest (OCR, hash) → preserve (vault, custody) → analyze (entities, timeline, contradictions, swarm) → verify (human).",
    "",
    "5. FINDINGS",
    ...(findings.length ? findings.map((f) => `  - [${f.verify || "generated"}] ${f.t}  (source: ${f.source})`) : ["  None logged."]),
    "",
    "6. EVIDENCE",
    ...(evidence.length
      ? evidence.map((e) => `  - ${e.id}  ${e.title}  type=${e.type}  hash=${e.hash || "n/a"}  custodian=${e.custodian || "operator"}  status=${e.status || "accepted"}`)
      : ["  None logged."]),
    "",
    "7. TIMELINE",
    ...(events.length ? events.map((e) => `  - ${e.when} — ${e.what}`) : ["  None logged."]),
    "",
    "8. RELATIONSHIPS",
    ...(relations.length ? relations.map((r) => `  - ${r.a} ${r.rel} ${r.b}`) : ["  None mapped."]),
    "",
    "9. CONTRADICTIONS (UNREVIEWED LEADS)",
    ...(flags.length ? flags.map((c) => `  - [${c.severity}] ${(c.left || "").slice(0, 140)}  vs  ${(c.right || "").slice(0, 140)}`) : ["  None flagged."]),
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
