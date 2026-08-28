export type LegalDoc = {
  id: "user" | "legal" | "license";
  title: string;
  short: string;
  file: string;
  body: string;
};

export const LEGAL_VERSION = "1.2";
export const LEGAL_EFFECTIVE = "27 August 2026";
export const LEGAL_ACCEPT_KEY = "KCN-II-LEGAL";

export const LICENSE_TEXT = `KCN-II PROPRIETARY SOFTWARE LICENSE
Version 1.2 — Effective 27 August 2026
Copyright (c) 2026 KCN / Ketchum's Intelligent Investigator. All rights reserved.

This license, the User Agreement, and the Legal Agreement (together, the "Legal
Pack") govern KCN-II, including source, design, marks, motion, audio, documents,
and architecture (the "Software"). Using KCN-II means you accept all three.

1. GRANT
The KCN-II operator ("Licensor") grants you a limited, personal, non-exclusive,
non-transferable, non-sublicensable, revocable license to access and use the
live KCN-II console for lawful investigative research, case organization, and
source review. No other rights are granted.

2. YOU MAY NOT
Without Licensor's prior written permission you may not:

  a. Copy, fork, clone for distribution, sublicense, sell, rent, lease, or
     publicly redistribute the Software.
  b. Reverse engineer, decompile, extract, or disclose proprietary cognitive
     architecture, classification methods, lookup pipelines, or branding for a
     competing product.
  c. Remove or alter copyright, trademark, proprietary, or attribution notices.
  d. Use the Software to harass, dox, threaten, stalk, or commit any crime.
  e. Represent KCN-II output as a court finding, law-enforcement conclusion,
     medical-examiner finding, or official government intelligence product.
  f. Impersonate KCN, Licensor, police, a court, or any government agency.
  g. Circumvent access, rate, or safety controls.

3. OWNERSHIP
KCN, KCN-II, Ketchum's Intelligent Investigator, the seal, gold-and-navy console
design, boot sequence, and related marks remain Licensor property. This license
is not a sale. Feedback you send may be used by Licensor without obligation.

4. CONFIDENTIAL ARCHITECTURE
Non-public methods, prompts, classifiers, and system design are proprietary.
You will not publish or productize them.

5. THIRD-PARTY SERVICES
Lookups and public-source links may use independent AI and search providers.
Those services have their own terms. Licensor does not control them.

6. TERMINATION
This license ends if you breach it, if Licensor withdraws access, or if you
stop using the Software. You must then stop use and destroy copies you control.
Sections 3, 4, 7, 8, and 9 survive.

7. NO WARRANTY
THE SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTY OF ANY
KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR
PURPOSE, TITLE, QUIET ENJOYMENT, AND NON-INFRINGEMENT. LICENSOR DOES NOT
WARRANT THAT OUTPUT IS ACCURATE, COMPLETE, OR FIT FOR LEGAL, MEDICAL, OR
OPERATIONAL DECISIONS.

8. LIABILITY
Liability is limited as stated in LEGAL.md. In any conflict, LEGAL.md controls
on damages; this License controls on IP and use rights.

9. LAW
Governed by the laws of the State of Washington, United States, except where
mandatory consumer law requires otherwise. Venue: courts located in Washington.

See USER_AGREEMENT.md and LEGAL.md. The Legal Pack is the entire agreement for
the Software.
`;

