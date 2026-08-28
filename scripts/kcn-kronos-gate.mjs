#!/usr/bin/env node
/**
 * KCN-II Kronos gate — local equivalent of:
 *   Kronos-Vibe-Coder scan_pipeline (analyze / debug / test / deploy / security / review / report)
 *   kcn-vibe-developer packaging check
 *   kcn-preflight PASS/BLOCK (secrets, review, verdict)
 *
 * Does not clone a remote FastAPI service. Runs the same quality gates against this tree.
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT = process.cwd();
const SKIP = new Set(["node_modules", ".git", ".grok", "dist", ".output", ".nitro", ".tanstack", "artifacts", "screenshots"]);
const CODE_EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".json", ".md", ".sh"]);
const PRODUCT_ROOTS = ["src/lib/kcn", "src/components/kcn"];

const SECRET_RES = [
  { name: "pem-key", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "aws-key", re: /AKIA[0-9A-Z]{16}/ },
  { name: "jwt", re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9._-]{20,}\.[A-Za-z0-9._-]{10,}/ },
  { name: "xai-hardcoded", re: /xai-[A-Za-z0-9]{20,}/ },
  { name: "sk-live", re: /sk-(?:live|test)-[A-Za-z0-9]{16,}/ },
  { name: "gh-pat", re: /ghp_[A-Za-z0-9]{20,}/ },
];

const NEGATIVE = [
  { name: "eval", re: /\beval\s*\(/, sev: "HIGH" },
  { name: "new-function", re: /\bnew Function\s*\(/, sev: "HIGH" },
  { name: "innerHTML", re: /\.innerHTML\s*=/, sev: "HIGH" },
  { name: "dangerouslySetInnerHTML", re: /dangerouslySetInnerHTML/, sev: "HIGH" },
  { name: "document.write", re: /document\.write\s*\(/, sev: "HIGH" },
  { name: "ts-ignore", re: /@ts-ignore|@ts-nocheck/, sev: "MEDIUM" },
  { name: "todo-ship", re: /\b(TODO|FIXME|HACK|XXX)\b/, sev: "LOW" },
];

const issues = [];
const stages = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith(".git")) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function rel(p) {
  return relative(ROOT, p).replaceAll("\\", "/");
}

function run(cmd) {
  try {
    const stdout = execSync(cmd, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, stdout, stderr: "" };
  } catch (e) {
    return {
      ok: false,
      stdout: String(e.stdout || ""),
      stderr: String(e.stderr || e.message || ""),
    };
  }
}

function addIssue(sev, cat, tool, message, path, line) {
  issues.push({ severity: sev, category: cat, tool, message, path: path || null, line: line || null });
}

// --- 1 ANALYZE ---
const files = walk(ROOT);
const productFiles = files.filter((p) => PRODUCT_ROOTS.some((r) => rel(p).startsWith(r)));
const lang = {};
for (const p of files) {
  const ext = extname(p) || "none";
  lang[ext] = (lang[ext] || 0) + 1;
}
stages.push({
  name: "analyze",
  ok: productFiles.length >= 12,
  detail: `${files.length} files · ${productFiles.length} product files · kcn modules present`,
});
if (productFiles.length < 12) addIssue("HIGH", "ANALYZE", "kronos", "Product surface is incomplete", "src/lib/kcn");

const required = [
  "src/lib/kcn/crypto.ts",
  "src/lib/kcn/vault.ts",
  "src/lib/kcn/compliance.ts",
  "src/lib/kcn/lookup-gate.ts",
  "src/components/kcn/console.tsx",
  "src/components/kcn/boot-sequence.tsx",
  "src/components/kcn/vault-gate.tsx",
  "LICENSE",
  "USER_AGREEMENT.md",
  "LEGAL.md",
  "COMPLIANCE.md",
];
for (const f of required) {
  if (!existsSync(join(ROOT, f))) {
    addIssue("CRITICAL", "ANALYZE", "kronos", `Missing required file ${f}`, f);
    stages[0].ok = false;
  }
}

// --- 2 SECURITY ---
let secretHits = 0;
let negHits = 0;
for (const p of files) {
  if (!CODE_EXT.has(extname(p)) && !p.endsWith(".env")) continue;
  const rpath = rel(p);
  if (rpath.startsWith("scripts/") && rpath.endsWith(".test.mjs")) continue;
  if (rpath === "scripts/kcn-kronos-gate.mjs") continue;
  let text = "";
  try {
    text = readFileSync(p, "utf8");
  } catch {
    continue;
  }
  const lines = text.split("\n");
  for (const rule of SECRET_RES) {
    lines.forEach((line, i) => {
      if (rule.re.test(line) && !line.includes("process.env.")) {
        secretHits++;
        addIssue("CRITICAL", "SECURITY", "preflight", `Possible secret (${rule.name})`, rpath, i + 1);
      }
    });
  }
  if (rpath.startsWith("src/lib/kcn") || rpath.startsWith("src/components/kcn")) {
    for (const rule of NEGATIVE) {
      lines.forEach((line, i) => {
        if (rule.re.test(line)) {
          negHits++;
          addIssue(rule.sev, "NEGATIVE", "vibe-coder", `${rule.name}: ${line.trim().slice(0, 120)}`, rpath, i + 1);
        }
      });
    }
  }
  if (rpath.startsWith("src/") && /\b(api[_-]?key|secret|token)\s*=\s*['"][^'"]+['"]/i.test(text) && !rpath.includes("legal-copy")) {
    addIssue("HIGH", "SECURITY", "preflight", "Hardcoded key-like assignment", rpath);
  }
}
if (existsSync(join(ROOT, ".env"))) {
  addIssue("CRITICAL", "SECURITY", "preflight", ".env is present in the tree — never ship secrets", ".env");
}

stages.push({
  name: "security",
  ok: secretHits === 0 && !issues.some((i) => i.severity === "CRITICAL"),
  detail: `${secretHits} secret hits · ${negHits} negative-coding hits in product source`,
});

// --- 3 DEBUG (typecheck) ---
const tsc = run("npm run typecheck");
stages.push({
  name: "debug",
  ok: tsc.ok,
  detail: tsc.ok ? "tsc --noEmit clean" : (tsc.stderr || tsc.stdout).slice(-800),
});
if (!tsc.ok) addIssue("HIGH", "TYPE_CHECK", "kronos", "Typecheck failed", "tsconfig.json");

// --- 4 TEST (live product probes) ---
let testsOk = true;
try {
  const { probeLookupGate } = await import("../src/lib/kcn/lookup-gate.ts");
  const g = probeLookupGate();
  if (!g.ok) {
    testsOk = false;
    addIssue("HIGH", "TEST", "kronos", g.evidence, "src/lib/kcn/lookup-gate.ts");
  }
} catch (e) {
  testsOk = false;
  addIssue("HIGH", "TEST", "kronos", `lookup-gate probe threw: ${e.message}`, "src/lib/kcn/lookup-gate.ts");
}

try {
  const { liveCryptoProbe, passphraseScore } = await import("../src/lib/kcn/crypto.ts");
  const live = await liveCryptoProbe();
  if (!live.ok) {
    testsOk = false;
    addIssue("HIGH", "TEST", "kronos", live.evidence, "src/lib/kcn/crypto.ts");
  }
  if (passphraseScore("short").ok || !passphraseScore("Kcn2VaultPass!").ok) {
    testsOk = false;
    addIssue("MEDIUM", "TEST", "kronos", "Passphrase policy drifted", "src/lib/kcn/crypto.ts");
  }
} catch (e) {
  testsOk = false;
  addIssue("HIGH", "TEST", "kronos", `crypto probe threw: ${e.message}`, "src/lib/kcn/crypto.ts");
}

const classify = await import("../src/lib/kcn/classify.ts");
const packed = classify.classifyText(
  "John Smith stated that the witness was last seen near Oak Street. Autopsy concluded otherwise.",
);
if (!packed.names.includes("John Smith") || packed.findings.length < 1) {
  testsOk = false;
  addIssue("MEDIUM", "TEST", "kronos", "Classifier missed a basic name/finding", "src/lib/kcn/classify.ts");
}

stages.push({
  name: "test",
  ok: testsOk,
  detail: testsOk ? "lookup-gate, AES-GCM live probe, passphrase policy, classifier" : "one or more live probes failed",
});

// --- 5 DEPLOY / vibe-developer packaging ---
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const packOk =
  pkg.name === "kcn-ii" &&
  existsSync(join(ROOT, "LICENSE")) &&
  existsSync(join(ROOT, "startup.sh")) &&
  existsSync(join(ROOT, "README.md")) &&
  !existsSync(join(ROOT, ".env"));
if (!packOk) addIssue("HIGH", "DEPLOY", "vibe-developer", "Packaging incomplete (name, license, startup, or .env)", "package.json");
stages.push({
  name: "deploy",
  ok: packOk,
  detail: packOk
    ? "kcn-ii package, LICENSE, startup.sh, no .env — ready for GitHub + preview"
    : "packaging gaps",
});

// --- 6 AI REVIEW (dead product exports already scanned) ---
const reviewFail = issues.filter((i) => i.category === "NEGATIVE" && (i.severity === "HIGH" || i.severity === "CRITICAL"));
stages.push({
  name: "ai_review",
  ok: reviewFail.length === 0,
  detail: reviewFail.length === 0 ? "No HIGH negative-coding in product source" : `${reviewFail.length} HIGH negative findings`,
});

// --- 7 REPORT ---
const critical = issues.filter((i) => i.severity === "CRITICAL" || i.severity === "HIGH");
const verdict = stages.every((s) => s.ok) && critical.length === 0 ? "PASS" : "BLOCK";
const report = {
  product: "KCN-II",
  pipeline: "Kronos-Vibe-Coder + kcn-vibe-developer + kcn-preflight",
  at: new Date().toISOString(),
  verdict,
  stages,
  issue_count: issues.length,
  severity_counts: issues.reduce((acc, i) => {
    acc[i.severity] = (acc[i.severity] || 0) + 1;
    return acc;
  }, {}),
  issues,
  language_distribution: lang,
};

const md = [
  "# KCN-II Kronos Gate Report",
  "",
  `**Verdict: ${verdict}**`,
  `Issued: ${report.at}`,
  "Pipeline: Kronos-Vibe-Coder (analyze/debug/test/deploy/security/review) · kcn-vibe-developer (package) · kcn-preflight (PASS/BLOCK)",
  "",
  "## Stages",
  ...stages.map((s) => `- ${s.ok ? "PASS" : "FAIL"} **${s.name}** — ${s.detail}`),
  "",
  `## Issues (${issues.length})`,
  issues.length
    ? issues.map((i) => `- [${i.severity}] ${i.category}/${i.tool} ${i.path || ""}:${i.line || "-"} ${i.message}`).join("\n")
    : "None.",
  "",
  "This is a local quality gate, not a hosted Kronos FastAPI clone-scan. Product source was scanned in place.",
].join("\n");

writeFileSync(join(ROOT, "KRONOS_GATE_REPORT.md"), md);
writeFileSync(join(ROOT, "KRONOS_GATE_REPORT.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ verdict, stages: stages.map((s) => [s.name, s.ok]), issue_count: issues.length }, null, 2));
process.exit(verdict === "PASS" ? 0 : 1);
