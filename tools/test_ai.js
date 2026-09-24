/**
 * Offline test for Heritage AI's mode selection + offline answer bank.
 * Extracts the real GEMINI config, geminiMode(), DEMO_ANSWERS and
 * demoAnswer() out of script.js and exercises them, so we verify the
 * shipped code rather than a copy of it.
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

const GEMINI_SRC = slice("const GEMINI = {", "\n};");
const PLACEHOLDER_SRC = slice("const GEMINI_KEY_PLACEHOLDER =", ";");
const PROMPT_SRC = slice("const GEMINI_SYSTEM_PROMPT =", ";");
const MODE_SRC = slice("function geminiMode()", "\n}");
const BANK_SRC = slice("const DEMO_ANSWERS = [", "\n];");
const ANSWER_SRC = slice("function demoAnswer(", "\n}");

// Evaluate the shipped code in an isolated scope and pull the bindings
// back out. Direct `eval` shares the caller's scope, so the eval'd
// `function geminiMode` would collide with our own destructured binding;
// `new Function` gives the extracted code a scope of its own.
const api = new Function(
    [GEMINI_SRC, PLACEHOLDER_SRC, PROMPT_SRC, MODE_SRC, BANK_SRC, ANSWER_SRC].join("\n") +
    "\n;return { GEMINI, GEMINI_KEY_PLACEHOLDER, GEMINI_SYSTEM_PROMPT, geminiMode, DEMO_ANSWERS, demoAnswer };"
)();
const {
    GEMINI,
    GEMINI_KEY_PLACEHOLDER,
    GEMINI_SYSTEM_PROMPT,
    geminiMode,
    DEMO_ANSWERS,
    demoAnswer
} = api;

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

console.log("\n== mode selection ==");
check("geminiMode() === 'demo' with the placeholder key", geminiMode() === "demo", "got: " + geminiMode());
check("placeholder constant matches config value", GEMINI.apiKey === GEMINI_KEY_PLACEHOLDER, GEMINI.apiKey);
check("model is a real, documented model name", GEMINI.model === "gemini-2.5-flash", GEMINI.model);
check("no leaked/invalid key committed", !/^AQ\./.test(GEMINI.apiKey), GEMINI.apiKey);
check("proxy endpoint still empty (static hosting)", GEMINI.endpoint === "");
check("reply cap still in place", GEMINI.maxOutputTokens === 200);

console.log("\n== system prompt present ==");
check("system prompt is non-trivial", GEMINI_SYSTEM_PROMPT.length > 200, String(GEMINI_SYSTEM_PROMPT.length));
check("system prompt pins the persona", /Heritage AI/.test(GEMINI_SYSTEM_PROMPT));

console.log("\n== offline answer bank ==");
check("answer bank is populated", DEMO_ANSWERS.length >= 20, DEMO_ANSWERS.length + " entries");
check("every entry has keys + text", DEMO_ANSWERS.every((e) => Array.isArray(e.keys) && e.keys.length && e.text));

// Every question offered in the UI must resolve to a real curated answer.
const UI_QUESTIONS = [
    "Tell me about Bharatanatyam.",
    "What is Madhubani art?",
    "Tell me about Hampi.",
    "What is the significance of Pongal?",
    "Tell me about Indian folk traditions.",
    "What are some traditional crafts of Rajasthan?"
];
const FALLBACK_STARTS = "That's a wonderful question";
for (const q of UI_QUESTIONS) {
    const a = demoAnswer(q);
    check("chip resolves: " + JSON.stringify(q), a && !a.startsWith(FALLBACK_STARTS));
}

console.log("\n== unknown question degrades gracefully ==");
const unknown = demoAnswer("what is the airspeed velocity of an unladen swallow");
check("returns the friendly fallback", unknown.startsWith(FALLBACK_STARTS));
check("fallback suggests real topics", /Bharatanatyam/.test(unknown));
check("never returns undefined/empty", typeof unknown === "string" && unknown.length > 50);

console.log("\n== case insensitivity ==");
check("upper case still matches", demoAnswer("WHAT IS DIWALI?").startsWith("Diwali, the festival of lights"));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail === 0 ? 0 : 1);
