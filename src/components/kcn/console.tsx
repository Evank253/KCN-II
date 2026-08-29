import { useEffect, useMemo, useRef, useState, Component, type ReactNode } from "react";
import { classifyText } from "@/lib/kcn/classify";
import { askCase } from "@/lib/kcn/assist";
import { caseDigest } from "@/lib/kcn/intel";
import { useKcn } from "@/lib/kcn/store";
import { currentPayload, IDLE_MS, currentInvestigatorId, isUnlocked, lockVault, openAccountSession, recordAudit, sealedBackup } from "@/lib/kcn/vault";
import { easyKey, readAutoSecret } from "@/lib/kcn/accounts";
import { parseIntent, intentLabel } from "@/lib/kcn/controller";
import { downloadText } from "@/lib/kcn/legal-copy";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { UserButton } from "@/lib/auth/gates";
import { signOut } from "@/lib/auth/client";
import { Link } from "@tanstack/react-router";
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
  SearchDesk,
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
    section: "Start",
    items: [["home", "Start"]],
  },
  {
    section: "Collect",
    items: [
      ["scanner", "Scan"],
      ["reader", "Files"],
      ["interview", "Interview"],
      ["video", "Video"],
      ["swarm", "Web search"],
    ],
  },
  {
    section: "Case",
    items: [
      ["cases", "Cases"],
      ["people", "People"],
      ["orgs", "Organizations"],
      ["locations", "Places"],
      ["notes", "Notes"],
    ],
  },
  {
    section: "Analyze",
    items: [
      ["conversation", "Ask"],
      ["investigator", "Case brief"],
      ["resolve", "Match names"],
      ["relmap", "Links"],
      ["timeline", "Timeline"],
      ["contradict", "Conflicts"],
    ],
  },
  {
    section: "Preserve",
    items: [
      ["evidence", "Evidence"],
      ["acquire", "Hashes"],
      ["custody", "Custody"],
      ["findings", "Findings"],
      ["verify", "Review"],
    ],
  },
  {
    section: "Output",
    items: [
      ["report", "Report"],
      ["intel", "Overview"],
      ["activity", "Activity"],
    ],
  },
  {
    section: "System",
    items: [
      ["vault", "Vault"],
      ["legal", "Legal"],
    ],
  },
];

const OPEN_DEFAULT: Record<string, boolean> = {
  Start: true,
  Collect: true,
  Case: true,
  Analyze: false,
  Preserve: false,
  Output: false,
  System: false,
};

