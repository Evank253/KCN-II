import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export type SearchHit = {
  title: string;
  url: string;
  snippet: string;
  source: string;
};

export type SourceId = "ddg" | "wikipedia" | "wikidata" | "maps" | "news" | "grok";

export const SEARCH_LANES: {
  id: SourceId;
  label: string;
  where: (q: string) => string;
}[] = [
  {
    id: "ddg",
    label: "DuckDuckGo",
    where: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
  },
  {
    id: "wikipedia",
    label: "Wikipedia",
    where: (q) => `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}`,
  },
  {
    id: "wikidata",
    label: "Wikidata",
    where: (q) => `https://www.wikidata.org/w/index.php?search=${encodeURIComponent(q)}`,
  },
  {
    id: "maps",
    label: "OpenStreetMap",
    where: (q) => `https://www.openstreetmap.org/search?query=${encodeURIComponent(q)}`,
  },
  {
    id: "news",
    label: "Google News",
    where: (q) => `https://news.google.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    id: "grok",
    label: "Live web + X",
    where: () => "https://api.x.ai  ·  web_search  ·  x_search",
  },
];

const UA = "KCN-II/1.2 (investigator console; public-source lookup)";

function strip(s: string) {
  return String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&/g, "&")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function grab(url: string, init: RequestInit = {}, ms = 12000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/json,application/xml,text/xml,*/*",
        ...(init.headers || {}),
      },
    });
    if (!res.ok) throw new Error(String(res.status));
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function hitsFromDdgInstant(raw: string): SearchHit[] {
  try {
    const j = JSON.parse(raw) as {
      Heading?: string;
      AbstractText?: string;
      AbstractURL?: string;
      AbstractSource?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }>;
    };
    const out: SearchHit[] = [];
    if (j.AbstractURL && (j.Heading || j.AbstractText)) {
      out.push({
        title: j.Heading || j.AbstractSource || "DuckDuckGo",
        url: j.AbstractURL,
        snippet: strip(j.AbstractText || ""),
        source: "DuckDuckGo",
      });
    }
    const topics = [
      ...(j.RelatedTopics || []),
      ...(j.RelatedTopics || []).flatMap((t) => t.Topics || []),
    ];
    topics.forEach((t) => {
      if (!t.FirstURL || !t.Text) return;
      out.push({
        title: strip(t.Text).slice(0, 90),
        url: t.FirstURL,
        snippet: strip(t.Text),
        source: "DuckDuckGo",
      });
    });
    return out.slice(0, 8);
  } catch {
    return [];
  }
}

function hitsFromDdgHtml(html: string): SearchHit[] {
  const out: SearchHit[] = [];
  const re =
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|td|span|div)>|)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 8) {
    const url = decodeDdgHref(m[1]);
    if (!url || url.startsWith("https://duckduckgo.com")) continue;
    out.push({
      title: strip(m[2]).slice(0, 120) || url,
      url,
      snippet: strip(m[3] || "").slice(0, 220),
      source: "DuckDuckGo",
    });
  }
  if (out.length) return out;
  const lite = /<a[^>]*rel="nofollow"[^>]*href="(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = lite.exec(html)) && out.length < 8) {
    const url = m[1];
    if (/duckduckgo\.com|facebook\.com\/sharer/i.test(url)) continue;
    out.push({
      title: strip(m[2]).slice(0, 120) || url,
      url,
      snippet: "",
      source: "DuckDuckGo",
    });
  }
  return out;
}

function decodeDdgHref(href: string) {
  try {
    const u = new URL(href, "https://duckduckgo.com");
    const uddg = u.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : href;
  } catch {
    return href;
  }
}

async function searchDdg(q: string): Promise<SearchHit[]> {
  const instant = await grab(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&no_redirect=1&skip_disambig=1`,
  ).catch(() => "");
  const fromInstant = instant ? hitsFromDdgInstant(instant) : [];
  const html = await grab(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `q=${encodeURIComponent(q)}&b=`,
  }).catch(() =>
    grab(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`).catch(() => ""),
  );
  const fromHtml = html ? hitsFromDdgHtml(html) : [];
  return dedupe([...fromInstant, ...fromHtml]).slice(0, 10);
}

async function searchWikipedia(q: string): Promise<SearchHit[]> {
  const raw = await grab(
    `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=8&namespace=0&format=json&origin=*`,
  );
  const parsed = JSON.parse(raw) as [string, string[], string[], string[]];
  const titles = parsed[1] || [];
  const desc = parsed[2] || [];
  const urls = parsed[3] || [];
  return titles.map((title, i) => ({
    title,
    url: urls[i] || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    snippet: desc[i] || "",
    source: "Wikipedia",
  }));
}

async function searchWikidata(q: string): Promise<SearchHit[]> {
  const raw = await grab(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(q)}&language=en&limit=8&format=json&origin=*`,
  );
  const parsed = JSON.parse(raw) as {
    search?: Array<{ label?: string; description?: string; concepturi?: string; id?: string }>;
  };
  return (parsed.search || []).map((s) => ({
    title: s.label || s.id || "Wikidata",
    url: s.concepturi || `https://www.wikidata.org/wiki/${s.id}`,
    snippet: s.description || "",
    source: "Wikidata",
  }));
}

