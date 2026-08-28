import { useEffect, useMemo, useRef, useState } from "react";
import { downloadText } from "@/lib/kcn/legal-copy";
import { VERIFY_FLOW, buildReport, findContradictions, resolveEntities, swarmBrief } from "@/lib/kcn/intel";
import { nowStamp, useKcn, type VerifyStatus } from "@/lib/kcn/store";

export function ResolveDesk() {
  const people = useKcn((s) => s.people);
  const aliases = useKcn((s) => s.aliases);
  const mergeAliases = useKcn((s) => s.mergeAliases);
  const setAliasStatus = useKcn((s) => s.setAliasStatus);
  const hits = useMemo(() => resolveEntities(people), [people]);
  return (
    <section>
      <h2 className="kcn-title">Entity resolution</h2>
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
        Run resolver
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
      {hits.length === 0 && aliases.length === 0 && <div className="kcn-muted">Need at least two people on the board.</div>}
    </section>
  );
}

export function ContradictDesk() {
  const store = useKcn();
  const live = useMemo(() => findContradictions(store), [store.findings, store.notes, store.events]);
  return (
    <section>
      <h2 className="kcn-title">Contradiction desk</h2>
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
      <h2 className="kcn-title">Human verification</h2>
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
      {findings.length === 0 && <div className="kcn-muted">No findings to verify.</div>}
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
      <h2 className="kcn-title">Chain of custody</h2>
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
          <div className="kcn-tiny mt-1">hash {c.hash.slice(0, 16)}… prev {c.prev.slice(0, 10)}</div>
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
      <h2 className="kcn-title">Evidence acquisition</h2>
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
          <div className="kcn-tiny mt-1">acquired SHA-256 {a.acquiredHash.slice(0, 24)}…</div>
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
      <h2 className="kcn-title">Investigative report</h2>
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
      <h2 className="kcn-title">Investigation swarm</h2>
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
          Run swarm
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
      <h2 className="kcn-title">Activity log</h2>
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
    recRef.current?.stop();
    recRef.current = null;
    recg.current?.stop();
    recg.current = null;
  }

  async function start() {
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
      <h2 className="kcn-title">Interview recorder</h2>
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

type SpeechLike = {
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  start: () => void;
  stop: () => void;
};

