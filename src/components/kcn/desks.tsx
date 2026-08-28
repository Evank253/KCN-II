import { useEffect, useMemo, useRef, useState } from "react";
import { downloadText } from "@/lib/kcn/legal-copy";
import { VERIFY_FLOW, buildReport, findContradictions, resolveEntities, swarmBrief } from "@/lib/kcn/intel";
import { nowStamp, useKcn, type SearchEvent, type SwarmRun, type VerifyStatus } from "@/lib/kcn/store";
import { liveGrokSearch, localPlan, planSwarm, probeSource, retaskSwarm, type AgentTask, type SwarmFocus } from "@/lib/kcn/deep-search";

export function ResolveDesk() {
  const people = useKcn((s) => s.people);
  const aliases = useKcn((s) => s.aliases);
  const mergeAliases = useKcn((s) => s.mergeAliases);
  const setAliasStatus = useKcn((s) => s.setAliasStatus);
  const hits = useMemo(() => resolveEntities(people), [people]);
  return (
    <section>
      <h2 className="kcn-title">Match names</h2>
      <p className="kcn-muted mb-3">
        Candidate matches only. John Smith and J. Smith can look related. The investigator decides.
      </p>
      <button
        className="kcn-btn gold mb-4"
        onClick={() => {
          const next = resolveEntities(people);
          mergeAliases(next);
        }}
      >
        Run match
      </button>
      {(aliases.length ? aliases : hits).map((h) => (
        <div key={h.id} className="kcn-item mb-2">
          <b>
            {h.a} ~ {h.b}
          </b>
          <div className="kcn-tiny kcn-muted">
            {Math.round(h.confidence * 100)}% · {h.status} · {h.why}
          </div>
          <div className="mt-2 flex gap-2">
            <button
              className="kcn-btn"
              onClick={() => {
                mergeAliases([h]);
                setAliasStatus(h.id, "confirmed");
              }}
            >
              Confirm overlap
            </button>
            <button
              className="kcn-btn"
              onClick={() => {
                mergeAliases([h]);
                setAliasStatus(h.id, "rejected");
              }}
            >
              Not the same
            </button>
          </div>
        </div>
      ))}
      {hits.length === 0 && aliases.length === 0 && <div className="kcn-muted">Add at least two people, then run match.</div>}
    </section>
  );
}

export function ContradictDesk() {
  const store = useKcn();
  const live = useMemo(() => findContradictions(store), [store.findings, store.notes, store.events]);
  return (
    <section>
      <h2 className="kcn-title">Conflicts</h2>
      <p className="kcn-muted mb-3">Flags possible conflicts. It does not decide who is telling the truth.</p>
      <button className="kcn-btn gold mb-4" onClick={() => store.mergeContradictions(live)}>
        Scan for conflicts
      </button>
      {(store.contradictions.length ? store.contradictions : live).map((c) => (
        <div key={c.id} className="kcn-item mb-2">
          <b className="text-gold-2">{c.severity.toUpperCase()} · {c.status}</b>
          <div className="kcn-tiny mt-1">{c.left}</div>
          <div className="kcn-tiny mt-1">{c.right}</div>
          <div className="kcn-tiny kcn-muted mt-1">{c.sources}</div>
          <div className="mt-2 flex gap-2">
            <button
              className="kcn-btn"
              onClick={() => {
                store.mergeContradictions([c]);
                store.setContradictionStatus(c.id, "reviewed");
              }}
            >
              Mark reviewed
            </button>
            <button
              className="kcn-btn"
              onClick={() => {
                store.mergeContradictions([c]);
                store.setContradictionStatus(c.id, "resolved");
              }}
            >
              Resolve
            </button>
          </div>
        </div>
      ))}
      {live.length === 0 && store.contradictions.length === 0 && <div className="kcn-muted">No conflicts flagged from current notes and findings.</div>}
    </section>
  );
}