async function searchMaps(q: string): Promise<SearchHit[]> {
  const raw = await grab(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=0`,
  );
  const parsed = JSON.parse(raw) as Array<{
    display_name?: string;
    lat?: string;
    lon?: string;
    osm_type?: string;
    osm_id?: number;
  }>;
  return parsed.map((p) => ({
    title: p.display_name || "Place",
    url: `https://www.openstreetmap.org/${p.osm_type || "search"}/${p.osm_id || ""}`,
    snippet: [p.lat, p.lon].filter(Boolean).join(", "),
    source: "OpenStreetMap",
  }));
}

async function searchNews(q: string): Promise<SearchHit[]> {
  const xml = await grab(
    `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`,
  );
  const out: SearchHit[] = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && out.length < 8) {
    const block = m[1];
    const title = strip((block.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "");
    const link = strip((block.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || "");
    const desc = strip((block.match(/<description>([\s\S]*?)<\/description>/i) || [])[1] || "");
    if (!title) continue;
    out.push({
      title,
      url: link || `https://news.google.com/search?q=${encodeURIComponent(q)}`,
      snippet: desc.slice(0, 220),
      source: "Google News",
    });
  }
  return out;
}

function dedupe(hits: SearchHit[]) {
  const seen = new Set<string>();
  return hits.filter((h) => {
    const k = (h.url || h.title).toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export const probeSource = createServerFn({ method: "POST" })
  .validator((input: { source: SourceId; query: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ data }): Promise<{ ok: boolean; hits: SearchHit[]; error?: string; where: string }> => {
    const q = (data.query || "").trim().slice(0, 180);
    const lane = SEARCH_LANES.find((l) => l.id === data.source);
    const where = lane ? lane.where(q) : "";
    if (!q) return { ok: false, hits: [], error: "No query.", where };
    try {
      let hits: SearchHit[] = [];
      if (data.source === "ddg") hits = await searchDdg(q);
      else if (data.source === "wikipedia") hits = await searchWikipedia(q);
      else if (data.source === "wikidata") hits = await searchWikidata(q);
      else if (data.source === "maps") hits = await searchMaps(q);
      else if (data.source === "news") hits = await searchNews(q);
      else if (data.source === "grok") {
        const g = await grokDeep(q, []);
        return { ok: g.ok, hits: g.hits, error: g.error, where };
      }
      return { ok: true, hits, where };
    } catch {
      return { ok: false, hits: [], error: `${lane?.label || data.source} did not return.`, where };
    }
  });

function collectCitations(body: unknown): SearchHit[] {
  const hits: SearchHit[] = [];
  const walk = (v: unknown) => {
    if (!v) return;
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    const url = String(o.url || o.uri || o.link || "");
    const title = String(o.title || o.name || "");
    if (url.startsWith("http")) {
      hits.push({
        title: title || url,
        url,
        snippet: String(o.snippet || o.text || o.description || "").slice(0, 220),
        source: "Live web + X",
      });
    }
    Object.values(o).forEach((child) => {
      if (child && typeof child === "object") walk(child);
    });
  };
  const root = body as Record<string, unknown>;
  walk(root.citations);
  walk(root.sources);
  walk(root.output);
  const md = String(
    (root.output_text as string) ||
      ((root.choices as { message?: { content?: string } }[] | undefined)?.[0]?.message?.content || ""),
  );
  const re = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) {
    hits.push({ title: m[1], url: m[2], snippet: "", source: "Live web + X" });
  }
  return dedupe(hits).slice(0, 12);
}

function grokText(body: Record<string, unknown>): string {
  if (typeof body.output_text === "string" && body.output_text.trim()) return body.output_text.trim();
  const choices = body.choices as { message?: { content?: string } }[] | undefined;
  const chat = choices?.[0]?.message?.content;
  if (chat) return chat.trim();
  const output = body.output as Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> | undefined;
  const bits = (output || [])
    .flatMap((o) => o.content || [])
    .map((c) => c.text)
    .filter(Boolean);
  return bits.join("\n").trim();
}

async function grokDeep(
  query: string,
  prior: SearchHit[],
): Promise<{ ok: boolean; text: string; hits: SearchHit[]; error?: string }> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      text: "",
      hits: [],
      error: "Live web + X is not available here. Public engines still ran.",
    };
  }
  const priorBlock = prior.length
    ? prior
        .slice(0, 12)
        .map((h) => `- ${h.title} — ${h.url}`)
        .join("\n")
    : "(none yet)";
  const prompt = [
    "You are KCN-II, a source-aware OSINT desk.",
    "Search the live web and X. Deepen the public-source hits already found.",
    "Do not invent. Do not claim law-enforcement access. Human review required.",
    "",
    `SUBJECT: ${query}`,
    "HITS ALREADY FOUND:",
    priorBlock,
    "",
    "Reply in this exact shape:",
    "WHERE SEARCHED:",
    "HITS:",
    "  - title — https://url — one line",
    "WHAT IS PUBLIC:",
    "GAPS:",
    "CAUTION:",
  ].join("\n");

  const tryChat = async () => {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 1400,
        tool_choice: "auto",
        tools: [{ type: "web_search" }, { type: "x_search" }],
        messages: [
          { role: "system", content: "OSINT desk. Use web_search and x_search. Cite URLs." },
          { role: "user", content: prompt },
        ],
      }),
    });
    return { ok: res.ok, status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  };

  const tryResponses = async () => {
    const res = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-4.5",
        input: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search" }, { type: "x_search" }],
      }),
    });
    return { ok: res.ok, status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  };

  try {
    let r = await tryChat();
    if (!r.ok) r = await tryResponses();
    if (!r.ok) {
      return { ok: false, text: "", hits: [], error: `Live search failed (${r.status}).` };
    }
    const text = grokText(r.body);
    return { ok: true, text: text || "No briefing returned.", hits: collectCitations(r.body) };
  } catch {
    return { ok: false, text: "", hits: [], error: "Live web + X did not finish." };
  }
}