export const USER_AGREEMENT_TEXT = `# KCN-II User Agreement
Version 1.2 — Effective 27 August 2026

This User Agreement ("Agreement") is a binding contract between you ("Operator")
and the KCN-II operator ("KCN") for use of Ketchum's Intelligent Investigator.

**This is a software terms document, not legal advice.** It is not an
attorney-client, investigator-client, or journalist-source relationship.

Together with the License and the Legal Agreement, this is the Legal Pack.

## 1. Acceptance

You accept this Agreement, the License, and the Legal Agreement when you check
the authorization box, tap **AUTHORIZE ACCESS**, or otherwise use KCN-II.

If you do not agree, do not use the console.

## 2. Who may use it

You must be 18 years of age or older. You use KCN-II as an independent
researcher or investigator. You are not granted police, court, military, or
intelligence-agency power, clearance, or credentials.

## 3. Independent operator

You act in your own name. KCN-II does not employ you, deputize you, or make
KCN responsible for your case work, publications, or interviews.

## 4. Your responsibilities

You agree to:

- Use the console only for lawful, good-faith investigation and research.
- Review every automatic extraction, lookup, OCR result, and search suggestion
  yourself before you rely on it or publish it.
- Not upload material you have no right to handle.
- Not use scans, lookups, or swarm searches to stalk, harass, threaten, or
  harm anyone.
- Keep credentials, case files, and source material under your control.
- Comply with applicable law in every jurisdiction you work in, including
  privacy, defamation, recording-consent, and evidence rules.
- Label KCN-II output as independent review material, not as official findings.

## 5. Case data — sealed investigator vault

Case files are classified investigator-sensitive. On this device they are stored
only as a sealed vault: AES-256-GCM ciphertext, a key derived from your
passphrase (PBKDF2-SHA256, 250,000 iterations, non-extractable), and a
hash-chained audit. The passphrase is never written to storage. There is no
recovery if the passphrase is lost.

You are the data controller of your case file. A sealed export still requires
the passphrase. Clearing browser data, wiping the vault, or losing the
passphrase destroys the working copy.

Do not treat the console as a court chain-of-custody system. Export sealed
backups you control. Human review is required.

## 6. Camera, microphone, files, and off-device lookup

Camera, microphone, and file access stay on this device unless you run a lookup
and explicitly consent to send a photo off-device. Local filing, OCR, notes,
and the case board never upload. Canvas capture strips camera metadata (EXIF)
before any optional lookup. Lookups use HTTPS and are size-capped.

You are responsible for what you capture and submit.

Do not capture or upload:

- Child sexual abuse material, or any sexual content involving a minor
- Content you are legally barred from possessing
- Private medical, juvenile, or sealed-court material except as the law allows

## 7. Lookups and AI output

Lookups, OCR, entity extraction, conversation replies, and swarm suggestions
are **leads for human review**. They can be wrong, incomplete, outdated, or
invented. They are not findings, not testimony, and not legal conclusions.

You will not present KCN-II output as:

- A court ruling or charging decision
- A police or coroner determination
- Proof that a named person committed a crime

## 8. Public-source searches

Web swarm links open public search engines. KCN does not control those sites.
You are responsible for how you use third-party results, paywalls, and terms.

## 9. Prohibited use

You will not use KCN-II to:

- Commit, plan, or conceal a crime
- Impersonate law enforcement, a court, or a government agency
- Bypass paywalls, private accounts, or security controls
- Upload illegal content
- Attack systems, people, or infrastructure
- Build a competing product from KCN-II's proprietary architecture

## 10. Your content

You retain rights in case files you lawfully own. You grant KCN a limited
right to process that content only to operate the console features you invoke
(scan, lookup, extract, file). KCN does not claim your investigation.

## 11. Intellectual property

The console, logo, sound, motion, and KCN marks are proprietary. You receive
only the limited license in LICENSE.

## 12. Suspension

KCN may suspend access if this Agreement is breached or if use is unlawful.

## 13. Changes

KCN may update this Agreement. Continued use after an update is acceptance.
The in-console License & Legal desk shows the current text.

## 14. Contact

Questions about this Agreement: the KCN-II operator who published this console.

See LICENSE and LEGAL.md.
`;