export function VerifyDesk() {
  const findings = useKcn((s) => s.findings);
  const setVerify = useKcn((s) => s.setVerify);
  return (
    <section>
      <h2 className="kcn-title">Review</h2>
      <p className="kcn-muted mb-3">
        Generated → unreviewed → corroborated → verified. Disputed or rejected stays on the record.
      </p>
      {findings.map((f) => (
        <div key={f.id} className="kcn-item mb-2">
          <b>{f.t}</b>
          <div className="kcn-tiny kcn-muted">
            {f.source} · {f.evidenceId ? `evidence ${f.evidenceId}` : "no evidence link"} · {f.verify || "generated"}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {VERIFY_FLOW.map((st) => (
              <button
                key={st}
                className={`kcn-chip ${f.verify === st ? "on" : ""}`}
                onClick={() => setVerify(f.id, st as VerifyStatus)}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      ))}
      {findings.length === 0 && <div className="kcn-muted">No findings to review yet.</div>}
    </section>
  );
}

export function CustodyDesk() {
  const evidence = useKcn((s) => s.evidence);
  const custody = useKcn((s) => s.custody);
  const addCustody = useKcn((s) => s.addCustody);
  const [id, setId] = useState(evidence[0]?.id || "");
  const [action, setAction] = useState("sealed");
  const [reason, setReason] = useState("");
  return (
    <section>
      <h2 className="kcn-title">Custody</h2>
      <p className="kcn-muted mb-3">
        Working-copy custody log with a hash chain. Not a court exhibit locker.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        <select className="kcn-field" value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">Evidence…</option>
          {evidence.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
        <select className="kcn-field" value={action} onChange={(e) => setAction(e.target.value)}>
          {["accepted", "transferred", "sealed", "analyzed", "released", "returned"].map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <input className="kcn-field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" />
        <button
          className="kcn-btn gold"
          onClick={() => {
            if (!id) return;
            addCustody(id, action, reason || action);
            setReason("");
          }}
        >
          Log event
        </button>
      </div>
      {custody.map((c) => (
        <div key={c.id} className="kcn-item mb-2">
          <b>
            {c.action.toUpperCase()} · {c.evidenceId}
          </b>
          <div className="kcn-tiny kcn-muted">
            {c.at} · {c.actor} · {c.reason}
          </div>
          <div className="kcn-tiny mt-1">hash {(c.hash || "").slice(0, 16)}… prev {(c.prev || "").slice(0, 10)}</div>
        </div>
      ))}
      {custody.length === 0 && <div className="kcn-muted">No custody events yet. Ingest a source or log one.</div>}
    </section>
  );
}

export function AcquireDesk() {
  const acquisitions = useKcn((s) => s.acquisitions);
  return (
    <section>
      <h2 className="kcn-title">Hashes</h2>
      <p className="kcn-muted mb-3">
        Each ingest can carry method, operator, tool, and SHA-256 of the working copy. This is provenance for the
        notebook, not a write-blocked forensic image.
      </p>
      {acquisitions.map((a) => (
        <div key={a.id} className="kcn-item mb-2">
          <b>{a.source}</b>
          <div className="kcn-tiny kcn-muted">
            {a.at} · {a.method} · {a.operator} · {a.tool} {a.version}
          </div>
          <div className="kcn-tiny mt-1">acquired SHA-256 {(a.acquiredHash || "").slice(0, 24)}…</div>
          <div className="kcn-tiny">{a.writeBlock}</div>
        </div>
      ))}
      {acquisitions.length === 0 && <div className="kcn-muted">Acquire records appear when you add files or scan a page.</div>}
    </section>
  );
}

export function ReportDesk() {
  const store = useKcn();
  const text = useMemo(() => buildReport(store), [store]);
  return (
    <section>
      <h2 className="kcn-title">Report</h2>
      <p className="kcn-muted mb-3">Standardized draft from the current case. Review every line before you publish.</p>
      <button className="kcn-btn gold mb-3" onClick={() => downloadText("KCN-II-report.txt", text)}>
        Download report
      </button>
      <pre className="kcn-legal-body">{text}</pre>
    </section>
  );
}

export function SwarmDesk() {
  const store = useKcn();
  const cards = useMemo(() => swarmBrief(store), [store]);
  return (
    <section>
      <h2 className="kcn-title">Case brief</h2>
      <p className="kcn-muted mb-3">
        Nine local analytical passes over the board. Optional OSINT opens public search in new tabs.
      </p>
      <div className="mb-3 flex gap-2">
        <button
          className="kcn-btn gold"
          onClick={() => {
            store.mergeAliases(resolveEntities(store.people));
            store.mergeContradictions(findContradictions(store));
          }}
        >
          Run brief
        </button>
      </div>
      {cards.map((c) => (
        <div key={c.agent} className="kcn-item mb-2">
          <b className="text-gold-2">{c.agent}</b>
          <div className="kcn-tiny mt-1">{c.text}</div>
        </div>
      ))}
    </section>
  );
}

export function ActivityDesk() {
  const activity = useKcn((s) => s.activity);
  const operator = useKcn((s) => s.operator);
  const setOperator = useKcn((s) => s.setOperator);
  const [name, setName] = useState(operator);
  return (
    <section>
      <h2 className="kcn-title">Activity</h2>
      <p className="kcn-muted mb-3">Local operator history for this device. Not a multi-user server.</p>
      <div className="mb-3 flex gap-2">
        <input className="kcn-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Operator name" />
        <button className="kcn-btn" onClick={() => setOperator(name.trim() || "Investigator")}>
          Set operator
        </button>
      </div>
      {activity.map((a, i) => (
        <div key={i} className="kcn-item mb-2">
          <b>{a.action}</b>
          <div className="kcn-tiny kcn-muted">
            {a.at} · {a.actor} · {a.target}
          </div>
        </div>
      ))}
      {activity.length === 0 && <div className="kcn-muted">No activity yet.</div>}
    </section>
  );
}

export function InterviewDesk() {
  const fileExtraction = useKcn((s) => s.fileExtraction);
  const stampIngest = useKcn((s) => s.stampIngest);
  const addEvidence = useKcn((s) => s.addEvidence);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const [status, setStatus] = useState("Recorder idle.");
  const [live, setLive] = useState("");
  const liveRef = useRef("");
  const recg = useRef<{ stop: () => void } | null>(null);

  useEffect(() => () => stopRec(), []);

  function stopRec() {
    try {
      const rec = recRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
    } catch {
      /* already stopped */
    }
    recRef.current = null;
    try {
      recg.current?.stop();
    } catch {
      /* ignore */
    }
    recg.current = null;
  }

  async function start() {
    if (typeof MediaRecorder === "undefined") {
      setStatus("This browser cannot record audio.");
      return;
    }
    stopRec();
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(media);
      chunks.current = [];
      rec.ondataavailable = (e) => chunks.current.push(e.data);
      rec.onstop = () => {
        media.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "KCN-II-interview.webm";
        a.click();
        addEvidence("Interview recording " + nowStamp(), "audio");
        if (liveRef.current.trim()) {
          const label = "Interview transcript " + nowStamp();
          fileExtraction(liveRef.current, label);
          void stampIngest(liveRef.current, label, "interview-audio");
        }
        setStatus("Interview captured. Audio downloaded. Transcript filed if speech-to-text ran.");
      };
      rec.start();
      recRef.current = rec;
      const w = window as unknown as {
        SpeechRecognition?: new () => SpeechLike;
        webkitSpeechRecognition?: new () => SpeechLike;
      };
      const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (SR) {
        const r = new SR();
        r.continuous = true;
        r.interimResults = true;
        r.onresult = (ev) => {
          let t = "";
          for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript + " ";
          setLive(t.trim());
          liveRef.current = t.trim();
        };
        r.start();
        recg.current = r;
      }
      setStatus("Recording. Speak clearly. Stop when finished.");
    } catch {
      setStatus("Microphone permission denied.");
    }
  }

  return (
    <section>
      <h2 className="kcn-title">Interview</h2>
      <p className="kcn-muted mb-3">
        Records audio on this device and files a transcript into the case when the browser supports speech-to-text.
      </p>
      <p className="kcn-muted mb-3">{status}</p>
      <button className="kcn-btn cyan mr-2" onClick={() => void start()}>
        Record
      </button>
      <button className="kcn-btn" onClick={stopRec}>
        Stop
      </button>
      {live ? <pre className="kcn-legal-body mt-3">{live}</pre> : null}
    </section>
  );
}

export function OrgDesk() {
  const orgs = useKcn((s) => s.orgs);
  const addOrg = useKcn((s) => s.addOrg);
  const [v, setV] = useState("");
  return (
    <section>
      <h2 className="kcn-title">Organizations</h2>
      <div className="mb-3 flex gap-2">
        <input className="kcn-field flex-1" value={v} onChange={(e) => setV(e.target.value)} placeholder="Organization" />
        <button
          className="kcn-btn gold"
          onClick={() => {
            if (!v.trim()) return;
            addOrg(v.trim());
            setV("");
          }}
        >
          Add
        </button>
      </div>
      {orgs.map((o) => (
        <div key={o.id} className="kcn-item mb-2">
          <b>{o.name}</b>
          <div className="kcn-tiny kcn-muted">{o.at}</div>
        </div>
      ))}
      {orgs.length === 0 && <div className="kcn-muted">No organizations yet.</div>}
    </section>
  );
}

export function CasesDesk() {
  const cases = useKcn((s) => s.cases);
  const active = useKcn((s) => s.activeCaseId);
  const addCase = useKcn((s) => s.addCase);
  const setActiveCase = useKcn((s) => s.setActiveCase);
  const [v, setV] = useState("");
  return (
    <section>
      <h2 className="kcn-title">Cases</h2>
      <p className="kcn-muted mb-3">Keep investigations named and separate. The sealed vault holds the working board.</p>
      <div className="mb-3 flex gap-2">
        <input className="kcn-field flex-1" value={v} onChange={(e) => setV(e.target.value)} placeholder="Case title" />
        <button
          className="kcn-btn gold"
          onClick={() => {
            if (!v.trim()) return;
            addCase(v.trim());
            setV("");
          }}
        >
          Open case
        </button>
      </div>
      {cases.map((c) => (
        <button
          key={c.id}
          className={`kcn-item mb-2 w-full text-left ${active === c.id ? "kcn-item-on" : ""}`}
          onClick={() => setActiveCase(c.id)}
        >
          <b>{c.title}</b>
          <div className="kcn-tiny kcn-muted">
            {c.status}
            {active === c.id ? " · ACTIVE" : ""}
          </div>
        </button>
      ))}
    </section>
  );
}

export function SearchDesk() {
  const store = useKcn();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState<SwarmFocus>("auto");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<SwarmRun | null>(null);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [intent, setIntent] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);
  const abort = useRef(false);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [live?.events.length]);

  useEffect(() => {
    const next = store.pendingSearch;
    if (!next) return;
    if (busy) {
      abort.current = true;
      return;
    }
    store.clearPendingSearch();
    setQ(next);
    void run(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.pendingSearch, busy]);

  function tick() {
    return new Date().toLocaleTimeString();
  }

  async function run(raw?: string) {
    const query = (typeof raw === "string" ? raw : q).trim();
    if (!query || busy) return;
    abort.current = false;
    setBusy(true);
    const hint = {
      people: store.people.slice(0, 6).map((p) => p.name),
      places: store.locations.slice(0, 6).map((p) => p.name),
      orgs: store.orgs.slice(0, 6).map((o) => o.name),
      findings: store.findings.slice(0, 4).map((f) => f.t.slice(0, 80)),
    };
    const sketch = localPlan(query, focus, hint);
    const id = Math.random().toString(36).slice(2, 10);
    let current: SwarmRun = {
      id,
      q: query,
      at: nowStamp(),
      agents: sketch.tasks.map((t) => t.agent),
      engines: sketch.tasks.map((t) => [t.agent, t.where] as [string, string]),
      events: [
        {
          at: tick(),
          kind: "control",
          source: "CONTROLLER",
          text: "Writing tasking. Directing agents to the right sources.",
        },
      ],
      hits: [],
      briefing: "",
      status: "running",
      intent: sketch.intent,
      tasks: sketch.tasks,
    };
    const push = (ev: SearchEvent) => {
      current = { ...current, events: [...current.events, ev] };
      setLive({ ...current });
      store.upsertSwarm(current);
    };
    setIntent(sketch.intent);
    setTasks(sketch.tasks);
    setLive(current);
    store.upsertSwarm(current);

    let plan = sketch;
    try {
      plan = await planSwarm({ data: { query, focus, hint } });
    } catch {
      plan = sketch;
    }
    if (abort.current) {
      setBusy(false);
      return;
    }
    current = {
      ...current,
      intent: plan.intent,
      agents: plan.tasks.map((t) => t.agent),
      engines: plan.tasks.map((t) => [t.agent, t.where] as [string, string]),
      tasks: plan.tasks,
    };
    setIntent(plan.intent);
    setTasks(plan.tasks);
    push({
      at: tick(),
      kind: "control",
      source: "CONTROLLER",
      text: `${plan.from === "ai" ? "AI controller" : "Local controller"}: ${plan.intent}`,
    });
    plan.tasks.forEach((t) => {
      push({
        at: tick(),
        kind: "control",
        source: t.agent,
        text: `PROMPT → ${t.why}  Query: ${t.query}`,
        url: t.where,
      });
    });

    async function exec(t: AgentTask) {
      if (abort.current) return;
      t.status = "running";
      setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...t } : x)));
      push({
        at: tick(),
        kind: "search",
        source: t.agent,
        text: `Hitting ${t.source === "grok" ? "live web + X" : t.source} for “${t.query}”`,
        url: t.where,
      });
      try {
        if (t.source === "grok") {
          const g = await liveGrokSearch({ data: { query: t.query, hits: current.hits } });
          if (g.hits?.length) {
            current = { ...current, hits: [...current.hits, ...g.hits] };
            t.hits = g.hits.length;
            t.status = "hit";
            g.hits.forEach((h) => {
              push({ at: tick(), kind: "hit", source: t.agent, text: h.title, url: h.url });
            });
          } else t.status = g.error ? "fail" : "empty";
          if (g.text) {
            current = { ...current, briefing: g.text };
            push({ at: tick(), kind: "note", source: t.agent, text: "Briefing ready. Human review required." });
          }
          if (g.error) push({ at: tick(), kind: "fail", source: t.agent, text: g.error });
        } else {
          const r = await probeSource({ data: { source: t.source, query: t.query } });
          if (r.hits?.length) {
            current = { ...current, hits: [...current.hits, ...r.hits] };
            t.hits = r.hits.length;
            t.status = "hit";
            r.hits.forEach((h) => {
              push({ at: tick(), kind: "hit", source: t.agent, text: h.title, url: h.url });
            });
            push({
              at: tick(),
              kind: "note",
              source: t.agent,
              text: `${r.hits.length} hit${r.hits.length === 1 ? "" : "s"}`,
            });
          } else {
            t.status = "empty";
            push({
              at: tick(),
              kind: "fail",
              source: t.agent,
              text: r.error || "No hits",
              url: r.where || t.where,
            });
          }
        }
      } catch {
        t.status = "fail";
        push({ at: tick(), kind: "fail", source: t.agent, text: "Did not answer", url: t.where });
      }
      setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...t } : x)));
      current = { ...current, tasks: (current.tasks || []).map((x) => (x.id === t.id ? { ...t } : x)) };
      setLive({ ...current });
    }

    const wave1 = plan.tasks.filter((t) => t.source !== "grok");
    const liveAgent = plan.tasks.find((t) => t.source === "grok");
    for (const t of wave1) {
      if (abort.current) break;
      await exec(t);
    }

    if (!abort.current) {
      push({
        at: tick(),
        kind: "control",
        source: "CONTROLLER",
        text: "Reading hits. Retasking agents onto gaps.",
      });
      try {
        const follow = await retaskSwarm({
          data: {
            query,
            hits: current.hits,
            done: wave1.map((t) => ({ source: t.source, query: t.query })),
          },
        });
        if (follow.intent) {
          setIntent(follow.intent);
          current = { ...current, intent: follow.intent };
          push({ at: tick(), kind: "control", source: "CONTROLLER", text: follow.intent });
        }
        if (follow.tasks.length) {
          setTasks((prev) => [...prev, ...follow.tasks]);
          current = { ...current, tasks: [...(current.tasks || []), ...follow.tasks] };
          for (const t of follow.tasks) {
            if (abort.current) break;
            if (t.source === "grok") continue;
            push({
              at: tick(),
              kind: "control",
              source: t.agent,
              text: `RETASK → ${t.why}  Query: ${t.query}`,
              url: t.where,
            });
            await exec(t);
          }
        } else {
          push({ at: tick(), kind: "control", source: "CONTROLLER", text: "No retask. First wave covered it." });
        }
      } catch {
        push({ at: tick(), kind: "control", source: "CONTROLLER", text: "Retask skipped." });
      }
    }

    if (!abort.current && liveAgent) await exec(liveAgent);

    current = { ...current, status: abort.current ? "failed" : "done" };
    push({
      at: tick(),
      kind: "done",
      source: "CONTROLLER",
      text: abort.current ? "Controller stopped the swarm." : `Sweep complete. ${current.hits.length} public hits.`,
    });
    store.upsertSwarm(current, true);
    if (current.briefing) store.addChat("Search: " + query, current.briefing);
    setLive(current);
    setBusy(false);
    setQ("");
  }

  const shown = live || store.swarmLog[0] || null;
  const events = shown?.events || [];
  const hits = shown?.hits || [];
  const board = tasks.length ? tasks : ((shown?.tasks || []) as AgentTask[]);
  const FOCUS: SwarmFocus[] = ["auto", "person", "place", "org", "news"];

  return (
    <section>
      <div className="kcn-legal-stamp">AI CONTROLLER • SWARM DIRECTIVE</div>
      <h2 className="kcn-title">Web search</h2>
      <p className="kcn-hint">
        The controller tasks each agent with its own prompt and sends it where it needs to hit. You will see the order, the query, and the URL. Public sources only.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {FOCUS.map((f) => (
          <button
            key={f}
            type="button"
            className={`kcn-chip ${focus === f ? "on" : ""}`}
            onClick={() => setFocus(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          className="kcn-field flex-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void run();
          }}
          placeholder="Name, alias, place, or subject"
        />
        <button className="kcn-btn gold" disabled={busy} onClick={() => void run()}>
          {busy ? "Directing…" : "Run swarm"}
        </button>
        {busy ? (
          <button
            className="kcn-btn"
            type="button"
            onClick={() => {
              abort.current = true;
            }}
          >
            Stop
          </button>
        ) : null}
      </div>
      <div className={`kcn-control ${shown?.status === "running" ? "live" : ""}`}>
        <div className="kcn-control-head">
          <span className={shown?.status === "running" ? "kcn-feed-pulse" : ""}>
            {shown?.status === "running" ? "CONTROLLER LIVE" : "CONTROLLER"}
          </span>
          <span>{intent || shown?.intent || "Standby — waiting for a subject"}</span>
        </div>
        <div className="kcn-agents">
          {(board.length ? board : []).map((t) => (
            <div key={t.id} className={`kcn-agent ${t.status}`}>
              <b>{t.agent}</b>
              <span>{t.status}</span>
              <em>{t.query}</em>
              <p>{t.why}</p>
              {t.where ? (
                <a href={t.where} target="_blank" rel="noopener noreferrer">
                  {t.where.replace(/^https?:\/\//, "").slice(0, 48)}
                </a>
              ) : null}
            </div>
          ))}
          {!board.length && (
            <div className="kcn-agent queued">
              <b>STANDBY</b>
              <span>idle</span>
              <p>Run swarm. The controller will write prompts and send agents to DuckDuckGo, Wikipedia, maps, news, then live web + X.</p>
            </div>
          )}
        </div>
      </div>
      <div className={`kcn-feed ${shown?.status === "running" ? "live" : ""}`} ref={feedRef} aria-live="polite">
        <div className="kcn-feed-head">
          <span className={shown?.status === "running" ? "kcn-feed-pulse" : ""}>
            {shown?.status === "running" ? "LIVE FEED" : shown ? "SEARCH FEED" : "STANDBY"}
          </span>
          <span>{shown ? shown.q : "Awaiting query"}</span>
        </div>
        {events.length === 0 && (
          <div className="kcn-feed-row note">The controller feed will show every prompt, engine, and URL.</div>
        )}
        {events.map((ev, i) => (
          <div key={i} className={`kcn-feed-row ${ev.kind}`}>
            <span className="kcn-feed-dot" />
            <span className="kcn-feed-time">{ev.at}</span>
            <span className="kcn-feed-src">{ev.source}</span>
            <span className="kcn-feed-text">
              {ev.text}
              {ev.url ? (
                <>
                  {" "}
                  <a href={ev.url} target="_blank" rel="noopener noreferrer">
                    {ev.url.replace(/^https?:\/\//, "").slice(0, 72)}
                  </a>
                </>
              ) : null}
            </span>
          </div>
        ))}
      </div>
      {hits.length > 0 && (
        <div className="mt-4">
          <div className="kcn-tiny kcn-muted mb-2">HITS — {hits.length} public sources</div>
          {hits.map((h, i) => (
            <a key={h.url + i} className="kcn-hit" href={h.url} target="_blank" rel="noopener noreferrer">
              <b>{h.title}</b>
              <span>{h.source}</span>
              <em>{h.url.replace(/^https?:\/\//, "")}</em>
              {h.snippet ? <p>{h.snippet}</p> : null}
            </a>
          ))}
        </div>
      )}
      {shown?.briefing ? (
        <div className="mt-4">
          <div className="kcn-tiny kcn-muted mb-2">BRIEFING</div>
          <pre className="kcn-legal-body">{shown.briefing}</pre>
          <button
            className="kcn-btn cyan mt-2"
            type="button"
            onClick={() => {
              store.fileExtraction(shown.briefing, "OSINT " + shown.q);
              store.addNote("OSINT briefing: " + shown.q);
            }}
          >
            File briefing into case
          </button>
        </div>
      ) : null}
      {store.swarmLog.length > 1 && (
        <div className="mt-4">
          <div className="kcn-tiny kcn-muted mb-2">PRIOR SWEEPS</div>
          {store.swarmLog.slice(shown && store.swarmLog[0]?.id === shown.id ? 1 : 0, 8).map((s) => (
            <button
              key={s.id || s.at + s.q}
              className="kcn-item mb-2 w-full text-left"
              type="button"
              onClick={() => {
                setLive(s);
                setIntent(s.intent || "");
                setTasks((s.tasks || []) as AgentTask[]);
              }}
            >
              <b>{s.q}</b>
              <div className="kcn-tiny kcn-muted">
                {s.at} · {(s.hits || []).length} hits · {s.status || "done"}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
type SpeechLike = {
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  start: () => void;
  stop: () => void;
};
