/* =====================================================================
   BHARAT — Digital Heritage of India
   Smart India Hackathon · Student Innovation Prototype
   Pure Vanilla JavaScript — no frameworks, no libraries.
   ---------------------------------------------------------------------
   TABLE OF CONTENTS
   0.  Helpers & shared state
   1.  Preloader
   2.  Navbar (scroll transform + active section)
   3.  Mobile menu
   4.  Scroll reveal effects (IntersectionObserver)
   5.  Region Explorer data
   6.  Region Explorer rendering
   7.  Festival Explorer data
   8.  Festival Explorer rendering
   9.  Heritage Quiz
   10. Heritage AI — chatbox UI
   11. Heritage AI — demo mode answers (offline, no API key)
   12. Heritage AI — Gemini API handling (secure endpoint)
   13. Error handling & footer year
   ===================================================================== */

"use strict";

/* =====================================================================
   0. HELPERS & SHARED STATE
   ===================================================================== */

/** Tiny query helpers so the code below stays readable. */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/**
 * Respect the user's "reduce motion" preference.
 * When true, the preloader is shortened and content swaps are instant.
 */
const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Small promise-based delay (used for natural-feeling pauses). */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* =====================================================================
   1. PRELOADER
   Hides the cinematic intro after the page (and its imagery) has loaded,
   enforcing a short minimum duration so the intro feels intentional.
   ===================================================================== */

(function initPreloader() {
    const preloader = $("#preloader");
    if (!preloader) return;

    let finished = false;

    function finish() {
        if (finished) return;
        finished = true;
        preloader.classList.add("is-done");
        document.body.classList.remove("no-scroll");
        document.body.classList.add("is-loaded"); // starts hero entrance
    }

    // Cinematic minimum display time (much shorter for reduced motion).
    const minTime = prefersReducedMotion ? 400 : 2300;
    const start = performance.now();

    function maybeFinish() {
        if (performance.now() - start >= minTime) finish();
    }

    window.addEventListener("load", maybeFinish);
    // Safety nets: never trap the visitor behind the preloader.
    setTimeout(maybeFinish, minTime + 2000);
    setTimeout(finish, 8000);
})();

/* =====================================================================
   2. NAVBAR
   - Adds .is-scrolled once the page moves (frosted-glass transform).
   - Highlights the nav link of the section currently in view.
   ===================================================================== */

(function initNavbar() {
    const navbar = $("#navbar");
    if (!navbar) return;

    const onScroll = () => {
        navbar.classList.toggle("is-scrolled", window.scrollY > 40);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    // Active-section indication using IntersectionObserver.
    const links = $$(".nav-link");
    const sectionForLink = new Map();

    links.forEach((link) => {
        const id = link.getAttribute("href").slice(1);
        const section = document.getElementById(id);
        if (section) sectionForLink.set(section, link);
    });

    if ("IntersectionObserver" in window && sectionForLink.size) {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    links.forEach((l) => l.classList.remove("is-active"));
                    const active = sectionForLink.get(entry.target);
                    if (active) active.classList.add("is-active");
                });
            },
            // Fire when a section crosses the middle band of the viewport.
            { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
        );
        sectionForLink.forEach((_, section) => observer.observe(section));
    }
})();

/* =====================================================================
   3. MOBILE MENU
   Hamburger toggle with proper ARIA state, close on link click
   and on Escape.
   ===================================================================== */

(function initMobileMenu() {
    const toggle = $("#nav-toggle");
    const menu = $("#nav-menu");
    if (!toggle || !menu) return;

    function setMenu(open) {
        toggle.classList.toggle("is-open", open);
        menu.classList.toggle("is-open", open);
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        if (open) {
            const first = $(".nav-link", menu);
            if (first) first.focus({ preventScroll: true });
        } else {
            toggle.focus({ preventScroll: true });
        }
    }

    toggle.addEventListener("click", () => {
        setMenu(!menu.classList.contains("is-open"));
    });

    // Close the menu after choosing a destination.
    $$(".nav-link", menu).forEach((link) =>
        link.addEventListener("click", () => setMenu(false))
    );

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && menu.classList.contains("is-open")) {
            setMenu(false);
        }
    });
})();

/* =====================================================================
   4. SCROLL REVEAL EFFECTS
   Elements marked with [data-reveal] fade in when they enter the
   viewport. Children of [data-reveal-group] get a staggered delay.
   ===================================================================== */

(function initReveal() {
    const targets = $$("[data-reveal]");
    if (!targets.length) return;

    // Reduced motion or no observer support → show everything at once.
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
        targets.forEach((el) => el.classList.add("is-revealed"));
        return;
    }

    // Stagger children of each reveal group (90ms steps).
    $$("[data-reveal-group]").forEach((group) => {
        $$(":scope > [data-reveal]", group).forEach((child, index) => {
            child.style.setProperty("--rd", index * 90 + "ms");
        });
    });

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-revealed");
                observer.unobserve(entry.target); // reveal only once
            });
        },
        { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );

    targets.forEach((el) => observer.observe(el));
})();

/* =====================================================================
   5. REGION EXPLORER DATA
   Six cultural regions of India, each described across ten dimensions.
   This data powers the interactive explorer — no page reload needed.
   ===================================================================== */