export const liveGrokSearch = createServerFn({ method: "POST" })
  .validator((input: { query: string; hits: SearchHit[] }) => input)
  .middleware([authMiddleware])
  .handler(async ({ data }) => {
    const q = (data.query || "").trim().slice(0, 180);
    if (!q) return { ok: false as const, text: "", hits: [] as SearchHit[], error: "No query." };
    return grokDeep(q, Array.isArray(data.hits) ? data.hits.slice(0, 16) : []);
  });

export type SwarmFocus = "auto" | "person" | "place" | "org" | "news";

export type AgentTask = {
  id: string;
  agent: string;
  source: SourceId;
  query: string;
  why: string;
  where: string;
  wave: 1 | 2;
  status: "queued" | "running" | "hit" | "empty" | "fail";
  hits: number;
};

export type ControllerPlan = {
  intent: string;
  focus: SwarmFocus;
  tasks: AgentTask[];
  from: "ai" | "local";
};

export type CaseHint = {
  people: string[];
  places: string[];
  orgs: string[];
  findings: string[];
};

const SOURCES: SourceId[] = ["ddg", "wikipedia", "wikidata", "maps", "news", "grok"];

export function whereFor(source: SourceId, q: string) {
  const lane = SEARCH_LANES.find((l) => l.id === source);
  return lane ? lane.where(q) : "";
}

function looksPerson(q: string) {
  return /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(q.trim()) || /\b(mr|ms|mrs|dr)\b/i.test(q);
}
function looksPlace(q: string) {
  return /\b(street|st|ave|road|rd|city|county|washington|oregon|california|lake|river|park|airport)\b/i.test(q);
}
function looksOrg(q: string) {
  return /\b(inc|llc|corp|company|agency|department|church|school|hospital|pd|sheriff)\b/i.test(q);
}

function task(
  agent: string,
  source: SourceId,
  query: string,
  why: string,
  wave: 1 | 2,
  i: number,
): AgentTask {
  const q = query.trim().slice(0, 160);
  return {
    id: `${wave}-${source}-${i}`,
    agent,
    source,
    query: q,
    why,
    where: whereFor(source, q),
    wave,
    status: "queued",
    hits: 0,
  };
}

