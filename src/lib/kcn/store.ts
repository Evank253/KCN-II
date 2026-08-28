import { create } from "zustand";
import { classifyText } from "./classify";
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
  swarmLog: { q: string; at: string; agents: string[]; engines: [string, string][] }[];
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
  void persistCase(snapshotState(get()));
}

function act(get: () => Store, set: (p: Partial<KcnState>) => void, action: string, target: string) {
  const row: Activity = { at: nowStamp(), actor: get().operator || "Investigator", action, target };
  set({ activity: [row, ...get().activity].slice(0, 200) });
}

export const useKcn = create<Store>((set, get) => ({
  ...blank(),
  hydrateFrom: (data) => set({ ...blank(), ...data }),
  persist: () => seal(get),
  lockMemory: () => set(blank()),
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
    const label = sourceName || "Ingested source";
    const packed = classifyText(text);
    const s = get();
    const people = [...s.people];
    packed.names.forEach((name) => {
      if (!people.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        people.unshift({ id: nid(), name, role: "Extracted from " + label });
      }
    });
    const locations = [...s.locations];
    packed.locations.forEach((place) => {
      if (!locations.some((l) => l.name.toLowerCase() === place.toLowerCase())) {
        locations.unshift({ id: nid(), name: place, at: nowStamp(), source: label });
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
      ...s.findings,
    ];
    const events = [
      { id: nid(), when: nowStamp(), what: "Source ingested: " + label },
      ...packed.dates.map((d) => ({
        id: nid(),
        when: d,
        what: "Date mark from " + label,
      })),
      ...s.events,
    ];
    const relations = [...s.relations];
    if (packed.names.length && packed.locations.length) {
      relations.push({ a: packed.names[0], rel: "associated with", b: packed.locations[0] });
    }
    set({
      reading: (s.reading ? s.reading + "\n\n" : "") + `--- SOURCE: ${label} ---\n` + text,
      files: [{ name: label, size: text.length, at: nowStamp() }, ...s.files],
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
        ...s.evidence,
      ],
      people,
      locations,
      findings,
      events,
      relations,
      activity: [{ at: nowStamp(), actor: s.operator || "Investigator", action: "ingest", target: label }, ...s.activity],
    });
    seal(get);
    return packed;
  },
  stampIngest: async (source, sourceName, method) => {
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
    set({ notes: [{ id: nid(), t, at: nowStamp() }, ...get().notes] });
    act(get, set, "note", t.slice(0, 48));
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
    const engines: [string, string][] = [
      ["DuckDuckGo", `https://duckduckgo.com/?q=${encodeURIComponent(q)}`],
      ["News", `https://news.google.com/search?q=${encodeURIComponent(q)}`],
      ["Scholar", `https://scholar.google.com/scholar?q=${encodeURIComponent(q)}`],
    ];
    set({
      swarmLog: [
        {
          q,
          at: nowStamp(),
          agents: ["OSINT-A", "OSINT-B", "ALIAS-TRACE", "RECORD-SWEEP", "GEO-CORRELATE"],
          engines,
        },
        ...get().swarmLog,
      ],
    });
    act(get, set, "osint", q);
    seal(get);
    engines.forEach(([, u]) => window.open(u, "_blank", "noopener"));
  },
  setVideo: (url) => {
    set({ video: url });
    act(get, set, "video", url);
    seal(get);
  },
  addCustody: (evidenceId, action, reason) => {
    const at = nowStamp();
    const id = nid();
    void (async () => {
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