const REGIONS = {
    north: {
        name: "North India",
        img: "assets/img/region-north.png",
        imgAlt: "Stylised illustration of North Indian heritage — the Taj Mahal before Himalayan peaks",
        tagline: "The heartland of classical music, dance and the great Mughal–Indic synthesis.",
        fields: {
            culture: "The heartland of classical arts — where the Ganga meets the Himalaya, where Mughal–Indic synthesis shaped music, poetry and architecture, and where yoga and meditation traditions were born.",
            art: "Mughal and Pahari miniature painting, Thangka art of Ladakh, and the vibrant appliqué and embroidery of the plains.",
            music: "Hindustani classical tradition of ragas and talas, the dhol of Bhangra, the shehnai, and folk ballads of Punjab, Haryana and Uttarakhand.",
            dance: "Kathak (the court dance of Uttar Pradesh and Delhi), Bhangra and Giddha of Punjab, Gaur dance of the Kumaon hills, and the folk theatre of Nautanki.",
            cuisine: "The Punjabi thali of dals, rotis and dahi; kachoris of Lucknow; lassi; and the halwas and malpuas that end every meal.",
            festivals: "Lohri, Baisakhi and the winter harvest fairs of Punjab; Teej in the hill regions; Holi at Mathura and across the plains.",
            clothing: "Kurtas and pajamas, the Patiala of Punjab, phulkari-stitched shawls, and the saffron-and-white of festival seasons.",
            crafts: "Phulkari of Punjab, Chikankari of Lucknow, blue pottery of Agra and Lucknow, and Pashmina weaving of Kashmir.",
            sites: "The Taj Mahal (Agra), Red Fort and Qutub Minar (Delhi), Agra Fort, the Golden Temple (Amritsar), and the Mughal gardens of Shahjahanabad.",
            knowledge: "Yoga traditions of Rishikesh, classical Ayurvedic texts, the folk healing practices of the hill regions, and the handloom and khadi traditions of the plains."
        }
    },
    west: {
        name: "West India",
        img: "assets/img/region-west.png",
        imgAlt: "Stylised illustration of a Rajasthani fort with a camel caravan and kites in the sky",
        tagline: "Forts, desert and long sea trade routes — the land of vivid colour and rhythm.",
        fields: {
            culture: "A land of forts, deserts and long sea trade routes — where Sufi and Jain traditions met the folk life of the desert and the coast, creating some of India's most vivid colour and rhythm.",
            art: "Warli painting of Maharashtra, the Rajput miniature schools of Mewar and Bundi, and the block-printed and tie-dyed textiles of Gujarat and Rajasthan.",
            music: "Rajasthani folk songs (kajri and langar), the Garba music of Gujarat, the Abhang tradition of Maharashtra, and the classical courts of the Marathas.",
            dance: "Garba and Dandiya of Gujarat, Ghoomar of Rajasthan, the fiery Lavani of Maharashtra, and the folk dances of the coastal and desert communities.",
            cuisine: "Rajasthani dal-baati-churma; the Gujarati thali; sev tameta and bhujia; bajra rotla of the desert; modak and malpua of Maharashtra.",
            festivals: "Navratri and its Garba nights (Gujarat); Uttarayan and its kites; Ganesh Chaturthi (Mumbai); Teej; and the harvest songs of Makar Sankranti.",
            clothing: "Ajrak and Bandhani of Gujarat and Sindh; the ghagra-choli of Rajasthan; the Paithani silk sari of Maharashtra; mirror-work cholis of Kutch.",
            crafts: "Ajrak block printing, Bandhani tie-dye, Patola weaving, Dhokra casting of the tribal regions, and camel-leather work of the Thar.",
            sites: "Ellora and Ajanta (Maharashtra), the Dilwara Temples (Rajasthan), Somnath and Dwarka (Gujarat), and the Thar's forts — Jaisalmer, Jodhpur and Chittorgarh.",
            knowledge: "Ajrak's natural dyeing, desert water conservation (johads), Jain principles of non-violence, and the coastal fishing and boat-building knowledge of the sea."
        }
    },
    central: {
        name: "Central India",
        img: "assets/img/region-central.png",
        imgAlt: "Stylised illustration of a Nagara temple spire in a forest with a river",
        tagline: "The forested heartland — where tribal and temple traditions have lived side by side.",
        fields: {
            culture: "The forested heartland of India — the land of the Narmada and Mahanadi rivers, where tribal and temple traditions have lived side by side for centuries, in a landscape of forests, rivers and stone.",
            art: "Gond painting of Madhya Pradesh with its dense lines and mirror motifs, the Bhagat and Pithora traditions, and Bagh painting of the Narmada valley.",
            music: "The folk songs of the tribal communities — Maddi and Jhumar — the nagada drum, and the devotional music of the Narmada's temples.",
            dance: "Devta Naach (the tribal masked dances), the folk dances of Gond and Baiga communities, and the Chhau dance tradition of the eastern belt.",
            cuisine: "Sattu of Madhya Pradesh, pawa (chickpeas) of Chhattisgarh, fafda-jalebi of Indore, and the river fish and rice of the Mahanadi basin.",
            festivals: "The tribal harvest festival (Hali Sara of the Gond community), Nag Panchami, Makar Sankranti, and the fair-season festivals of the river towns.",
            clothing: "The handwoven saris of Madhya Pradesh, tribal silver and bead ornaments, and the simple saris of the Mahanadi valley.",
            crafts: "Chhipa appliqué work, Gond and tribal basketry, Dhokra casting, and the terracotta work of the river towns.",
            sites: "Khajuraho (Madhya Pradesh), the Sanchi Stupa, Bhimbetka rock paintings (among the world's oldest), and the ruined city of Mandu.",
            knowledge: "Medicinal-plant knowledge of the forest communities, the sattu-based diet, terracotta and temple craft traditions, and the river-town seasonal calendar."
        }
    },
    east: {
        name: "East India",
        img: "assets/img/region-east.png",
        imgAlt: "Stylised illustration of an ornate Durga Puja pandal with a river boat and lotus",
        tagline: "The land of rivers, rice and fine arts — where faith, literature and craft meet.",
        fields: {
            culture: "The land of rivers, rice and the monsoon — where tribal, Vaishnava and Tantric traditions met in the fertile plains, creating some of India's most refined art and literature.",
            art: "Madhubani (Mithila) painting of Bihar, Kalighat painting of Bengal, Pattachitra scroll painting of Odisha, and the terracotta of Bishnupur.",
            music: "The songs of the Baul mystics, Rabindra Sangeet of Bengal, the Odissi and Mallahari traditions of Odisha, and the folk music of the Mahanadi.",
            dance: "Odissi (one of the oldest classical dance forms), the Chhau mask dance of the tribal belt, the Raslila of Dwarka, and the folk dances of Bengal.",
            cuisine: "Litti-chokha of Bihar, the mahaprasad of Odisha, makhana (foxnuts) of Jharkhand, and the fish-and-rice curries of Bengal.",
            festivals: "Durga Puja of Bengal, Chilhosa of Odisha, Saraswati Puja, Raksha Bandhan, and the Mughal Erai of the Sundarbans.",
            clothing: "The Baluchari and Tant saris of Bengal, the Sambalpuri sari of Odisha, and the silk saris of the river towns.",
            crafts: "Pattachitra scrolls, Chhau mask making, terracotta art of Bishnupur, Dhokra casting, and the cane work of the Sundarbans.",
            sites: "The Konark Sun Temple, the Lingaraja Temple of Bhubaneswar, Bodh Gaya, the terracotta temples of Bishnupur, and the Sundarbans.",
            knowledge: "Rice and river farming of the plains, makhana (foxnut) cultivation of Jharkhand, traditional boat building of Bengal, and the tidal knowledge of the Sundarbans."
        }
    },
    south: {
        name: "South India",
        img: "assets/img/region-south.png",
        imgAlt: "Stylised illustration of a South Indian gopuram with a snake-boat race on the backwaters",
        tagline: "Classical art, temple towns and monsoon harvests — the Dravidian tradition.",
        fields: {
            culture: "A land of classical art, temple towns and monsoon harvests — where the Dravidian tradition produced the gopuram, the Carnatic concert and the banana-leaf feast, with the temple at the centre of community life.",
            art: "Tanjore painting of Tamil Nadu, Kalamkari of Andhra Pradesh, Channapatna toy craft of Karnataka, and the mural art of the great temples.",
            music: "The Carnatic classical tradition — raga-tala system and the violin-veena-mridangam ensemble — along with the folk songs of the coastal and hill regions.",
            dance: "Bharatanatyam of Tamil Nadu, Kathakali and Mohiniyattam of Kerala, and the Kodiyettam (flag dance) of the temples.",
            cuisine: "The dosa, idli and vada of the South Indian thali; Kerala's appam; the sadya (banana-leaf feast); filter coffee; and the coastal rice-and-fish of the coast.",
            festivals: "Pongal of Tamil Nadu, Onam of Kerala, Thrissur Pooram, Ugadi of Karnataka and Andhra, and the temple festivals of the year.",
            clothing: "The Kanjeevaram silk sari, Kerala's kasavu, the Pochampally sari of Telangana, and Mysore silk.",
            crafts: "Kalamkari painting, the brass-lamp and bell-metal (kansa) craft, Channapatna toys, and kasavu weaving.",
            sites: "Hampi (Vijayanagara), the Brihadeeswarar Temple of Thanjavur, the Meenakshi Temple of Madurai, and the shore temples of Mahabalipuram.",
            knowledge: "Ayurvedic traditions and their classical texts, coir and backwater fishing of Kerala, monsoon water harvesting of the temple towns, and heirloom rice varieties of the paddies."
        }
    },
    northeast: {
        name: "Northeast India",
        img: "assets/img/region-northeast.png",
        imgAlt: "Stylised illustration of a Bihu dancer with tea gardens, an elephant and a bamboo house",
        tagline: "Hills, tea and tribal kingdoms — a hundred communities, one proud identity.",
        fields: {
            culture: "The land of hills, tea and tribal kingdoms — a region of more than a hundred communities, where bamboo and river are at the centre of life, and where folk art is the language of the village.",
            art: "Tribal textiles (Naga hornbill motifs, Mishing patterns), bamboo craft art, and the scroll paintings of the hill communities.",
            music: "The Bihu music of Assam, Naga flute and the khol drum, Meitei music of Manipur, and the folk songs of the hill valleys.",
            dance: "The Bihu dance, Thangtal of Manipur, Sengkur of the Naga communities, and the pung drum dances of the hills.",
            cuisine: "The pitha (rice cakes) of Assam, bamboo-shoot cuisine, xac beige (fermented eel), and the tea culture of the hill valleys.",
            festivals: "Rongali (Bohag) Bihu — the new year; Losar of the Tibetan Buddhist communities; the Hornbill Festival of Shillong; and the harvest fairs of the hills.",
            clothing: "The mekhela chador of Assam, the Naga angri and shoulder bag, the Mizo lui ka, and the hill handloom textiles.",
            crafts: "Bamboo and cane crafts, mekhela chador weaving, tribal silver work, and the handloom textiles of the hills.",
            sites: "Kaziranga National Park (UNESCO natural heritage), Majuli (river island and its monasteries), Kangla Fort, and the sacred groves of the Khasi hills.",
            knowledge: "Bamboo and cane craft traditions, tea cultivation, paddy cultivation in flooded fields, and the indigenous conservation of sacred groves."
        }
    }
};

/** Field order + labels + icons for the region detail panel. */
const REGION_FIELD_LABELS = [
    ["culture",   "Culture",              "🪷"],
    ["art",       "Traditional Art",      "🎨"],
    ["music",     "Music",                "🎵"],
    ["dance",     "Dance",                "💃"],
    ["cuisine",   "Cuisine",              "🍲"],
    ["festivals", "Festivals",            "🎉"],
    ["clothing",  "Clothing",             "👘"],
    ["crafts",    "Crafts",               "🧵"],
    ["sites",     "Heritage Sites",       "🏛️"],
    ["knowledge", "Traditional Knowledge","📜"]
];