export function localPlan(query: string, focus: SwarmFocus, hint: CaseHint): ControllerPlan {
  const q = query.trim().slice(0, 160);
  const person = focus === "person" || (focus === "auto" && looksPerson(q));
  const place = focus === "place" || (focus === "auto" && looksPlace(q));
  const org = focus === "org" || (focus === "auto" && looksOrg(q));
  const news = focus === "news";
  const tasks: AgentTask[] = [];
  let i = 0;
  const add = (agent: string, source: SourceId, query: string, why: string) => {
    if (!query.trim()) return;
    if (tasks.some((t) => t.source === source && t.query.toLowerCase() === query.trim().toLowerCase())) return;
    tasks.push(task(agent, source, query, why, 1, i++));
  };

  if (news) add("NEWS-SWEEP", "news", q, "Operator asked for news first.");
  add("OSINT-A", "ddg", q, "Broad public web for the subject.");
  add("OSINT-B", "ddg", `"${q}"`, "Exact-phrase lock so the name is not split.");
  add("WIKI-TRACE", "wikipedia", q, "Identity / place page if one exists.");
  add("ENTITY-REG", "wikidata", q, "Structured entity registry.");
  if (person) {
    add("NEWS-SWEEP", "news", `${q} news`, "Person in public reporting.");
    add("ALIAS-TRACE", "ddg", `${q} aka OR alias OR "also known as"`, "Public aliases and other names.");
  }
  if (place) {
    add("GEO-CORRELATE", "maps", q, "Ground the subject on a map.");
    add("NEWS-SWEEP", "news", `${q} news`, "Place in public reporting.");
  }
  if (org) {
    add("NEWS-SWEEP", "news", `${q} company OR organization`, "Org in public reporting.");
    add("OSINT-C", "ddg", `${q} site:gov OR site:edu`, "Public gov/edu traces only.");
  }
  if (!person && !place && !org && !news) {
    add("GEO-CORRELATE", "maps", q, "Check whether this is a place.");
    add("NEWS-SWEEP", "news", q, "Check public news.");
  }
  (hint.places || []).slice(0, 2).forEach((p) => {
    if (p && p.toLowerCase() !== q.toLowerCase()) add("GEO-CORRELATE", "maps", p, `Case place: ${p}`);
  });
  (hint.people || []).slice(0, 2).forEach((p) => {
    if (p && p.toLowerCase() !== q.toLowerCase()) add("ALIAS-TRACE", "ddg", p, `Case person: ${p}`);
  });
  add("LIVE-WEB", "grok", q, "Deep live web and X after public engines.");

  const intent = person
    ? `Controller: treat as a person. Identity, news, aliases.`
    : place
      ? `Controller: treat as a place. Map, wiki, local news.`
      : org
        ? `Controller: treat as an organization. Registry, news, public records.`
        : news
          ? `Controller: news-first sweep, then identity backup.`
          : `Controller: mixed sweep. Web, wiki, map, news, then live web + X.`;

  return { intent, focus, tasks: tasks.slice(0, 9), from: "local" };
}

export function localRetask(query: string, hits: SearchHit[], done: AgentTask[]): AgentTask[] {
  const have = new Set(done.map((t) => `${t.source}|${t.query.toLowerCase()}`));
  const out: AgentTask[] = [];
  let i = 0;
  const add = (agent: string, source: SourceId, q: string, why: string) => {
    const key = `${source}|${q.trim().toLowerCase()}`;
    if (!q.trim() || have.has(key)) return;
    have.add(key);
    out.push(task(agent, source, q, why, 2, i++));
  };
  const titles = hits.map((h) => h.title).filter(Boolean);
  const wiki = hits.find((h) => /wikipedia\.org/i.test(h.url));
  if (wiki) add("ENTITY-REG", "wikidata", wiki.title.replace(/\s*\(.*\)\s*$/, ""), "Follow Wikipedia title into Wikidata.");
  const placeHit = hits.find((h) => /openstreetmap|city|county|washington/i.test(`${h.title} ${h.source}`));
  if (placeHit) add("GEO-CORRELATE", "maps", placeHit.title.split(",")[0], "Retask GEO onto a named place from hits.");
  if (!hits.some((h) => h.source === "Google News")) add("NEWS-SWEEP", "news", `${query} ${new Date().getFullYear()}`, "No news yet — year-stamped pass.");
  const extra = titles.find((t) => t.length > 8 && !t.toLowerCase().includes(query.toLowerCase().slice(0, 8)));
  if (extra) add("OSINT-C", "ddg", extra.slice(0, 80), "Follow a new name that appeared in hits.");
  return out.slice(0, 4);
}

