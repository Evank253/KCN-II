# KCN-II — Ketchum's Intelligent Investigator

American intelligence operations console for case files, paper scans, photo lookup, and source-aware review.

**License:** proprietary. Not MIT, Apache, or GPL.

**Source:** [github.com/Evank253/KCN-II](https://github.com/Evank253/KCN-II)

## Legal Pack (required)

Using the console, checking the authorization box, or tapping **AUTHORIZE ACCESS** means you accept all three:

| Document | File | What it is |
|---|---|---|
| **License** | [LICENSE](LICENSE) | Proprietary grant. No copy, fork, sale, or reverse engineering. |
| **User Agreement** | [USER_AGREEMENT.md](USER_AGREEMENT.md) | Who may use it, sealed-vault rules, camera/AI duties. |
| **Legal Agreement** | [LEGAL.md](LEGAL.md) | Disclaimers, human-review duty, liability, Washington law. |

See also [NOTICE](NOTICE) and [COMPLIANCE.md](COMPLIANCE.md). The in-console **License & Legal** desk shows the same text.

KCN-II is not law enforcement, not a court, and not a classified system. Output is for independent review only. Human review is required on every automatic lead.

## What it is

- Boot with operator authorization (18+ and Legal Pack). Tap authorize to arm audio.
- Sealed investigator vault: AES-256-GCM, passphrase, idle lock, IDPC-1.0 live certification
- Optional Quick Investigator bar (ask / upload / scan) — hide it if you do not want it
- Camera scanner with on-device OCR; lookup only if you consent to send the photo
- Case board: people, organizations, locations, findings, evidence, timeline, relationships
- Entity resolution, contradiction flags, human verification flow
- Acquisition hashes, chain of custody, activity log, standardized report
- Interview recorder with optional speech-to-text
- OSINT swarm (public sources) and AI assistant over the case digest

IDPC-1.0 live controls are run in-console under **Vault & certification**. They are operator-attested device tests, not a third-party ISO/SOC/CJIS ATO.

## Run

```bash
npm install
npm run dev
```
