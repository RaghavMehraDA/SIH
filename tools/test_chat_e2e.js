/**
 * End-to-end test of the Heritage AI chatbox in a simulated DOM.
 *
 * Loads the real index.html + script.js into jsdom, opens the chat and
 * drives it exactly as a visitor would: greeting, suggested-question
 * chips and typed questions — while a recorder watches window.fetch to
 * prove the chat answers without ever touching the network.
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
function buildPage() {
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

    // Offline mode must mean offline. jsdom has no fetch, so install a
    // recorder that captures the URL and rejects: any request the page
    // attempts is both logged (for the assertion) and fatal to the
    // answer, so it can never pass by accident.
    const fetchLog = [];
    window.fetch = (url) => {
        fetchLog.push(String(url));
        return Promise.reject(new TypeError("network disabled — Heritage AI must answer offline"));
    };

    window.eval(js);
    return { dom, window, errors, source: js, fetchLog };
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

/**
 * Poll until the answer to the most recent question lands. Offline
 * answers take ~1.5s (a deliberate human pause), so a fixed sleep is
 * either too short or wastefully long.
 */
async function waitForAnswers(window, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const got = answers(window);
        const typing = bubbles(window).some((b) => b.isTyping);
        if (got.length >= 1 && !typing) return got;
        await wait(150);
    }
    return answers(window);
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

        // Offline answers land in ~1.5s; poll rather than guess.
        await waitForAnswers(window);
        const after = bubbles(window);
        check("typing indicator is cleared", !after.some((b) => b.isTyping));
        const ai = answers(window);
        check("an AI answer arrived", ai.length === 1, "got " + ai.length);
        check(
            "answer is a real answer (not the failure text)",
            ai.length === 1 &&
                !/could not reach/i.test(ai[0].text) &&
                !/^That's a wonderful question/i.test(ai[0].text),
            ai[0] && ai[0].text.slice(0, 60)
        );
        check(
            "answer came back substantive, not truncated",
            ai.length === 1 && ai[0].text.split(/\s+/).length >= 15,
            ai[0] && ai[0].text.split(/\s+/).length + " words"
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
        const ai = await waitForAnswers(window);
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
        const ai = await waitForAnswers(window);
        check("got a reply", ai.length === 1, "got " + ai.length);
        // An out-of-scope question: offline there is no model to steer
        // it back, so the bank answers with its friendly fallback that
        // points at topics it does know. What must never happen is a
        // dead end, an empty bubble or an error message.
        check(
            "reply is a real response, not an error",
            ai.length === 1 && !/could not reach|usage limit/i.test(ai[0].text)
        );
        check("never empty", ai.length === 1 && ai[0].text.length > 50, ai[0] && ai[0].text.length + " chars");
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

    console.log("\n== scenario 7: answers arrive with the network watched ==");
    {
        // window.fetch is a recorder that rejects. If the chat ever
        // tries to reach out, it lands in fetchLog AND gets no answer —
        // so this scenario fails loudly rather than silently passing.
        const { window, errors, fetchLog, source } = buildPage();
        openChat(window);
        const form = window.document.getElementById("ai-form");
        const input = window.document.getElementById("ai-input");

        const got = [];
        for (const q of ["Tell me about Hampi.", "What is the significance of Pongal?"]) {
            input.value = q;
            form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
            const ai = await waitForAnswers(window);
            got.push(ai.length ? ai[0].text : null);
        }

        check("both questions were answered", got.every((t) => t && t.length > 50), JSON.stringify(got));
        check("answers differ per question", got[0] !== got[1]);
        check("fetch was never called", fetchLog.length === 0, fetchLog.join(" | "));
        check("shipped source has no API endpoint or key",
            !/generativelanguage|apiKey|AQ\.Ab8RN|\bGEMINI\b/i.test(source));
        check("shipped source has no fetch/XHR at all",
            !/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/.test(source));
        check("no uncaught page errors", errors.length === 0, errors.join(" | "));
    }

    console.log("\n== scenario 8: offline answer for a question outside the chips ==");
    {
        // Deliberately not one of the six suggested chips: only a real
        // entry in DEMO_ANSWERS can answer it. The generic "temple"
        // entry would not mention the Chola dynasty, so matching the
        // specific entry proves the bank is being searched properly.
        const QUESTION = "Which dynasty built the Brihadeeswarar Temple in Thanjavur?";
        const { window, errors, fetchLog } = buildPage();
        openChat(window);
        const form = window.document.getElementById("ai-form");
        const input = window.document.getElementById("ai-input");
        input.value = QUESTION;
        form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));

        const ai = await waitForAnswers(window);
        check("an answer arrived", ai.length === 1, "got " + ai.length);
        check(
            "answer came from the bank, not the fallback",
            ai.length === 1 && !/^That's a wonderful question/i.test(ai[0].text),
            ai[0] && ai[0].text.slice(0, 70)
        );
        check(
            "answer actually addresses the question (names the Chola dynasty)",
            ai.length === 1 && /chola/i.test(ai[0].text),
            ai[0] && ai[0].text.slice(0, 120)
        );
        check(
            "answer is complete, not truncated mid-sentence",
            ai.length === 1 && ai[0].text.length > 80 && /[.!?]["']?$/.test(ai[0].text.trim()),
            ai[0] && JSON.stringify(ai[0].text.slice(-40))
        );
        check("no network call made", fetchLog.length === 0, fetchLog.join(" | "));
        check("no uncaught page errors", errors.length === 0, errors.join(" | "));
    }

    console.log("\n" + pass + " passed, " + fail + " failed");
    process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
    console.error("\nE2E harness crashed:", err);
    process.exit(1);
});