function parsePlan(raw: string, focus: SwarmFocus, wave: 1 | 2): ControllerPlan | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const j = JSON.parse(match[0]) as {
      intent?: string;
      tasks?: Array<{ agent?: string; source?: string; query?: string; why?: string }>;
    };
    const tasks = (j.tasks || [])
      .map((t, i) => {
        const source = SOURCES.includes(t.source as SourceId) ? (t.source as SourceId) : null;
        if (!source || !t.query) return null;
        return task(String(t.agent || "OSINT-A").slice(0, 18), source, String(t.query), String(t.why || "Controller task."), wave, i);
      })
      .filter((t): t is AgentTask => !!t)
      .slice(0, 9);
    if (!tasks.length) return null;
    return {
      intent: String(j.intent || "Controller tasking issued.").slice(0, 240),
      focus,
      tasks,
      from: "ai",
    };
  } catch {
    return null;
  }
}

async function grokJson(prompt: string): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return "";
  const ctrl = AbortSignal.timeout(10000);
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    signal: ctrl,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "grok-4.5",
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content:
            "You are KCN-II swarm controller. Return JSON only. Public sources only. No paywall bypass. Human review required.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) return "";
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return body.choices?.[0]?.message?.content?.trim() || "";
}

export const planSwarm = createServerFn({ method: "POST" })
  .validator((input: { query: string; focus: SwarmFocus; hint: CaseHint }) => input)
  .middleware([authMiddleware])
  .handler(async ({ data }): Promise<ControllerPlan> => {
    const q = (data.query || "").trim().slice(0, 160);
    const focus = data.focus || "auto";
    const hint: CaseHint = {
      people: (data.hint?.people || []).slice(0, 6),
      places: (data.hint?.places || []).slice(0, 6),
      orgs: (data.hint?.orgs || []).slice(0, 6),
      findings: (data.hint?.findings || []).slice(0, 4),
    };
    const fallback = localPlan(q, focus, hint);
    if (!q) return fallback;
    try {
      const raw = await grokJson(
        [
          "Task OSINT agents. Vary the query per agent. Send each to the right source.",
          `SUBJECT: ${q}`,
          `FOCUS: ${focus}`,
          `CASE PEOPLE: ${hint.people.join("; ") || "none"}`,
          `CASE PLACES: ${hint.places.join("; ") || "none"}`,
          `CASE ORGS: ${hint.orgs.join("; ") || "none"}`,
          `FINDINGS: ${hint.findings.join("; ") || "none"}`,
          "Sources: ddg, wikipedia, wikidata, maps, news, grok.",
          "4 to 8 tasks. Put grok last. JSON shape:",
          '{"intent":"...","tasks":[{"agent":"OSINT-A","source":"ddg","query":"...","why":"..."}]}',
        ].join("\n"),
      );
      const parsed = parsePlan(raw, focus, 1);
      if (parsed) {
        if (!parsed.tasks.some((t) => t.source === "grok")) {
          parsed.tasks.push(task("LIVE-WEB", "grok", q, "Deep live web and X.", 1, parsed.tasks.length));
        }
        return parsed;
      }
    } catch {
      /* local fallback */
    }
    return fallback;
  });

export const retaskSwarm = createServerFn({ method: "POST" })
  .validator((input: { query: string; hits: SearchHit[]; done: { source: SourceId; query: string }[] }) => input)
  .middleware([authMiddleware])
  .handler(async ({ data }): Promise<{ intent: string; tasks: AgentTask[]; from: "ai" | "local" }> => {
    const q = (data.query || "").trim().slice(0, 160);
    const hits = Array.isArray(data.hits) ? data.hits.slice(0, 16) : [];
    const done = (data.done || []).map((d, i) => task("DONE", d.source, d.query, "", 1, i));
    const fallback = localRetask(q, hits, done);
    try {
      const raw = await grokJson(
        [
          "You already ran a public sweep. Issue 0-4 follow-up tasks that hit GAPS.",
          "Do not repeat the same source+query. Public sources only.",
          `SUBJECT: ${q}`,
          "ALREADY RAN:",
          (data.done || []).map((d) => `${d.source} :: ${d.query}`).join("\n") || "none",
          "HITS:",
          hits.map((h) => `${h.source}: ${h.title} — ${h.url}`).join("\n") || "none",
          "JSON: {\"intent\":\"...\",\"tasks\":[{\"agent\":\"GEO-CORRELATE\",\"source\":\"maps\",\"query\":\"...\",\"why\":\"...\"}]}",
        ].join("\n"),
      );
      const parsed = parsePlan(raw, "auto", 2);
      if (parsed) return { intent: parsed.intent, tasks: parsed.tasks.slice(0, 4), from: "ai" };
    } catch {
      /* local */
    }
    return {
      intent: fallback.length ? "Controller retask from gaps in the first wave." : "No retask. First wave was enough.",
      tasks: fallback,
      from: "local",
    };
  });