/* =====================================================================
   6. REGION EXPLORER RENDERING
   Controls the interactive regional heritage explorer.
   ===================================================================== */

(function initRegionExplorer() {
    const panel = $("#region-panel");
    const regionImage = $("#region-image");
    const regionName = $("#region-name");
    const regionTagline = $("#region-tagline");
    const regionFields = $("#region-fields");

    if (!panel || !regionFields) return;

    /** Fill the detail panel for a given region id. */
    function applyRegion(id) {
        const region = REGIONS[id];
        if (!region) return;

        // Update button + map states (single source of truth: the id).
        $$(".region-btn").forEach((btn) => {
            const selected = btn.dataset.region === id;
            btn.classList.toggle("is-selected", selected);
            btn.setAttribute("aria-pressed", String(selected));
        });
        $$(".map-region").forEach((shape) => {
            shape.classList.toggle("is-selected", shape.dataset.region === id);
        });

        regionImage.src = region.img;
        regionImage.alt = region.imgAlt;
        regionName.textContent = region.name;
        regionTagline.textContent = region.tagline;

        // Rebuild the ten cultural fields.
        regionFields.innerHTML = "";
        REGION_FIELD_LABELS.forEach(([key, label, icon]) => {
            const dt = document.createElement("dt");
            dt.innerHTML = '<span aria-hidden="true"></span> ';
            dt.firstChild.nodeValue = icon;
            dt.appendChild(document.createTextNode(label));

            const dd = document.createElement("dd");
            dd.textContent = region.fields[key];

            regionFields.append(dt, dd);
        });
    }

    /** Switch regions with a short fade for a smooth feel. */
    function selectRegion(id) {
        if (!REGIONS[id]) return;
        if (prefersReducedMotion) {
            applyRegion(id);
            return;
        }
        panel.classList.add("is-fading");
        setTimeout(() => {
            applyRegion(id);
            panel.classList.remove("is-fading");
        }, 180);
    }

    // Wire up both the buttons and the map shapes.
    $$("[data-region]").forEach((el) => {
        el.addEventListener("click", () => selectRegion(el.dataset.region));
        // Map shapes: keyboard support (Enter / Space).
        if (el.classList.contains("map-region")) {
            el.setAttribute("tabindex", "0");
            el.setAttribute("role", "button");
            el.setAttribute("aria-label", "Select " + (REGIONS[el.dataset.region] ? REGIONS[el.dataset.region].name : el.dataset.region));
            el.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectRegion(el.dataset.region);
                }
            });
        }
    });

    // First paint (ensures the panel matches the default North selection).
    applyRegion("north");
})();

/* =====================================================================
   7. FESTIVAL EXPLORER DATA
   Ten festivals across India. Each festival carries its significance,
   region, traditions, food, clothing, art and celebrations.
   ===================================================================== */

const FESTIVALS = {
    diwali: {
        name: "Diwali",
        img: "assets/img/fest-diwali.png",
        imgAlt: "Rows of glowing diya lamps and a marigold rangoli during Diwali",
        region: "Celebrated across India, with regional names and customs",
        fields: {
            significance: "The festival of lights, celebrating the inner light that conquers darkness. In the north it is associated with Lord Rama's homecoming; in the south, with Krishna, Durga or Lakshmi, according to tradition.",
            traditions: "Homes are cleaned and decorated with clay diyas, rangoli and marigolds. Families offer prayers to Goddess Lakshmi, light lamps at windows and doors, and share sweets with neighbours.",
            food: "Mithai — laddoo, barfi, gulab jamun — along with halwa, chakli and other regional sweets, prepared in large quantities for sharing.",
            clothing: "New festive wear — silk and printed saris, kurtas and churidar sets; a day meant to be dressed for.",
            art: "Rangoli and kolam at doorways, diya arrangements, henna (mehndi), and lanterns and fireworks in many parts of the country.",
            celebrations: "Often a sequence of five days — Dhanteras, Chhoti Diwali, main Diwali, Govardhan Puja and Bhai Dooj — each with its own small ritual."
        }
    },
    holi: {
        name: "Holi",
        img: "assets/img/fest-holi.png",
        imgAlt: "People celebrating Holi with clouds of colourful powder",
        region: "All India — especially Uttar Pradesh, Maharashtra and the Mathura–Vrindavan region",
        fields: {
            significance: "The arrival of spring and the victory of good over evil, told through the legend of Holika and Prahlada; a day when social boundaries quietly dissolve.",
            traditions: "Holika Dahan bonfires the night before; the next day, people play with coloured powder (gulal) and water, sing Fag songs, and embrace even strangers.",
            food: "Gujiya (sweet dumplings), malai, thandai, and fresh spring fruits.",
            clothing: "White clothes, chosen so the colours can take hold; a festival that ends with everyone wearing the same rainbow.",
            art: "The colours themselves are the art — natural gulal, henna, face designs, and folk song and dance.",
            celebrations: "Cities like Mathura, Vrindavan and Barsana draw visitors from across the country; the celebration moves from the streets into homes."
        }
    },
    durgapuja: {
        name: "Durga Puja",
        img: "assets/img/fest-durgapuja.png",
        imgAlt: "An ornate Durga Puja pandal at dusk with a glowing idol of the Goddess",
        region: "West Bengal, Odisha, Jharkhand and Assam — and Hindu communities across India",
        fields: {
            significance: "The annual celebration of Goddess Durga's victory over the buffalo demon Mahishasura, crowning the ten days of Navratri and Vijayadashami.",
            traditions: "Cities build intricate pandals — temporary art installations — where the clay idol is worshipped daily for four days; cultural programmes and adda (conversation) fill the evenings, before the idol is immersed in a river.",
            food: "Festival bhog — labra and seasonal vegetables, mishti doi (sweet curd) and traditional sweets; a festival of food as much as faith.",
            clothing: "Women often dress in red-and-white saris — the shakha-pola colour associated with the Goddess.",
            art: "Pandal design is a celebrated art form — architecture, light and community effort; the immersion procession is a festival of the whole city.",
            celebrations: "Ten days of Navratri culminate in the five days of Durga Puja; the Kolkata edition has been recognised by UNESCO as Intangible Cultural Heritage."
        }
    },
    pongal: {
        name: "Pongal",
        img: "assets/img/fest-pongal.png",
        imgAlt: "A brass pot of sweet pongal on a stove with a decorated bull during Pongal",
        region: "Tamil Nadu",
        fields: {
            significance: "A four-day harvest festival thanking the Sun God (Surya) and nature; 'Pongal' is both the festival and the boiled rice dish that symbolises abundance.",
            traditions: "The main day begins with a sunrise bath, cooking sweet pongal in a clay pot that is allowed to overflow — greeted with the cry 'Pongalo Pongal!' — and kolam decorations. The following day honours the cattle (Mattu Pongal).",
            food: "Sweet pongal (rice and jaggery), ven pongal, sakkarai pongal, and seasonal harvest dishes.",
            clothing: "New festive wear for the whole family; the day begins in the morning sun.",
            art: "Kolam at the door, decorated cattle, and village music.",
            celebrations: "Four days — Bhogi, Thai Pongal, Mattu Pongal, and Kaanum Pongal (a day for family visits)."
        }
    },
    onam: {
        name: "Onam",
        img: "assets/img/fest-onam.png",
        imgAlt: "A pookalam floral carpet and a banana-leaf sadya feast during Onam",
        region: "Kerala",
        fields: {
            significance: "The ten-day harvest festival celebrating the legendary King Mahabali — a just ruler who, legend says, returns to Kerala every Onam.",
            traditions: "Each day the pookalam — a giant flower carpet — grows larger; the centrepiece is the Onasadya, a grand vegetarian feast on a banana leaf; snake-boat races (vallam kali) fill the backwaters.",
            food: "Onasadya — dozens of dishes served on a banana leaf: avial, thoran, ochu, payasam and more.",
            clothing: "Kasavu — white or off-white with a golden border — the sari of women and the mundu of men.",
            art: "Pookalam design, the kummetti clay-doll craft, and the music of the boat races.",
            celebrations: "Ten days, with Thiruvonam as the great feast day; the festival closes with the spectacular snake-boat races."
        }
    },
    baisakhi: {
        name: "Baisakhi",
        img: "assets/img/fest-baisakhi.png",
        imgAlt: "Golden wheat fields, a dhol player and a turbaned farmer during Baisakhi",
        region: "Punjab (and Sikh communities worldwide)",
        fields: {
            significance: "The new year of Punjab and the harvest festival of the rabi crop; in 1699 it was also the day Guru Gobind Singh founded the Khalsa at Anandpur.",
            traditions: "Gurdwara processions with the Nagar Kirtan, a day of gratitude and community service; the evening brings bhangra and dhol in the villages.",
            food: "Langar (community meals), sarson da saag with makki di roti, lassi, and fresh wheat dishes.",
            clothing: "The dastar (turban) for men, phulkari shawls — a festival of colour.",
            art: "Bhangra and Giddha dance, dhol and tumbi music, and folk poetry (boliyan).",
            celebrations: "A day of procession, worship, harvest thanksgiving, and dancing into the night."
        }
    },
    navratri: {
        name: "Navratri",
        img: "assets/img/fest-navratri.png",
        imgAlt: "Women dancing Garba in colourful chaniya choli with dandiya sticks at night",
        region: "All India — nine nights of the Goddess; especially Gujarat, Rajasthan and the South",
        fields: {
            significance: "The nine nights (Navaratri) honouring the divine feminine in her many forms — from Durga to Lakshmi to Saraswati — leading into Vijayadashami.",
            traditions: "Garba and Dandiya nights in Gujarat; fasting and special prayers in the north; Golu (doll displays) and Saraswati worship in the south; Ramlila performances.",
            food: "Sattvic fasting thalis in the north, undhiyu and bhajis in Gujarat; feasts that change with the region.",
            clothing: "Chaniya choli (Gujarat) and ghagra (Rajasthan) — the nights celebrate the festive sari and mirror-work craft.",
            art: "Garba's circular dance, bangle and mirror craft, and the Golu doll-making of the south.",
            celebrations: "Nine nights of dance and devotion, culminating on the tenth day with Durga Puja or the immersion of clay idols."
        }
    },
    eid: {
        name: "Eid",
        img: "assets/img/fest-eid.png",
        imgAlt: "A festive prayer ground at dawn with lights, a gift box and a crescent moon",
        region: "Muslim communities across India — Eid-ul-Fitr after Ramadan, and Bakrid in the month of Dhul Hijjah",
        fields: {
            significance: "Eid-ul-Fitr marks the end of the fasting month of Ramadan with gratitude and community; Eid-ul-Adha (Bakrid) commemorates the willingness to sacrifice of Ibrahim (Abraham).",
            traditions: "Special morning prayers (Eid namaz) in open grounds or mosques, the greeting 'Eid Mubarak', eidi gifts for children, visits to family, and community feasts.",
            food: "Biryani, kebabs, sheermal, sevaiyan and other sweets — a day when the kitchen becomes a feast.",
            clothing: "New or freshly pressed clothes for prayer — kurta-pajamas, kameez, and the festive wear of every family.",
            art: "Eidgah and home decorations, the exchange of sweets, and the warmth of the community table.",
            celebrations: "A morning of prayer and greeting, a day of family, and a festival of giving — the first food of the day for those who fasted."
        }
    },
    christmas: {
        name: "Christmas",
        img: "assets/img/fest-christmas.png",
        imgAlt: "A decorated Indian church with a nativity scene and star lights in the evening",
        region: "Christian communities across India — with distinct local traditions in Goa, Kerala, the Northeast and the North",
        fields: {
            significance: "The celebration of the birth of Jesus Christ — a season of light, family and charity that has been part of the Indian calendar for centuries.",
            traditions: "Nativity scenes in churches and homes, star lights, carols, and midnight mass; in Goa the tradition of Misa da Galo (the rooster mass); in the North, the Guddi (cradle) is taken in procession.",
            food: "Regional feasts — vindaloo and bebinca of Goa, roast chicken of Kerala, fruit cake, plum pudding and wafers.",
            clothing: "Festive family wear; red and green accents in the decoration of homes and streets.",
            art: "Nativity artwork, handmade decorations, carol singing, and the lighting of the Christmas star.",
            celebrations: "A season of giving — family, charity and light — celebrated on 25 December and in the weeks around it."
        }
    },
    bihu: {
        name: "Bihu",
        img: "assets/img/fest-bihu.png",
        imgAlt: "Bihu dancers in mekhela chador with dhol and gungura in Assam's fields",
        region: "Assam",
        fields: {
            significance: "Assam's new-year and harvest celebration, told through three Bihu festivals — Rongali (Bohag) in spring, Kongali in autumn, and Magh in winter.",
            traditions: "The spring Bihu brings cleaning of the home, lighting of diyas, the making of pitha (rice cakes), and nights of Bihu song and dance in the villages.",
            food: "Pitha in many forms, xac beige (fermented eel), pork with bamboo shoots, and khorika.",
            clothing: "Mekhela chador and the daura-puan — the traditional dress of Assam.",
            art: "The Bihu dance and its music — dhol, gungura and pemasa — the heartbeat of the festival.",
            celebrations: "Rongali Bihu is the great one — a three-day burst of dance, music and feasting as the new year begins."
        }
    }
};

