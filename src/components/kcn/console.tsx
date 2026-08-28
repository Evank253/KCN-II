import { useEffect, useMemo, useRef, useState } from "react";
import { classifyText } from "@/lib/kcn/classify";
import { askCase } from "@/lib/kcn/assist";
import { caseDigest } from "@/lib/kcn/intel";
import { useKcn } from "@/lib/kcn/store";
import { currentPayload, IDLE_MS, isUnlocked, lockVault, recordAudit, sealedBackup } from "@/lib/kcn/vault";
import { downloadText } from "@/lib/kcn/legal-copy";
import { BootSequence } from "./boot-sequence";
import { CertificationDesk } from "./certification-desk";
import {
  AcquireDesk,
  ActivityDesk,
  CasesDesk,
  ContradictDesk,
  CustodyDesk,
  InterviewDesk,
  OrgDesk,
  ReportDesk,
  ResolveDesk,
  SwarmDesk,
  VerifyDesk,
} from "./desks";
import { LegalDesk } from "./legal-desk";
import { ScannerSheet } from "./scanner-sheet";
import { Seal } from "./seal";
import { Starfield } from "./starfield";
import { VaultGate } from "./vault-gate";

const NAV: { section: string; items: [string, string][] }[] = [
  {
    section: "Collect",
    items: [
      ["scanner", "Scan and look up"],
      ["reader", "Reader"],
      ["interview", "Interview"],
      ["video", "Video"],
      ["swarm", "OSINT swarm"],
    ],
  },
  {
    section: "Case",
    items: [
      ["cases", "Cases"],
      ["people", "People"],
      ["orgs", "Organizations"],
      ["locations", "Locations"],
      ["notes", "Notes"],
    ],
  },
  {
    section: "Analyze",
    items: [
      ["conversation", "Assistant"],
      ["investigator", "AI swarm"],
      ["resolve", "Entity resolution"],
      ["relmap", "Relationships"],
      ["timeline", "Timeline"],
      ["contradict", "Contradictions"],
    ],
  },
  {
    section: "Preserve",
    items: [
      ["evidence", "Evidence"],
      ["acquire", "Acquisition"],
      ["custody", "Chain of custody"],
      ["findings", "Findings"],
      ["verify", "Human verification"],
    ],
  },
  {
    section: "Output",
    items: [
      ["report", "Investigative report"],
      ["intel", "Case intelligence"],
      ["activity", "Activity"],
    ],
  },
  {
    section: "System",
    items: [
      ["vault", "Vault & certification"],
      ["legal", "License & legal"],
    ],
  },
];

