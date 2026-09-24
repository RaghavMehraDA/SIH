/**
 * End-to-end test of the Heritage AI chatbox in a simulated DOM.
 *
 * Loads the real index.html + script.js into jsdom, opens the chat and
 * drives it exactly as a visitor would: greeting, suggested-question
 * chips, typed questions, and the live-mode failure path.
 *
 * Requires jsdom (installed outside the repo, see run note below).
 * Run: node tools/test_chat_e2e.js
 */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");

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

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Build a fresh page for one scenario. */
function buildPage({ fetchImpl, scriptTransform } = {}) {
    const virtualConsole = new VirtualConsole();
    const errors = [];
    virtualConsole.on("jsdomError", (e) => errors.push(String(e)));
    virtualConsole.on("error", (e) => errors.push(String(e)));

    const dom = new JSDOM(html, {
        runScripts: "outside-only",
        pretendToBeVisual: true,
        url: "https://raghavmehrada.github.io/SIH/",
        virtualConsole
    });
    const { window } = dom;

    // jsdom lacks a few browser APIs the site uses. Stub the ones the
    // page touches so script.js can run unmodified.
    window.matchMedia =
        window.matchMedia ||
        (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
    window.IntersectionObserver =
        window.IntersectionObserver ||
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        };
    window.scrollTo = window.scrollTo || (() => {});
    if (fetchImpl) window.fetch = fetchImpl;

    // Lets a scenario pretend a user pasted a real API key, without
    // relying on `const GEMINI` leaking out of the eval scope.
    const source = scriptTransform ? scriptTransform(js) : js;
    window.eval(source);
    return { dom, window, errors, source };
}

/** Click the floating "Heritage AI" pill. */
function openChat(window) {
    window.document.getElementById("ai-toggle").click();
}

/** All rendered chat bubbles, in order. */
function bubbles(window) {
    return [...window.document.querySelectorAll("#ai-messages .ai-msg")].map((el) => ({
        text: el.textContent.trim(),
        isUser: el.classList.contains("ai-msg--user"),
        isTyping: el.classList.contains("ai-msg--typing")
    }));
}

/**
 * AI answers to the MOST RECENT user question. The greeting is itself an
 * AI bubble, so counting every non-user bubble would over-count by one.
 */
function answers(window) {
    const all = bubbles(window);
    let lastUser = -1;
    all.forEach((b, i) => {
        if (b.isUser) lastUser = i;
    });
    if (lastUser === -1) return [];
    return all.slice(lastUser + 1).filter((b) => !b.isTyping);
}