/** Field order + labels + icons for the festival panel. */
const FEST_FIELD_LABELS = [
    ["significance", "Significance",   "✨"],
    ["traditions",   "Traditions",     "🎭"],
    ["food",         "Food",           "🍽️"],
    ["clothing",     "Clothing",       "👘"],
    ["art",          "Art",            "🎨"],
    ["celebrations", "Celebrations",   "🎉"]
];

/* =====================================================================
   8. FESTIVAL EXPLORER RENDERING
   Controls the festival selector and its detail panel.
   ===================================================================== */

(function initFestivalExplorer() {
    const panel = $("#fest-panel");
    const festImage = $("#fest-image");
    const festName = $("#fest-name");
    const festRegion = $("#fest-region");
    const festFields = $("#fest-fields");

    if (!panel || !festFields) return;

    /** Fill the festival detail panel for a given festival id. */
    function applyFestival(id) {
        const fest = FESTIVALS[id];
        if (!fest) return;

        $$(".fest-chip").forEach((chip) => {
            const selected = chip.dataset.fest === id;
            chip.classList.toggle("is-selected", selected);
            chip.setAttribute("aria-pressed", String(selected));
        });

        festImage.src = fest.img;
        festImage.alt = fest.imgAlt;
        festName.textContent = fest.name;
        festRegion.textContent = "📍 " + fest.region;

        festFields.innerHTML = "";
        FEST_FIELD_LABELS.forEach(([key, label, icon]) => {
            const dt = document.createElement("dt");
            dt.innerHTML = '<span aria-hidden="true"></span> ';
            dt.firstChild.nodeValue = icon;
            dt.appendChild(document.createTextNode(label));

            const dd = document.createElement("dd");
            dd.textContent = fest.fields[key];

            festFields.append(dt, dd);
        });
    }

    function selectFestival(id) {
        if (!FESTIVALS[id]) return;
        if (prefersReducedMotion) {
            applyFestival(id);
            return;
        }
        panel.classList.add("is-fading");
        setTimeout(() => {
            applyFestival(id);
            panel.classList.remove("is-fading");
        }, 180);
    }

    $$(".fest-chip").forEach((chip) => {
        chip.addEventListener("click", () => selectFestival(chip.dataset.fest));
    });
})();

/* =====================================================================
   9. HERITAGE QUIZ
   "How Well Do You Know India's Heritage?"
   Multiple choice with score, progress, feedback and restart —
   implemented entirely in Vanilla JavaScript.
   ===================================================================== */

