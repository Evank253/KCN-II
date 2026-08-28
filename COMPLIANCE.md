# KCN-II Investigator Data Protection Certification (IDPC-1.0)

Operator-attested control certification with cryptographic evidence.

This is **not** a third-party ISO 27001 certificate, SOC 2 Type II report,
FedRAMP authorization, or CJIS Authorization to Operate. Those require an
independent auditor and an authorizing official. IDPC-1.0 is a live test of
controls that actually run on the operator's device.

## Scope

Investigator-sensitive case files on one operator device:

- AES-256-GCM sealed vault (PBKDF2-SHA256, 250,000 iterations, non-extractable key)
- Passphrase never stored
- Idle lock (5 minutes) wipes keys and case text from memory
- Hash-chained audit ledger inside the vault
- SHA-256 acquisition hashes for ingested working copies
- Off-device photo lookup only with explicit consent, size-capped, over HTTPS
- Photos stripped from the sealed case (no data-URL persistence)
- Legal Pack acceptance

## Control map

| ID | Framework | Control |
|---|---|---|
| PR.DS-01 | NIST CSF 2.0 / ISO 27001 A.8.24 | Encryption at rest |
| PR.AC-01 | NIST CSF 2.0 / ISO 27001 A.5.15 | Access control (passphrase-derived key) |
| PR.DS-10 | NIST CSF 2.0 / ISO 27001 A.8.10 | Deletion / no plaintext residue |
| PR.DS-02 | NIST CSF 2.0 / ISO 27001 A.8.24 | Off-device transfer consent |
| PR.DS-11 | NIST CSF 2.0 / ISO 27001 A.8.9 | Integrity (GCM tag + audit chain) |
| PR.PT-01 | NIST CSF 2.0 / ISO 27001 A.8.15 | Logging |
| PR.IP-10 | NIST CSF 2.0 / ISO 27001 A.8.16 | Idle lock / session wipe |
| ID.AM-05 | NIST CSF 2.0 / ISO 27001 A.5.12 | Classification |
| PR.AT-01 | NIST CSF 2.0 / ISO 27001 A.6.3 | Legal pack |
| DE.CM-01 | NIST CSF 2.0 / ISO 27001 A.8.16 | Tamper detection |

Run **Vault & certification → Run certification** in the console. The evidence
pack is a timestamped PASS/FAIL of those live tests plus a vault fingerprint.

## Honesty limits

- Client-side encryption cannot protect a compromised device or a stolen
  unlocked session.
- Optional lookups send a consented, metadata-stripped still to an AI provider
  over HTTPS. That provider has its own retention terms.
- Custody and acquisition hashes apply to the working copy in the notebook,
  not to a write-blocked forensic image.
- OSINT uses public search engines. It does not bypass privacy controls.

Human review is required. The investigator remains the data controller.
