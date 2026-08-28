export type LegalDoc = { id: string; title: string; body: string };

export const LEGAL_DOCS: LegalDoc[] = [
  {
    id: "user",
    title: "User Agreement",
    body: `KCN-II User Agreement — Effective 27 August 2026

This is a software terms document, not legal advice.

1. Acceptance
You accept the User Agreement, License, and Legal Agreement when you authorize access or use KCN-II. If you do not agree, do not use the console.

2. Who may use it
You must be 18 or older. You are an independent researcher. KCN-II does not grant police, court, or intelligence-agency power.

3. Your responsibilities
Use the console only for lawful, good-faith investigation. Review every extraction and lookup yourself. Do not upload material you have no right to handle. Do not use scans or searches to stalk, harass, or harm anyone. Export and archive important files yourself.

4. Case data
Case text, scans, and notes stay in your browser unless you export them. You are the data controller. Local storage is not a chain-of-custody vault.

5. Camera, microphone, and files
Media you capture is processed on your device. When you run a lookup, the photo and instruction may be sent to an AI service. You are responsible for what you submit.

6. Lookups and AI output
OCR, entity extraction, and briefings are leads for human review. They can be wrong. They are not findings, testimony, or legal conclusions.

7. Prohibited use
No crimes, no impersonating law enforcement, no illegal content, no attacking systems or people.

8. Intellectual property
The console, logo, sound, motion, and KCN marks are proprietary. You receive only the limited license in LICENSE.

9. Changes
Continued use after an update is acceptance. The Legal desk shows the current text.`,
  },
  {
    id: "legal",
    title: "Legal Agreement",
    body: `KCN-II Legal Agreement — Effective 27 August 2026

Not legal advice. Not an attorney-client relationship.

1. Nature of the product
KCN-II is an independent investigative workspace. It is not a law-enforcement system, court of record, chain-of-custody locker, or classified intelligence service.

2. Human review is required
Every name, location, date, finding, and lookup must be verified against original sources. Publishing unverified output is the operator's risk.

3. No official status
American intelligence branding is design only. It does not confer clearance or authority. KCN-II does not speak for any government, police department, coroner, or court.

4. Limitation of liability
The software is provided as-is. To the maximum extent allowed by law, KCN is not liable for lost data, lost cases, or claims arising from reliance on the console. Total liability shall not exceed USD $100 or amounts paid in the prior three months, whichever is greater.

5. Indemnity
You will hold KCN harmless from claims arising out of your case files, publications, lookups, or misuse.

6. Governing law
Laws of the State of Washington, United States, unless mandatory consumer law says otherwise.

7. Entire agreement
LICENSE, the User Agreement, and this Legal Agreement are the entire agreement for KCN-II.`,
  },
  {
    id: "license",
    title: "License",
    body: `KCN-II Proprietary License
Copyright (c) 2026 KCN / Ketchum's Intelligent Investigator
All rights reserved.

You receive a limited, personal, non-exclusive, non-transferable, revocable license to use the live console for lawful investigative research.

You may not copy, fork, sell, or redistribute the software; reverse engineer proprietary architecture; remove notices; or represent KCN-II output as a court finding or official intelligence product.

KCN, KCN-II, and Ketchum's Intelligent Investigator remain operator property.

THE SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND.`,
  },
];