const QUIZ = [
    {
        q: "Which classical dance form is traditionally associated with the temples of Tamil Nadu and the South?",
        options: ["Kathak", "Bharatanatyam", "Odissi", "Kathakali"],
        answer: 1,
        note: "Bharatanatyam is one of India's oldest classical dance traditions, traditionally linked with South Indian temples."
    },
    {
        q: "Madhubani painting, one of India's most famous folk arts, originates from which state?",
        options: ["West Bengal", "Rajasthan", "Bihar", "Maharashtra"],
        answer: 2,
        note: "Madhubani (Mithila) painting comes from the Mithila region of Bihar, traditionally painted by village women."
    },
    {
        q: "The Warli painting tradition belongs to which Indian state?",
        options: ["Gujarat", "Odisha", "Assam", "Maharashtra"],
        answer: 3,
        note: "Warli is the tribal painting tradition of the Warli people of Maharashtra, drawn in white rice paste on earth-coloured walls."
    },
    {
        q: "The harvest festival 'Pongal' is celebrated over four days in which state?",
        options: ["Karnataka", "Kerala", "Tamil Nadu", "Andhra Pradesh"],
        answer: 2,
        note: "Pongal is the Tamil harvest festival, named after the boiled rice dish that symbolises abundance."
    },
    {
        q: "Chikankari — delicate white-on-white embroidery — is famously associated with which city?",
        options: ["Varanasi", "Jaipur", "Lucknow", "Agra"],
        answer: 2,
        note: "Chikankari, fine white threadwork on cotton and muslin, has been made in Lucknow for centuries."
    },
    {
        q: "Which of these monuments is a UNESCO World Heritage Site located in Karnataka?",
        options: ["Hampi", "Khajuraho", "Konark", "Sanchi"],
        answer: 0,
        note: "Hampi, the ancient capital of the Vijayanagara Empire, has been a UNESCO World Heritage Site since 1986."
    },
    {
        q: "The 'Pattachitra' style of scroll painting is traditionally from which state?",
        options: ["Rajasthan", "Odisha", "Punjab", "Kerala"],
        answer: 1,
        note: "Pattachitra — the scroll painting of mythological scenes — is a classic art of Odisha."
    },
    {
        q: "Which classical music tradition is the centrepiece of South Indian concert culture?",
        options: ["Hindustani", "Sufiana", "Carnatic", "Baul"],
        answer: 2,
        note: "Carnatic music, with its raga-tala system and violin-veena-mridangam ensemble, is the classical tradition of the South."
    },
    {
        q: "Onam, the great harvest festival of Kerala, celebrates the homecoming of which legendary king?",
        options: ["King Harshavardhana", "King Mahabali", "King Raja Rao", "King Yudhishthira"],
        answer: 1,
        note: "Onam celebrates the legendary, beloved King Mahabali who, tradition says, returns to Kerala every year for the festival."
    },
    {
        q: "The Dhokra craft is an example of which ancient technique?",
        options: ["Natural dyeing", "Lost-wax metal casting", "Block printing", "Coil pottery"],
        answer: 1,
        note: "Dhokra is the traditional lost-wax (cire perdue) metal casting craft, still alive in tribal regions of central and eastern India."
    }
];

const QUIZ_STATE = { index: 0, score: 0, locked: false };
const QUIZ_KEYS = ["A", "B", "C", "D"];

(function initQuiz() {
    const countEl = $("#quiz-count");
    const progressEl = $("#quiz-progress");
    const progressFill = $("#quiz-progress-fill");
    const questionEl = $("#quiz-question");
    const optionsEl = $("#quiz-options");
    const feedbackEl = $("#quiz-feedback");
    const nextBtn = $("#quiz-next");
    const bodyEl = $("#quiz-body");
    const resultEl = $("#quiz-result");
    const resultEmoji = $("#quiz-result-emoji");
    const resultTitle = $("#quiz-result-title");
    const resultText = $("#quiz-result-text");
    const restartBtn = $("#quiz-restart");

    if (!questionEl || !optionsEl) return;

    /** Render the current question with fresh option buttons. */
    function renderQuestion() {
        const item = QUIZ[QUIZ_STATE.index];
        QUIZ_STATE.locked = false;

        countEl.textContent = "Question " + (QUIZ_STATE.index + 1) + " of " + QUIZ.length;
        progressEl.setAttribute("aria-valuenow", String(QUIZ_STATE.index + 1));
        progressFill.style.width = ((QUIZ_STATE.index + 1) / QUIZ.length) * 100 + "%";

        questionEl.textContent = item.q;
        feedbackEl.textContent = "";
        feedbackEl.classList.remove("is-good", "is-bad");
        nextBtn.hidden = true;

        optionsEl.innerHTML = "";
        item.options.forEach((text, i) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "quiz-option";
            btn.setAttribute("data-index", String(i));
            btn.innerHTML =
                '<span class="quiz-option__key" aria-hidden="true">' +
                QUIZ_KEYS[i] +
                '</span><span class="quiz-option__text"></span>';
            btn.querySelector(".quiz-option__text").textContent = text;
            btn.addEventListener("click", () => chooseAnswer(i, btn));
            optionsEl.appendChild(btn);
        });
    }

    /** Handle an answer choice: lock, mark, explain, enable Next. */
    function chooseAnswer(chosen, btn) {
        if (QUIZ_STATE.locked) return;
        QUIZ_STATE.locked = true;

        const item = QUIZ[QUIZ_STATE.index];
        const options = $$(".quiz-option", optionsEl);
        options.forEach((option) => (option.disabled = true));
        options[item.answer].classList.add("is-correct");

        if (chosen === item.answer) {
            QUIZ_STATE.score += 1;
            feedbackEl.textContent = "✓ Correct! " + item.note;
            feedbackEl.classList.add("is-good");
        } else {
            btn.classList.add("is-wrong");
            feedbackEl.textContent = "✗ Not quite — the answer is " +
                item.options[item.answer] + ". " + item.note;
            feedbackEl.classList.add("is-bad");
        }

        nextBtn.textContent =
            QUIZ_STATE.index === QUIZ.length - 1 ? "See my result" : "Next question";
        nextBtn.hidden = false;
        nextBtn.focus({ preventScroll: true });
    }

    /** Advance to the next question or show the final result. */
    function next() {
        QUIZ_STATE.index += 1;
        if (QUIZ_STATE.index < QUIZ.length) {
            renderQuestion();
        } else {
            showResult();
        }
    }

    /** Show the final score with a friendly, encouraging message. */
    function showResult() {
        bodyEl.hidden = true;
        resultEl.hidden = false;
        progressFill.style.width = "100%";

        const s = QUIZ_STATE.score;
        const total = QUIZ.length;
        let emoji, title, text;

        if (s === total) {
            emoji = "🏆";
            title = "You are a Heritage Scholar!";
            text = "A perfect score — " + s + " of " + total +
                ". India's living heritage is clearly a subject you hold dear.";
        } else if (s >= 7) {
            emoji = "🌟";
            title = "A True Cultural Explorer";
            text = "You scored " + s + " of " + total +
                ". You know a great deal about India's heritage — keep wandering the museum.";
        } else if (s >= 5) {
            emoji = "📖";
            title = "A Curious Learner";
            text = "You scored " + s + " of " + total +
                ". A fine start — scroll back through the stories and try again.";
        } else {
            emoji = "🪔";
            title = "Every Journey Begins with One Light";
            text = "You scored " + s + " of " + total +
                ". That's perfectly alright — explore the sections above, and come back to the quiz.";
        }

        resultEmoji.textContent = emoji;
        resultTitle.textContent = title;
        resultText.textContent = text;
        restartBtn.focus({ preventScroll: true });
    }

    /** Reset and restart the quiz from question one. */
    function restart() {
        QUIZ_STATE.index = 0;
        QUIZ_STATE.score = 0;
        resultEl.hidden = true;
        bodyEl.hidden = false;
        renderQuestion();
    }

    nextBtn.addEventListener("click", next);
    restartBtn.addEventListener("click", restart);

    renderQuestion();
})();

/* =====================================================================
   10. HERITAGE AI — CHATBOX UI
   The "Heritage AI" pill button (bottom-right) opens the cultural
   chat box.
   - No artificial message limits are imposed here: availability is
     governed entirely by the Gemini API's own rate and quota limits.
   - User input is ALWAYS inserted via textContent (never innerHTML),
     so the chat is safe against markup injection.
   ===================================================================== */

const AI_STATE = { open: false, busy: false, greeted: false, history: [] };

