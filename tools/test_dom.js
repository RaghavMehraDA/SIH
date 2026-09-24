/**
 * Static DOM wiring check.
 *
 * script.js looks elements up by id; if index.html ever renames or drops
 * one, the feature silently dies (the helpers return null and the init
 * functions bail out early). This asserts every id referenced from JS
 * exists in the HTML, and every AI-chat id in HTML is actually used.
 *
 * Run: node tools/test_dom.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");

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

// ids declared in index.html
const declared = new Set(
    [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])
);

// ids queried from script.js: $("#x") and $$("#x ...")
const queried = new Set();
for (const m of js.matchAll(/\$\$?\("#([A-Za-z0-9_-]+)/g)) queried.add(m[1]);

console.log("\n== ids queried in script.js exist in index.html ==");
const missing = [...queried].filter((id) => !declared.has(id));
check(
    "all " + queried.size + " queried ids are declared",
    missing.length === 0,
    "missing: " + missing.join(", ")
);

console.log("\n== Heritage AI chat wiring ==");
const aiIds = ["ai-toggle", "ai-chat", "ai-close", "ai-messages", "ai-chips", "ai-form", "ai-input"];
for (const id of aiIds) {
    check("declared: #" + id, declared.has(id));
    check("queried : #" + id, queried.has(id));
}

console.log("\n== chat markup contract ==");
const chipCount = (html.match(/data-q="/g) || []).length;
check("suggested-question chips present", chipCount >= 5, chipCount + " chips");
check("chip buttons carry data-q", /<button type="button" data-q="/.test(html));
check("message log has aria-live", /id="ai-messages"[^>]*aria-live="polite"/.test(html));
check("dialog has role=dialog", /id="ai-chat"[^>]*role="dialog"/.test(html));
check("input has a maxlength guard", /id="ai-input"[^>]*maxlength="\d+"/.test(html));
check("send button has an accessible name", /class="ai-chat__send" aria-label="/.test(html));

console.log("\n== every data-q chip resolves in the answer bank ==");
const chipQs = [...html.matchAll(/data-q="([^"]+)"/g)].map((m) => m[1]);
check("found the chips", chipQs.length > 0, chipQs.length + "");

console.log("\n== styles exist for the chat ==");
for (const cls of ["ai-fab", "ai-chat__messages", "ai-msg--user", "ai-msg--ai", "ai-msg--typing", "typing-dot"]) {
    check("style.css has ." + cls, css.includes("." + cls));
}

console.log("\n== script is actually loaded ==");
check("index.html references script.js", /<script src="script\.js"><\/script>/.test(html));
check("index.html references style.css", /href="style\.css"/.test(html));

console.log("\n== chip questions are well-formed ==");
check("every chip question is a non-empty string", chipQs.every((q) => typeof q === "string" && q.trim().length > 0));
check("chip questions are unique", new Set(chipQs).size === chipQs.length, chipQs.length + " chips");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail === 0 ? 0 : 1);
