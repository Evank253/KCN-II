import { useEffect, useRef, useState } from "react";
import { createIntelAudio, type IntelAudio } from "@/lib/kcn/boot-audio";
import { LEGAL_DOCS, recordLegalAcceptance } from "@/lib/kcn/legal-copy";
import { Seal } from "./seal";

const LINES = [
  { at: 280, text: "VERIFYING OPERATOR CLEARANCE…", sound: "ping" as const },
  { at: 1100, text: "INITIALIZING DATABASE CORE…", sound: "tick" as const },
  { at: 1900, text: "SEALING INVESTIGATOR VAULT — AES-256-GCM…", sound: "tick" as const },
  { at: 2800, text: "INDEXING PEOPLE · LOCATIONS · FINDINGS…", sound: "sweep" as const },
  { at: 3800, text: "CALIBRATING EVIDENCE PIPELINE…", sound: "tick" as const },
  { at: 4700, text: "LINKING INTELLIGENCE MODULES…", sound: "ping" as const },
  { at: 5600, text: "KCN-II ONLINE — HUMAN REVIEW REQUIRED.", sound: "confirm" as const },
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
  const [needAgree, setNeedAgree] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [legalTab, setLegalTab] = useState(LEGAL_DOCS[0].id);

  function armAudio() {
    if (!audio.current) audio.current = createIntelAudio();
    audio.current.setMuted(muted);
    void audio.current.unlock();
    return audio.current;
  }

  useEffect(() => {
    return () => audio.current?.stop();
  }, []);

  useEffect(() => {
    audio.current?.setMuted(muted);
  }, [muted]);

  function engage() {
    if (!agreed) {
      setNeedAgree(true);
      return;
    }
    const a = armAudio();
    recordLegalAcceptance();
    a.drone(true);
    a.ping();
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
      }, 6400),
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
    <div
      className={`kcn-boot ${phase === "out" ? "kcn-boot-out" : ""}`}
      role="dialog"
      aria-label="KCN-II system boot"
      onPointerDown={() => armAudio()}
    >
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
            <label className={`kcn-agree ${needAgree && !agreed ? "kcn-agree-need" : ""}`}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => {
                  setAgreed(e.target.checked);
                  if (e.target.checked) {
                    setNeedAgree(false);
                    armAudio().tick();
                  }
                }}
              />
              <span>I am 18+ and I agree to the User Agreement, Legal Agreement, and License.</span>
            </label>
            {needAgree && !agreed ? (
              <p className="kcn-tiny mt-2 text-gold-2">Check the box first, then authorize.</p>
            ) : null}
            <button className="kcn-btn gold mt-5 min-w-52" type="button" onClick={engage}>
              AUTHORIZE ACCESS
            </button>
            <p className="kcn-tiny kcn-muted mt-3">Tap authorize to arm audio and initialize the database.</p>
            <button className="kcn-tiny mt-3 text-cyan underline" type="button" onClick={() => setShowLegal((v) => !v)}>
              {showLegal ? "Hide agreements" : "Read License, User Agreement, and Legal Agreement"}
            </button>
            {showLegal && (
              <div className="kcn-boot-legal">
                <p className="kcn-tiny kcn-muted mb-2">Legal Pack — same text as the in-console License & Legal desk.</p>
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
        <button
          className="kcn-boot-mute"
          onClick={(e) => {
            e.stopPropagation();
            const next = !muted;
            setMuted(next);
            const a = armAudio();
            a.setMuted(next);
            if (!next) a.tick();
          }}
          type="button"
        >
          {muted ? "AUDIO OFF" : "AUDIO ON"}
        </button>
      </div>
    </div>
  );
}