(function initHeritageAI() {
    const fab = $("#ai-toggle");
    const chat = $("#ai-chat");
    const closeBtn = $("#ai-close");
    const messages = $("#ai-messages");
    const chips = $("#ai-chips");
    const form = $("#ai-form");
    const input = $("#ai-input");

    if (!fab || !chat) return;

    /** Add a message bubble. role: "ai" | "user". */
    function addMessage(role, text) {
        const bubble = document.createElement("div");
        bubble.className = "ai-msg ai-msg--" + role;
        bubble.textContent = text; // safe: plain text only
        messages.appendChild(bubble);
        messages.scrollTop = messages.scrollHeight;
        return bubble;
    }

    /** Show / hide the animated "thinking" indicator. */
    function showTyping() {
        const bubble = document.createElement("div");
        bubble.className = "ai-msg ai-msg--ai ai-msg--typing";
        bubble.setAttribute("aria-label", "Heritage AI is thinking");
        bubble.innerHTML =
            '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
        messages.appendChild(bubble);
        messages.scrollTop = messages.scrollHeight;
        return bubble;
    }

    function hideTyping(bubble) {
        if (bubble && bubble.parentNode) bubble.remove();
    }

    /** Open / close the chat box with focus management. */
    function setChat(open) {
        AI_STATE.open = open;
        chat.classList.toggle("is-open", open);
        fab.setAttribute("aria-expanded", String(open));
        fab.setAttribute("aria-label", open ? "Close Heritage AI Chat" : "Open Heritage AI Chat");
        if (open) {
            if (!AI_STATE.greeted) {
                AI_STATE.greeted = true;
                addMessage(
                    "ai",
                    "Namaste 🙏 I am Heritage AI — your guide through India's rich cultural heritage. " +
                    "Ask me about a dance form, a craft, a festival or a monument, or tap one of the suggestions below."
                );
            }
            // Small delay so focus lands after the open transition.
            setTimeout(() => input.focus({ preventScroll: true }), prefersReducedMotion ? 0 : 250);
        } else {
            fab.focus({ preventScroll: true });
        }
    }

    fab.addEventListener("click", () => setChat(!AI_STATE.open));
    closeBtn.addEventListener("click", () => setChat(false));

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && AI_STATE.open) setChat(false);
    });

    // Suggested questions.
    $$("#ai-chips button").forEach((chip) => {
        chip.addEventListener("click", () => {
            sendQuestion(chip.dataset.q);
        });
    });

    // Text input (Enter submits via the form).
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const text = input.value;
        input.value = "";
        sendQuestion(text);
    });

    /**
     * Send one user question and render the answer.
     * Demo mode: offline curated answers (default).
     * Live mode: via the secure Gemini endpoint (see section 12).
     * NOTE: there is deliberately NO client-side message cap — the
     * Gemini project's own rate limits determine availability.
     */
    async function sendQuestion(text) {
        text = (text || "").trim();
        if (!text || AI_STATE.busy) return;

        // Once the user gives a command, remove the suggested
        // questions so only the conversation is displayed.
        chips.classList.add("is-hidden");

        AI_STATE.busy = true;
        addMessage("user", text);
        AI_STATE.history.push({ role: "user", content: text });

        const typing = showTyping();
        let reply;

        try {
            if (geminiMode() === "demo") {
                // Demo mode: a natural pause, then a curated answer.
                await wait(prefersReducedMotion ? 200 : 800 + Math.random() * 700);
                reply = demoAnswer(text);
            } else {
                // Live mode (secure endpoint or direct Gemini API):
                // keep the recent context window short.
                reply = await callGemini(AI_STATE.history.slice(-10));
            }
            hideTyping(typing);
            addMessage("ai", reply);
            AI_STATE.history.push({ role: "model", content: reply });
        } catch (err) {
            hideTyping(typing);
            if (err && err.code === "RATE_LIMIT") {
                // The exact graceful message required for quota errors.
                addMessage(
                    "ai",
                    "Heritage AI has temporarily reached its Gemini API usage limit. Please try again later."
                );
            } else {
                addMessage(
                    "ai",
                    "I could not reach my heritage knowledge right now. Please try again in a moment."
                );
            }
        } finally {
            AI_STATE.busy = false;
            // Once the answer is displayed, show the suggested-question
            // menu again so the visitor can keep exploring.
            chips.classList.remove("is-hidden");
            input.focus({ preventScroll: true });
        }
    }
})();

/* =====================================================================
   11. HERITAGE AI — DEMO MODE ANSWERS
   Used when no secure API endpoint is configured, so the prototype
   works perfectly in an offline SIH demo WITHOUT any API key.
   Answers are curated, factual and cultural in tone.
   ===================================================================== */

const DEMO_ANSWERS = [
    {
        keys: ["bharatanatyam", "bharatnatyam"],
        text: "Bharatanatyam is one of India's oldest classical dance forms, traditionally associated with the temples of Tamil Nadu and the South. Its name is often read as 'bhara' (meaning) + 'natya' (performance) — storytelling through movement. The dance is built on tataka (rhythmic footwork) and sthana (sculptural postures) that mirror the carvings of temple pillars, while abhinaya — expression — carries the story. In the 20th century, artists such as Rukmini Devi Arundale brought it from the temple courtyard to the concert stage, and today it is performed across the world."
    },
    {
        keys: ["madhubani", "mithila"],
        text: "Madhubani painting — also called Mithila painting — comes from the Madhubani region of Bihar. Traditionally painted by women on freshly plastered walls with twigs and natural dyes for weddings and festivals, it is instantly recognisable: dense fine black lines, vivid natural colours, and a rule that no space is ever left empty. Peacocks, lotus ponds, fish, the sun and trees fill every inch. It has been recognised on UNESCO's Intangible Cultural Heritage list, and today's village women are celebrated as artists in their own right."
    },
    {
        keys: ["hampi", "vijayanagara"],
        text: "Hampi, in Karnataka, was the capital of the Vijayanagara Empire from the 14th to the 17th century — one of the greatest cities of the pre-modern world. Imagine a landscape of giant red granite boulders holding temples, market squares, royal pavilions and water tanks. The stone chariot of Vittleswara, the Lotus Mahal and the steps of the Hemakuta Hill are all here, and the Virupaksha Temple is still alive with festival processions. It has been a UNESCO World Heritage Site since 1986."
    },
    {
        keys: ["pongal"],
        text: "Pongal is Tamil Nadu's harvest festival, celebrated over four days in mid-January: Bhogi, Thai Pongal, Mattu Pongal and Kaanum Pongal. The main day thanks the Sun God (Surya) for the harvest — the sweet rice-and-jaggery pudding 'pongal' is cooked in a clay pot and allowed to overflow, greeted with the joyful cry 'Pongalo Pongal!' — a symbol of abundance and prosperity. Cattle are honoured on Mattu Pongal, and homes are decorated with kolams."
    },
    {
        keys: ["folk", "folk traditions", "folk music", "folk dance"],
        text: "India's folk traditions are its living memory — music, dance, theatre and painting passed down by communities rather than institutions. Think of the Baul mystics singing in Bengal, the Lavani of Maharashtra, the Bihu dance and gungura of Assam, the Garba circles of Gujarat, the Nautanki street theatres of the north, and the white Warli paintings of the Maharashtra forests. Each region keeps its own palette, its own rhythm — together they form the folk layer under the classical arts."
    },
    {
        keys: ["rajasthan", "rajdhan"],
        text: "Rajasthan's traditional crafts are as varied as its deserts and forts: Ajrak block-printing and Bandhani tie-dye (with deep Sindh connections), the famous blue pottery of Jaipur, camel-leather work, Meenakari enamelware, and the miniature painting schools of Mewar and Kota. Add the mirror work of Marwar and the embroidery of the Thar villages, and you have a craft tradition that is still very much alive in the hands of today's artisans."
    },
    {
        keys: ["taj mahal", "taj"],
        text: "The Taj Mahal, on the banks of the Yamuna in Agra, was built by Emperor Shah Jahan in memory of his wife Mumtaz Mahal, whose grave it holds. Completed around 1653, it is an ivory-white marble dome and garden — the high point of Mughal architecture — and a UNESCO World Heritage Site as well as one of the New Seven Wonders of the World. Its reflection in the long pool at sunrise is one of the most photographed images in India."
    },
    {
        keys: ["diwali"],
        text: "Diwali, the festival of lights, is celebrated across India with regional variations. In the north it is linked to Lord Rama's homecoming to Ayodhya; in the south it honours Krishna, Lakshmi or Durga, according to tradition. Homes are cleaned and lit with clay diyas, rangoli are spread at the doors, families worship Goddess Lakshmi for prosperity, and sweets are shared with neighbours. It is often a five-day sequence, from Dhanteras to Bhai Dooj."
    },
    {
        keys: ["holi"],
        text: "Holi is India's festival of spring and colour. The evening bonfire (Holika Dahan) retells the legend of Holika and Prahlada — good triumphing over evil — and the next day people of every age play with coloured powder (gulal) and water, sing Fag songs and exchange gujiya and thandai. In Mathura and Vrindavan it is a full-fledged season. Its quiet message: for a day, distinctions of status fade into colour."
    },
    {
        keys: ["onam"],
        text: "Onam is Kerala's ten-day harvest festival, centred on the legend of King Mahabali — a just and beloved ruler who, tradition says, returns to Kerala every Onam. Each day the household pookalam, a huge flower carpet, grows a new ring; the centrepiece is the Onasadya, a grand vegetarian feast on a banana leaf with dozens of dishes. Snake-boat races (vallam kali) thunder across the backwaters, and the festival closes in a riot of colour on Thiruvonam."
    },
    {
        keys: ["durga puja", "durga", "navratri garba"],
        text: "Durga Puja is the celebration of Goddess Durga's victory over the buffalo demon Mahishasura, crowning the ten days of Navratri. In West Bengal, Odisha, Jharkhand and Assam, cities build intricate pandals — temporary palaces of art — where the idol is worshipped for four days, then the whole city walks with the idol to the river for immersion. Kolkata's Durga Puja is a UNESCO Intangible Cultural Heritage. The evenings belong to adda — conversation — and bhog, the festival's food."
    },
    {
        keys: ["chikankari"],
        text: "Chikankari is the delicate white-on-white (and pale pastel) embroidery that has been made in Lucknow for centuries. The name comes from 'chikan', a stitch. Masters work with dozens of named stitches — shadow work, bakhi, phanda, jaali — on fine cotton and muslin, using needles, fingers and a few pliers. It went from Awadhi court dress to a modern wardrobe staple, and it remains largely a hand craft of Lucknow's embroidery houses."
    },
    {
        keys: ["phulkari"],
        text: "Phulkari — 'flower work' — is the bright stitched embroidery of Punjab. Working from the wrong side of coarse khadi cloth, embroiderers fill the fabric with geometric rupa (diamond) patterns in saffron, magenta, green and white thread, often covering most of the shawl. It was traditionally part of a Punjabi bride's trousseau, and it is still made by hand in villages across Punjab."
    },
    {
        keys: ["kalamkari"],
        text: "Kalamkari means 'pen work' — painting on cloth with a bamboo pen. Two great traditions bear the name: the temple cloth of Sriperumbudur in Tamil Nadu, where mythological scenes were painted in natural dyes to dress deities, and the Malkajgiri painting of Andhra Pradesh, made for household drapes. Both use dyes from the earth — indigo for blue, myrobalan and pomegranate rind for brown, turmeric and kermes for the rest — making each cloth a small wearable manuscript."
    },
    {
        keys: ["warli"],
        text: "Warli painting is the tribal art of the Warli community of Maharashtra. It is drawn in white rice paste on earth-coloured walls using simple sticks, built from dots and lines: circles of people dancing, banyan trees, the sun, the river, the drum. It is art of the everyday — weddings, harvests, the monsoon — and one of India's most recognisable folk visual languages."
    },
    {
        keys: ["odissi"],
        text: "Odissi is one of the oldest of the classical dance traditions, from Odisha. Its sculptural tribhangi (three-bend) posture can be read directly on the stone carvings of Odisha's temples, which preserve the dance's forms for over a thousand years. The music — with its soft, sliding phrases — is equally ancient. Odissi tells the stories of Krishna, Radha and the deities through a slow bloom of movement, like a lotus opening."
    },
    {
        keys: ["kathak"],
        text: "Kathak — from 'katha', story — is the story-telling dance of the north, most closely associated with Uttar Pradesh and Delhi. It blends precise, rapid footwork (the ghat) with spins, expressive abhinaya and a narrative arc that runs from devotion to celebration. It grew in both temple and Mughal courts, which is why its vocabulary carries both devotional and courtly flavours."
    },
    {
        keys: ["yoga"],
        text: "Yoga is one of India's oldest continuous traditions — a family of practices that includes posture (asana), breath (pranayama), meditation and ethics, rooted in classical texts such as the Yoga Sutras. What the world now calls 'yoga class' is one branch of a much larger contemplative discipline. Indian yogic traditions, especially around Rishikesh in Uttarakhand, have been important centres of learning for generations."
    },
    {
        keys: ["ayurveda"],
        text: "Ayurveda — literally 'the science of life' — is one of the world's oldest systematic medical traditions, documented in classical Sanskrit texts. It understands health as a balance of body, mind and nature, and its knowledge of herbs, diet, seasons and lifestyle has influenced wellness practices for millennia. As a heritage tradition it is fascinating and richly documented; for any personal medical use, qualified professional guidance is always the right path."
    },
    {
        keys: ["cuisine", "food", "dosa", "thali", "cuisine of india"],
        text: "Indian cuisine is as diverse as its people. The South eats off the banana leaf — dosa, idli, vada, sambar and rasam, with filter coffee to finish. The North embraces the thali — dals, rotis, sabzi, pickle and sweet. Bengal honours its fish and rice; Rajasthan cooks for the desert — dal-baati-churma and spices; Kerala serves the grand sadya. Spice is not a single thing here — it is a hundred regional grammars of flavour."
    },
    {
        keys: ["music", "hindustani", "carnatic"],
        text: "Indian classical music has two great streams. Hindustani music of the north organises sound through ragas (melodic frameworks) and talas (rhythmic cycles), with the sitar, sarod, tabla and sarangi among its instruments. Carnatic music of the south — centred on the Carnatic concert with its violin, veena and mridangam — shares the raga-tala grammar with its own distinct style and repertory. Both rest on centuries of guru-shishya (teacher-student) transmission, alongside the enormous folk traditions."
    },
    {
        keys: ["dance", "classical dance"],
        text: "India recognises ten classical dance forms: Bharatanatyam, Kathak, Odissi, Kathakali, Mohiniyattam, Kuchipudi, Manipuri, Sattriya, Chhau and Bharatanatyam's southern siblings each carry their region's story — plus hundreds of folk dances: Bihu, Garba, Bhangra, Lavani, Ghoomar... Each form is a complete language: rhythm, posture, expression and narrative, trained over years and performed in temple and concert hall alike."
    },
    {
        keys: ["festival", "festivals"],
        text: "India's festival calendar is essentially a celebration of time itself: harvest (Pongal, Onam, Baisakhi, Bihu), seasons (Holi, Makar Sankranti), light (Diwali), devotion (Navratri, Durga Puja, Rath Yatra), and the great religious occasions of every community — Eid, Christmas and many more. If you tell me a region or a month, I can walk you through what is being celebrated there."
    },
    {
        keys: ["heritagesite", "heritage site", "monument", "architecture"],
        text: "India's heritage architecture spans five thousand years: the planned cities of the Indus Valley, the great stupa at Sanchi, the temple gopurams of the South and the Nagara spires of the North (Khajuraho, Konark), the Mughal marvel of the Taj Mahal, the rock-cut caves of Ellora and Ajanta, and open-air cities like Hampi. More than 40 are UNESCO World Heritage Sites. Tell me which era or region interests you and I'll take you there."
    }
];

