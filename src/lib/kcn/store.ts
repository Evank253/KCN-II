import { create } from "zustand";
import { classifyText, looksLikePerson } from "./classify";
import { persistCase } from "./vault";
import { sha256 } from "./crypto";

export type Person = { id: string; name: string; role: string };
export type Org = { id: string; name: string; at: string };
export type Note = { id: string; t: string; at: string };
export type CaseItem = { id: string; title: string; status: string; summary: string };
export type Evidence = {
  id: string;
  title: string;
  type: string;
  at: string;
  source?: string;
  custodian?: string;
  status?: string;
  hash?: string;
  mediaId?: string;
  bytes?: number;
  mime?: string;
  duration?: string;
};
export type EventItem = { id: string; when: string; what: string };
export type Place = { id: string; name: string; at: string; source: string };
export type VerifyStatus = "generated" | "unreviewed" | "corroborated" | "verified" | "disputed" | "rejected";
export type Finding = { id: string; t: string; at: string; source: string; evidenceId?: string; verify?: VerifyStatus };
export type ChatMsg = { role: "you" | "kcn"; text: string };
export type ScanRec = {
  title: string;
  at: string;
  names: number;
  locations: number;
  findings: number;
  instruction: string;
};
export type LookupRec = {
  id: string;
  at: string;
  instruction: string;
  briefing: string;
  searches: string[];
};
export type CustodyEvent = {
  id: string;
  evidenceId: string;
  action: string;
  actor: string;
  at: string;
  reason: string;
  custodian: string;
  prev: string;
  hash: string;
};
export type Acquisition = {
  id: string;
  method: string;
  source: string;
  operator: string;
  tool: string;
  version: string;
  writeBlock: string;
  authorization: string;
  notes: string;
  sourceHash: string;
  acquiredHash: string;
  at: string;
};
export type AliasHit = {
  id: string;
  a: string;
  b: string;
  confidence: number;
  why: string;
  status: "candidate" | "confirmed" | "rejected";
};
export type Contradiction = {
  id: string;
  left: string;
  right: string;
  severity: "low" | "medium" | "high";
  sources: string;
  status: "flagged" | "reviewed" | "resolved";
};
export type Activity = { at: string; actor: string; action: string; target: string };
export type SearchEvent = {
  at: string;
  kind: "task" | "search" | "hit" | "fail" | "note" | "done" | "control";
  source: string;
  text: string;
  url?: string;
};
export type SearchHit = {
  title: string;
  url: string;
  snippet: string;
  source: string;
};
export type SwarmRun = {
  id: string;
  q: string;
  at: string;
  agents: string[];
  engines: [string, string][];
  events: SearchEvent[];
  hits: SearchHit[];
  briefing: string;
  status: "running" | "done" | "failed";
  intent?: string;
  tasks?: {
    id: string;
    agent: string;
    source: string;
    query: string;
    why: string;
    where: string;
    wave: 1 | 2;
    status: string;
    hits: number;
  }[];
};

export type KcnState = {
  files: { name: string; size: number; at: string }[];
  reading: string;
  notes: Note[];
  cases: CaseItem[];
  activeCaseId: string;
  people: Person[];
  orgs: Org[];
  locations: Place[];
  findings: Finding[];
  evidence: Evidence[];
  events: EventItem[];
  relations: { a: string; rel: string; b: string }[];
  chat: ChatMsg[];
  video: string;
  swarmLog: SwarmRun[];
  scans: ScanRec[];
  lookups: LookupRec[];
  custody: CustodyEvent[];
  acquisitions: Acquisition[];
  aliases: AliasHit[];
  contradictions: Contradiction[];
  activity: Activity[];
  operator: string;
};

function nid() {
  return crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 9);
}
export function nowStamp() {
  return new Date().toLocaleString();
}

export const blank = (): KcnState => {
  const id = nid();
  return {
    files: [],
    reading: "",
    notes: [],
    cases: [{ id, title: "Active Case", status: "OPEN", summary: "Primary investigative workspace." }],
    activeCaseId: id,
    people: [],
    orgs: [],
    locations: [],
    findings: [],
    evidence: [],
    events: [],
    relations: [],
    chat: [],
    video: "",
    swarmLog: [],
    scans: [],
    lookups: [],
    custody: [],
    acquisitions: [],
    aliases: [],
    contradictions: [],
    activity: [],
    operator: "Investigator",
  };
};

