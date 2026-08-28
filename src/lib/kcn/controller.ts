export type ControllerIntent =
  | { kind: "search"; query: string }
  | { kind: "add-person"; name: string; role: string }
  | { kind: "add-place"; name: string }
  | { kind: "add-org"; name: string }
  | { kind: "add-note"; text: string }
  | { kind: "add-finding"; text: string }
  | { kind: "open-desk"; desk: string; label: string }
  | { kind: "ask"; question: string };

const DESKS: [RegExp, string, string][] = [
  [/web\s*search|swarm|osint\s*desk/i, "swarm", "Web search"],
  [/scan|camera|photo/i, "scanner", "Scan"],
  [/files?|reader|document/i, "reader", "Files"],
  [/people|persons|names/i, "people", "People"],
  [/places?|locations?/i, "locations", "Places"],
  [/orgs?|organizations?/i, "orgs", "Organizations"],
  [/notes?/i, "notes", "Notes"],
  [/findings?/i, "findings", "Findings"],
  [/interview/i, "interview", "Interview"],
  [/video/i, "video", "Video"],
  [/cases?/i, "cases", "Cases"],
  [/timeline/i, "timeline", "Timeline"],
  [/report/i, "report", "Report"],
  [/vault/i, "vault", "Vault"],
  [/brief|investigator/i, "investigator", "Case brief"],
  [/ask|conversation/i, "conversation", "Ask"],
  [/start|home/i, "home", "Start"],
];

function clip(s: string, n = 120) {
  return s.replace(/\s+/g, " ").trim().slice(0, n);
}

function aboutThisCase(text: string) {
  return /\b(this case|our (?:case|files?|board|notes?|people)|we (?:have|added|found|logged)|on the board)\b/i.test(text);
}

/**
 * The UI controller's only job: turn what the operator typed into the
 * action they asked for. Search verbs hunt. Add verbs file. Questions
 * about the case stay on Ask. Never dump a hunt into conversation.
 */
export function parseIntent(raw: string): ControllerIntent {
  const text = String(raw || "").trim();
  if (!text) return { kind: "ask", question: "" };

  const open = text.match(/^(?:please\s+)?(?:open|go to|show|switch to)\s+(?:the\s+)?(.+?)(?:\s+desk)?\.?$/i);
  if (open) {
    const want = open[1].trim();
    const hit = DESKS.find(([re]) => re.test(want));
    if (hit) return { kind: "open-desk", desk: hit[1], label: hit[2] };
  }

  const person = text.match(
    /^(?:please\s+)?(?:add|file|record)\s+(?:a\s+)?(?:person|name|subject)(?:\s*[:\-]| named| called)?\s+(.+)/i,
  );
  if (person) {
    const rest = clip(person[1]);
    const split = rest.match(/^(.+?)\s+(?:as|role)\s+(.+)$/i);
    return split
      ? { kind: "add-person", name: clip(split[1], 80), role: clip(split[2], 48) }
      : { kind: "add-person", name: rest, role: "From Ask" };
  }

  const place = text.match(
    /^(?:please\s+)?(?:add|file|record)\s+(?:a\s+)?(?:place|location|address)(?:\s*[:\-]| named| called)?\s+(.+)/i,
  );
  if (place) return { kind: "add-place", name: clip(place[1], 80) };

  const org = text.match(
    /^(?:please\s+)?(?:add|file|record)\s+(?:an?\s+)?(?:org|organization|company)(?:\s*[:\-]| named| called)?\s+(.+)/i,
  );
  if (org) return { kind: "add-org", name: clip(org[1], 80) };

  const note = text.match(/^(?:please\s+)?(?:add|file|record)\s+(?:a\s+)?note(?:\s*[:\-]| that| saying)?\s+(.+)/i);
  if (note) return { kind: "add-note", text: clip(note[1], 400) };

  const finding = text.match(/^(?:please\s+)?(?:add|file|record)\s+(?:a\s+)?finding(?:\s*[:\-]| that)?\s+(.+)/i);
  if (finding) return { kind: "add-finding", text: clip(finding[1], 400) };

  const hunt = text.match(
    /^(?:please\s+)?(?:can you\s+|could you\s+)?(?:search|look\s*up|lookup|find|osint|investigate|hunt|deep[\s-]*search)(?:\s+(?:for|on|up))?\s+(.+)/i,
  );
  if (hunt && hunt[1].trim()) return { kind: "search", query: clip(hunt[1], 160) };

  if (aboutThisCase(text)) return { kind: "ask", question: text };

  const who = text.match(/^(?:who|where)\s+is\s+(.+?)\??$/i);
  if (who && who[1].trim()) return { kind: "search", query: clip(who[1].replace(/\?+$/, ""), 160) };

  return { kind: "ask", question: text };
}

export function intentLabel(intent: ControllerIntent): string {
  switch (intent.kind) {
    case "search":
      return "Searching: " + intent.query;
    case "add-person":
      return "Filed person: " + intent.name;
    case "add-place":
      return "Filed place: " + intent.name;
    case "add-org":
      return "Filed organization: " + intent.name;
    case "add-note":
      return "Note filed.";
    case "add-finding":
      return "Finding filed.";
    case "open-desk":
      return "Opened " + intent.label;
    default:
      return "Working the question…";
  }
}