export function KcnConsole() {
  const store = useKcn();
  const [mod, setMod] = useState("scanner");
  const [scanOpen, setScanOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [clock, setClock] = useState("");
  const [ask, setAsk] = useState("");
  const [savedAt, setSavedAt] = useState("VAULT STANDBY");
  const [booted, setBooted] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const lastAct = useRef(Date.now());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleString()), 1000);
    setClock(new Date().toLocaleString());
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!vaultOpen) return;
    const bump = () => {
      lastAct.current = Date.now();
    };
    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const t = window.setInterval(() => {
      if (Date.now() - lastAct.current > IDLE_MS) lockNow("Idle lock.");
    }, 15000);
    const vis = () => {
      if (document.visibilityState === "hidden") lastAct.current = Date.now() - IDLE_MS + 15000;
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultOpen]);

  function ping(msg: string) {
    setToast(msg);
    setSavedAt("SEALED • " + new Date().toLocaleTimeString());
    setTimeout(() => setToast(""), 2200);
  }

  function analyze(q: string) {
    const packed = classifyText((store.reading || "") + "\n" + q);
    return [
      "KCN-II desk analysis — human review required.",
      packed.names.length ? "Names: " + packed.names.join(", ") : "No clear names in the current file.",
      packed.locations.length ? "Locations: " + packed.locations.join(", ") : "No locations extracted.",
      packed.findings.length
        ? "Possible findings:\n- " + packed.findings.slice(0, 4).join("\n- ")
        : "No automatic findings flagged.",
      `Board: ${store.people.length} people • ${store.locations.length} locations • ${store.findings.length} findings.`,
    ].join("\n\n");
  }

  function sendAsk(q: string) {
    const text = q.trim();
    if (!text) return;
    setAsk("");
    setMod("conversation");
    ping("Working the question…");
    void (async () => {
      try {
        const r = await askCase({ data: { question: text, digest: caseDigest(useKcn.getState()) } });
        store.addChat(text, r.text || analyze(text));
      } catch {
        store.addChat(text, analyze(text));
      }
      ping("Answer filed to Conversation.");
    })();
  }

  async function ingestFiles(files: FileList | File[]) {
    for (const f of [...files]) {
      if ((f.type || "").startsWith("image/")) {
        setScanOpen(true);
        ping("Open the scanner to look this photo up.");
        continue;
      }
      if ((f.type || "").startsWith("audio/")) {
        store.addEvidence(f.name, "audio");
        const bytes = new Uint8Array(await f.arrayBuffer());
        void store.stampIngest(bytes, f.name, "audio-upload");
        ping("Audio filed as evidence. Use Interview to transcribe spoken statements.");
        continue;
      }
      if ((f.type || "").startsWith("video/")) {
        store.addEvidence(f.name, "video");
        const bytes = new Uint8Array(await f.arrayBuffer());
        void store.stampIngest(bytes, f.name, "video-upload");
        ping("Video filed as evidence. Add notes from what you observe.");
        continue;
      }
      const text = await f.text();
      store.fileExtraction(text, f.name);
      void store.stampIngest(text, f.name, "file-upload");
    }
    ping("Sources locked into the case file.");
  }

  function lockNow(msg?: string) {
    lockVault();
    store.lockMemory();
    setVaultOpen(false);
    ping(msg || "Vault locked. Case files are sealed.");
  }

  function openVault() {
    const p = currentPayload();
    if (p) store.hydrateFrom(p.case);
    setVaultOpen(true);
    lastAct.current = Date.now();
    ping("Vault open. Files are encrypted at rest.");
    void recordAudit("CONSOLE_OPEN");
  }

  function saveCase() {
    if (!isUnlocked()) {
      ping("Unlock the vault first.");
      return;
    }
    try {
      downloadText("KCN-II-sealed-vault.json", sealedBackup());
      void recordAudit("SEALED_BACKUP_EXPORTED");
      ping("Sealed vault downloaded. Still needs the passphrase.");
    } catch {
      ping("Nothing sealed to export.");
    }
  }

  const view = useMemo(() => {
    if (mod === "scanner") {
      return (
        <section>
          <h2 className="kcn-title">Scan and look up</h2>
          <p className="kcn-muted mb-4">
            This is both a document scanner and a photo lookup desk. Take a picture of a page, a person, a place, or anything in front of you. Then say what you want: look it up, file it, identify names, or search public sources.
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            <button className="kcn-btn cyan" onClick={() => setScanOpen(true)}>
              Open camera
            </button>
            <button className="kcn-btn gold" onClick={() => setScanOpen(true)}>
              Upload a photo
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {store.lookups.length === 0 && store.scans.length === 0 && (
              <div className="kcn-muted">No captures yet. Open the camera and tell KCN-II what to do.</div>
            )}
            {store.lookups.map((l) => (
              <div key={l.id} className="kcn-item">
                <b>{l.instruction}</b>
                <div className="kcn-tiny kcn-muted">{l.at}</div>
                <pre className="mt-2 whitespace-pre-wrap font-mono text-xs">{l.briefing.slice(0, 500)}</pre>
              </div>
            ))}
            {store.scans.map((s, i) => (
              <div key={i} className="kcn-item">
                <b>{s.title}</b>
                <div className="kcn-tiny kcn-muted">
                  {s.at} • {s.instruction} • {s.names} names • {s.locations} locations
                </div>
              </div>
            ))}
          </div>
        </section>
      );
    }
    if (mod === "reader") {
      return (
        <section>
          <h2 className="kcn-title">Upload a file</h2>
          <textarea
            value={store.reading}
            onChange={(e) => store.setReading(e.target.value)}
            placeholder="Your extracted reading appears here..."
            className="min-h-[220px]"
          />
          <div className="kcn-tiny kcn-muted mt-2">
            {store.files.map((f) => f.name).join(" • ") || "No sources loaded."}
          </div>
        </section>
      );
    }
    if (mod === "conversation") {
      return (
        <section>
          <h2 className="kcn-title">Conversation</h2>
          <div className="kcn-card mb-3 min-h-48">
            {store.chat.map((m, i) => (
              <div key={i} className="kcn-item mb-2">
                <b>{m.role === "you" ? "OPERATOR" : "KCN-II"}</b>
                <div className="kcn-tiny whitespace-pre-wrap">{m.text}</div>
              </div>
            ))}
            {store.chat.length === 0 && <div className="kcn-muted">Ask from the command bar, or look a photo up.</div>}
          </div>
        </section>
      );
    }
    if (mod === "notes") {
      return <ListForm title="Research Notes" placeholder="Add an investigative note" onAdd={(t) => store.addNote(t)} items={store.notes.map((n) => ({ t: n.t, s: n.at }))} />;
    }
    if (mod === "cases") {
      return <CasesDesk />;
    }
    if (mod === "people") {
      return (
        <TwoField
          title="People"
          a="Name"
          b="Role / org"
          onAdd={(a, b) => store.addPerson(a, b)}
          items={store.people.map((p) => ({ t: p.name, s: p.role }))}
        />
      );
    }
    if (mod === "locations") {
      return <ListForm title="Locations" placeholder="Place, address, city, scene" onAdd={(t) => store.addPlace(t)} items={store.locations.map((l) => ({ t: l.name, s: l.source }))} />;
    }
    if (mod === "findings") {
      return <ListForm title="Findings" placeholder="Finding, lead, contradiction, conclusion to review" onAdd={(t) => store.addFinding(t)} items={store.findings.map((f) => ({ t: f.t, s: `${f.verify || "generated"} · ${f.source}` }))} />;
    }
    if (mod === "evidence") {
      return <ListForm title="Forensic Evidence" placeholder="Evidence title" onAdd={(t) => store.addEvidence(t, "document")} items={store.evidence.map((e) => ({ t: e.title, s: e.type }))} />;
    }
    if (mod === "timeline") {
      return <ListForm title="Timeline" placeholder="Event" onAdd={(t) => store.addEvent("", t)} items={store.events.map((e) => ({ t: e.what, s: String(e.when) }))} />;
    }
    if (mod === "swarm") {
      return (
        <section>
          <h2 className="kcn-title">Web Browser Swarm</h2>
          <SwarmBox onGo={(q) => store.addSwarm(q)} log={store.swarmLog} />
        </section>
      );
    }
    if (mod === "video") {
      return (
        <section>
          <h2 className="kcn-title">Video Link Evidence</h2>
          <VideoBox url={store.video} onLock={(u) => { store.setVideo(u); store.addEvidence("Linked video", "video"); }} />
        </section>
      );
    }
    if (mod === "orgs") {
      return <OrgDesk />;
    }
    if (mod === "interview") {
      return <InterviewDesk />;
    }
    if (mod === "resolve") {
      return <ResolveDesk />;
    }
    if (mod === "contradict") {
      return <ContradictDesk />;
    }
    if (mod === "verify") {
      return <VerifyDesk />;
    }
    if (mod === "custody") {
      return <CustodyDesk />;
    }
    if (mod === "acquire") {
      return <AcquireDesk />;
    }
    if (mod === "report") {
      return <ReportDesk />;
    }
    if (mod === "activity") {
      return <ActivityDesk />;
    }
    if (mod === "investigator") {
      return <SwarmDesk />;
    }
    if (mod === "relmap") {
      return (
        <section>
          <h2 className="kcn-title">Relationship Map</h2>
          <RelationBox />
        </section>
      );
    }
    if (mod === "legal") {
      return <LegalDesk />;
    }
    if (mod === "vault") {
      return (
        <CertificationDesk
          onLocked={() => lockNow()}
          onWiped={() => {
            store.lockMemory();
            setVaultOpen(false);
            ping("This device was wiped.");
          }}
        />
      );
    }
    return (
      <section>
        <h2 className="kcn-title">Case Intelligence</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["OPEN CASES", store.cases.length],
            ["PEOPLE", store.people.length],
            ["LOCATIONS", store.locations.length],
            ["FINDINGS", store.findings.length],
            ["LOOKUPS", store.lookups.length],
            ["SCANS", store.scans.length],
            ["EVIDENCE", store.evidence.length],
            ["SOURCES", store.files.length],
            ["CUSTODY", store.custody.length],
            ["ACQUISITIONS", store.acquisitions.length],
          ].map(([k, v]) => (
            <div key={String(k)} className="kcn-card">
              <div className="text-gold-2 tracking-[0.12em]">{k}</div>
              <div className="text-4xl">{v}</div>
            </div>
          ))}
        </div>
      </section>
    );
  }, [mod, store]);

  return (
    <div className={`kcn-app ${cmdOpen ? "cmd-open" : ""}`}>
      <Starfield />
      <div className="kcn-ribbon">KCN-II // INVESTIGATOR SENSITIVE // SEALED VAULT • HUMAN REVIEW REQUIRED</div>
      <header className="kcn-appbar">
        <div className="kcn-brand flex items-center gap-3">
          <Seal />
          <div>
            <h1>
              KCN-<span>II</span>
            </h1>
            <p>CASE INTELLIGENCE • SEALED VAULT • HUMAN REVIEW</p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className={`kcn-pill ${vaultOpen ? "live" : ""}`}>{vaultOpen ? "VAULT OPEN" : "VAULT SEALED"}</div>
          <div className="kcn-pill">{clock}</div>
          <div className="kcn-pill">{savedAt}</div>
          <button className="kcn-btn" onClick={saveCase}>Export sealed</button>
          <button className="kcn-btn" onClick={() => lockNow()}>Lock</button>
          <button className="kcn-btn" onClick={() => setMod("vault")}>Certification</button>
          <button className="kcn-btn" onClick={() => setScanOpen(true)}>Scan / look up</button>
          <label className="kcn-btn cyan">
            Add files
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void ingestFiles(e.target.files);
              }}
            />
          </label>
        </div>
      </header>
      <div className="kcn-shell">
        <aside className="kcn-aside">
          <div className="px-2 text-[10px] tracking-[0.28em] text-cyan">OPERATIONS CONSOLE</div>
          <div className="px-2 pb-3 text-xl">Investigation Workspace</div>
          {NAV.map((group) => (
            <div key={group.section} className="kcn-nav-group">
              <div className="kcn-nav-label">{group.section}</div>
              {group.items.map(([key, label]) => (
                <button
                  key={key}
                  className={`kcn-nav ${mod === key ? "active" : ""}`}
                  onClick={() => setMod(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          ))}
        </aside>
        <main className="kcn-workspace">
          <div className="kcn-ws-top">
            <div>SEALED WORKSPACE • KCN-II INVESTIGATOR VAULT</div>
            <div>AES-256-GCM • SOURCE-AWARE • HUMAN REVIEW REQUIRED</div>
          </div>
          <div className="kcn-body">{view}</div>
        </main>
      </div>
      {cmdOpen ? (
        <div className="kcn-cmd">
          <div className="flex min-w-0 items-center gap-2">
            <input
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendAsk(ask);
              }}
              placeholder="Ask about the case — optional"
            />
            <button className="kcn-btn gold" onClick={() => sendAsk(ask)}>
              Ask
            </button>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <label className="kcn-btn">
              Upload files
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) void ingestFiles(e.target.files);
                }}
              />
            </label>
            <button className="kcn-btn cyan" onClick={() => setScanOpen(true)}>
              Scan / look up
            </button>
            <button className="kcn-btn" onClick={() => setCmdOpen(false)}>
              Hide
            </button>
          </div>
        </div>
      ) : (
        <button className="kcn-cmd-fab" type="button" onClick={() => setCmdOpen(true)}>
          Quick Investigator
        </button>
      )}
      <ScannerSheet open={scanOpen && vaultOpen} onClose={() => setScanOpen(false)} toast={ping} />
      {toast ? <div className="kcn-toast">{toast}</div> : null}
      {!booted && <BootSequence onDone={() => setBooted(true)} />}
      {booted && !vaultOpen && <VaultGate onOpen={openVault} />}
    </div>
  );
}