export const LEGAL_AGREEMENT_TEXT = `# KCN-II Legal Agreement
Version 1.2 — Effective 27 August 2026

This Legal Agreement sits with the License and User Agreement. Together they
are the Legal Pack that governs KCN-II.

**Not legal advice. Not an attorney-client relationship. Not a substitute for
a licensed investigator, attorney, journalist, or medical examiner.**

## 1. Nature of the product

KCN-II is an independent investigative workspace. It helps an operator
organize sources, scan paper, look up photos, and take notes.

It is **not**:

- A law-enforcement system
- A court of record
- A chain-of-custody evidence locker
- A classified intelligence service
- An official government product
- A substitute for licensed professional services

## 2. Human review is required

Every extraction, name, location, date, finding, lookup briefing, and search
suggestion must be verified by a human operator against original sources.

Automatic output may invent, miss, or misread information. Publishing or acting
on unverified output is the operator's risk.

## 3. No official status

KCN-II does not speak for any government, police department, coroner, or
court. Branding that uses an American intelligence aesthetic is design only.
It does not confer clearance, authority, or access.

## 4. Investigations and publication

If you use KCN-II on a real case, including public independent review work:

- You remain solely responsible for accuracy, fairness, and legality.
- You must not present KCN-II output as proof.
- You must handle private, medical, and juvenile information lawfully.
- Defamation, privacy, recording-consent, and evidence rules still apply to
  anything you publish.
- You must not use the console to harass, dox, or endanger anyone.

## 5. Evidence handling and data protection

KCN-II is a working notebook. The sealed vault uses AES-256-GCM and a
hash-chained audit; that is integrity protection for the working copy, not a
court-admissible custody log. If a matter may go to court, preserve originals
with qualified counsel or a licensed examiner.

Off-device lookup is opt-in per capture. Photos are not stored in the vault.

The in-console Investigator Data Protection Certification (IDPC-1.0) is a live
control test with cryptographic evidence, mapped to NIST CSF 2.0 and
ISO 27001:2022 control language. It is operator-attested. It is **not** a
third-party ISO 27001 certificate, SOC 2 report, FedRAMP authorization, or
CJIS Authorization to Operate. See COMPLIANCE.md.

## 6. Limitation of liability

TO THE MAXIMUM EXTENT ALLOWED BY LAW, KCN AND ITS OPERATORS ARE NOT LIABLE
FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR
LOST DATA, LOST CASES, LOST PROFITS, REPUTATIONAL HARM, OR CLAIMS ARISING FROM
RELIANCE ON THE CONSOLE.

TOTAL LIABILITY FOR ANY CLAIM SHALL NOT EXCEED ONE HUNDRED U.S. DOLLARS (USD
$100) OR THE AMOUNT YOU PAID TO USE KCN-II IN THE PRIOR THREE MONTHS,
WHICHEVER IS GREATER.

Some places do not allow these limits. In those places, liability is limited
to the greatest extent the law allows.

## 7. Indemnity

You will defend and hold KCN harmless from claims arising out of your case
files, publications, lookups, interviews, or misuse of the console, except to
the extent caused by KCN's willful misconduct.

## 8. Governing law

Unless mandatory consumer law says otherwise, this Agreement is governed by
the laws of the State of Washington, United States, without regard to conflict
of law rules. Venue lies in courts located in Washington.

## 9. Severability

If a court strikes one clause, the rest remains in force.

## 10. Survival

Sections on ownership, confidential architecture, no warranty, limitation of
liability, indemnity, and governing law survive the end of access.

## 11. Entire agreement

LICENSE, USER_AGREEMENT.md, and this Legal Agreement are the entire agreement
for KCN-II. They replace prior oral or written terms about the console.
`;

export const LEGAL_DOCS: LegalDoc[] = [
  {
    id: "user",
    title: "User Agreement",
    short: "Who may use the console, case-data rules, and operator duties.",
    file: "USER_AGREEMENT.md",
    body: USER_AGREEMENT_TEXT,
  },
  {
    id: "legal",
    title: "Legal Agreement",
    short: "Disclaimers, human-review duty, liability, and governing law.",
    file: "LEGAL.md",
    body: LEGAL_AGREEMENT_TEXT,
  },
  {
    id: "license",
    title: "License",
    short: "Proprietary grant. Not MIT. No redistribution or reverse engineering.",
    file: "LICENSE",
    body: LICENSE_TEXT,
  },
];

export type LegalAcceptance = {
  version: string;
  at: string;
  docs: string[];
};

export function recordLegalAcceptance(): LegalAcceptance {
  const rec: LegalAcceptance = {
    version: LEGAL_VERSION,
    at: new Date().toISOString(),
    docs: LEGAL_DOCS.map((d) => d.file),
  };
  try {
    localStorage.setItem(LEGAL_ACCEPT_KEY, JSON.stringify(rec));
  } catch {
    /* private mode */
  }
  return rec;
}

export function readLegalAcceptance(): LegalAcceptance | null {
  try {
    const raw = localStorage.getItem(LEGAL_ACCEPT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LegalAcceptance;
    if (!parsed?.version || !parsed?.at) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function legalPackText(): string {
  return [
    "KCN-II LEGAL PACK",
    `Version ${LEGAL_VERSION} — Effective ${LEGAL_EFFECTIVE}`,
    "Copyright (c) 2026 KCN / Ketchum's Intelligent Investigator. All rights reserved.",
    "",
    "This pack contains the License, User Agreement, and Legal Agreement.",
    "Using KCN-II means you accept all three.",
    "",
    "========== LICENSE ==========",
    "",
    LICENSE_TEXT.trimEnd(),
    "",
    "========== USER AGREEMENT ==========",
    "",
    USER_AGREEMENT_TEXT.trimEnd(),
    "",
    "========== LEGAL AGREEMENT ==========",
    "",
    LEGAL_AGREEMENT_TEXT.trimEnd(),
    "",
  ].join("\n");
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