/**
 * Pick a curated offline answer for a question (demo mode).
 * Uses simple keyword matching against the answer bank above.
 */
function demoAnswer(question) {
    const q = question.toLowerCase();
    for (const entry of DEMO_ANSWERS) {
        if (entry.keys.some((key) => q.includes(key))) {
            return entry.text;
        }
    }
    // Friendly fallback — steer the visitor toward known topics.
    return "That's a wonderful question — in demo mode I'm an offline guide with a curated set of heritage stories. Try asking me about Bharatanatyam, Madhubani art, Hampi, Pongal, Indian folk traditions, or the traditional crafts of Rajasthan. In live mode (connected to a secure Gemini API endpoint) I can answer much more broadly about India's rich cultural heritage.";
}

/* =====================================================================
   12. HERITAGE AI — GEMINI API HANDLING (SECURE ENDPOINT)
   ---------------------------------------------------------------------
   SECURITY ARCHITECTURE (important for the SIH team):

       User
         ↓
       Heritage Website (this static site — no secrets!)
         ↓
       Secure API Endpoint (a small proxy you deploy)
         ↓
       Gemini API  ← your GEMINI_API_KEY lives ONLY in the proxy's
                     server-side environment variables
         ↓
       Heritage AI Response → User

   HOW TO ENABLE LIVE MODE:
   1. Deploy a tiny serverless function (Cloud Run / Cloud Functions /
      any server) that:
        - receives POST /api/heritage-ai  { "messages": [ {role, content} ] }
        - reads GEMINI_API_KEY from its own environment (NEVER from the
          frontend, NEVER from this file)
        - calls the Gemini API with a system prompt like:
            "You are Heritage AI, a knowledgeable and respectful guide to
             India's cultural heritage. Answer in clear, educational
             language. You speak only about Indian culture, history,
             traditions, art, crafts, festivals, food and heritage sites."
        - replies with JSON: { "reply": "..." }
   2. Set GEMINI.endpoint below to your proxy URL (e.g.
      "https://your-app.example.com/api/heritage-ai").
   3. Leave it empty (the default) for a fully static, offline demo.

   QUOTA & RATE LIMITS — "unlimited" chat experience:
   - This website does NOT impose any artificial message limit
     (no "10 messages / 20 per day / 100 max" caps — by design).
   - Actual availability is governed ENTIRELY by the Gemini API
     project's own limits (requests per minute, tokens per minute,
     requests per day), which depend on the model and usage tier.
   - We stay inside those limits by design so they serve as many
     messages as possible:
       * the AI answers in only the words required — the system prompt
         asks for ≤ 60 words, and generationConfig.maxOutputTokens
         (GEMINI.maxOutputTokens) is a hard cap the model can't pass
       * a short context window (last 10 messages only)
       * a per-message length guard on the input (token economy)
   - When Gemini returns a rate-limit / quota error (429, 403 or a
     RESOURCE_EXHAUSTED payload), the assistant waits for the API's
     suggested reset window (capped at 30s) and automatically retries
     ONCE — so brief quota pauses don't break the conversation. If the
     retry is also limited, the chat gracefully shows:
     "Heritage AI has temporarily reached its Gemini API usage limit.
     Please try again later."
     We never attempt to bypass those limits.
   ===================================================================== */