function ListForm({
  title,
  placeholder,
  onAdd,
  items,
}: {
  title: string;
  placeholder: string;
  onAdd: (t: string) => void;
  items: { t: string; s: string }[];
}) {
  const [v, setV] = useState("");
  return (
    <section>
      <h2 className="kcn-title">{title}</h2>
      <div className="mb-3 flex gap-2">
        <input className="kcn-field flex-1" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} />
        <button
          className="kcn-btn gold"
          onClick={() => {
            if (!v.trim()) return;
            onAdd(v.trim());
            setV("");
          }}
        >
          Add
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((it, i) => (
          <div key={i} className="kcn-item">
            <b>{it.t}</b>
            <div className="kcn-tiny kcn-muted">{it.s}</div>
          </div>
        ))}
        {items.length === 0 && <div className="kcn-muted">Nothing logged yet.</div>}
      </div>
    </section>
  );
}

function TwoField({
  title,
  a,
  b,
  onAdd,
  items,
}: {
  title: string;
  a: string;
  b: string;
  onAdd: (a: string, b: string) => void;
  items: { t: string; s: string }[];
}) {
  const [x, setX] = useState("");
  const [y, setY] = useState("");
  return (
    <section>
      <h2 className="kcn-title">{title}</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        <input className="kcn-field" value={x} onChange={(e) => setX(e.target.value)} placeholder={a} />
        <input className="kcn-field" value={y} onChange={(e) => setY(e.target.value)} placeholder={b} />
        <button
          className="kcn-btn gold"
          onClick={() => {
            if (!x.trim()) return;
            onAdd(x.trim(), y.trim());
            setX("");
            setY("");
          }}
        >
          Add
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((it, i) => (
          <div key={i} className="kcn-item">
            <b>{it.t}</b>
            <div className="kcn-tiny kcn-muted">{it.s}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SwarmBox({
  onGo,
  log,
}: {
  onGo: (q: string) => void;
  log: { q: string; at: string; engines: [string, string][] }[];
}) {
  const [q, setQ] = useState("");
  return (
    <>
      <div className="mb-3 flex gap-2">
        <input className="kcn-field flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Target query / subject / alias" />
        <button
          className="kcn-btn gold"
          onClick={() => {
            if (!q.trim()) return;
            onGo(q.trim());
            setQ("");
          }}
        >
          Launch swarm
        </button>
      </div>
      {log.map((s) => (
        <div key={s.at + s.q} className="kcn-card mb-2">
          <h3 className="text-gold-2">{s.q}</h3>
          <div className="kcn-tiny kcn-muted">{s.at}</div>
        </div>
      ))}
    </>
  );
}

function VideoBox({ url, onLock }: { url: string; onLock: (u: string) => void }) {
  const [v, setV] = useState(url);
  const yt = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return (
    <>
      <div className="mb-3 flex gap-2">
        <input className="kcn-field flex-1" value={v} onChange={(e) => setV(e.target.value)} placeholder="Paste a public video URL" />
        <button className="kcn-btn cyan" onClick={() => onLock(v.trim())}>
          Lock evidence
        </button>
      </div>
      {yt ? (
        <iframe
          title="Video evidence"
          className="h-80 w-full rounded-xl"
          src={`https://www.youtube.com/embed/${yt[1]}`}
          allowFullScreen
        />
      ) : (
        <div className="kcn-card kcn-muted">{url || "No linked video."}</div>
      )}
    </>
  );
}

function RelationBox() {
  const people = useKcn((s) => s.people);
  const relations = useKcn((s) => s.relations);
  const addRelation = useKcn((s) => s.addRelation);
  const [a, setA] = useState("");
  const [rel, setRel] = useState("linked to");
  const [b, setB] = useState("");
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <input className="kcn-field" value={a} onChange={(e) => setA(e.target.value)} placeholder="From" />
        <input className="kcn-field" value={rel} onChange={(e) => setRel(e.target.value)} placeholder="relationship" />
        <input className="kcn-field" value={b} onChange={(e) => setB(e.target.value)} placeholder="To" />
        <button
          className="kcn-btn gold"
          onClick={() => {
            if (!a.trim() || !b.trim()) return;
            addRelation(a.trim(), rel.trim() || "linked to", b.trim());
            setA("");
            setB("");
          }}
        >
          Link
        </button>
      </div>
      <div className="kcn-card min-h-40">
        {people.map((p) => (
          <div key={p.id} className="kcn-tiny">
            {p.name} — {p.role}
          </div>
        ))}
        {relations.map((r, i) => (
          <div key={i} className="kcn-tiny text-gold-2">
            {r.a} {r.rel} {r.b}
          </div>
        ))}
        {people.length === 0 && <div className="kcn-muted">Upload sources or add people to populate the graph.</div>}
      </div>
    </>
  );
}