export function KcnConsole() {
  const store = useKcn();
  const { user } = useCurrentUserState();
  const [mod, setMod] = useState("home");
  const [scanOpen, setScanOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [clock, setClock] = useState("");
  const [ask, setAsk] = useState("");
  const [savedAt, setSavedAt] = useState("VAULT STANDBY");
  const [booted, setBooted] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [needPass, setNeedPass] = useState(false);
  const [sessionBusy, setSessionBusy] = useState(true);
  const [sealedAway, setSealedAway] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [navQ, setNavQ] = useState("");
  const [openSec, setOpenSec] = useState<Record<string, boolean>>(() => ({ ...OPEN_DEFAULT }));
  const [coach, setCoach] = useState(true);
  const lastAct = useRef(Date.now());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleString()), 1000);
    setClock(new Date().toLocaleString());
    try {
      /* coach is per investigator — set on vault open */
    } catch {
      /* private mode */
    }
    const hush = (e: Event) => {
      e.preventDefault();
    };
    window.addEventListener("error", hush);
    window.addEventListener("unhandledrejection", hush);
    return () => {
      clearInterval(t);
      window.removeEventListener("error", hush);
      window.removeEventListener("unhandledrejection", hush);
    };
  }, []);

  useEffect(() => {
    const g = NAV.find((s) => s.items.some(([k]) => k === mod));
    if (g) setOpenSec((prev) => ({ ...prev, [g.section]: true }));
  }, [mod]);

  useEffect(() => {
    if (!vaultOpen) return;
    const bump = () => {
      lastAct.current = Date.now();
    };
    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const t = window.setInterval(() => {
      if (Date.now() - lastAct.current > IDLE_MS) {
        try {
          store.persist();
        } catch {
          /* keep working */
        }
        lastAct.current = Date.now();
      }
    }, 30000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultOpen]);

  function ping(msg: string) {
    setToast(msg);
    setSavedAt("SEALED • " + new Date().toLocaleTimeString());
    setTimeout(() => setToast(""), 2200);
  }

  function go(desk: string) {
    setMod(desk);
    setMoreOpen(false);
  }

  function dismissCoach() {
    setCoach(false);
    try {
      const id = currentInvestigatorId();
      if (id) localStorage.setItem(easyKey(id), "1");
    } catch {
      /* private mode */
    }
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
    let intent = parseIntent(text);
    if (intent.kind === "ask" && mod === "swarm" && !/[?]/.test(text)) {
      intent = { kind: "search", query: text };
    }
    if (intent.kind === "search") {
      store.requestSearch(intent.query);
      go("swarm");
      setCmdOpen(false);
      store.addChat(text, "Controller tasked the swarm to search: " + intent.query);
      ping("Controller is searching that now.");
      return;
    }
    if (intent.kind === "add-person") {
      store.addPerson(intent.name, intent.role);
      go("people");
      setCmdOpen(false);
      store.addChat(text, "Controller filed " + intent.name + " on People. Isolated to this investigator.");
      ping(intentLabel(intent));
      return;
    }
    if (intent.kind === "add-place") {
      store.addPlace(intent.name);
      go("locations");
      setCmdOpen(false);
      store.addChat(text, "Controller filed place: " + intent.name);
      ping(intentLabel(intent));
      return;
    }
    if (intent.kind === "add-org") {
      store.addOrg(intent.name);
      go("orgs");
      setCmdOpen(false);
      store.addChat(text, "Controller filed organization: " + intent.name);
      ping(intentLabel(intent));
      return;
    }
    if (intent.kind === "add-note") {
      store.addNote(intent.text);
      go("notes");
      setCmdOpen(false);
      store.addChat(text, "Controller filed the note.");
      ping(intentLabel(intent));
      return;
    }
    if (intent.kind === "add-finding") {
      store.addFinding(intent.text);
      go("findings");
      setCmdOpen(false);
      store.addChat(text, "Controller filed the finding.");
      ping(intentLabel(intent));
      return;
    }
    if (intent.kind === "open-desk") {
      go(intent.desk);
      if (intent.desk === "scanner") setScanOpen(true);
      setCmdOpen(false);
      ping(intentLabel(intent));
      return;
    }
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
      try {
        if ((f.type || "").startsWith("image/")) {
          setScanOpen(true);
          ping("Open the scanner to look this photo up.");
          continue;
        }
        if ((f.type || "").startsWith("audio/")) {
          store.addEvidence(f.name, "audio");
          const bytes = new Uint8Array(await f.arrayBuffer());
          void store.stampIngest(bytes, f.name, "audio-upload").catch(() => undefined);
          ping("Audio filed as evidence. Use Interview to transcribe spoken statements.");
          continue;
        }
        if ((f.type || "").startsWith("video/")) {
          store.addEvidence(f.name, "video");
          const bytes = new Uint8Array(await f.arrayBuffer());
          void store.stampIngest(bytes, f.name, "video-upload").catch(() => undefined);
          ping("Video filed as evidence. Add notes from what you observe.");
          continue;
        }
        const text = await f.text();
        store.fileExtraction(text, f.name);
        void store.stampIngest(text, f.name, "file-upload").catch(() => undefined);
      } catch {
        ping("Could not read " + (f.name || "that file") + ".");
      }
    }
    ping("Sources locked into the case file.");
  }

  function lockNow(msg?: string) {
    try {
      store.persist();
    } catch {
      /* still lock */
    }
    lockVault();
    store.lockMemory();
    setVaultOpen(false);
    setMod("home");
    setCmdOpen(false);
    setScanOpen(false);
    setMoreOpen(false);
    setAsk("");
    setCoach(true);
    const auto = readAutoSecret(user?.id || "guest");
    setNeedPass(!auto);
    setSealedAway(!!auto);
    ping(msg || "Workspace locked. Case files are sealed.");
  }

  function openVault() {
    const p = currentPayload();
    if (p) store.hydrateFrom(p.case);
    try {
      const id = currentInvestigatorId();
      setCoach(!(id && localStorage.getItem(easyKey(id)) === "1"));
    } catch {
      setCoach(true);
    }
    setMod("home");
    setCmdOpen(false);
    setVaultOpen(true);
    lastAct.current = Date.now();
    ping("Vault open for " + (p?.meta.operatorName || p?.case.operator || user?.displayName || "this investigator") + ".");
    void recordAudit("CONSOLE_OPEN").catch(() => undefined);
  }

  function applySession(r: "opened" | "needs-pass") {
    if (r === "opened") {
      const p = currentPayload();
      if (p) store.hydrateFrom(p.case);
      setNeedPass(false);
      setSealedAway(false);
      setVaultOpen(true);
      lastAct.current = Date.now();
    } else {
      setNeedPass(true);
      setSealedAway(false);
      setVaultOpen(false);
    }
  }

  function reopenSession() {
    setSealedAway(false);
    setSessionBusy(true);
    const id = user?.id || "guest";
    const name = user?.displayName || user?.primaryEmail?.split("@")[0] || "Investigator";
    void openAccountSession(id, name)
      .then(applySession)
      .catch(() => {
        setNeedPass(true);
        setVaultOpen(false);
      })
      .finally(() => setSessionBusy(false));
  }

  useEffect(() => {
    if (!booted) return;
    let live = true;
    setSessionBusy(true);
    const id = user?.id || "guest";
    const name = user?.displayName || user?.primaryEmail?.split("@")[0] || "Investigator";
    try {
      store.persist();
    } catch {
      /* ignore */
    }
    void openAccountSession(id, name)
      .then((r) => {
        if (!live) return;
        applySession(r);
      })
      .catch(() => {
        if (!live) return;
        setNeedPass(true);
        setVaultOpen(false);
      })
      .finally(() => {
        if (live) setSessionBusy(false);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted, user?.id]);

  function saveCase() {
    if (!isUnlocked()) {
      ping("Unlock the vault first.");
      return;
    }
    try {
      downloadText("KCN-II-sealed-vault.json", sealedBackup());
      void recordAudit("SEALED_BACKUP_EXPORTED").catch(() => undefined);
      ping("Sealed vault downloaded. Still needs the passphrase.");
    } catch {
      ping("Nothing sealed to export.");
    }
  }

  const view = useMemo(() => {
    if (mod === "home") {
      return (
        <HomeDesk
          coach={coach}
          onDismissCoach={dismissCoach}
          counts={{
            people: store.people.length,
            files: store.files.length,
            findings: store.findings.length,
            scans: store.scans.length + store.lookups.length,
          }}
          onScan={() => {
            setMod("scanner");
            setScanOpen(true);
          }}
          onFiles={() => go("reader")}
          onPeople={() => go("people")}
          onAsk={() => {
            go("conversation");
            setCmdOpen(true);
          }}
          onGo={go}
        />
      );
    }
    if (mod === "scanner") {
      return (
        <section>
          <h2 className="kcn-title">Scan</h2>
          <p className="kcn-hint">Photo a page or anything in front of you. Then say what you want done.</p>
          <div className="mb-4 flex flex-wrap gap-2">
            <button className="kcn-btn gold" onClick={() => setScanOpen(true)}>
              Open camera
            </button>
            <button className="kcn-btn cyan" onClick={() => setScanOpen(true)}>
              Use a photo
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {store.lookups.length === 0 && store.scans.length === 0 && (
              <div className="kcn-empty">Nothing scanned yet. Open the camera or pick a photo.</div>
            )}
            {store.lookups.map((l) => (
              <div key={l.id} className="kcn-item">
                <b>{l.instruction}</b>
                <div className="kcn-tiny kcn-muted">{l.at}</div>
                <pre className="mt-2 whitespace-pre-wrap font-mono text-xs">{(l.briefing || "").slice(0, 500)}</pre>
              </div>
            ))}
            {store.scans.map((s, i) => (
              <div key={i} className="kcn-item">
                <b>{s.title}</b>
                <div className="kcn-tiny kcn-muted">
                  {s.at} • {s.instruction} • {s.names} names • {s.locations} places
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
          <h2 className="kcn-title">Files</h2>
          <p className="kcn-hint">Add a document or paste text. Photos belong in Scan.</p>
          <label className="kcn-btn cyan mb-3 inline-flex">
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
          <textarea
            value={store.reading}
            onChange={(e) => store.setReading(e.target.value)}
            placeholder="Paste or extracted text appears here"
            className="min-h-[220px]"
          />
          <div className="kcn-tiny kcn-muted mt-2">
            {store.files.map((f) => f.name).join(" • ") || "No files yet."}
          </div>
        </section>
      );
    }
    if (mod === "conversation") {
      return (
        <section>
          <h2 className="kcn-title">Ask</h2>
          <p className="kcn-hint">
            The controller does what you asked. Search a name, add a person, or question this case.
          </p>
          <div className="kcn-card mb-3 min-h-48">
            {store.chat.map((m, i) => (
              <div key={i} className="kcn-item mb-2">
                <b>{m.role === "you" ? "YOU" : "KCN-II"}</b>
                <div className="kcn-tiny whitespace-pre-wrap">{m.text}</div>
              </div>
            ))}
            {store.chat.length === 0 && <div className="kcn-empty">No questions yet. Type below.</div>}
          </div>
          <AskPad onSubmit={sendAsk} />
        </section>
      );
    }
    if (mod === "notes") {
      return <ListForm title="Notes" hint="Quick facts, hunches, and follow-ups." placeholder="Add a note" onAdd={(t) => store.addNote(t)} items={store.notes.map((n) => ({ t: n.t, s: n.at }))} />;
    }
    if (mod === "cases") {
      return <CasesDesk />;
    }
    if (mod === "people") {
      return (
        <TwoField
          title="People"
          hint="Add a name. Role is optional."
          a="Name"
          b="Role / org"
          onAdd={(a, b) => store.addPerson(a, b)}
          items={store.people.map((p) => ({ t: p.name, s: p.role }))}
        />
      );
    }
    if (mod === "locations") {
      return <ListForm title="Places" hint="Addresses, cities, scenes." placeholder="Place, address, city, scene" onAdd={(t) => store.addPlace(t)} items={store.locations.map((l) => ({ t: l.name, s: l.source }))} />;
    }
    if (mod === "findings") {
      return <ListForm title="Findings" hint="Leads to review. Not conclusions." placeholder="Finding or lead" onAdd={(t) => store.addFinding(t)} items={store.findings.map((f) => ({ t: f.t, s: `${f.verify || "generated"} · ${f.source}` }))} />;
    }
    if (mod === "evidence") {
      return <ListForm title="Evidence" hint="What you have in hand." placeholder="Evidence title" onAdd={(t) => store.addEvidence(t, "document")} items={store.evidence.map((e) => ({ t: e.title, s: e.type }))} />;
    }
    if (mod === "timeline") {
      return <ListForm title="Timeline" hint="What happened, in order." placeholder="Event" onAdd={(t) => store.addEvent("", t)} items={store.events.map((e) => ({ t: e.what, s: String(e.when) }))} />;
    }
    if (mod === "swarm") {
      return <SearchDesk />;
    }
    if (mod === "video") {
      return (
        <section>
          <h2 className="kcn-title">Video</h2>
          <p className="kcn-hint">Paste a public video link to file it.</p>
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
          <h2 className="kcn-title">Links</h2>
          <p className="kcn-hint">Who is connected to whom.</p>
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
            setNeedPass(false);
            setSealedAway(false);
            setMod("home");
            ping("This account's vault was wiped. Opening a fresh workspace.");
            reopenSession();
          }}
        />
      );
    }
    return (
      <section>
        <h2 className="kcn-title">Overview</h2>
        <p className="kcn-hint">Counts only. Open Start if you want the next step.</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["CASES", store.cases.length, "cases"],
            ["PEOPLE", store.people.length, "people"],
            ["PLACES", store.locations.length, "locations"],
            ["FINDINGS", store.findings.length, "findings"],
            ["LOOKUPS", store.lookups.length, "scanner"],
            ["SCANS", store.scans.length, "scanner"],
            ["EVIDENCE", store.evidence.length, "evidence"],
            ["FILES", store.files.length, "reader"],
            ["CUSTODY", store.custody.length, "custody"],
            ["HASHES", store.acquisitions.length, "acquire"],
          ].map(([k, v, desk]) => (
            <button key={String(k)} className="kcn-card text-left" type="button" onClick={() => go(String(desk))}>
              <div className="text-gold-2 tracking-[0.12em]">{k}</div>
              <div className="text-4xl">{v}</div>
            </button>
          ))}
        </div>
      </section>
    );
  }, [mod, store, coach]);

  if (!booted) {
    return <BootSequence onDone={() => setBooted(true)} />;
  }
  if (sessionBusy || (!vaultOpen && !needPass && !sealedAway)) {
    return (
      <div className="kcn-boot" aria-label="Opening workspace">
        <Starfield />
        <div className="kcn-boot-stage">
          <p className="kcn-boot-sub">OPENING WORKSPACE</p>
        </div>
      </div>
    );
  }
  if (sealedAway && !vaultOpen) {
    return (
      <div className="kcn-boot" aria-label="Workspace locked">
        <Starfield />
        <div className="kcn-boot-stage">
          <p className="kcn-boot-sub">WORKSPACE LOCKED</p>
          <p className="kcn-hint mt-4">Case files stay sealed on this device. Tap to keep working.</p>
          <button className="kcn-btn gold mt-5 min-w-52" type="button" onClick={reopenSession}>
            Reopen
          </button>
        </div>
      </div>
    );
  }
  if (needPass && !vaultOpen) {
    return (
      <VaultGate
        onOpen={openVault}
        userId={user?.id || "guest"}
        operatorName={user?.displayName || user?.primaryEmail?.split("@")[0] || "Investigator"}
        email={user?.primaryEmail || user?.displayName || "this device"}
      />
    );
  }

  return (
    <div className={`kcn-app ${cmdOpen ? "cmd-open" : ""}`} data-investigator={store.operator || ""}>
      <Starfield />
      <div className="kcn-ribbon">KCN-II // INVESTIGATOR SENSITIVE // SEALED VAULT • HUMAN REVIEW REQUIRED</div>
      <header className="kcn-appbar">
        <div className="kcn-brand flex items-center gap-3">
          <Seal />
          <div>
            <h1>
              KCN-<span>II</span>
            </h1>
            <p>CASE INTELLIGENCE • {store.operator || user?.primaryEmail || "READY"}</p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className={`kcn-pill ${vaultOpen ? "live" : ""}`}>{vaultOpen ? "OPEN" : "LOCKED"}</div>
          <div className="kcn-pill">{user?.primaryEmail || store.operator || "Investigator"}</div>
          <div className="kcn-userchip">
            {user ? (
              <UserButton />
            ) : (
              <Link to="/login" className="kcn-btn gold">
                Sign in
              </Link>
            )}
          </div>
          <div className="kcn-appbar-desk">
            <div className="kcn-pill">{clock}</div>
            <div className="kcn-pill">{savedAt}</div>
            <button className="kcn-btn" onClick={saveCase}>Export</button>
            <button className="kcn-btn" onClick={() => go("vault")}>Vault</button>
            <button className="kcn-btn" onClick={() => setScanOpen(true)}>Scan</button>
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
          {user ? (
          <button
            className="kcn-btn"
            aria-label="Switch account"
            onClick={() => {
              lockNow("Signed out. That case stays in this email's vault.");
              void signOut("/login").catch(() => ping("Sign out did not finish. Try again."));
            }}
          >
            Switch account
          </button>
          ) : null}
          <button className="kcn-btn" onClick={() => lockNow()}>Lock</button>
        </div>
      </header>
      <div className="kcn-shell">
        <aside className="kcn-aside">
          <div className="px-2 text-[10px] tracking-[0.28em] text-cyan">OPERATIONS</div>
          <div className="px-2 pb-2 text-xl">Desks</div>
          <input
            className="kcn-nav-search"
            value={navQ}
            onChange={(e) => setNavQ(e.target.value)}
            placeholder="Find a desk"
            aria-label="Find a desk"
          />
          <NavList
            mod={mod}
            query={navQ}
            openSec={openSec}
            onToggle={(section) => setOpenSec((prev) => ({ ...prev, [section]: !prev[section] }))}
            onPick={(key) => go(key)}
          />
        </aside>
        <main className="kcn-workspace">
          <div className="kcn-ws-top">
            <div>START WITH A PHOTO, A FILE, OR A NAME</div>
            <div>HUMAN REVIEW REQUIRED</div>
          </div>
          <div className="kcn-body">
            <DeskGuard>{view}</DeskGuard>
          </div>
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
              placeholder="Search a name, add a person, or ask the case"
              autoFocus
            />
            <button className="kcn-btn gold" onClick={() => sendAsk(ask)}>
              Ask
            </button>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button className="kcn-btn cyan" onClick={() => setScanOpen(true)}>
              Scan
            </button>
            <button className="kcn-btn" onClick={() => setCmdOpen(false)}>
              Hide
            </button>
          </div>
        </div>
      ) : (
        <button className="kcn-cmd-fab" type="button" onClick={() => setCmdOpen(true)}>
          Ask
        </button>
      )}
      <nav className="kcn-dock" aria-label="Main">
        <button type="button" className={mod === "home" ? "on" : ""} onClick={() => go("home")}>
          Start
        </button>
        <button
          type="button"
          className={mod === "scanner" ? "on" : ""}
          onClick={() => {
            go("scanner");
            setScanOpen(true);
          }}
        >
          Scan
        </button>
        <button type="button" className={mod === "reader" ? "on" : ""} onClick={() => go("reader")}>
          Files
        </button>
        <button type="button" className={mod === "people" ? "on" : ""} onClick={() => go("people")}>
          People
        </button>
        <button type="button" className={moreOpen ? "on" : ""} onClick={() => setMoreOpen(true)}>
          More
        </button>
      </nav>
      {moreOpen ? (
        <div className="kcn-sheet" onClick={() => setMoreOpen(false)}>
          <div className="kcn-sheet-card kcn-more-card" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="kcn-title mb-0">All desks</h2>
              <button className="kcn-btn" type="button" onClick={() => setMoreOpen(false)}>
                Close
              </button>
            </div>
            <input
              className="kcn-nav-search mb-3"
              value={navQ}
              onChange={(e) => setNavQ(e.target.value)}
              placeholder="Search desks"
              aria-label="Search desks"
            />
            <NavList
              mod={mod}
              query={navQ}
              openSec={openSec}
              onToggle={(section) => setOpenSec((prev) => ({ ...prev, [section]: true }))}
              onPick={(key) => go(key)}
            />
          </div>
        </div>
      ) : null}
      <ScannerSheet open={scanOpen} onClose={() => setScanOpen(false)} toast={ping} />
      {toast ? <div className="kcn-toast">{toast}</div> : null}
    </div>
  );
}

