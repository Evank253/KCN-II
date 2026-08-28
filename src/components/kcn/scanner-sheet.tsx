import { useEffect, useRef, useState } from "react";
import { inspectCapture } from "@/lib/kcn/inspect";
import { classifyText, compressImage, enhanceDoc } from "@/lib/kcn/classify";
import { nowStamp, useKcn } from "@/lib/kcn/store";

const INTENTS = [
  "Look this up",
  "What is this?",
  "Identify names and places",
  "File this as a document",
  "Search public sources",
];

type Props = {
  open: boolean;
  onClose: () => void;
  toast: (m: string) => void;
};

export function ScannerSheet({ open, onClose, toast }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [shot, setShot] = useState(false);
  const [ocr, setOcr] = useState("");
  const [instruction, setInstruction] = useState("Look this up");
  const [status, setStatus] = useState("Camera idle. Capture or upload a photo, then say what you want done.");
  const [briefing, setBriefing] = useState("");
  const [searches, setSearches] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState("");
  const fileExtraction = useKcn((s) => s.fileExtraction);
  const addScan = useKcn((s) => s.addScan);
  const addLookup = useKcn((s) => s.addLookup);
  const addNote = useKcn((s) => s.addNote);
  const addChat = useKcn((s) => s.addChat);

  useEffect(() => {
    if (open) void startCam();
    return () => stopCam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function stopCam() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setLive(false);
  }

  async function startCam() {
    stopCam();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setLive(true);
      setShot(false);
      setStatus("Camera is live. Fill the frame, capture, then say what you want KCN-II to do.");
    } catch {
      setStatus("Camera is blocked. Tap Use photo to pick an image from your phone.");
      toast("Camera unavailable — pick a photo instead.");
    }
  }

  async function ocrFromCanvas(canvas: HTMLCanvasElement) {
    setStatus("Reading the page…");
    try {
      const Tesseract = await import("tesseract.js");
      const result = await Tesseract.recognize(canvas, "eng");
      const text = (result.data.text || "").trim();
      setOcr(text);
      setStatus(
        text
          ? "Text extracted. Tell KCN-II what to do, then tap Run."
          : "Little text found. You can still look the photo up — say what you want.",
      );
    } catch {
      setStatus("Could not read text. You can still look the photo up.");
    }
  }

  function grab() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || !v.videoWidth) {
      toast("Camera is not ready.");
      return;
    }
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    const dataUrl = compressImage(c);
    setImageDataUrl(dataUrl);
    enhanceDoc(ctx, c.width, c.height);
    setShot(true);
    void ocrFromCanvas(c);
  }

  async function onPick(file: File) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej();
      img.src = url;
    });
    const c = canvasRef.current;
    if (!c) return;
    const scale = Math.min(1, 1600 / img.width);
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    setImageDataUrl(compressImage(img));
    enhanceDoc(ctx, c.width, c.height);
    setShot(true);
    setLive(false);
    URL.revokeObjectURL(url);
    void ocrFromCanvas(c);
  }

  async function run() {
    const ask = instruction.trim() || "Look this up";
    if (!imageDataUrl && !ocr) {
      toast("Capture or upload a photo first.");
      return;
    }
    setBusy(true);
    setStatus("Running your instruction…");
    try {
      const result = await inspectCapture({
        data: { instruction: ask, ocrText: ocr, imageDataUrl },
      });
      const brief = result.briefing || result.error || "No briefing returned.";
      setBriefing(brief);
      setSearches(result.searches || []);
      addLookup({
        id: Math.random().toString(36).slice(2, 9),
        at: nowStamp(),
        instruction: ask,
        briefing: brief,
        searches: result.searches || [],
      });
      addChat(ask, brief);
      if (ocr) {
        const packed = fileExtraction(ocr, "Capture " + nowStamp());
        addScan({
          title: "Capture " + nowStamp(),
          at: nowStamp(),
          names: packed.names.length,
          locations: packed.locations.length,
          findings: packed.findings.length,
          instruction: ask,
        });
      }
      addNote("Lookup: " + ask);
      setStatus("Done. Review the briefing, then open any search you want.");
      toast("Instruction complete.");
    } catch {
      setStatus("Lookup failed. You can still search from the extracted text.");
      toast("Lookup failed.");
    } finally {
      setBusy(false);
    }
  }

  function fileOnly() {
    if (!ocr.trim()) {
      toast("No text to file.");
      return;
    }
    const packed = fileExtraction(ocr, "Scanned page " + nowStamp());
    addScan({
      title: "Scanned page " + nowStamp(),
      at: nowStamp(),
      names: packed.names.length,
      locations: packed.locations.length,
      findings: packed.findings.length,
      instruction: "File this as a document",
    });
    toast("Page filed under names, locations, findings, and evidence.");
  }

  if (!open) return null;
  const packed = classifyText(ocr);

  return (
    <div className="kcn-sheet">
      <div className="kcn-sheet-card">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="kcn-title mb-0">Scan and look up</h2>
          <button className="kcn-btn" onClick={() => { stopCam(); onClose(); }}>
            Close
          </button>
        </div>
        <p className="kcn-muted kcn-tiny mb-3">
          Take a picture or upload one, then tell KCN-II what to do — look it up, file it, identify names, or search public sources.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <video
              ref={videoRef}
              className={`kcn-preview ${shot ? "hidden" : ""}`}
              autoPlay
              playsInline
              muted
            />
            <canvas ref={canvasRef} className={`kcn-preview ${shot ? "" : "hidden"}`} />
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="kcn-btn cyan" onClick={() => void startCam()}>
                Start camera
              </button>
              <button className="kcn-btn gold" onClick={grab} disabled={!live}>
                Capture
              </button>
              <button className="kcn-btn" onClick={() => fileRef.current?.click()}>
                Use photo
              </button>
              <button className="kcn-btn" onClick={stopCam}>
                Stop camera
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPick(f);
                e.target.value = "";
              }}
            />
          </div>
          <div className="kcn-card">
            <div className="mb-2 text-sm tracking-[0.14em] text-gold-2">WHAT SHOULD KCN-II DO?</div>
            <div className="mb-2">
              {INTENTS.map((label) => (
                <button
                  key={label}
                  className={`kcn-chip ${instruction === label ? "on" : ""}`}
                  onClick={() => setInstruction(label)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Example: Look this person up. Search this address. What does this document say?"
            />
            <p className="kcn-tiny kcn-muted mt-2">{status}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="kcn-btn gold" disabled={busy} onClick={() => void run()}>
                {busy ? "Working…" : "Run"}
              </button>
              <button className="kcn-btn" onClick={fileOnly}>
                File text only
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <div className="kcn-tiny kcn-muted mb-1">Extracted text (you can edit)</div>
            <textarea value={ocr} onChange={(e) => setOcr(e.target.value)} />
            <div className="mt-2 text-cyan">
              {packed.names.slice(0, 6).map((n) => (
                <span key={n} className="kcn-chip">{n}</span>
              ))}
              {packed.locations.slice(0, 4).map((n) => (
                <span key={n} className="kcn-chip">{n}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="kcn-tiny kcn-muted mb-1">Lookup briefing</div>
            <pre className="kcn-card max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed">
              {briefing || "Run an instruction to see the briefing here."}
            </pre>
            {searches.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {searches.map((q) => (
                  <a
                    key={q}
                    className="kcn-btn"
                    href={`https://duckduckgo.com/?q=${encodeURIComponent(q)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Search: {q.slice(0, 42)}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
