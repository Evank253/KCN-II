import { create } from "zustand";
import { classifyText } from "./classify";

export type Person = { id: string; name: string; role: string };
export type Note = { id: string; t: string; at: string };
export type CaseItem = { id: string; title: string; status: string; summary: string };
export type Evidence = { id: string; title: string; type: string; at: string };
export type EventItem = { id: string; when: string; what: string };
export type Place = { id: string; name: string; at: string; source: string };
export type Finding = { id: string; t: string; at: string; source: string };
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

export type KcnState = {
  files: { name: string; size: number; at: string }[];
  reading: string;
  notes: Note[];
  cases: CaseItem[];
  people: Person[];
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
};

function nid() {
  return Math.random().toString(36).slice(2, 9);
}
export function nowStamp() {
  return new Date().toLocaleString();
}

const blank = (): KcnState => ({
  files: [],
  reading: "",
  notes: [],
  cases: [
    {
      id: nid(),
      title: "Active Case",
      status: "OPEN",
      summary: "Primary investigative workspace.",
    },
  ],
  people: [],
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
});

function load(): KcnState {
  try {
    const raw = localStorage.getItem("KCN-II");
    if (!raw) return blank();
    return { ...blank(), ...JSON.parse(raw) };
  } catch {
    return blank();
  }
}

type Store = KcnState & {
  hydrate: () => void;
  persist: () => void;
  setReading: (v: string) => void;
  fileExtraction: (text: string, sourceName: string) => ReturnType<typeof classifyText>;
  addLookup: (row: LookupRec) => void;
  addScan: (row: ScanRec) => void;
  addNote: (t: string) => void;
  addCase: (title: string) => void;
  addPerson: (name: string, role: string) => void;
  addPlace: (name: string) => void;
  addFinding: (t: string) => void;
  addEvidence: (title: string, type: string) => void;
  addEvent: (when: string, what: string) => void;
  addRelation: (a: string, rel: string, b: string) => void;
  addChat: (you: string, kcn: string) => void;
  addSwarm: (q: string) => void;
  setVideo: (url: string) => void;
  replaceAll: (next: Partial<KcnState>) => void;
};

export const useKcn = create<Store>((set, get) => ({
  ...blank(),
  hydrate: () => set(load()),
  persist: () => {
    const s = get();
    const {
      hydrate: _h,
      persist: _p,
      setReading: _sr,
      fileExtraction: _fe,
      addLookup: _al,
      addScan: _as,
      addNote: _an,
      addCase: _ac,
      addPerson: _ap,
      addPlace: _apl,
      addFinding: _af,
      addEvidence: _ae,
      addEvent: _aev,
      addRelation: _ar,
      addChat: _ach,
      addSwarm: _asw,
      setVideo: _sv,
      replaceAll: _ra,
      ...data
    } = s;
    localStorage.setItem("KCN-II", JSON.stringify(data));
  },
  setReading: (v) => {
    set({ reading: v });
    get().persist();
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
    const findings = [
      ...packed.findings.map((f) => ({
        id: nid(),
        t: f,
        at: nowStamp(),
        source: label,
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
      relations.push({
        a: packed.names[0],
        rel: "associated with",
        b: packed.locations[0],
      });
    }
    set({
      reading: (s.reading ? s.reading + "\n\n" : "") + `--- SOURCE: ${label} ---\n` + text,
      files: [{ name: label, size: text.length, at: nowStamp() }, ...s.files],
      evidence: [
        { id: nid(), title: label, type: "document", at: nowStamp() },
        ...s.evidence,
      ],
      people,
      locations,
      findings,
      events,
      relations,
    });
    get().persist();
    return packed;
  },
  addLookup: (row) => {
    set({ lookups: [row, ...get().lookups] });
    get().persist();
  },
  addScan: (row) => {
    set({ scans: [row, ...get().scans] });
    get().persist();
  },
  addNote: (t) => {
    set({ notes: [{ id: nid(), t, at: nowStamp() }, ...get().notes] });
    get().persist();
  },
  addCase: (title) => {
    set({
      cases: [
        {
          id: nid(),
          title,
          status: "OPEN",
          summary: "Newly opened investigative file.",
        },
        ...get().cases,
      ],
    });
    get().persist();
  },
  addPerson: (name, role) => {
    set({
      people: [{ id: nid(), name, role: role || "Unknown" }, ...get().people],
    });
    get().persist();
  },
  addPlace: (name) => {
    set({
      locations: [
        { id: nid(), name, at: nowStamp(), source: "manual" },
        ...get().locations,
      ],
    });
    get().persist();
  },
  addFinding: (t) => {
    set({
      findings: [{ id: nid(), t, at: nowStamp(), source: "manual" }, ...get().findings],
    });
    get().persist();
  },
  addEvidence: (title, type) => {
    set({
      evidence: [{ id: nid(), title, type, at: nowStamp() }, ...get().evidence],
    });
    get().persist();
  },
  addEvent: (when, what) => {
    set({ events: [{ id: nid(), when: when || nowStamp(), what }, ...get().events] });
    get().persist();
  },
  addRelation: (a, rel, b) => {
    const people = [...get().people];
    [a, b].forEach((n) => {
      if (!people.some((p) => p.name === n)) {
        people.push({ id: nid(), name: n, role: "Linked entity" });
      }
    });
    set({ relations: [...get().relations, { a, rel, b }], people });
    get().persist();
  },
  addChat: (you, kcn) => {
    set({
      chat: [...get().chat, { role: "you", text: you }, { role: "kcn", text: kcn }],
    });
    get().persist();
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
    get().persist();
    engines.forEach(([, u]) => window.open(u, "_blank", "noopener"));
  },
  setVideo: (url) => {
    set({ video: url });
    get().persist();
  },
  replaceAll: (next) => {
    set({ ...get(), ...next });
    get().persist();
  },
}));

export function newId() {
  return nid();
}
