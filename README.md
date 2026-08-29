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

1. First visit: tap **ENTER KCN-II**. That records the Legal Pack. Returning operators skip this screen.
2. The workspace opens. **Sign in is optional.** Search, scan, files, and desks work without an account.
3. Optional: **Sign in with email** if you want this case on its own login (no Grok / Google / X).
4. Work the desks. **Ask** does what you typed — `search Jane Doe` runs the swarm; `add person …` files the name.
5. **Lock** hides the board. Tap **Reopen** to keep working. Older passphrase-only vaults still ask for that passphrase.
6. Optional: **Vault → Run certification** for a live IDPC-1.0 control test on this device.

New workspaces seal themselves on this device. You are not asked for a second vault password unless you choose one, or you already had a passphrase vault.

**Lock** wipes keys from memory. **Export** downloads ciphertext only. **Wipe this investigator** removes only this account's vault.

---

## Console map

### Collect
| Desk | What it does |
|---|---|
| Scan | Camera or photo. On-device OCR. Lookup runs unless you uncheck photo transfer. |
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

Also: optional email sign-in, Ask bar (optional), boot screen, AES-256-GCM sealed vault per investigator (guest or email).

Photos are stripped from the vault. Case ciphertext for a signed-in email stays with that account. Lookups leave the device unless you uncheck photo transfer.

---

## Vault

- Email sign-in is optional so each investigator can have their own account. No Grok account required to use a shared link.
- AES-256-GCM at rest, including private ciphertext stored for a signed-in account
- PBKDF2-SHA256, 250,000 iterations, non-extractable key
- New workspaces auto-seal on this device. A vault passphrase is optional extra lock, not required to start
- Sign-in password (if you use email) is separate from any vault passphrase. The server never receives the vault passphrase
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

Using the console or tapping **ENTER KCN-II** means you accept all three:

| Document | File |
|---|---|
| Proprietary License | [LICENSE](LICENSE) |
| User Agreement | [USER_AGREEMENT.md](USER_AGREEMENT.md) |
| Legal Agreement | [LEGAL.md](LEGAL.md) |

The in-console **License & Legal** desk shows the same text. See [NOTICE](NOTICE).

Copyright (c) 2026 KCN / Ketchum's Intelligent Investigator. All rights reserved.