function DeskGuard({ children }: { children: ReactNode }) {
  return <DeskGuardInner>{children}</DeskGuardInner>;
}

class DeskGuardInner extends Component<{ children: ReactNode }, { err: string | null }> {
  state: { err: string | null } = { err: null };

  static getDerivedStateFromError(error: Error) {
    return { err: error.message || "Desk failed." };
  }

  componentDidCatch() {
    /* keep the vault up; do not log */
  }

  render() {
    if (this.state.err) {
      return (
        <section>
          <h2 className="kcn-title">This desk hit a problem</h2>
          <p className="kcn-hint">The vault is still sealed. Switch desks or retry. Nothing was sent off this device.</p>
          <p className="kcn-tiny kcn-muted mb-3">{this.state.err}</p>
          <button className="kcn-btn gold" type="button" onClick={() => this.setState({ err: null })}>
            Retry
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}

function NavList({
  mod,
  query,
  openSec,
  onToggle,
  onPick,
}: {
  mod: string;
  query: string;
  openSec: Record<string, boolean>;
  onToggle: (section: string) => void;
  onPick: (key: string) => void;
}) {
  const q = query.trim().toLowerCase();
  return (
    <>
      {NAV.map((group) => {
        const items = q
          ? group.items.filter(
              ([, label]) =>
                label.toLowerCase().includes(q) || group.section.toLowerCase().includes(q),
            )
          : group.items;
        if (q && items.length === 0) return null;
        const open = Boolean(q) || Boolean(openSec[group.section]);
        return (
          <div key={group.section} className="kcn-nav-group">
            <button type="button" className="kcn-nav-label" onClick={() => onToggle(group.section)}>
              {group.section}
              <span>{open ? "–" : "+"}</span>
            </button>
            {open &&
              items.map(([key, label]) => (
                <button
                  key={key}
                  className={`kcn-nav ${mod === key ? "active" : ""}`}
                  onClick={() => onPick(key)}
                >
                  {label}
                </button>
              ))}
          </div>
        );
      })}
    </>
  );
}

function HomeDesk({
  coach,
  onDismissCoach,
  counts,
  onScan,
  onFiles,
  onPeople,
  onAsk,
  onGo,
}: {
  coach: boolean;
  onDismissCoach: () => void;
  counts: { people: number; files: number; findings: number; scans: number };
  onScan: () => void;
  onFiles: () => void;
  onPeople: () => void;
  onAsk: () => void;
  onGo: (k: string) => void;
}) {
  return (
    <section>
      <h2 className="kcn-title">Start</h2>
      <p className="kcn-hint">Three moves. Photo or file. Names. Then ask.</p>
      {coach ? (
        <div className="kcn-coach">
          <p>Scan, add a name, or search. Sign in is optional if you want this case on an email account.</p>
          <button className="kcn-btn gold" type="button" onClick={onDismissCoach}>
            Got it
          </button>
        </div>
      ) : null}
      <div className="kcn-home-grid">
        <button className="kcn-action primary" type="button" onClick={onScan}>
          <b>Scan</b>
          <span>Photo a page or a face. Then say what to do.</span>
        </button>
        <button className="kcn-action" type="button" onClick={onFiles}>
          <b>Files</b>
          <span>Add a document or paste text.</span>
        </button>
        <button className="kcn-action" type="button" onClick={onPeople}>
          <b>People</b>
          <span>Put a name on the board.</span>
        </button>
        <button className="kcn-action" type="button" onClick={onAsk}>
          <b>Ask</b>
          <span>Search a name, add a person, or question the case.</span>
        </button>
      </div>
      <div className="kcn-home-stats">
        {[
          ["Scans", counts.scans, "scanner"],
          ["Files", counts.files, "reader"],
          ["People", counts.people, "people"],
          ["Findings", counts.findings, "findings"],
        ].map(([label, n, desk]) => (
          <button key={String(label)} className="kcn-stat" type="button" onClick={() => onGo(String(desk))}>
            <b>{n}</b>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function AskPad({ onSubmit }: { onSubmit: (q: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex flex-wrap gap-2">
      <input
        className="kcn-field flex-1"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const t = v.trim();
            if (!t) return;
            setV("");
            onSubmit(t);
          }
        }}
        placeholder="search Jane Doe  ·  add person Marcus Hale  ·  what is on the board"
        aria-label="Ask the controller"
      />
      <button
        className="kcn-btn gold"
        type="button"
        onClick={() => {
          const t = v.trim();
          if (!t) return;
          setV("");
          onSubmit(t);
        }}
      >
        Send
      </button>
    </div>
  );
}

function ListForm({
  title,
  hint,
  placeholder,
  onAdd,
  items,
}: {
  title: string;
  hint?: string;
  placeholder: string;
  onAdd: (t: string) => void;
  items: { t: string; s: string }[];
}) {
  const [v, setV] = useState("");
  function submit() {
    if (!v.trim()) return;
    onAdd(v.trim());
    setV("");
  }
  return (
    <section>
      <h2 className="kcn-title">{title}</h2>
      {hint ? <p className="kcn-hint">{hint}</p> : null}
      <div className="mb-3 flex gap-2">
        <input
          className="kcn-field flex-1"
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={placeholder}
        />
        <button className="kcn-btn gold" onClick={submit}>
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
        {items.length === 0 && <div className="kcn-empty">Nothing here yet. Type above and tap Add.</div>}
      </div>
    </section>
  );
}

function TwoField({
  title,
  hint,
  a,
  b,
  onAdd,
  items,
}: {
  title: string;
  hint?: string;
  a: string;
  b: string;
  onAdd: (a: string, b: string) => void;
  items: { t: string; s: string }[];
}) {
  const [x, setX] = useState("");
  const [y, setY] = useState("");
  function submit() {
    if (!x.trim()) return;
    onAdd(x.trim(), y.trim());
    setX("");
    setY("");
  }
  return (
    <section>
      <h2 className="kcn-title">{title}</h2>
      {hint ? <p className="kcn-hint">{hint}</p> : null}
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          className="kcn-field"
          value={x}
          onChange={(e) => setX(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={a}
        />
        <input
          className="kcn-field"
          value={y}
          onChange={(e) => setY(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={b}
        />
        <button className="kcn-btn gold" onClick={submit}>
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
        {items.length === 0 && <div className="kcn-empty">No people yet. Add a name to start the board.</div>}
      </div>
    </section>
  );
}

function VideoBox({ url, onLock }: { url: string; onLock: (u: string) => void }) {
  const [v, setV] = useState(url);
  const yt = typeof url === "string" ? url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/) : null;
  return (
    <>
      <div className="mb-3 flex gap-2">
        <input className="kcn-field flex-1" value={v} onChange={(e) => setV(e.target.value)} placeholder="Paste a public video URL" />
        <button className="kcn-btn cyan" onClick={() => onLock(v.trim())}>
          Save
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
        {people.length === 0 && <div className="kcn-empty">Add people first, then link them.</div>}
      </div>
    </>
  );
}