export function snapshotState(s: KcnState): KcnState {
  const {
    files, reading, notes, cases, activeCaseId, people, orgs, locations, findings, evidence,
    events, relations, chat, video, swarmLog, scans, lookups, custody, acquisitions, aliases,
    contradictions, activity, operator,
  } = s;
  return {
    files, reading, notes, cases, activeCaseId, people, orgs, locations, findings, evidence,
    events, relations, chat, video, swarmLog, scans, lookups, custody, acquisitions, aliases,
    contradictions, activity, operator,
  };
}

type Store = KcnState & {
  hydrateFrom: (data: Partial<KcnState>) => void;
  persist: () => void;
  lockMemory: () => void;
  setReading: (v: string) => void;
  setOperator: (v: string) => void;
  setActiveCase: (id: string) => void;
  fileExtraction: (text: string, sourceName: string) => ReturnType<typeof classifyText>;
  fileSearchHits: (query: string, hits: SearchHit[], briefing?: string) => void;
  stampIngest: (source: string | Uint8Array, sourceName: string, method: string) => Promise<void>;
  addLookup: (row: LookupRec) => void;
  addScan: (row: ScanRec) => void;
  addNote: (t: string) => void;
  addCase: (title: string) => void;
  addPerson: (name: string, role: string) => void;
  addOrg: (name: string) => void;
  addPlace: (name: string) => void;
  addFinding: (t: string) => void;
  addEvidence: (title: string, type: string) => void;
  addEvent: (when: string, what: string) => void;
  addRelation: (a: string, rel: string, b: string) => void;
  addChat: (you: string, kcn: string) => void;
  addSwarm: (q: string) => void;
  upsertSwarm: (run: SwarmRun, persist?: boolean) => void;
  requestSearch: (q: string) => void;
  clearPendingSearch: () => void;
  pendingSearch: string;
  setVideo: (url: string) => void;
  addCustody: (evidenceId: string, action: string, reason: string) => void;
  setVerify: (findingId: string, status: VerifyStatus) => void;
  setAliasStatus: (id: string, status: AliasHit["status"]) => void;
  mergeAliases: (hits: AliasHit[]) => void;
  mergeContradictions: (hits: Contradiction[]) => void;
  setContradictionStatus: (id: string, status: Contradiction["status"]) => void;
  replaceAll: (next: Partial<KcnState>) => void;
};

function seal(get: () => Store) {
  void persistCase(snapshotState(get())).catch(() => undefined);
}

function act(get: () => Store, set: (p: Partial<KcnState>) => void, action: string, target: string) {
  const row: Activity = { at: nowStamp(), actor: get().operator || "Investigator", action, target };
  set({ activity: [row, ...get().activity].slice(0, 200) });
}

