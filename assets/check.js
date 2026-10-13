/* The Reframe Check: a three-minute diagnostic that doubles as the application.
   Name and email come first, so every lead is kept even if they stop early.
   Each step (email given, left early, completed, booked) goes to the Reframe Leads Google Sheet via Zapier.
   Completed checks also go to Netlify Forms. Qualified leaders unlock the booking calendar. */
(function () {
  "use strict";

  /* ---------- Settings ---------- */
  const CONFIG = {
    // Paste the video embed link here when it's ready (Vimeo, YouTube or Wistia embed URL).
    video: "",
    // Switch to the private 60-minute Reframe Check call event link when it exists.
    calendly: "https://calendly.com/reframewithmona",
    // Zapier catch hook: adds a row to the Reframe Leads sheet for every step.
    hook: "https://hooks.zapier.com/hooks/catch/28953308/Cb79kg1jRElPmOAjN/",
    formName: "reframe-check",
    formPath: "/ceo/",
    reply: "within one business day"
  };

  /* ---------- Content ---------- */
  const PARTS = ["Your seat", "Your team", "The fit"];

  const QUESTIONS = [
    { key: "role", part: 0, title: "What's your role?", options: ["CEO", "Founder and CEO", "President", "Other C-suite", "Something else"] },
    { key: "size", part: 0, title: "About how many people work at your company?", options: ["Under 50", "50 to 200", "200 to 1,000", "Over 1,000"] },
    { key: "change", part: 0, title: "What has changed in the last 18 months?", options: ["New owners or investors", "I took over from a founder or family", "Fast growth", "My first time as CEO", "Something else", "Nothing major"] },
    { key: "tenure", part: 0, title: "How long have you been in this seat?", options: ["Under 3 months", "3 to 18 months", "18 months to 3 years", "More than 3 years"] },
    { key: "monday", part: 1, title: "On Monday, your team agrees on the priorities. By Friday…", options: ["The same questions are back on my desk", "Things drift back to the old way", "I'm not sure who's really with me", "Honestly, it holds"] },
    { key: "belief", part: 1, title: "Which belief from the video sounds closest to where you are?", options: ["“I have the wrong people.”", "“We need more structure.”", "“Coaching is for leaders who aren't performing.”", "I haven't watched it yet"] },
    { key: "tried", part: 1, type: "multi", title: "What have you already tried?", help: "Choose any that apply.", options: ["A new hire or a COO", "A new operating rhythm (EOS, OKRs, new meetings)", "A coach or advisor", "A peer group (Vistage, YPO, EO)", "An offsite", "Nothing yet"] },
    { key: "challenge", part: 1, type: "text", title: "In a sentence or two, what's the challenge you'd bring to the call?", help: "This is what Mona would reframe with you first." },
    { key: "want", part: 2, title: "Which is closest to what you want?", help: "Reframing works when you test a new way of seeing the problem in your real week, between conversations.", options: ["That's what I'm looking for", "I'd want to understand it more first", "Someone to fix the team for me"] },
    { key: "decide", part: 2, title: "If it's a fit, how would the decision get made?", help: "Working with Mona is a premium, one-to-one engagement, priced like a senior advisor.", options: ["I can decide this myself", "With my board, investors or a family owner", "Through HR or L&D", "I couldn't make this investment right now"] },
    { key: "start", part: 2, title: "If it's a fit, when would you want to start?", options: ["Now", "Within three months", "Later this year", "Just exploring"] }
  ];

  const PATTERNS = [
    { name: "The safe-to-ask loop", read: "Your team has learned that checking with you is safer than deciding. After a big change that's a sensible habit, and it keeps the decisions on your desk.", reframe: "What if the bottleneck is one decision you keep taking back?", action: "Pick one decision that reached you this week that someone else could own. Hand it over, and don't take it back." },
    { name: "Agreement without ownership", read: "The team agrees in the room, and the old way creeps back later. People commit to what they've had a real chance to push back on, and agreeing quickly is often a sign they haven't.", reframe: "What if they agree so quickly because disagreeing with you feels risky?", action: "In your next leadership meeting, ask for the strongest case against your plan before you decide." },
    { name: "The inherited frame", read: "Part of the team may still be working to the old playbook, or waiting to see who you are. That can look like resistance, and it's often caution.", reframe: "What if they're waiting to see what you'll protect, not deciding whether to follow you?", action: "Ask each direct report one question: what did we get right before I arrived that I should protect?" },
    { name: "Holding, for now", read: "Good. The useful question is what keeps it that way as the company grows and the decisions get bigger.", reframe: "What if the next bottleneck is the one that hasn't formed yet?", action: "Name the one decision you'd most like your team to own a year from now, and start handing over a piece of it." }
  ];

  const SOURCES = ["A LinkedIn post", "A message from Mona", "Someone recommended her", "Other"];
  const FREE_MAIL = ["gmail.", "googlemail.", "yahoo.", "outlook.", "hotmail.", "live.", "icloud.", "me.com", "aol.", "proton", "pm.me", "gmx.", "zoho.", "yandex.", "rediffmail."];

  /* ---------- State (kept for this browser tab only) ---------- */
  const KEY = "reframe-check-v1";
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const fresh = () => ({ q: -1, answers: {}, contact: {}, result: null, sentKey: "", booked: false, session: newId(), leftAt: null });
  let state = fresh();
  try { const saved = JSON.parse(sessionStorage.getItem(KEY) || "null"); if (saved && typeof saved === "object") state = Object.assign(fresh(), saved); } catch (e) { /* storage unavailable */ }
  if (!state.session) state.session = newId();
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ } };

  // Where the visitor came from (kept across the session)
  let tracking = {};
  try {
    const p = new URLSearchParams(location.search);
    const stored = JSON.parse(sessionStorage.getItem("reframe-utm") || "{}");
    ["utm_source", "utm_medium", "utm_campaign", "utm_content"].forEach((k) => { if (p.get(k)) stored[k] = p.get(k); });
    if (!stored.referrer && document.referrer && document.referrer.indexOf(location.host) === -1) stored.referrer = document.referrer;
    tracking = stored;
    sessionStorage.setItem("reframe-utm", JSON.stringify(stored));
  } catch (e) { /* storage unavailable */ }

  /* ---------- Helpers ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TOTAL = QUESTIONS.length;

  const check = $("#check");
  const body = $("#checkBody");
  const page = $("#page");
  let opener = null;

  /* ---------- Video ---------- */
  const poster = $("#poster");
  if (poster) {
    poster.addEventListener("click", () => {
      if (CONFIG.video) {
        const f = document.createElement("iframe");
        const sep = CONFIG.video.indexOf("?") > -1 ? "&" : "?";
        f.src = CONFIG.video + sep + "autoplay=1";
        f.title = "Mona Patel: the video";
        f.allow = "autoplay; fullscreen; picture-in-picture";
        f.allowFullscreen = true;
        $("#player").replaceChildren(f);
      } else {
        $("#posterNote").hidden = false;
      }
    });
  }

  /* ---------- Open and close ---------- */
  function openCheck(push) {
    if (!check.hidden) return;
    opener = document.activeElement;
    check.hidden = false;
    document.body.classList.add("check-open");
    page.inert = true;
    if (push && location.hash !== "#reframe-check") history.pushState({ rc: 1 }, "", "#reframe-check");
    render();
  }

  function closeCheck(fromHistory) {
    if (check.hidden) return;
    recordLeft();
    check.hidden = true;
    document.body.classList.remove("check-open");
    page.inert = false;
    if (!fromHistory && location.hash === "#reframe-check") {
      if (history.state && history.state.rc) history.back();
      else history.replaceState(null, "", location.pathname + location.search);
    }
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }

  $$("[data-open-check]").forEach((b) => b.addEventListener("click", () => openCheck(true)));
  $("#closeCheck").addEventListener("click", () => closeCheck(false));
  window.addEventListener("popstate", () => {
    if (location.hash === "#reframe-check") openCheck(false);
    else closeCheck(true);
  });
  if (location.hash === "#reframe-check") openCheck(false);

  /* ---------- Rendering ---------- */
  function show(html) {
    body.innerHTML = html;
    check.scrollTop = 0;
    body.focus({ preventScroll: true });
    save();
  }

  function progress() {
    const fills = PARTS.map((_, p) => {
      const qs = QUESTIONS.filter((q) => q.part === p);
      const done = QUESTIONS.slice(0, Math.max(state.q, 0)).filter((q) => q.part === p).length;
      return state.q >= TOTAL ? 100 : Math.round((done / qs.length) * 100);
    });
    const nowPart = state.q < TOTAL ? QUESTIONS[state.q].part : -1;
    return '<div class="parts" aria-hidden="true">' + PARTS.map((name, p) =>
      '<div class="part' + (p === nowPart ? " now" : "") + '">' + esc(name) + '<i><b style="width:' + fills[p] + '%"></b></i></div>'
    ).join("") + "</div>";
  }

  function render() {
    if (state.result) return renderResult();
    if (state.q < 0) return renderIntro();
    if (!state.contact.email) return renderLead();
    if (state.q >= TOTAL) return renderContact();
    const q = QUESTIONS[state.q];
    if (q.type === "text") return renderText(q);
    return renderChoice(q);
  }

  function renderIntro() {
    const started = Object.keys(state.answers).length > 0;
    show(
      '<div class="qhead"><h1 class="qtitle">A three-minute diagnostic for leaders in a new chapter.</h1></div>' +
      '<ul class="intro-list">' +
        "<li>Your name and email, then eleven short questions about your seat, your team and the fit.</li>" +
        "<li>You'll get a read of the pattern you're in and one reframe to try this week.</li>" +
        "<li>If it looks like a fit, the calendar opens for a 60-minute Reframe Check call with Mona.</li>" +
      "</ul>" +
      '<div class="actions">' +
        (started
          ? '<button class="btn" type="button" id="resume">Continue where you left off</button><button class="btn-quiet" type="button" id="restart">Start again</button>'
          : '<button class="btn" type="button" id="begin">Start</button>') +
      "</div>" +
      '<p class="fine">Your answers go to Mona only.</p>'
    );
    if (started) {
      $("#resume").onclick = () => { state.q = firstUnanswered(); render(); };
      $("#restart").onclick = () => { state = fresh(); state.q = 0; render(); };
    } else {
      $("#begin").onclick = () => { state.q = 0; render(); };
    }
  }

  function firstUnanswered() {
    for (let i = 0; i < TOTAL; i++) {
      const v = state.answers[QUESTIONS[i].key];
      if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) return i;
    }
    return TOTAL;
  }

  function head(q) {
    return progress() +
      '<div class="qhead"><p class="count">Question ' + (state.q + 1) + " of " + TOTAL + "</p>" +
      '<h2 class="qtitle" id="qtitle">' + esc(q.title) + "</h2>" +
      (q.help ? '<p class="qhelp">' + esc(q.help) + "</p>" : "") + "</div>";
  }

  function optionButtons(q, isPressed) {
    return '<div class="options" role="group" aria-labelledby="qtitle">' + q.options.map((o, i) =>
      '<button class="opt" type="button" data-i="' + i + '" aria-pressed="' + (isPressed(i) ? "true" : "false") + '">' +
        '<span class="marks" aria-hidden="true"></span>' +
        '<span class="key" aria-hidden="true">' + String.fromCharCode(65 + i) + "</span><span>" + esc(o) + "</span></button>"
    ).join("") + "</div>";
  }

  function renderChoice(q) {
    const multi = q.type === "multi";
    const sel = () => state.answers[q.key];
    const pressed = (i) => multi ? (sel() || []).indexOf(i) > -1 : sel() === i;
    show(
      head(q) + optionButtons(q, pressed) +
      (multi ? '<p class="err" id="qErr" role="alert" hidden>Choose at least one, or “Nothing yet”.</p>' : "") +
      '<div class="actions">' + (multi ? '<button class="btn" type="button" id="qNext">Continue</button>' : "") +
      '<button class="btn-quiet" type="button" id="qBack">Back</button></div>'
    );
    $$(".opt", body).forEach((b) => b.addEventListener("click", () => pick(q, Number(b.dataset.i))));
    if (multi) $("#qNext").onclick = () => next(q);
    $("#qBack").onclick = back;
  }

  let advancing = false;
  function pick(q, i) {
    if (advancing) return;
    if (q.type === "multi") {
      const none = q.options.length - 1;
      let cur = (state.answers[q.key] || []).slice();
      if (i === none) cur = cur.indexOf(none) > -1 ? [] : [none];
      else {
        cur = cur.filter((x) => x !== none);
        const at = cur.indexOf(i);
        if (at > -1) cur.splice(at, 1); else cur.push(i);
      }
      state.answers[q.key] = cur;
      $$(".opt", body).forEach((o) => o.setAttribute("aria-pressed", cur.indexOf(Number(o.dataset.i)) > -1 ? "true" : "false"));
      const err = $("#qErr"); if (err) err.hidden = true;
      save();
      return;
    }
    state.answers[q.key] = i;
    $$(".opt", body).forEach((o) => o.setAttribute("aria-pressed", Number(o.dataset.i) === i ? "true" : "false"));
    save();
    advancing = true;
    setTimeout(() => { advancing = false; state.q++; render(); }, reduced ? 60 : 240);
  }

  function next(q) {
    if (q.type === "multi" && !(state.answers[q.key] || []).length) { $("#qErr").hidden = false; return; }
    state.q++; render();
  }
  function back() { state.q = Math.max(-1, state.q - 1); render(); }

  function renderText(q) {
    show(
      head(q) +
      '<div class="field"><label for="q-challenge">Your challenge</label>' +
      '<textarea id="q-challenge" maxlength="800" aria-describedby="qErr">' + esc(state.answers.challenge || "") + "</textarea></div>" +
      '<p class="err" id="qErr" role="alert" hidden>Add a sentence or two (at least 8 words) so Mona knows where to start.</p>' +
      '<div class="actions"><button class="btn" type="button" id="qNext">Continue</button><button class="btn-quiet" type="button" id="qBack">Back</button></div>'
    );
    const ta = $("#q-challenge");
    ta.addEventListener("input", () => { state.answers.challenge = ta.value; save(); });
    $("#qNext").onclick = () => {
      const v = ta.value.trim();
      if (v.split(/\s+/).filter(Boolean).length < 8) { $("#qErr").hidden = false; ta.focus(); return; }
      state.answers.challenge = v; state.q++; render();
    };
    $("#qBack").onclick = back;
    if (window.matchMedia("(hover: hover)").matches) ta.focus({ preventScroll: true });
  }

  function renderLead() {
    const c = state.contact;
    show(
      '<div class="qhead"><p class="count">Before we start</p><h2 class="qtitle">First, where can Mona reach you?</h2>' +
      '<p class="qhelp">So your read and any reply from Mona reach the right person.</p></div>' +
      '<form id="leadForm" class="check-form" novalidate>' +
        '<div class="fields">' +
          '<div class="field"><label for="c-name">Name</label><input id="c-name" autocomplete="name" required value="' + esc(c.name) + '"></div>' +
          '<div class="field"><label for="c-email">Email <span class="hint">(work or private)</span></label><input id="c-email" type="email" autocomplete="email" inputmode="email" required value="' + esc(c.email) + '"></div>' +
        "</div>" +
        '<p class="err" id="lErr" role="alert" hidden>Add your name and a valid email to continue.</p>' +
        '<div class="actions" style="margin-top:26px"><button class="btn" type="submit">Continue</button><button class="btn-quiet" type="button" id="lBack">Back</button></div>' +
        '<p class="fine" style="margin-top:16px">Your details go to Mona only. No newsletter unless you ask.</p>' +
      "</form>"
    );
    $("#lBack").onclick = () => { state.q = -1; render(); };
    $("#leadForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#c-name").value.trim();
      const email = $("#c-email").value.trim();
      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $("#lErr").hidden = false; return; }
      state.contact = Object.assign({}, state.contact, { name: name, email: email });
      save();
      track("Email given");
      render();
    });
  }

  function renderContact() {
    const c = state.contact;
    show(
      progress() +
      '<div class="qhead"><p class="count">Last step</p><h2 class="qtitle">A little about your company</h2></div>' +
      '<form id="contactForm" class="check-form" novalidate>' +
        '<div class="fields">' +
          '<div class="field"><label for="c-company">Company</label><input id="c-company" autocomplete="organization" value="' + esc(c.company) + '"></div>' +
          '<div class="field"><label for="c-linkedin">LinkedIn profile <span class="hint">(optional)</span></label><input id="c-linkedin" inputmode="url" value="' + esc(c.linkedin) + '"></div>' +
          '<div class="field"><label for="c-source">How did you hear about Mona?</label><select id="c-source">' +
            SOURCES.map((s) => "<option" + (c.source === s ? " selected" : "") + ">" + esc(s) + "</option>").join("") +
          "</select></div>" +
        "</div>" +
        '<div class="actions" style="margin-top:26px"><button class="btn" type="submit">See my read</button><button class="btn-quiet" type="button" id="qBack">Back</button></div>' +
        '<p class="fine" style="margin-top:16px">Your answers go to Mona only. What you share stays private.</p>' +
      "</form>"
    );
    $("#qBack").onclick = back;
    $("#contactForm").addEventListener("submit", (e) => {
      e.preventDefault();
      state.contact = Object.assign({}, state.contact, { company: $("#c-company").value.trim(), linkedin: $("#c-linkedin").value.trim(), source: $("#c-source").value });
      state.result = classify(state.answers, state.contact);
      state.booked = false;
      send();
      track("Completed");
      render();
    });
  }

  /* ---------- Qualification ---------- */
  function classify(a, contact) {
    let reason = null;
    if (a.role === 4) reason = "The Reframe Check call is built for CEOs, founders and presidents. If someone on your leadership team is in that seat, this page may be useful to them.";
    else if (a.size === 0) reason = "The Reframe Check call is built for leaders of companies with about 50 people or more.";
    else if (a.want === 2) reason = "It sounds like you want someone to fix the team directly. That's consulting work. Mona works with the leader, as a thinking partner.";
    else if (a.decide === 3) reason = "You said this isn't the right time to invest. That's fine. When it is, the Reframe Check will be here.";
    else if (a.start === 3) reason = "You said you're exploring, which is fine. When the timing is right, the Reframe Check will be here.";

    const domain = ((contact.email || "").toLowerCase().split("@")[1]) || "";
    const personal = FREE_MAIL.some((d) => domain.indexOf(d) === 0);
    const vague = (a.challenge || "").split(/\s+/).filter(Boolean).length < 8;

    const why = [];
    if (a.role === 3) why.push("other C-suite");
    if (a.decide === 2) why.push("HR or L&D decides");
    if (a.start === 2) why.push("starting later this year");
    if (vague) why.push("short challenge");
    const flags = personal ? ["personal email: check LinkedIn before the call"] : [];

    const pts = (v, two, one) => two.indexOf(v) > -1 ? 2 : one.indexOf(v) > -1 ? 1 : 0;
    const score = pts(a.change, [0, 1, 3], [2, 4]) + pts(a.tenure, [1], [0, 2]) + pts(a.want, [0], [1]) + pts(a.decide, [0], [1]) + pts(a.start, [0], [1]);

    return { outcome: reason ? "not" : why.length ? "review" : "unlocked", reason: reason, score: score, why: why, flags: flags };
  }

  function answerText(key) {
    const q = QUESTIONS.find((x) => x.key === key);
    const v = state.answers[key];
    if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) return "";
    if (q.type === "multi") return v.map((i) => q.options[i]).join("; ");
    if (q.type === "text") return v;
    return q.options[v];
  }

  /* ---------- Sending to Netlify Forms ---------- */
  function send() {
    const r = state.result, c = state.contact;
    const fields = {
      "form-name": CONFIG.formName,
      outcome: (r.outcome === "unlocked" ? "Unlocked: calendar shown" : r.outcome === "review" ? "Mona to review: " + r.why.join(", ") : "Not right now") + ((r.flags || []).length ? " (" + r.flags.join("; ") + ")" : ""),
      priority: r.outcome === "not" ? "Not scored" : r.score + "/10" + (r.score >= 8 ? " (offer the earliest slot)" : ""),
      review_reasons: r.outcome === "not" ? (r.reason || "") : r.why.join(", "),
      name: c.name, email: c.email, company: c.company, linkedin: c.linkedin,
      challenge: answerText("challenge"),
      role: answerText("role"), size: answerText("size"), change: answerText("change"), tenure: answerText("tenure"),
      monday: answerText("monday"), belief: answerText("belief"), tried: answerText("tried"),
      want: answerText("want"), decide: answerText("decide"), start: answerText("start"),
      pattern: PATTERNS[state.answers.monday] ? PATTERNS[state.answers.monday].name : "",
      source: c.source,
      utm_source: tracking.utm_source || "", utm_medium: tracking.utm_medium || "", utm_campaign: tracking.utm_campaign || "", utm_content: tracking.utm_content || "",
      referrer: tracking.referrer || "",
      page: location.pathname,
      submitted_at: new Date().toISOString()
    };
    const sentKey = JSON.stringify([state.answers, c]);
    if (state.sentKey === sentKey) return;
    const payload = Object.keys(fields).map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(fields[k] == null ? "" : fields[k])).join("&");
    const post = () => fetch(CONFIG.formPath, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: payload, keepalive: true })
      .then((res) => { if (!res.ok) throw new Error("HTTP " + res.status); state.sentKey = sentKey; save(); });
    post().catch(() => setTimeout(() => post().catch((err) => console.warn("Reframe Check could not be sent:", err)), 2500));
  }

  /* ---------- Sending each step to the Reframe Leads sheet (Zapier) ---------- */
  function track(stage) {
    if (!CONFIG.hook || !state.contact.email) return;
    const r = state.result, c = state.contact;
    const data = {
      ts: new Date().toISOString(),
      stage: stage,
      reached: state.result ? "All " + TOTAL + " questions" : state.q >= TOTAL ? "Last step" : "Question " + (Math.max(state.q, 0) + 1) + " of " + TOTAL,
      result: stage === "Booked" ? "Booked a Reframe Check call" : r ? (r.outcome === "unlocked" ? "Qualified: calendar shown" : r.outcome === "review" ? "Mona to review" : "Not right now") : "",
      priority: r && r.outcome !== "not" ? r.score + "/10" : "",
      reasons: r ? (r.outcome === "not" ? (r.reason || "") : r.why.concat(r.flags || []).join("; ")) : "",
      name: c.name || "", email: c.email || "", company: c.company || "", linkedin: c.linkedin || "",
      challenge: answerText("challenge"),
      role: answerText("role"), size: answerText("size"), change: answerText("change"), tenure: answerText("tenure"),
      monday: answerText("monday"), belief: answerText("belief"), tried: answerText("tried"),
      want: answerText("want"), decide: answerText("decide"), start: answerText("start"),
      pattern: PATTERNS[state.answers.monday] ? PATTERNS[state.answers.monday].name : "",
      source: c.source || "",
      utm_source: tracking.utm_source || "", utm_medium: tracking.utm_medium || "", utm_campaign: tracking.utm_campaign || "", utm_content: tracking.utm_content || "",
      referrer: tracking.referrer || "",
      session: state.session
    };
    const body = new URLSearchParams(data);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(CONFIG.hook, body)) return;
    } catch (e) { /* fall through to fetch */ }
    try { fetch(CONFIG.hook, { method: "POST", mode: "no-cors", body: body, keepalive: true }); } catch (e) { /* offline */ }
  }

  // Someone who gave their email but stops before the end is still recorded, once per question.
  function recordLeft() {
    if (!state.contact.email || state.result || state.q < 0 || state.leftAt === state.q) return;
    state.leftAt = state.q;
    save();
    track("Left early");
  }
  window.addEventListener("pagehide", recordLeft);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && !check.hidden) recordLeft(); });

  /* ---------- Result ---------- */
  function calendlyUrl(embed) {
    let u;
    try { u = new URL(CONFIG.calendly); } catch (e) { return CONFIG.calendly; }
    if (embed) {
      u.searchParams.set("embed_domain", location.host || "reframe.spexalink.com");
      u.searchParams.set("embed_type", "Inline");
    }
    u.searchParams.set("hide_gdpr_banner", "1");
    if (state.contact.name) u.searchParams.set("name", state.contact.name);
    if (state.contact.email) u.searchParams.set("email", state.contact.email);
    if (state.answers.challenge) u.searchParams.set("a1", state.answers.challenge);
    return u.toString();
  }

  function renderResult() {
    const a = state.answers, r = state.result;
    const p = PATTERNS[a.monday] || PATTERNS[0];
    const first = (state.contact.name || "").split(" ")[0];
    const belief = a.belief === 3 || a.belief === undefined
      ? "You haven't watched the video yet. It covers three beliefs in seven minutes, and it's worth a look before any call."
      : "From the video, you picked " + QUESTIONS[5].options[a.belief] + " On a call, that's where Mona would start.";

    if (state.booked) return renderBooked();

    let html = "";
    if (r.outcome === "unlocked") {
      html += '<div class="open-bar" role="status"><p>You qualify. Your Reframe Check call with Mona is open.</p><a class="btn" href="' + esc(calendlyUrl(false)) + '" target="_blank" rel="noopener">Book your call</a></div>';
    }
    html +=
      '<div class="read"><p class="who">Your read' + (first ? ", " + esc(first) : "") + "</p>" +
      "<h2>" + esc(p.name) + "</h2><p>" + esc(p.read) + "</p></div>" +
      '<div class="reframe-box"><span class="marks" aria-hidden="true"></span><p class="lab">A reframe to try</p><p class="reframe">' + esc(p.reframe) + "</p></div>" +
      '<div class="this-week"><h3>This week</h3><p>' + esc(p.action) + "</p></div>" +
      '<p class="echo">' + esc(belief) + "</p>";

    if (r.outcome === "unlocked") {
      html +=
        '<section class="invite" id="invite" aria-labelledby="inviteTitle">' +
          '<h3 id="inviteTitle">You\'re invited to a Reframe Check call.</h3>' +
          "<p>Sixty minutes with Mona. Bring the challenge you described and she'll reframe it with you, so you leave with something useful either way. Then you both decide whether working together makes sense.</p>" +
          (a.challenge ? '<p class="yours">“' + esc(a.challenge) + "”</p>" : "") +
          '<div class="actions"><a class="btn" href="' + esc(calendlyUrl(false)) + '" target="_blank" rel="noopener">Book your Reframe Check call</a><span class="fine">Or pick a time below.</span></div>' +
          '<div class="cal"><iframe id="calFrame" title="Book your Reframe Check call" loading="lazy" src="' + esc(calendlyUrl(true)) + '"></iframe></div>' +
          '<ul class="promises"><li>What you talk about stays between you and Mona.</li><li>If Mona isn\'t the right person for what you need, she\'ll say so and recommend someone who is.</li></ul>' +
        "</section>";
    } else if (r.outcome === "review") {
      html +=
        '<section class="later" role="status">' +
          "<h3>Thank you. Mona will be in touch.</h3>" +
          "<p>She reads every Reframe Check herself and replies " + esc(CONFIG.reply) + ", to " + esc(state.contact.email) + ".</p>" +
          '<p class="echo">Your read above is yours to keep in the meantime.</p>' +
        "</section>";
    } else {
      html +=
        '<section class="later" role="status">' +
          "<h3>Thank you for taking the Reframe Check.</h3>" +
          "<p>" + esc(r.reason) + "</p>" +
          '<p class="echo">Your read above is yours to keep.</p>' +
        "</section>";
    }
    html += '<div class="actions"><button class="btn-quiet" type="button" id="retake">Change my answers</button></div>';
    show(html);

    const toCal = $("#toCal");
    if (toCal) toCal.onclick = () => $("#invite").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    $("#retake").onclick = () => { state.result = null; state.q = 0; render(); };
  }

  function renderBooked() {
    const c = state.answers.challenge;
    show(
      '<div class="booked">' +
        '<h2>You\'re booked. Here\'s how to get the most from the hour.</h2>' +
        '<dl class="prep">' +
          "<dt>Bring</dt><dd>" + (c ? "Your challenge, and anything that has changed since: “" + esc(c) + "”" : "One real challenge, the one on your desk this week.") + "</dd>" +
          "<dt>The hour</dt><dd>Mona reframes that challenge with you, live. In the last part, you both decide whether working together makes sense.</dd>" +
          "<dt>Privacy</dt><dd>What you talk about stays between you, even when your company is paying.</dd>" +
          "<dt>Next</dt><dd>Your confirmation and calendar invite arrive by email.</dd>" +
        "</dl>" +
        '<div class="actions"><button class="btn" type="button" id="done">Back to the page</button></div>' +
      "</div>"
    );
    $("#done").onclick = () => closeCheck(false);
  }

  // Calendly tells the page its height, and when a call is booked.
  window.addEventListener("message", (e) => {
    if (!/^https:\/\/([a-z0-9-]+\.)?calendly\.com$/.test(e.origin) || !e.data || typeof e.data !== "object") return;
    if (e.data.event === "calendly.page_height" && e.data.payload && e.data.payload.height) {
      const f = $("#calFrame");
      const h = parseInt(e.data.payload.height, 10);
      if (f && h > 300) f.style.height = Math.min(h, 1400) + "px";
    }
    if (e.data.event === "calendly.event_scheduled") {
      state.booked = true;
      save();
      track("Booked");
      if (!check.hidden) renderBooked();
    }
  });

  /* ---------- Keyboard: letters pick answers, Escape closes ---------- */
  document.addEventListener("keydown", (e) => {
    if (check.hidden) return;
    if (e.key === "Escape") { closeCheck(false); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (state.result || state.q < 0 || state.q >= TOTAL) return;
    const q = QUESTIONS[state.q];
    if (q.type === "text") return;
    const i = e.key.toUpperCase().charCodeAt(0) - 65;
    if (e.key.length === 1 && i >= 0 && i < q.options.length) { e.preventDefault(); pick(q, i); }
    else if (e.key === "Enter" && q.type === "multi" && tag !== "button") { e.preventDefault(); next(q); }
  });
})();
