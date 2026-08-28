import { useEffect, useRef, useState } from "react";
import { createIntelAudio, type IntelAudio } from "@/lib/kcn/boot-audio";
import { LEGAL_DOCS, recordLegalAcceptance } from "@/lib/kcn/legal-copy";
import { Seal } from "./seal";

const LINES = [
  { at: 350, text: "VERIFYING OPERATOR CLEARANCE…", sound: "ping" as const },
  { at: 1300, text: "INITIALIZING DATABASE CORE…", sound: "tick" as const },
  { at: 2200, text: "MOUNTING CASE LEDGER / LOCAL STORE…", sound: "tick" as const },
  { at: 3100, text: "INDEXING PEOPLE · LOCATIONS · FINDINGS…", sound: "sweep" as const },
  { at: 4100, text: "CALIBRATING EVIDENCE PIPELINE…", sound: "tick" as const },
  { at: 5000, text: "LINKING INTELLIGENCE MODULES…", sound: "ping" as const },
  { at: 5900, text: "KCN-II ONLINE — HUMAN REVIEW REQUIRED.", sound: "confirm" as const },
];

type Props = { onDone: () => void };

export function BootSequence({ onDone }: Props) {
  const audio = useRef<IntelAudio | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const [phase, setPhase] = useState<"gate" | "run" | "out">("gate");
  const [log, setLog] = useState<string[]>([]);
  const [bar, setBar] = useState(0);
  const [muted, setMuted] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [legalTab, setLegalTab] = useState(LEGAL_DOCS[0].id);

  useEffect(() => {
    audio.current = createIntelAudio();
    return () => audio.current?.stop();
  }, []);

  useEffect(() => {
    audio.current?.setMuted(muted);
  }, [muted]);

  async function engage() {
    if (!agreed) return;
    recordLegalAcceptance();
    await audio.current?.unlock();
    audio.current?.drone(true);
    audio.current?.ping();
    setPhase("run");
  }

  useEffect(() => {
    if (phase !== "run") return;
    const timers: number[] = [];
    LINES.forEach((line, i) => {
      timers.push(
        window.setTimeout(() => {
          setLog((prev) => [...prev, line.text]);
          setBar(Math.round(((i + 1) / LINES.length) * 100));
          audio.current?.[line.sound]();
        }, line.at),
      );
    });
    timers.push(
      window.setTimeout(() => {
        audio.current?.drone(false);
        setPhase("out");
      }, 6800),
    );
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  useEffect(() => {
    if (phase !== "out") return;
    const t = window.setTimeout(() => doneRef.current(), 800);
    return () => clearTimeout(t);
  }, [phase]);

  const active = LEGAL_DOCS.find((d) => d.id === legalTab) ?? LEGAL_DOCS[0];

  return (
    <div className={`kcn-boot ${phase === "out" ? "kcn-boot-out" : ""}`} role="dialog" aria-label="KCN-II system boot">
      <div className="kcn-boot-scan" />
      <div className="kcn-boot-grid" />
      <div className="kcn-boot-stage">
        <div className={`kcn-boot-3d ${phase === "run" ? "spin" : ""}`}>
          <div className="kcn-boot-ring r1" />
          <div className="kcn-boot-ring r2" />
          <div className="kcn-boot-ring r3" />
          <div className="kcn-boot-seal">
            <Seal prefix="boot" className="h-full w-full" />
          </div>
        </div>
        <h1 className="kcn-boot-title">
          KCN-<span>II</span>
        </h1>
        <p className="kcn-boot-sub">KETCHUM'S INTELLIGENT INVESTIGATOR</p>
        {phase === "gate" && (
          <>
            <p className="kcn-tiny kcn-muted mt-4 tracking-[0.28em]">CLASSIFIED OPERATIONS CONSOLE</p>
            <label className="kcn-agree">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>
                I am 18+ and I agree to the User Agreement, Legal Agreement, and License.
              </span>
            </label>
            <button className="kcn-tiny mt-2 text-cyan underline" type="button" onClick={() => setShowLegal((v) => !v)}>
              {showLegal ? "Hide agreements" : "Read License, User Agreement, and Legal Agreement"}
            </button>
            {showLegal && (
              <div className="kcn-boot-legal">
                <p className="kcn-tiny kcn-muted mb-2">Legal Pack v1.1 — effective 27 August 2026. Same text as the GitHub files.</p>
                <div className="mb-2 flex flex-wrap justify-center gap-2">
                  {LEGAL_DOCS.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={`kcn-chip ${legalTab === d.id ? "on" : ""}`}
                      onClick={() => setLegalTab(d.id)}
                    >
                      {d.title}
                    </button>
                  ))}
                </div>
                <pre>{active.body}</pre>
              </div>
            )}
            <button className="kcn-btn gold mt-6 min-w-52" disabled={!agreed} onClick={() => void engage()}>
              AUTHORIZE ACCESS
            </button>
            <p className="kcn-tiny kcn-muted mt-3">Tap to arm audio and initialize the database.</p>
          </>
        )}
        {phase !== "gate" && (
          <div className="kcn-boot-log">
            {log.map((line) => (
              <div key={line}>{line}</div>
            ))}
            <div className="kcn-boot-bar">
              <span style={{ width: `${bar}%` }} />
            </div>
            <div className="kcn-tiny kcn-muted mt-2">{bar}% — DATABASE INIT</div>
          </div>
        )}
        <button className="kcn-boot-mute" onClick={() => setMuted((m) => !m)} type="button">
          {muted ? "AUDIO OFF" : "AUDIO ON"}
        </button>
      </div>
    </div>
  );
}