async function main() {
    console.log("\n== scenario 1: greeting on open ==");    {
        const { window, errors } = buildPage();
        const chat = window.document.getElementById("ai-chat");
        check("chat starts closed", !chat.classList.contains("is-open"));

        openChat(window);
        check("chat opens", chat.classList.contains("is-open"));
        check(
            "aria-expanded flips to true",
            window.document.getElementById("ai-toggle").getAttribute("aria-expanded") === "true"
        );

        const g = bubbles(window);
        check("exactly one greeting bubble", g.length === 1, "got " + g.length);
        check("greeting names the assistant", /Heritage AI/.test(g[0].text));
        check("greeting greets in Nepali/Indian style", /Namaste/.test(g[0].text));

        openChat(window);
        check("re-opening does not duplicate the greeting", bubbles(window).length === 1);

        check("no uncaught page errors", errors.length === 0, errors.join(" | "));
    }

    console.log("\n== scenario 2: suggested-question chip answers ==");
    {
        const { window, errors } = buildPage();
        openChat(window);
        const chips = [...window.document.querySelectorAll("#ai-chips button")];
        check("chips rendered", chips.length >= 5, chips.length + "");

        chips[0].click();
        // typing indicator appears immediately
        await wait(30);
        const during = bubbles(window);
        check(
            "user bubble is rendered",
            during.some((b) => b.isUser && b.text === chips[0].dataset.q)
        );
        check("typing indicator shows while thinking", during.some((b) => b.isTyping));

        // demo mode waits ~800-1500ms; wait it out
        await wait(2600);
        const after = bubbles(window);
        check("typing indicator is cleared", !after.some((b) => b.isTyping));
        const ai = answers(window);
        check("an AI answer arrived", ai.length === 1, "got " + ai.length);
        check(
            "answer is a real curated answer (not the failure text)",
            ai.length === 1 &&
                !/could not reach/i.test(ai[0].text) &&
                !/^That's a wonderful question/i.test(ai[0].text),
            ai[0] && ai[0].text.slice(0, 60)
        );
        check("chips come back after the answer", !window.document.getElementById("ai-chips").classList.contains("is-hidden"));
        check("no uncaught page errors", errors.length === 0, errors.join(" | "));
    }

    console.log("\n== scenario 3: typed question + input cleared ==");
    {
        const { window, errors } = buildPage();
        openChat(window);
        const form = window.document.getElementById("ai-form");
        const input = window.document.getElementById("ai-input");
        input.value = "What is Madhubani art?";
        form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));

        check("input is cleared on send", input.value === "");
        await wait(2600);
        const ai = answers(window);
        check("typed question got an answer", ai.length === 1, "got " + ai.length);
        check(
            "answer is about Madhubani",
            ai.length === 1 && /Madhubani|mithila/i.test(ai[0].text),
            ai[0] && ai[0].text.slice(0, 70)
        );
        check("no uncaught page errors", errors.length === 0, errors.join(" | "));
    }

    console.log("\n== scenario 4: unknown question still gets a reply ==");
    {
        const { window } = buildPage();
        openChat(window);
        const form = window.document.getElementById("ai-form");
        const input = window.document.getElementById("ai-input");
        input.value = "what is the airspeed velocity of an unladen swallow";
        form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
        await wait(2600);
        const ai = answers(window);
        check("got a reply", ai.length === 1, "got " + ai.length);
        check("reply steers back to heritage topics", ai.length === 1 && /Bharatanatyam/.test(ai[0].text));
        check("never empty", ai.length === 1 && ai[0].text.length > 50);
    }

    console.log("\n== scenario 5: Escape closes the chat ==");
    {
        const { window } = buildPage();
        openChat(window);
        window.document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        check("Escape closes it", !window.document.getElementById("ai-chat").classList.contains("is-open"));
    }

    console.log("\n== scenario 6: user input is never executed as HTML ==");
    {
        const { window } = buildPage();
        openChat(window);
        const form = window.document.getElementById("ai-form");
        const input = window.document.getElementById("ai-input");
        input.value = "<img src=x onerror=alert(1)>";
        form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
        await wait(60);
        const userBubble = bubbles(window).find((b) => b.isUser);
        check("payload echoed as literal text", userBubble && userBubble.text === "<img src=x onerror=alert(1)>");
        check("no element was injected", window.document.querySelectorAll("#ai-messages img").length === 0);
    }

    console.log("\n== scenario 7: live mode failing degrades to a real answer ==");
    {
        // Force "direct" mode by pretending a key was pasted into the
        // config — exactly what a user does for a local demo — and make
        // every network call fail: the bug that used to dead-end the chat.
        const failingFetch = () => Promise.reject(new TypeError("Failed to fetch"));
        const { window, errors, source } = buildPage({
            fetchImpl: failingFetch,
            scriptTransform: (src) =>
                src.replace('apiKey: "YOUR_GEMINI_API_KEY_HERE"', 'apiKey: "AIzaSyFakeKeyForTestingOnly123456789"')
        });
        // Assert the substitution really happened, otherwise this scenario
        // would silently pass while still running in offline demo mode.
        check(
            "fake key really replaced the placeholder in the executed source",
            source.includes('apiKey: "AIzaSyFakeKeyForTestingOnly123456789"') &&
                !source.includes('apiKey: "YOUR_GEMINI_API_KEY_HERE"')
        );

        openChat(window);
        const form = window.document.getElementById("ai-form");
        const input = window.document.getElementById("ai-input");
        input.value = "Tell me about Hampi.";
        form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));

        await wait(3000);
        const ai = answers(window);
        check("network failure still yields an answer", ai.length === 1, "got " + ai.length);
        check(
            "answer is a real Hampi answer, not an error",
            ai.length === 1 && /Hampi|Vijayanagara/i.test(ai[0].text),
            ai[0] && ai[0].text.slice(0, 70)
        );
        check(
            "no dead-end error message shown",
            ai.length === 1 && !/could not reach/i.test(ai[0].text)
        );
        check("no uncaught page errors", errors.length === 0, errors.join(" | "));
    }

    console.log("\n" + pass + " passed, " + fail + " failed");
    process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
    console.error("\nE2E harness crashed:", err);
    process.exit(1);
});