const GEMINI = {
    /* ── API KEY (placeholder) ─────────────────────────────────────
       For a quick LOCAL DEMO, paste your Gemini API key here:

           apiKey: "AIzaSy....your key...."

       ⚠️  SECURITY: a key pasted here is visible in the page source to
       anyone who opens the website. For a public demo or production,
       keep the key inside your secure API endpoint's environment
       variables instead (see "endpoint" below) and leave this as the
       placeholder. NEVER commit a real key to a shared repository.
    */
    apiKey: "AQ.Ab8RN6KjbaShvkFsCkmx1nATrwb4kG7hzWece64vfTqW5NKFoA",

    // Model to call — any Gemini model your key has access to.
    model: "gemini-3.5-flash",

    /* ── REPLY LENGTH CAP (token economy) ──────────────────────────
       Hard cap on how long each answer may be, in output tokens
       (200 tokens ≈ ~150 words). The system prompt asks for far
       less (~60 words); this cap is the safety net that guarantees
       it. Smaller replies burn fewer tokens, so Gemini's
       tokens-per-minute quota serves MANY more messages — the user
       can keep chatting without hitting the limit quickly.
    */
    maxOutputTokens: 200,

    /* ── SECURE ENDPOINT (recommended) ─────────────────────────────
       If set, chat requests go to YOUR proxy (which holds the key
       server-side) instead of using apiKey in the browser, e.g.
       "https://your-app.example.com/api/heritage-ai"
       Leave empty to use apiKey directly (local demo) or demo mode.
    */
    endpoint: "",

    timeoutMs: 20000
};

// The placeholder value above — compared at runtime to detect whether
// a real key has actually been provided.
const GEMINI_KEY_PLACEHOLDER = "YOUR_GEMINI_API_KEY_HERE";

// System prompt sent to Gemini in live mode — defines the Heritage AI
// persona. The "required words only" rule keeps every reply short so
// each message costs few tokens and the quota serves many more chats.
const GEMINI_SYSTEM_PROMPT =
    "You are Heritage AI, a warm, knowledgeable and respectful guide to India's rich " +
    "cultural heritage. You answer questions about Indian art, architecture, classical " +
    "and folk dance, music, festivals, crafts, cuisine, clothing, languages, traditional " +
    "knowledge and heritage sites. " +
    "Answer ONLY in the words required: at most 60 words, in 1–3 short sentences, with " +
    "no preamble, no closing line and no lists unless explicitly asked. Be accurate and " +
    "give the essential cultural context. If the user explicitly asks for detail, you may " +
    "go up to 100 words. Make no medical claims. If a question is outside Indian cultural " +
    "heritage, politely steer back to it in one line.";

/**
 * Which mode is Heritage AI running in?
 *   "proxy"  → requests go to the secure endpoint (GEMINI.endpoint)
 *   "direct" → requests go straight to the Gemini REST API using GEMINI.apiKey
 *   "demo"   → offline curated answers (default, no key required)
 */
function geminiMode() {
    if (GEMINI.endpoint && GEMINI.endpoint.trim() !== "") return "proxy";
    if (GEMINI.apiKey &&
        GEMINI.apiKey.trim() !== "" &&
        GEMINI.apiKey !== GEMINI_KEY_PLACEHOLDER) return "direct";
    return "demo";
}

/**
 * Extract the server-suggested retry delay (in seconds) from a Gemini
 * error payload. Gemini usually provides it as `error.retryDelay`
 * (e.g. "5s") or inside the message ("Retry Delay - 48s").
 * Capped at 30s so a misreported value can't freeze the chat.
 */
function geminiRetryDelaySeconds(errorInfo) {
    if (!errorInfo) return 0;
    if (errorInfo.retryDelay) {
        const secs = parseInt(String(errorInfo.retryDelay), 10);
        if (!Number.isNaN(secs)) return Math.min(Math.max(secs, 3), 30);
    }
    const match = /retry delay - (\d+)s/i.exec(errorInfo.message || "");
    if (match) return Math.min(parseInt(match[1], 10), 30);
    return 0;
}

/**
 * Call Gemini — via the secure endpoint, or directly — with the recent
 * conversation and return the assistant's reply text.
 *
 * Rate-limit strategy (keeps the chat feeling "unlimited"):
 *   - We never bypass Gemini's own RPM/TPM/RPD limits.
 *   - On a quota error, we wait for the API's suggested reset window
 *     (capped at 30s) and automatically retry ONCE.
 *   - If the retry is also limited, a RATE_LIMIT error is thrown and
 *     the UI shows the graceful "usage limit" message.
 *
 * @param {Array<{role: "user"|"model", content: string}>} messages
 * @param {number} [attempt=1] current attempt (internal retry counter)
 * @returns {Promise<string>} the assistant's reply text
 * @throws {Error} with code "RATE_LIMIT" on quota errors, otherwise a
 *                 generic error for network / HTTP failures.
 */
async function callGemini(messages, attempt = 1) {
    // Build the request for the active live mode.
    const mode = geminiMode();
    let url;
    let body;

    if (mode === "proxy") {
        // Recommended: your secure endpoint holds the key server-side.
        url = GEMINI.endpoint;
        body = JSON.stringify({ messages });
    } else {
        // Local-demo shortcut: call the Gemini REST API directly with
        // the key from GEMINI.apiKey (see the security note above it).
        url = "https://generativelanguage.googleapis.com/v1beta/models/" +
            GEMINI.model + ":generateContent?key=" +
            encodeURIComponent(GEMINI.apiKey);
        body = JSON.stringify({
            systemInstruction: { parts: [{ text: GEMINI_SYSTEM_PROMPT }] },
            generationConfig: {
                // Hard safety net on reply length — the model can never
                // run past this, keeping each request cheap so the
                // token quota serves as many messages as possible.
                maxOutputTokens: GEMINI.maxOutputTokens
            },
            contents: messages.map((m) => ({
                role: m.role === "model" ? "model" : "user",
                parts: [{ text: m.content }]
            }))
        });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEMINI.timeoutMs);

    let response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: body,
            signal: controller.signal
        });
    } catch (err) {
        // Network failure or timeout — not a quota issue.
        throw new Error("network error: " + (err && err.message ? err.message : "unreachable"));
    } finally {
        clearTimeout(timer);
    }

    // Read the error payload (if any) so we can detect quota errors
    // accurately — Gemini reports rate limits as HTTP 429, 403, or
    // even HTTP 400 with a RESOURCE_EXHAUSTED payload.
    let errorInfo = null;
    if (!response.ok) {
        let payload = null;
        try { payload = await response.json(); } catch (e) { /* not JSON */ }
        errorInfo = payload && payload.error ? payload.error : null;
    }

    const isQuotaError =
        response.status === 429 ||
        response.status === 403 ||
        (errorInfo && (
            errorInfo.code === 429 ||
            errorInfo.status === "RESOURCE_EXHAUSTED" ||
            /quota|rate.?limit|resource_?exhausted/i.test(errorInfo.message || "")
        ));

    if (isQuotaError) {
        // Respect the API's limit: wait for its reset window and retry
        // once, so brief quota pauses don't interrupt the conversation.
        if (attempt < 2) {
            const delayMs = Math.max(geminiRetryDelaySeconds(errorInfo) * 1000, 3000);
            await wait(delayMs);
            return callGemini(messages, attempt + 1);
        }
        const err = new Error("gemini rate limit");
        err.code = "RATE_LIMIT";
        throw err;
    }

    if (!response.ok) {
        throw new Error("gemini api error " + response.status);
    }

    const data = await response.json();

    // Accept either the simple { reply } shape (proxy) or the raw
    // Gemini generateContent response.
    const reply =
        data.reply ||
        data.message ||
        (data.candidates &&
            data.candidates[0] &&
            data.candidates[0].content &&
            data.candidates[0].content.parts &&
            data.candidates[0].content.parts.map((p) => p.text || "").join(""));

    if (!reply) throw new Error("empty response from gemini api");
    return reply;
}

/* =====================================================================
   13. ERROR HANDLING & FOOTER YEAR
   ===================================================================== */

/**
 * Global safety net: surface unexpected script errors quietly in the
 * console (no crash UI) so the prototype keeps running during demos.
 */
window.addEventListener("error", (event) => {
    console.warn("[BHARAT] Non-fatal error:", event.message);
});

/** Keep the footer copyright year current. */
(function setYear() {
    const el = $("#year");
    if (el) el.textContent = String(new Date().getFullYear());
})();