export const useKcn = create<Store>((set, get) => ({
  ...blank(),
  pendingSearch: "",
  hydrateFrom: (data) => {
    try {
      const base = blank();
      const src = data || {};
      const next = { ...base };
      (Object.keys(base) as (keyof KcnState)[]).forEach((key) => {
        const v = src[key];
        if (v === undefined || v === null) return;
        const b = base[key];
        if (Array.isArray(b) && !Array.isArray(v)) return;
        if (typeof b === "string" && typeof v !== "string") return;
        (next as Record<string, unknown>)[key] = v;
      });
      set({ ...next, pendingSearch: "" });
    } catch {
      set({ ...blank(), pendingSearch: "" });
    }
  },
  persist: () => seal(get),
  lockMemory: () => set({ ...blank(), pendingSearch: "" }),
  setReading: (v) => {
    set({ reading: v });
    seal(get);
  },
  setOperator: (v) => {
    set({ operator: v || "Investigator" });
    seal(get);
  },
  setActiveCase: (id) => {
    set({ activeCaseId: id });
    act(get, set, "switch-case", id);
    seal(get);
  },
  fileExtraction: (text, sourceName) => {
    try {
      const label = sourceName || "Ingested source";
      const packed = classifyText(text);
      const s = get();
      const people = [...(s.people || [])];
      packed.names.forEach((name) => {
        if (!people.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
          people.unshift({ id: nid(), name, role: "Extracted from " + label });
        }
      });
      const locations = [...(s.locations || [])];
      packed.locations.forEach((place) => {
        if (!locations.some((l) => l.name.toLowerCase() === place.toLowerCase())) {
          locations.unshift({ id: nid(), name: place, at: nowStamp(), source: label });
        }
      });
      const orgs = [...(s.orgs || [])];
      (packed.orgs || []).forEach((name) => {
        if (!orgs.some((o) => o.name.toLowerCase() === name.toLowerCase())) {
          orgs.unshift({ id: nid(), name, at: nowStamp() });
        }
      });
      const evId = nid();
      const findings = [
        ...packed.findings.map((f) => ({
          id: nid(),
          t: f,
          at: nowStamp(),
          source: label,
          evidenceId: evId,
          verify: "generated" as const,
        })),
        ...(s.findings || []),
      ];
      const events = [
        { id: nid(), when: nowStamp(), what: "Source ingested: " + label },
        ...packed.dates.map((d) => ({
          id: nid(),
          when: d,
          what: "Date mark from " + label,
        })),
        ...(packed.times || []).map((t) => ({
          id: nid(),
          when: t,
          what: "Time mark from " + label,
        })),
        ...(s.events || []),
      ];
      const relations = [...(s.relations || [])];
      if (packed.names.length && packed.locations.length) {
        relations.push({ a: packed.names[0], rel: "associated with", b: packed.locations[0] });
      }
      if (packed.names[0] && packed.orgs?.[0]) {
        relations.push({ a: packed.names[0], rel: "linked to", b: packed.orgs[0] });
      }
      const extras = (packed.things || []).map((t) => ({
        id: nid(),
        title: t,
        type: "item",
        at: nowStamp(),
        source: label,
        custodian: s.operator || "Investigator",
        status: "accepted",
      }));
      set({
        reading: (s.reading ? s.reading + "\n\n" : "") + `--- SOURCE: ${label} ---\n` + String(text || "").slice(0, 14000),
        files: [{ name: label, size: String(text || "").length, at: nowStamp() }, ...(s.files || [])],
        evidence: [
          {
            id: evId,
            title: label,
            type: "document",
            at: nowStamp(),
            source: label,
            custodian: s.operator || "Investigator",
            status: "accepted",
          },
          ...extras,
          ...(s.evidence || []),
        ],
        people,
        locations,
        orgs,
        findings,
        events,
        relations,
        activity: [{ at: nowStamp(), actor: s.operator || "Investigator", action: "ingest", target: label }, ...(s.activity || [])],
      });
      seal(get);
      return packed;
    } catch {
      return { names: [], locations: [], dates: [], times: [], orgs: [], things: [], findings: [] };
    }
  },
  fileSearchHits: (query, hits, briefing) => {
    try {
      const q = String(query || "").trim();
      if (!q) return;
      const label = "OSINT " + q;
      const block = [
        `OSINT sweep: ${q}`,
        ...(hits || []).map((h) => `${h.title}\n${h.snippet || ""}\n${h.url}`),
        briefing ? `BRIEFING:\n${briefing}` : "",
      ]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 14000);
      const packed = classifyText(block);
      const s = get();
      const people = [...(s.people || [])];
      packed.names.forEach((name) => {
        if (!looksLikePerson(name)) return;
        if (!people.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
          people.unshift({ id: nid(), name, role: "From public source · " + label });
        }
      });
      if (looksLikePerson(q) && !people.some((p) => p.name.toLowerCase() === q.toLowerCase())) {
        people.unshift({ id: nid(), name: q, role: "Search subject" });
      }
      (hits || []).forEach((h) => {
        if (!/wikipedia|wikidata/i.test(`${h.source} ${h.url}`)) return;
        const title = (h.title || "").trim();
        if (looksLikePerson(title) && !people.some((p) => p.name.toLowerCase() === title.toLowerCase())) {
          people.unshift({ id: nid(), name: title, role: "From public source · " + h.source });
        }
      });
      const locations = [...(s.locations || [])];
      packed.locations.forEach((place) => {
        if (!locations.some((l) => l.name.toLowerCase() === place.toLowerCase())) {
          locations.unshift({ id: nid(), name: place, at: nowStamp(), source: label });
        }
      });
      (hits || []).forEach((h) => {
        if (h.source !== "OpenStreetMap" && !/openstreetmap/i.test(h.url || "")) return;
        const place = (h.title || "").split(",")[0].trim();
        if (place && !locations.some((l) => l.name.toLowerCase() === place.toLowerCase())) {
          locations.unshift({ id: nid(), name: place, at: nowStamp(), source: h.url || label });
        }
      });
      const orgs = [...(s.orgs || [])];
      (packed.orgs || []).forEach((name) => {
        if (!orgs.some((o) => o.name.toLowerCase() === name.toLowerCase())) {
          orgs.unshift({ id: nid(), name, at: nowStamp() });
        }
      });
      const findings = [...(s.findings || [])];
      packed.findings.forEach((f) => {
        if (!findings.some((x) => x.t.toLowerCase() === f.toLowerCase())) {
          findings.unshift({ id: nid(), t: f, at: nowStamp(), source: label, verify: "generated" });
        }
      });
      if (!findings.some((f) => f.t === "Public sweep filed: " + q)) {
        findings.unshift({
          id: nid(),
          t: `Public sweep filed: ${q} · ${(hits || []).length} sources`,
          at: nowStamp(),
          source: label,
          verify: "generated",
        });
      }
      const events = [...(s.events || [])];
      if (!events.some((e) => e.what === "OSINT sweep: " + q)) {
        events.unshift({ id: nid(), when: nowStamp(), what: "OSINT sweep: " + q });
      }
      packed.dates.forEach((d) => {
        if (!events.some((e) => e.when === d && e.what.includes(label))) {
          events.unshift({ id: nid(), when: d, what: "Date mark from " + label });
        }
      });
      (packed.times || []).forEach((t) => {
        if (!events.some((e) => e.when === t && e.what.includes(label))) {
          events.unshift({ id: nid(), when: t, what: "Time mark from " + label });
        }
      });
      const relations = [...(s.relations || [])];
      const link = (a: string, rel: string, b: string) => {
        if (!a || !b) return;
        if (relations.some((r) => r.a === a && r.b === b)) return;
        relations.push({ a, rel, b });
      };
      packed.names.slice(0, 4).forEach((n) => {
        packed.locations.slice(0, 3).forEach((p) => link(n, "associated with", p));
        packed.orgs.slice(0, 2).forEach((o) => link(n, "linked to", o));
        packed.dates.slice(0, 2).forEach((d) => link(n, "dated", d));
        packed.things.slice(0, 2).forEach((th) => link(n, "linked to", th));
      });
      const evidence = [...(s.evidence || [])];
      if (!evidence.some((e) => e.title === label)) {
        evidence.unshift({
          id: nid(),
          title: label,
          type: "osint",
          at: nowStamp(),
          source: label,
          custodian: s.operator || "Investigator",
          status: "accepted",
        });
      }
      (hits || []).forEach((h) => {
        if (!h.title) return;
        if (evidence.some((e) => e.source === h.url || (e.title === h.title && e.type === "osint"))) return;
        evidence.unshift({
          id: nid(),
          title: h.title,
          type: "osint",
          at: nowStamp(),
          source: h.url,
          custodian: s.operator || "Investigator",
          status: "accepted",
        });
      });
      const extras = (packed.things || [])
        .filter((t) => !evidence.some((e) => e.title === t))
        .map((t) => ({
          id: nid(),
          title: t,
          type: "item",
          at: nowStamp(),
          source: label,
          custodian: s.operator || "Investigator",
          status: "accepted",
        }));
      set({
        reading: s.reading.includes(`--- SOURCE: ${label} ---`)
          ? s.reading
          : (s.reading ? s.reading + "\n\n" : "") + `--- SOURCE: ${label} ---\n` + block,
        files: s.files.some((f) => f.name === label) ? s.files : [{ name: label, size: block.length, at: nowStamp() }, ...s.files],
        evidence: [...extras, ...evidence],
        people,
        locations,
        orgs,
        findings,
        events,
        relations,
        activity:
          s.activity[0]?.action === "osint" && s.activity[0]?.target === q
            ? s.activity
            : [{ at: nowStamp(), actor: s.operator || "Investigator", action: "osint", target: q }, ...(s.activity || [])],
      });
      seal(get);
    } catch {
      /* keep the sweep even if filing fails */
    }
  },
  stampIngest: async (source, sourceName, method) => {
    try {
      const hash = await sha256(source);
      const s = get();
      const ev =
        s.evidence.find((e) => e.title === sourceName) ||
        s.evidence.find((e) => e.source === sourceName) ||
        s.evidence[0];
      const evidenceId = ev?.id || "";
      const evidence = s.evidence.map((e) => (e.id === evidenceId || e.title === sourceName ? { ...e, hash } : e));
      const acq: Acquisition = {
        id: nid(),
        method,
        source: sourceName,
        operator: s.operator || "Investigator",
        tool: "KCN-II",
        version: "IDPC-1.0",
        writeBlock: "browser-local / no write-back to source",
        authorization: "operator-initiated",
        notes: "Working copy hashed after ingest. Not a forensic imager.",
        sourceHash: hash,
        acquiredHash: hash,
        at: nowStamp(),
      };
      const prev = s.custody[0]?.hash || "GENESIS";
      const body = `${ev?.id || "ev"}|accepted|${acq.at}|${prev}|${hash}`;
      const chain = await sha256(body);
      const custody: CustodyEvent = {
        id: nid(),
        evidenceId: ev?.id || "",
        action: "accepted",
        actor: s.operator || "Investigator",
        at: acq.at,
        reason: "Source ingested into sealed workspace",
        custodian: s.operator || "Investigator",
        prev,
        hash: chain,
      };
      set({
        evidence,
        acquisitions: [acq, ...s.acquisitions],
        custody: [custody, ...s.custody],
      });
      seal(get);
    } catch {
      /* hash failure must not take down the console */
    }
  },
  addLookup: (row) => {
    set({ lookups: [row, ...get().lookups] });
    act(get, set, "lookup", row.instruction);
    seal(get);
  },
  addScan: (row) => {
    set({ scans: [row, ...get().scans] });
    seal(get);
  },
  addNote: (t) => {
    const text = String(t || "");
    set({ notes: [{ id: nid(), t: text, at: nowStamp() }, ...get().notes] });
    act(get, set, "note", text.slice(0, 48));
    seal(get);
  },
  addCase: (title) => {
    const id = nid();
    set({
      cases: [{ id, title, status: "OPEN", summary: "Newly opened investigative file." }, ...get().cases],
      activeCaseId: id,
    });
    act(get, set, "open-case", title);
    seal(get);
  },
  addPerson: (name, role) => {
    set({ people: [{ id: nid(), name, role: role || "Unknown" }, ...get().people] });
    act(get, set, "add-person", name);
    seal(get);
  },
  addOrg: (name) => {
    set({ orgs: [{ id: nid(), name, at: nowStamp() }, ...get().orgs] });
    act(get, set, "add-org", name);
    seal(get);
  },
  addPlace: (name) => {
    set({ locations: [{ id: nid(), name, at: nowStamp(), source: "manual" }, ...get().locations] });
    act(get, set, "add-place", name);
    seal(get);
  },
  addFinding: (t) => {
    set({
      findings: [{ id: nid(), t, at: nowStamp(), source: "manual", verify: "unreviewed" }, ...get().findings],
    });
    act(get, set, "add-finding", t.slice(0, 48));
    seal(get);
  },
  addEvidence: (title, type) => {
    const id = nid();
    set({
      evidence: [
        {
          id,
          title,
          type,
          at: nowStamp(),
          custodian: get().operator || "Investigator",
          status: "accepted",
        },
        ...get().evidence,
      ],
    });
    act(get, set, "add-evidence", title);
    seal(get);
  },
  addEvent: (when, what) => {
    set({ events: [{ id: nid(), when: when || nowStamp(), what }, ...get().events] });
    seal(get);
  },
  addRelation: (a, rel, b) => {
    const people = [...get().people];
    [a, b].forEach((n) => {
      if (!people.some((p) => p.name === n)) people.push({ id: nid(), name: n, role: "Linked entity" });
    });
    set({ relations: [...get().relations, { a, rel, b }], people });
    act(get, set, "link", `${a} ${rel} ${b}`);
    seal(get);
  },
  addChat: (you, kcn) => {
    set({
      chat: [...get().chat, { role: "you", text: you }, { role: "kcn", text: kcn }],
    });
    seal(get);
  },
  addSwarm: (q) => {
    const id = nid();
    const engines: [string, string][] = [
      ["DuckDuckGo", `https://duckduckgo.com/?q=${encodeURIComponent(q)}`],
      ["Wikipedia", `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}`],
      ["News", `https://news.google.com/search?q=${encodeURIComponent(q)}`],
      ["OpenStreetMap", `https://www.openstreetmap.org/search?query=${encodeURIComponent(q)}`],
      ["Live web + X", "web_search + x_search"],
    ];
    const run: SwarmRun = {
      id,
      q,
      at: nowStamp(),
      agents: ["OSINT-A", "WIKI-TRACE", "GEO-CORRELATE", "NEWS-SWEEP", "LIVE-WEB"],
      engines,
      events: [],
      hits: [],
      briefing: "",
      status: "running",
    };
    set({ swarmLog: [run, ...get().swarmLog].slice(0, 40) });
    act(get, set, "osint", q);
    seal(get);
  },
  upsertSwarm: (run, persist) => {
    try {
      const rest = get().swarmLog.filter((s) => s.id !== run.id);
      set({ swarmLog: [run, ...rest].slice(0, 40) });
      if (persist) {
        act(get, set, "osint", run.q);
        seal(get);
      }
    } catch {
      /* ignore */
    }
  },
  requestSearch: (q) => set({ pendingSearch: String(q || "").trim() }),
  clearPendingSearch: () => set({ pendingSearch: "" }),
  setVideo: (url) => {
    set({ video: url });
    act(get, set, "video", url);
    seal(get);
  },
  addCustody: (evidenceId, action, reason) => {
    const at = nowStamp();
    const id = nid();
    void (async () => {
      try {
        const s = get();
        const prev = s.custody[0]?.hash || "GENESIS";
        const hash = await sha256(`${evidenceId}|${action}|${at}|${prev}|${reason}`);
        const ev = get();
        set({
          custody: [
            {
              id,
              evidenceId,
              action,
              actor: ev.operator || "Investigator",
              at,
              reason,
              custodian: ev.operator || "Investigator",
              prev,
              hash,
            },
            ...ev.custody,
          ],
          evidence: ev.evidence.map((e) => (e.id === evidenceId ? { ...e, status: action } : e)),
        });
        act(get, set, "custody-" + action, evidenceId);
        seal(get);
      } catch {
        /* custody hash failure must not take down the console */
      }
    })();
  },
  setVerify: (findingId, status) => {
    set({
      findings: get().findings.map((f) => (f.id === findingId ? { ...f, verify: status } : f)),
    });
    act(get, set, "verify", `${findingId}:${status}`);
    seal(get);
  },
  setAliasStatus: (id, status) => {
    set({ aliases: get().aliases.map((a) => (a.id === id ? { ...a, status } : a)) });
    seal(get);
  },
  mergeAliases: (hits) => {
    const have = new Set(get().aliases.map((a) => a.id));
    set({ aliases: [...get().aliases, ...hits.filter((h) => !have.has(h.id))] });
    seal(get);
  },
  mergeContradictions: (hits) => {
    const have = new Set(get().contradictions.map((c) => c.id));
    set({ contradictions: [...get().contradictions, ...hits.filter((h) => !have.has(h.id))] });
    seal(get);
  },
  setContradictionStatus: (id, status) => {
    set({
      contradictions: get().contradictions.map((c) => (c.id === id ? { ...c, status } : c)),
    });
    seal(get);
  },
  replaceAll: (next) => {
    set({ ...get(), ...next });
    seal(get);
  },
}));

export function newId() {
  return nid();
}
