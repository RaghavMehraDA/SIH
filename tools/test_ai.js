/**
 * Offline test for Heritage AI's answer bank + the guarantee that the
 * assistant never touches the network.
 *
 * Extracts DEMO_ANSWERS, normaliseForMatch, matchKey and demoAnswer out
 * of script.js and exercises them, so we verify the shipped code rather
 * than a copy of it — then asserts the shipped source contains no
 * network call and no credential at all.
 *
 * Run: node tools/test_ai.js
 */
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");

/** Grab the source of a top-level `const NAME = ...;` / function by name. */
function slice(startMarker, endMarker) {
    const start = src.indexOf(startMarker);
    if (start === -1) throw new Error("marker not found: " + startMarker);
    const end = src.indexOf(endMarker, start);
    if (end === -1) throw new Error("end marker not found: " + endMarker);
    return src.slice(start, end + endMarker.length);
}

const BANK_SRC = slice("const DEMO_ANSWERS = [", "\n];");
const NORMALISE_SRC = slice("function normaliseForMatch(", "\n}");
const MATCH_SRC = slice("function matchKey(", "\n}");
const ANSWER_SRC = slice("function demoAnswer(", "\n}");

// Evaluate the extracted code in an isolated scope and pull the bindings
// back out. `new Function` gives it a scope of its own, so nothing here
// can accidentally reach into or be shadowed by this file.
const api = new Function(
    [BANK_SRC, NORMALISE_SRC, MATCH_SRC, ANSWER_SRC].join("\n") +
    "\n;return { DEMO_ANSWERS, normaliseForMatch, matchKey, demoAnswer };"
)();
const { DEMO_ANSWERS, normaliseForMatch, matchKey, demoAnswer } = api;

let pass = 0;
let fail = 0;
function check(label, condition, detail) {
    if (condition) {
        pass++;
        console.log("  ok   " + label);
    } else {
        fail++;
        console.log("  FAIL " + label + (detail ? "  -> " + detail : ""));
    }
}

const FALLBACK_STARTS = "That's a wonderful question";
const fallbackFor = (q) => demoAnswer(q);
const looksLikeFallback = (text) => text.startsWith(FALLBACK_STARTS);

