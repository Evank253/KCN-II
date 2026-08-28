# KCN-II — Ketchum's Intelligent Investigator

Sealed case-intelligence console. Independent review workspace for sources, scans, photo lookup, people, evidence, and reports.

**Classification:** INVESTIGATOR SENSITIVE  
**License:** Proprietary. Not MIT, Apache, or GPL.  
**Legal Pack:** [LICENSE](LICENSE) · [USER_AGREEMENT.md](USER_AGREEMENT.md) · [LEGAL.md](LEGAL.md)  
**Certification:** [COMPLIANCE.md](COMPLIANCE.md) (IDPC-1.0 — operator-attested device tests, not ISO / SOC / FedRAMP / CJIS)

**Source:** [github.com/Evank253/KCN-II](https://github.com/Evank253/KCN-II)  
**Live console:** tap **Publish** in this Grok chat and choose **anyone with the link**. That address is what you share. Recipients sign in with **email** — they do not need a Grok account. The same address is the installable web app (Add to Home Screen).

KCN-II is **not** law enforcement, **not** a court, and **not** a classified government system. The American intelligence look is design only. Human review is required on every automatic lead.

---

## Operator start

1. Confirm you are 18+ and accept the Legal Pack.
2. Tap **AUTHORIZE ACCESS**. Audio arms from that tap.
3. **Sign in with email.** No Grok, Google, or X login. Create an account if you are new. Each email is its own sealed case.
4. Create or unlock **your sealed vault** (12+ character passphrase, separate from the sign-in password). There is no recovery if the vault passphrase is lost.
5. Work the desks. **Ask** does what you typed — `search Jane Doe` runs the swarm; `add person …` files the name.
6. **Switch account** / **Sign out** locks this case. A different email cannot open it.
7. Optional: **Vault → Run certification** for a live IDPC-1.0 control test on this device.

Idle lock is five minutes. **Lock** wipes keys and case text from memory but keeps you signed in. **Export** downloads ciphertext only — still needs the vault passphrase. **Wipe this investigator** removes only this account's vault.

---

## Console map

### Collect
| Desk | What it does |
|---|---|
| Scan | Camera or photo. On-device OCR. Lookup only if you check consent. |
| Files | Documents and pasted text. Names, places, and findings are extracted onto the board. |
| Interview | Record on this device. Speech-to-text files a transcript when the browser supports it. |
| Video | File a public video link as evidence. |
| Web search | AI controller tasks swarm agents. Live feed of engines, URLs, and hits. DuckDuckGo, Wikipedia, Wikidata, maps, news, live web + X. |

### Case
| Desk | What it does |
|---|---|
| Cases | Named working files inside the vault. |
| People | Names and roles. |
| Organizations | Groups and companies. |
| Places | Locations and addresses. |
| Notes | Quick facts and follow-ups. |

### Analyze
| Desk | What it does |
|---|---|
| Ask | Controller: `search Jane Doe` runs the swarm; `add person …` files a name; questions stay on the case. |
| Case brief | Local nine-pass review of the board. |
| Match names | Alias / same-person candidates. |
| Links | Who is connected to whom. |
| Timeline | Dated events from ingest and notes. |
| Conflicts | Contradictions flagged for human review. |

### Preserve
| Desk | What it does |
|---|---|
| Evidence | Working copies with type and custodian. |
| Hashes | SHA-256 of the working copy (not a forensic image). |
| Custody | Hash-chained notebook log. |
| Findings | Leads with verification status. |
| Review | generated → unreviewed → corroborated → verified / disputed / rejected. |

### Output
| Desk | What it does |
|---|---|
| Report | Standardized investigative report. Human review required. |
| Overview | Counts across the board. |
| Activity | What this investigator did, in order. |

### System
| Desk | What it does |
|---|---|
| Vault | Lock, sealed export, wipe this account, IDPC-1.0 live control test. |
| Legal | License, User Agreement, Legal Agreement. |

Also: idle lock (5 minutes), Switch account / Sign out, Ask bar (optional), cinematic boot, AES-256-GCM sealed vault per email.

Photos are stripped from the vault. Case ciphertext is stored only for that signed-in account. Lookups leave the device only if you consent.

---

## Vault

- Email sign-in so each investigator has their own account. No Grok account required to use a shared link.
- AES-256-GCM at rest, including the private ciphertext stored for that account
- PBKDF2-SHA256, 250,000 iterations, non-extractable key
- Sign-in password and vault passphrase are separate. The server never receives the vault passphrase
- Passphrase never stored
- Hash-chained audit inside the sealed blob
- Sealed export / sealed import only — plaintext case files are rejected
- A persist in flight cannot write into another account's vault

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
