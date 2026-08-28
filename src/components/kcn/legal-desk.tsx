import { useMemo, useState } from "react";
import {
  LEGAL_DOCS,
  LEGAL_EFFECTIVE,
  LEGAL_VERSION,
  downloadText,
  legalPackText,
  readLegalAcceptance,
  type LegalDoc,
} from "@/lib/kcn/legal-copy";

export function LegalDesk() {
  const [tab, setTab] = useState<LegalDoc["id"]>(LEGAL_DOCS[0].id);
  const [copied, setCopied] = useState("");
  const active = LEGAL_DOCS.find((d) => d.id === tab) ?? LEGAL_DOCS[0];
  const accepted = useMemo(() => readLegalAcceptance(), [copied]);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("Copy blocked");
      setTimeout(() => setCopied(""), 1800);
    }
  }

  return (
    <section>
      <div className="kcn-legal-head">
        <div>
          <div className="kcn-legal-stamp">LEGAL PACK • CLASSIFICATION: OPERATOR TERMS</div>
          <h2 className="kcn-title">License, Legal Agreement, and User Agreement</h2>
          <p className="kcn-muted">
            These three documents govern KCN-II. They are software agreements, not legal advice.
            Human review is required. Proprietary — not an open-source license.
          </p>
        </div>
        <div className="kcn-legal-meta">
          <div>VERSION {LEGAL_VERSION}</div>
          <div>EFFECTIVE {LEGAL_EFFECTIVE}</div>
          <div>
            {accepted
              ? `ACCEPTED ${new Date(accepted.at).toLocaleString()}`
              : "ACCEPTANCE RECORDED AT AUTHORIZE ACCESS"}
          </div>
        </div>
      </div>

      <div className="kcn-legal-grid">
        {LEGAL_DOCS.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`kcn-legal-card ${tab === d.id ? "on" : ""}`}
            onClick={() => setTab(d.id)}
          >
            <b>{d.title}</b>
            <span>{d.file}</span>
            <p>{d.short}</p>
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <button className="kcn-btn" type="button" onClick={() => void copy(active.body, active.file)}>
          Copy this document
        </button>
        <button className="kcn-btn" type="button" onClick={() => downloadText(active.file, active.body)}>
          Download {active.file}
        </button>
        <button
          className="kcn-btn gold"
          type="button"
          onClick={() => downloadText("KCN-II-LEGAL-PACK.txt", legalPackText())}
        >
          Download full legal pack
        </button>
        {copied ? <span className="kcn-pill live">{copied} copied</span> : null}
      </div>

      <pre className="kcn-legal-body">{active.body}</pre>
      <p className="kcn-tiny kcn-muted mt-3">
        Checking the boot box and tapping AUTHORIZE ACCESS means you accept all three documents.
        Washington law governs, except where mandatory consumer law says otherwise.
      </p>
    </section>
  );
}
