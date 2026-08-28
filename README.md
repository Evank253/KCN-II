# KCN-II — Ketchum's Intelligent Investigator

Sealed case-intelligence console. Independent review workspace for sources, scans, photo lookup, people, evidence, and reports.

**Classification:** INVESTIGATOR SENSITIVE  
**License:** Proprietary. Not MIT, Apache, or GPL.  
**Legal Pack:** [LICENSE](LICENSE) · [USER_AGREEMENT.md](USER_AGREEMENT.md) · [LEGAL.md](LEGAL.md)  
**Certification:** [COMPLIANCE.md](COMPLIANCE.md) (IDPC-1.0 — operator-attested device tests, not ISO / SOC / FedRAMP / CJIS)

KCN-II is **not** law enforcement, **not** a court, and **not** a classified government system. The American intelligence look is design only. Human review is required on every automatic lead.

---

## Operator start

1. Confirm you are 18+ and accept the Legal Pack.
2. Tap **AUTHORIZE ACCESS**. Audio arms from that tap.
3. Create or unlock the **sealed vault** (12+ character passphrase). There is no recovery if it is lost.
4. Work the desks. **Quick Investigator** stays hidden until you want it.
5. Optional: **Vault & certification → Run certification** for a live IDPC-1.0 control test on this device.

Idle lock is five minutes. **Lock** wipes keys and case text from memory. **Export sealed** downloads ciphertext only — still needs the passphrase.

---

## Console map

### Collect
| Desk | What it does |
|---|---|
| Scan and look up | Camera or photo. OCR stays on this device. Lookup sends the still only if you check consent. |
| Reader | File ingest and extracted text. |
| Interview | On-device audio. Speech-to-text files a transcript when the browser supports it. |
| Video | Public video link as evidence. |
| OSINT swarm | Public search engines in new tabs. No paywall bypass. |

### Case
People, organizations, locations, notes, and named cases on the working board.

### Analyze
Assistant over the case digest, investigation swarm, entity resolution, relationship map, timeline, contradiction flags.

### Preserve
Evidence, acquisition hashes (SHA-256 of the working copy), chain of custody (hash-chained notebook log), findings, human verification (generated → unreviewed → corroborated → verified / disputed / rejected).

### Output
Standardized investigative report, case intelligence, activity log.

### System
Vault & certification, License & legal.

Photos are stripped from the vault. Case files never leave this device unless you run a consented lookup.

---

## Vault

- AES-256-GCM at rest
- PBKDF2-SHA256, 250,000 iterations, non-extractable key
- Passphrase never stored
- Hash-chained audit inside the sealed blob
- Sealed export / sealed import only — plaintext case files are rejected

IDPC-1.0 is a live test of those controls on the operator's device. It is **not** a purchased certificate and does not replace a licensed auditor or an ATO.

---

## Honesty limits

- OCR, lookups, entity matches, and swarm briefs are **leads**. They can be wrong.
- Custody and acquisition hashes describe the **working copy**, not a write-blocked forensic image.
- Optional photo lookup uses HTTPS to an AI provider. That provider has its own terms.
- A compromised or unlocked device is outside the vault's protection.

You remain the data controller of your case file.

---

## Legal Pack (required)

Using the console, checking the authorization box, or tapping **AUTHORIZE ACCESS** means you accept all three:

| Document | File |
|---|---|
| Proprietary License | [LICENSE](LICENSE) |
| User Agreement | [USER_AGREEMENT.md](USER_AGREEMENT.md) |
| Legal Agreement | [LEGAL.md](LEGAL.md) |

The in-console **License & Legal** desk shows the same text. See [NOTICE](NOTICE).

Copyright (c) 2026 KCN / Ketchum's Intelligent Investigator. All rights reserved.