console.log("\n== shipped source makes no network call ==");
// This is the core promise: offline means offline. A regression here
// would silently reintroduce an API key or an outbound request.
check("no Gemini endpoint in the source", !/generativelanguage/.test(src));
check("no credential in the source", !/AQ\.Ab8RN|AIzaSy/.test(src));
check("no API key config in the source", !/\bapiKey\b|\bAPI_KEY\b/.test(src));
check("no GEMINI config block left", !/\bGEMINI\b/.test(src));
check("no fetch( anywhere in the source", !/\bfetch\s*\(/.test(src));
check("no XHR / beacon / websocket fallbacks",
    !/XMLHttpRequest|sendBeacon|EventSource|WebSocket/.test(src));
check("no mode switching left over", !/geminiMode|callGemini|demo mode/.test(src));
check("no message history kept for an API", !/history:\s*\[\]/.test(src));

console.log("\n== answer bank structure ==");
check("answer bank is populated", DEMO_ANSWERS.length >= 55, DEMO_ANSWERS.length + " entries");
check("every entry has keys + substantial text",
    DEMO_ANSWERS.every((e) => Array.isArray(e.keys) && e.keys.length && e.text && e.text.length > 150));
check("every key is normalised (lowercase, alphanumerics and spaces only)",
    DEMO_ANSWERS.every((e) => e.keys.every((k) => /^[a-z0-9 ]+$/.test(k))),
    JSON.stringify(DEMO_ANSWERS.flatMap((e) => e.keys).filter((k) => !/^[a-z0-9 ]+$/.test(k))));
const allKeys = DEMO_ANSWERS.flatMap((e) => e.keys);
const duplicates = allKeys.filter((k, i) => allKeys.indexOf(k) !== i);
check("no key is claimed by two entries", duplicates.length === 0, duplicates.join(", "));
check("keys are trimmed", DEMO_ANSWERS.every((e) => e.keys.every((k) => k === k.trim())));

console.log("\n== every suggested chip resolves to a real answer ==");
const UI_QUESTIONS = [
    "Tell me about Bharatanatyam.",
    "What is Madhubani art?",
    "Tell me about Hampi.",
    "What is the significance of Pongal?",
    "Tell me about Indian folk traditions.",
    "What are some traditional crafts of Rajasthan?"
];
for (const q of UI_QUESTIONS) {
    const a = demoAnswer(q);
    check("chip resolves: " + JSON.stringify(q), a && !looksLikeFallback(a), a && a.slice(0, 60));
}

console.log("\n== matching is specific, not substring-guessing ==");
// The old matcher used q.includes(key), so "holistically" answered as
// Holi and "kathakali" fell through to plain Kathak. These pin the fix.
const expectEntry = (question, test, label) => {
    const a = demoAnswer(question);
    check(label + "  -> " + JSON.stringify(a.slice(0, 46)), test(a), a.slice(0, 90));
};
expectEntry("What is Kathakali?", (a) => a.startsWith("Kathakali is Kerala"), "kathakali not answered as kathak");
expectEntry("tell me about kathak", (a) => /^Kathak — from/.test(a), "kathak answers kathak");
expectEntry("a holistic approach to tourism", (a) => looksLikeFallback(a), "'holistically' does not match 'holi'");
expectEntry("who were the cholas?", (a) => /Chola/.test(a) && !looksLikeFallback(a), "'cholas' still matches 'chola'");
expectEntry("rajasthani textiles and mirror work", (a) => /Rajasthan/.test(a), "'rajasthani' matches 'rajasthan'");
expectEntry("what are heritage sites of india", (a) => a.startsWith("India's heritage architecture"), "'heritage sites' matches 'heritage site'");
expectEntry("which dynasty built the brihadeeswarar temple in thanjavur",
    (a) => /Chola/.test(a) && !looksLikeFallback(a), "specific Chola entry beats the generic temple entry");
expectEntry("tell me about the golden temple langar", (a) => /Amritsar/.test(a), "golden temple entry wins");
expectEntry("WHAT IS DIWALI?", (a) => a.startsWith("Diwali, the festival of lights"), "case insensitive");
expectEntry("biryani, samosa and chai", (a) => a.startsWith("Indian cuisine"), "cuisine keys broaden the match");

console.log("\n== normalisation + scoring helpers ==");
check("normalise lowercases and strips punctuation",
    normaliseForMatch("WHAT IS Diwali?") === "what is diwali", normaliseForMatch("WHAT IS Diwali?"));
check("possessives split rather than swallow the key",
    normaliseForMatch("Rajasthan's forts") === "rajasthan s forts", normaliseForMatch("Rajasthan's forts"));
check("hyphenated names keep both halves",
    normaliseForMatch("Mohenjo-Daro") === "mohenjo daro", normaliseForMatch("Mohenjo-Daro"));
check("exact key scores higher than a prefix of it",
    matchKey(" what is kathakali ", "kathakali") > matchKey(" what is kathakali ", "kathak"));
check("short keys never prefix-match (keeps 'hi' out of 'this')",
    matchKey(" this is fine ", "hi") === 0, String(matchKey(" this is fine ", "hi")));

console.log("\n== unknown question degrades gracefully ==");
const unknown = fallbackFor("what is the airspeed velocity of an unladen swallow");
check("returns the friendly fallback", looksLikeFallback(unknown), unknown.slice(0, 60));
check("fallback suggests real topics", /Bharatanatyam/.test(unknown));
check("fallback echoes what was heard", /airspeed/.test(unknown));
check("fallback admits it is offline, not broken", /offline guide/.test(unknown));
check("fallback makes no live/API claim", !/Gemini|api key|live mode|real time/i.test(unknown));
check("never returns undefined/empty", typeof unknown === "string" && unknown.length > 50);

console.log("\n== conversational openers ==");
check("'hi' gets the introduction, not the generic fallback",
    demoAnswer("hi").startsWith("Namaste! I'm Heritage AI"), demoAnswer("hi").slice(0, 50));
check("'thanks' gets the sign-off", demoAnswer("thanks").startsWith("You're welcome"),
    demoAnswer("thanks").slice(0, 50));
check("'who are you' gets the introduction",
    demoAnswer("who are you?").startsWith("Namaste! I'm Heritage AI"), demoAnswer("who are you?").slice(0, 50));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail === 0 ? 0 : 1);
