/* 보카 데일리 · 정적 웹앱 (서버 없음, 기록은 이 기기의 브라우저에만 저장) */
(function () {
  "use strict";

  const D = window.VD_DATA;
  const KEY = "voca-daily-v1";
  const LVS = D.levels.map(l => l.id);
  const LVNAME = Object.fromEntries(D.levels.map(l => [l.id, l.name]));
  const W = [], BY_ID = {}, BY_DAY = {};
  LVS.forEach(lv => {
    BY_DAY[lv] = {};
    D.words[lv].forEach((list, di) => {
      const day = di + 1;
      BY_DAY[lv][day] = list.map(([en, ko], i) => {
        const w = { id: lv + day + "-" + (i + 1), lv, day, n: i + 1, en, ko };
        W.push(w); BY_ID[w.id] = w; return w;
      });
    });
  });
  const DAYS = Array.from({ length: 30 }, (_, i) => i + 1);

  /* ---------- 저장 ---------- */
  function fresh() {
    return { v: 1, c: {}, wrong: {}, star: {}, log: {}, tests: {},
      set: { theme: "system", cap: 20, extra: true, lvs: { b: true, e: true, n: true }, order: "day", front: "en", rate: 0.9, auto: true,
        hide: "none", dlv: "b", lastBackup: "", test: { src: "day", lv: "b", from: 1, to: 1, type: "mix", count: 20 } } };
  }
  function merge(s) {
    const f = fresh();
    const set = Object.assign(f.set, s.set || {});
    set.lvs = Object.assign(fresh().set.lvs, (s.set || {}).lvs || {});
    set.test = Object.assign(fresh().set.test, (s.set || {}).test || {});
    return Object.assign(f, s, { set });
  }
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return merge(s); } catch (e) { /* 새로 시작 */ }
    return fresh();
  }
  let S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("기록을 저장하지 못했어요"); } }

  /* ---------- 도우미 ---------- */
  const $ = sel => document.querySelector(sel);
  const app = () => $("#app");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ds = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const today = () => ds(new Date());
  const addDays = (s, n) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return ds(d); };
  const daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const HANGUL = /[가-힣]/;
  function logT() { const t = today(); return (S.log[t] = S.log[t] || { n: 0, r: 0, t: 0, ok: 0 }); }
  const act = l => l ? (l.n || 0) + (l.r || 0) + (l.t || 0) : 0;
  function streak() {
    let d = today(), n = 0;
    if (!act(S.log[d])) d = addDays(d, -1);
    while (act(S.log[d])) { n++; d = addDays(d, -1); }
    return n;
  }

  /* ---------- 간격 반복 (SM-2 변형) ---------- */
  function nextCard(c0, g) {
    const c = c0 ? Object.assign({}, c0) : { e: 2.5, i: 0, r: 0, l: 0, s: today() };
    if (g === 0) { c.r = 0; c.l++; c.i = 0; c.e = Math.max(1.3, c.e - 0.2); }
    else if (g === 1) { c.i = c.r === 0 ? 1 : Math.max(c.i + 1, Math.round(c.i * 1.2)); c.e = Math.max(1.3, c.e - 0.15); c.r++; }
    else if (g === 2) { c.i = c.r === 0 ? 1 : c.r === 1 ? 3 : Math.max(c.i + 1, Math.round(c.i * c.e)); c.r++; }
    else { c.i = c.r === 0 ? 4 : c.r === 1 ? 7 : Math.max(c.i + 2, Math.round(c.i * c.e * 1.3)); c.e += 0.15; c.r++; }
    c.d = addDays(today(), c.i);
    return c;
  }
  const ivLabel = i => i === 0 ? "곧" : i < 30 ? i + "일" : i < 365 ? Math.round(i / 30) + "달" : (i / 365).toFixed(1) + "년";
  function markWrong(id) { const w = S.wrong[id] || { c: 0, k: 0 }; w.c++; w.k = 0; w.ts = Date.now(); S.wrong[id] = w; }
  function markRight(id) { const w = S.wrong[id]; if (w && ++w.k >= 2) delete S.wrong[id]; }
  const isLeech = id => S.c[id] && S.c[id].l >= 3;
  const dueIds = () => Object.keys(S.c).filter(id => BY_ID[id] && S.c[id].d <= today()).sort((a, b) => S.c[a].d < S.c[b].d ? -1 : 1);
  function orderedIds() {
    const on = LVS.filter(l => S.set.lvs[l]), out = [];
    if (S.set.order === "day") DAYS.forEach(d => on.forEach(l => BY_DAY[l][d].forEach(w => out.push(w.id))));
    else on.forEach(l => DAYS.forEach(d => BY_DAY[l][d].forEach(w => out.push(w.id))));
    return out;
  }
  const newIds = k => k > 0 ? orderedIds().filter(id => !S.c[id]).slice(0, k) : [];
  const newLeft = () => Math.max(0, S.set.cap - ((S.log[today()] || {}).n || 0));
  const seenIn = ws => ws.filter(w => S.c[w.id]).length;
  function nextDay(lv) { for (const d of DAYS) if (seenIn(BY_DAY[lv][d]) < BY_DAY[lv][d].length) return d; return 30; }

  /* ---------- 발음 ---------- */
  const canSpeak = "speechSynthesis" in window;
  let voice = null;
  function pickVoice() {
    if (!canSpeak) return;
    const vs = speechSynthesis.getVoices();
    voice = vs.find(v => /en[-_]US/i.test(v.lang) && /Google|Samantha|Aria|Jenny|Natural|Ava/i.test(v.name)) ||
      vs.find(v => /^en[-_]US/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
  }
  if (canSpeak) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speak(text) {
    if (!canSpeak) { toast("이 브라우저는 발음 듣기를 지원하지 않아요"); return; }
    const t = String(text).replace(/\([^)]*\)/g, " ").replace(/[~=]/g, " ").replace(/\s+/g, " ").trim();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = "en-US"; u.rate = isFinite(S.set.rate) && S.set.rate > 0 ? S.set.rate : 0.9; if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  }

  /* ---------- 아이콘 ---------- */
  const ic = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
    quiz: '<path d="M9 11l2 2 4-4"/><rect x="4" y="4" width="16" height="16" rx="3"/>',
    note: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7M9 8h3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'
  };
  const svg = (name, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ic[name]}</svg>`;
  const sndBtn = id => `<button class="iconbtn" data-act="say" data-id="${id}" aria-label="발음 듣기">${svg("sound")}</button>`;
  const starBtn = id => `<button class="iconbtn star ${S.star[id] ? "on" : ""}" data-act="star" data-id="${id}" aria-label="별표">${svg("star")}</button>`;
  const lvTag = lv => `<i class="tag lv-${lv}">${LVNAME[lv]}</i>`;

  /* ---------- 마스코트 보리 (햄스터) ---------- */
  function hamster(mood, cls) {
    const ink = "#3D2A2A";
    const eyes = {
      happy: `<circle cx="45" cy="62" r="4.6" fill="${ink}"/><circle cx="75" cy="62" r="4.6" fill="${ink}"/><circle cx="46.6" cy="60.4" r="1.5" fill="#fff"/><circle cx="76.6" cy="60.4" r="1.5" fill="#fff"/>`,
      cheer: `<path d="M40 64q5-7 10 0M70 64q5-7 10 0" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
      sleep: `<path d="M40 62q5 5 10 0M70 62q5 5 10 0" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
      sad: `<circle cx="45" cy="63" r="4" fill="${ink}"/><circle cx="75" cy="63" r="4" fill="${ink}"/><path d="M39 57l9-4M81 57l-9-4" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`
    }[mood];
    const mouth = {
      happy: `<path d="M54 75q6 6 12 0" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
      cheer: `<path d="M52 74q8 12 16 0z" fill="#C2475F" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>`,
      sleep: `<ellipse cx="60" cy="77" rx="3" ry="2.4" fill="${ink}"/>`,
      sad: `<path d="M54 79q6-5 12 0" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
    }[mood];
    const deco = mood === "cheer"
      ? `<path d="M14 30l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#FFC94D"/><path d="M104 18l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#FF8FA8"/>`
      : mood === "sleep" ? `<text x="92" y="30" font-size="16" font-family="Jua, sans-serif" fill="#9A8AA8">z</text><text x="102" y="18" font-size="12" font-family="Jua, sans-serif" fill="#9A8AA8">z</text>`
      : mood === "sad" ? `<path d="M86 68q2 5 0 8q-2-3 0-8z" fill="#7FB7FF"/>` : "";
    return `<svg class="${cls || "mascot"}" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="33" cy="32" r="13" fill="#E9A877"/><circle cx="33" cy="32" r="7" fill="#FFB3C1"/>
      <circle cx="87" cy="32" r="13" fill="#E9A877"/><circle cx="87" cy="32" r="7" fill="#FFB3C1"/>
      <ellipse cx="60" cy="70" rx="45" ry="41" fill="#F5C99B"/>
      <ellipse cx="60" cy="84" rx="29" ry="24" fill="#FFF3E6"/>
      <ellipse cx="35" cy="74" rx="7.5" ry="4.8" fill="#FF9EB1" opacity=".75"/><ellipse cx="85" cy="74" rx="7.5" ry="4.8" fill="#FF9EB1" opacity=".75"/>
      ${eyes}<ellipse cx="60" cy="70" rx="3.4" ry="2.4" fill="#E07A8F"/>${mouth}
      <rect x="45" y="90" width="30" height="20" rx="4" fill="#fff" stroke="#E9A877" stroke-width="2"/><path d="M51 97h18M51 103h11" stroke="#FF8FA8" stroke-width="2.4" stroke-linecap="round"/>
      <ellipse cx="44" cy="99" rx="7" ry="6" fill="#E9A877"/><ellipse cx="76" cy="99" rx="7" ry="6" fill="#E9A877"/>
      ${deco}</svg>`;
  }

  /* ---------- 파생어와 유의어 ---------- */
  const EXTRA = window.VD_EXTRA || {};
  const POSK = { n: "명", v: "동", a: "형", ad: "부", prep: "전" };
  function extraHtml(en) {
    if (!S.set.extra) return "";
    const x = EXTRA[String(en).toLowerCase()];
    if (!x) return "";
    const [d, s] = x;
    let h = "";
    if (d) h += `<div class="xrow"><b>파생</b><span>${d.split("; ").map(p => {
      const t = p.split(" ");
      return `<span class="dv"><b>${esc(t[0])}</b> <i class="pos">${POSK[t[1]] || esc(t[1])}</i> ${esc(t.slice(2).join(" "))}</span>`;
    }).join("")}</span></div>`;
    if (s) h += `<div class="xrow"><b>유의</b><span>${esc(s)}</span></div>`;
    return `<div class="extra">${h}</div>`;
  }

  /* ---------- 공통 UI ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 1900);
  }
  function sheet(html) {
    const sh = $("#sheet");
    sh.innerHTML = `<div class="scrim" data-act="close-sheet"></div><div class="panel" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
    sh.classList.add("open");
  }
  function closeSheet() { const sh = $("#sheet"); sh.classList.remove("open"); sh.innerHTML = ""; }
  function nav(active) {
    const items = [["home", "홈", "home"], ["days", "Day", "book"], ["test", "테스트", "quiz"], ["notes", "노트", "note"], ["search", "검색", "search"]];
    const wc = Object.keys(S.wrong).length;
    return `<nav class="tabbar">${items.map(([r, label, icon]) =>
      `<a href="#${r}" class="${active === r ? "on" : ""}">${svg(icon)}<span>${label}</span>${r === "notes" && wc ? `<b class="badge">${wc}</b>` : ""}</a>`).join("")}</nav>`;
  }
  function page(active, inner) { app().innerHTML = `<main class="page">${inner}</main>${nav(active)}`; window.scrollTo(0, 0); }
  const bar = (p, color) => `<div class="bar"><i style="width:${p}%${color ? ";background:" + color : ""}"></i></div>`;
  function applyTheme() {
    const t = S.set.theme;
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }
  const seg = (act, cur, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-act="${act}" data-v="${v}" class="${String(cur) === String(v) ? "on" : ""}">${l}</button>`).join("")}</div>`;

  /* ---------- 홈 ---------- */
  function viewHome() {
    const due = dueIds().length, nl = Math.min(newLeft(), newIds(newLeft()).length);
    const seen = Object.keys(S.c).length, wc = Object.keys(S.wrong).length;
    const done = due + nl === 0;
    const week = [];
    for (let i = 6; i >= 0; i--) {
      const k = addDays(today(), -i), d = new Date(k + "T00:00:00");
      week.push({ n: act(S.log[k]), label: "일월화수목금토"[d.getDay()], today: i === 0 });
    }
    const todayN = act(S.log[today()]), st = streak();
    let mood = "happy", msg = "보리랑 같이 외워볼까요?";
    if (done) { mood = "cheer"; msg = "오늘 몫 끝! 최고예요"; }
    else if (todayN) msg = "좋아요, 조금만 더 해요!";
    else if (st) msg = `연속 ${st}일째! 오늘도 해요`;
    else if (seen) { mood = "sleep"; msg = "보리를 깨워 주세요…"; }
    const mx = Math.max(10, ...week.map(x => x.n));
    const firstDay = Object.keys(S.log).sort()[0] || today();
    const needBackup = seen >= 20 && daysBetween(S.set.lastBackup || firstDay, today()) >= 14;
    page("home", `
      <header class="top"><h1>보카 데일리</h1><button class="iconbtn" data-act="settings" aria-label="설정">${svg("gear")}</button></header>
      <section class="card hero">
        <div class="bubble">${msg}</div>
        <div class="hero-num"><div><b>${due}</b><span>복습할 단어</span></div><div><b>${nl}</b><span>새 단어</span></div></div>
        ${done ? `<button class="btn block" data-act="more-new">새 단어 10개 더</button>`
          : `<button class="btn block primary" data-act="start-today">학습 시작</button>`}
        ${hamster(mood, "mascot bob")}
      </section>
      <div class="stats">
        <div class="stat"><span class="em">🔥</span><b>${st}</b><span>연속 학습일</span></div>
        <div class="stat"><span class="em">📚</span><b>${seen}</b><span>학습한 단어</span></div>
        <a class="stat" href="#notes"><span class="em">📝</span><b>${wc}</b><span>오답 단어</span></a>
      </div>
      ${needBackup ? `<section class="card"><div class="row-between"><div><b>백업할 때가 됐어요</b><p class="small muted">기록은 이 기기에만 있어요. 2주에 한 번 파일로 저장해 두세요.</p></div></div><button class="btn block primary" data-act="export">백업 파일 저장</button></section>` : ""}
      <section class="card">
        <h2>단계별 진도</h2>
        ${LVS.map(lv => {
          const tot = W.filter(w => w.lv === lv).length, s = W.filter(w => w.lv === lv && S.c[w.id]).length, nd = nextDay(lv);
          return `<a href="#day/${lv}/${nd}" style="display:block;margin:10px 0">
            <div class="row-between"><span><b>${LVNAME[lv]}</b>${S.set.lvs[lv] ? "" : '<i class="tag warn">새 단어 꺼짐</i>'}</span><span class="small muted">${s} / ${tot} · 이어서 Day ${nd}</span></div>
            ${bar(pct(s, tot), `var(--lv-${lv})`)}</a>`;
        }).join("")}
      </section>
      <section class="card">
        <h2>최근 7일</h2>
        <div class="week">${week.map(x => `<div class="wk ${x.today ? "today" : ""}"><em>${x.n ? (x.n >= 20 ? "🌸 " : "") + x.n : ""}</em><div class="wkbar"><i style="height:${pct(x.n, mx)}%"></i></div><span>${x.label}</span></div>`).join("")}</div>
        <p class="tiny muted" style="margin-top:8px">카드와 테스트를 합친 개수예요. 20개 넘게 한 날은 🌸 도장!</p>
      </section>`);
  }

  /* ---------- Day 목록 ---------- */
  function viewDays() {
    const lv = S.set.dlv;
    page("days", `
      <header class="top"><h1>Day 목록</h1></header>
      <div class="seg wide">${D.levels.map(l => `<button data-act="dlv" data-v="${l.id}" class="${lv === l.id ? "on" : ""}">${l.name}</button>`).join("")}</div>
      <section class="card"><ul class="daylist">${DAYS.map(d => {
        const ws = BY_DAY[lv][d], s = seenIn(ws), t = S.tests[lv + d];
        return `<li><a href="#day/${lv}/${d}" class="${s === ws.length ? "done" : ""}"><div class="dayhead"><span><b>Day ${d}</b> <span class="muted">${esc(D.topics[d - 1])}</span></span>
          <span class="small muted">${s}/${ws.length}${t ? ` · 테스트 ${t.best}%` : ""}</span></div>${bar(pct(s, ws.length), `var(--lv-${lv})`)}</a></li>`;
      }).join("")}</ul></section>`);
  }

  /* ---------- Day 상세 ---------- */
  function wordRow(w, showDay, extra) {
    const tags = (S.wrong[w.id] ? '<i class="tag bad">오답</i>' : "") + (isLeech(w.id) ? '<i class="tag warn">어려움</i>' : "");
    return `<li class="wrow"><span class="wnum">${w.n}</span>
      <div class="wbody" data-act="reveal"><span class="w-en">${esc(w.en)}${tags}</span><span class="w-ko">${esc(w.ko)}</span>
      ${showDay ? `<span class="w-meta">${LVNAME[w.lv]} · Day ${w.day} ${esc(D.topics[w.day - 1])}${extra ? " · " + extra : ""}</span>` : ""}</div>
      ${sndBtn(w.id)}${starBtn(w.id)}</li>`;
  }
  function viewDay(lv, d) {
    if (!BY_DAY[lv] || !BY_DAY[lv][d]) { location.hash = "#days"; return; }
    S.set.dlv = lv;
    const ws = BY_DAY[lv][d], s = seenIn(ws), t = S.tests[lv + d];
    page("days", `
      <header class="top"><a class="iconbtn" href="#days" aria-label="뒤로">${svg("back")}</a><h1>Day ${d}</h1>
        <a class="iconbtn" href="#day/${lv}/${d < 30 ? d + 1 : 1}" aria-label="다음 Day" style="transform:scaleX(-1)">${svg("back")}</a></header>
      <p class="muted" style="text-align:center;margin:0 0 10px">${esc(D.topics[d - 1])} · ${ws.length}개</p>
      <div class="seg wide">${D.levels.map(l => `<button data-act="go" data-v="#day/${l.id}/${d}" class="${lv === l.id ? "on" : ""}">${l.name}</button>`).join("")}</div>
      <section class="card">
        <div class="row-between small"><span>학습 ${s}/${ws.length}</span><span class="muted">${t ? `테스트 최고 ${t.best}% · 최근 ${t.last}%` : "테스트 기록 없음"}</span></div>
        ${bar(pct(s, ws.length), `var(--lv-${lv})`)}
        <div class="btns2"><button class="btn primary" data-act="day-cards" data-lv="${lv}" data-d="${d}">카드로 외우기</button>
          <button class="btn" data-act="day-test" data-lv="${lv}" data-d="${d}">테스트</button></div>
      </section>
      <div class="field">가리기 ${seg("hide", S.set.hide, [["none", "모두 보기"], ["ko", "뜻 가리기"], ["en", "단어 가리기"]])}</div>
      <section class="card"><ul class="wlist ${S.set.hide === "ko" ? "hide-ko" : S.set.hide === "en" ? "hide-en" : ""}" id="wlist">${ws.map(w => wordRow(w)).join("")}</ul>
        <p class="tiny muted" style="margin-top:8px">가린 칸은 눌러서 확인하세요.</p></section>`);
    save();
  }

  /* ---------- 카드 학습 ---------- */
  let SESS = null;
  function startCards(ids, title, back) {
    if (!ids.length) { toast("학습할 단어가 없어요"); return; }
    SESS = { title, back: back || "#home", queue: ids.slice(), total: ids.length, done: 0, again: 0, flipped: false, undo: null, spoke: null };
    if (location.hash === "#study") viewStudy(); else location.hash = "#study";
  }
  function viewStudy() {
    if (!SESS) { location.hash = "#home"; return; }
    if (!SESS.queue.length) {
      app().innerHTML = `<main class="page run">
        <header class="top"><h1>${esc(SESS.title)}</h1></header>
        <section class="card result pop">${hamster("cheer", "mascot bob")}<div class="big-score">${SESS.done}<span> 단어</span></div>
          <p class="muted">다 했어요! "다시"를 누른 횟수는 ${SESS.again}번이에요.</p>
          <p class="small muted">복습 날짜는 자동으로 정해졌어요. 그날 홈 화면에 다시 나와요.</p></section>
        <button class="btn block primary" data-act="go" data-v="${SESS.back}">돌아가기</button>
        <button class="btn block" data-act="go" data-v="#home">홈으로</button></main>`;
      SESS = null; return;
    }
    const id = SESS.queue[0], w = BY_ID[id], c = S.c[id];
    const fr = S.set.front;
    if (S.set.auto && fr === "en" && SESS.spoke !== id) { SESS.spoke = id; speak(w.en); }
    const isNew = !c;
    const rates = [[0, "다시", "😵"], [1, "어려움", "😅"], [2, "알맞음", "🙂"], [3, "쉬움", "😎"]].map(([g, l, em]) =>
      `<button class="rate r${g}" data-act="rate" data-g="${g}"><span class="em">${em}</span>${l}<small>${ivLabel(nextCard(c, g).i)}</small></button>`).join("");
    app().innerHTML = `<main class="page run">
      <header class="top"><button class="iconbtn" data-act="go" data-v="${SESS.back}" aria-label="그만하기">${svg("x")}</button>
        <div class="prog">${bar(pct(SESS.done, SESS.total))}<span class="tiny muted">${SESS.done} / ${SESS.total}</span></div>
        <button class="iconbtn" data-act="undo" aria-label="되돌리기" ${SESS.undo ? "" : "disabled"}>${svg("undo")}</button></header>
      <section class="card flash" data-act="flip">
        <div class="meta"><span>${LVNAME[w.lv]} · Day ${w.day} ${esc(D.topics[w.day - 1])}</span><span>${isNew ? '<i class="tag lv-' + w.lv + '">새 단어</i>' : (isLeech(id) ? '<i class="tag warn">어려움</i>' : "")}</span></div>
        ${fr === "en" ? `<div class="face">${esc(w.en)}</div>` : `<div class="face ko">${esc(w.ko)}</div>`}
        ${SESS.flipped ? (fr === "en" ? `<div class="back">${esc(w.ko)}</div>` : `<div class="back en">${esc(w.en)}</div>`) + extraHtml(w.en)
          : `<div class="hint">눌러서 ${fr === "en" ? "뜻" : "단어"} 보기 (Space)</div>`}
      </section>
      <div class="row-between" style="justify-content:center;margin-bottom:12px">${sndBtn(id)}${starBtn(id)}</div>
      ${SESS.flipped ? `<div class="rates">${rates}</div><p class="tiny muted" style="text-align:center">아래 숫자는 다음 복습까지 남은 기간이에요. 키보드 1~4</p>`
        : `<button class="btn block primary" data-act="flip">${fr === "en" ? "뜻" : "단어"} 보기</button>`}
    </main>`;
  }
  function rateCard(g) {
    if (!SESS || !SESS.flipped) return;
    const id = SESS.queue[0], L = logT();
    SESS.undo = { id, c: S.c[id] ? Object.assign({}, S.c[id]) : null, w: S.wrong[id] ? Object.assign({}, S.wrong[id]) : null,
      log: Object.assign({}, L), queue: SESS.queue.slice(), done: SESS.done, again: SESS.again };
    if (S.c[id]) L.r++; else L.n++;
    S.c[id] = nextCard(S.c[id], g);
    SESS.queue.shift();
    if (g === 0) { markWrong(id); SESS.again++; SESS.queue.splice(Math.min(SESS.queue.length, 4), 0, id); }
    else { if (g >= 2) markRight(id); SESS.done++; }
    SESS.flipped = false;
    save(); viewStudy();
  }
  function undoCard() {
    const u = SESS && SESS.undo; if (!u) return;
    if (u.c) S.c[u.id] = u.c; else delete S.c[u.id];
    if (u.w) S.wrong[u.id] = u.w; else delete S.wrong[u.id];
    S.log[today()] = u.log;
    Object.assign(SESS, { queue: u.queue, done: u.done, again: u.again, flipped: true, undo: null, spoke: u.id });
    save(); viewStudy();
  }

  /* ---------- 테스트 ---------- */
  let TEST = null;
  const TYPES = [["mix", "섞어서"], ["meaning", "뜻 고르기"], ["word", "단어 고르기"], ["spell", "철자 쓰기"], ["listen", "듣고 고르기"]];
  const norm = s => String(s).toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[’`]/g, "'").replace(/[~.,!?;:]/g, " ").replace(/\s+/g, " ").trim();
  function distractors(w, key) {
    let pool = BY_DAY[w.lv][w.day].filter(x => x.id !== w.id && norm(x[key]) !== norm(w[key]));
    if (pool.length < 3) pool = W.filter(x => x.lv === w.lv && x.id !== w.id);
    const out = [], used = new Set([norm(w[key])]);
    for (const x of shuffle(pool)) { if (!used.has(norm(x[key]))) { used.add(norm(x[key])); out.push(x); } if (out.length === 3) break; }
    return out;
  }
  function buildTest(ids, type, count, title, key, back) {
    if (!ids.length) { toast("테스트할 단어가 없어요"); return; }
    const pick = shuffle(ids).slice(0, count || ids.length);
    const kinds = canSpeak ? ["meaning", "word", "spell", "listen"] : ["meaning", "word", "spell"];
    const items = pick.map(id => {
      const w = BY_ID[id];
      let t = type === "mix" ? kinds[Math.floor(Math.random() * kinds.length)] : type;
      if (t === "listen" && !canSpeak) t = "meaning";
      const k = t === "word" ? "en" : "ko";
      return { id, t, opts: t === "spell" ? null : shuffle([w, ...distractors(w, k)]).map(x => x.id), key: k };
    });
    TEST = { title, key, back: back || "#test", items, i: 0, ans: null, ok: 0, wrong: [], spoke: -1, hint: false };
    if (location.hash === "#trun") viewTestRun(); else location.hash = "#trun";
  }
  function viewTestRun() {
    if (!TEST) { location.hash = "#test"; return; }
    if (TEST.i >= TEST.items.length) return viewTestResult();
    const it = TEST.items[TEST.i], w = BY_ID[it.id], a = TEST.ans;
    if ((it.t === "listen" || (it.t === "meaning" && S.set.auto)) && TEST.spoke !== TEST.i) { TEST.spoke = TEST.i; setTimeout(() => speak(w.en), 150); }
    let q = "";
    if (it.t === "meaning") q = `<div class="qtag">이 단어의 뜻은?</div><div class="prompt">${esc(w.en)}</div>`;
    else if (it.t === "word") q = `<div class="qtag">이 뜻의 단어는?</div><div class="prompt ko">${esc(w.ko)}</div>`;
    else if (it.t === "listen") q = `<div class="qtag">듣고 뜻을 고르세요</div><div style="text-align:center"><button class="btn" data-act="say" data-id="${w.id}">${svg("sound")} 다시 듣기</button></div>${a ? `<div class="prompt">${esc(w.en)}</div>` : ""}`;
    else {
      const ans = norm(w.en), hint = ans.split("").map((ch, i) => ch === " " ? "&nbsp;&nbsp;" : i === 0 ? esc(ch) : "_").join(" ");
      q = `<div class="qtag">영어로 쓰세요</div><div class="prompt ko">${esc(w.ko)}</div>
        <p style="text-align:center;letter-spacing:.05em">${TEST.hint || a ? hint : `<button class="btn small" data-act="hint">첫 글자 힌트</button>`}</p>
        <input class="typein ${a ? (a.ok ? "ok" : "no") : ""}" id="typein" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="정답 입력 후 Enter" ${a ? `value="${esc(a.typed)}" disabled` : ""}>
        ${a ? "" : `<button class="btn block primary" data-act="submit-spell">확인</button>`}`;
    }
    const opts = it.opts ? `<div class="opts">${it.opts.map((oid, k) => {
      const o = BY_ID[oid], cls = a ? (oid === it.id ? "correct" : oid === a.pick ? "wrong" : "") : "";
      return `<button class="opt ${cls}" data-act="pick" data-id="${oid}" ${a ? "disabled" : ""}><span class="lt">${k + 1}</span><span>${esc(o[it.key])}</span></button>`;
    }).join("")}</div>` : "";
    const verdict = a ? `<section class="card verdict pop ${a.ok ? "v-good" : "v-bad"}"><div class="vh">${a.ok ? "정답! 🎉" : "아쉬워요 😢"}</div>
      <div class="row-between"><div><b>${esc(w.en)}</b><div class="small">${esc(w.ko)}</div><div class="tiny muted">${LVNAME[w.lv]} · Day ${w.day}</div></div><div style="display:flex">${sndBtn(w.id)}${starBtn(w.id)}</div></div>${extraHtml(w.en)}</section>
      <button class="btn block primary" data-act="tnext">${TEST.i + 1 < TEST.items.length ? "다음 (Enter)" : "결과 보기"}</button>` : "";
    app().innerHTML = `<main class="page run">
      <header class="top"><button class="iconbtn" data-act="go" data-v="${TEST.back}" aria-label="그만하기">${svg("x")}</button>
        <div class="prog">${bar(pct(TEST.i, TEST.items.length))}<span class="tiny muted">${TEST.i + 1} / ${TEST.items.length} · 맞힘 ${TEST.ok}</span></div><span style="width:40px"></span></header>
      <section class="card">${q}</section>${opts}${verdict}</main>`;
    const ti = $("#typein"); if (ti && !a) ti.focus();
  }
  function answer(ok, extra) {
    const it = TEST.items[TEST.i], L = logT();
    TEST.ans = Object.assign({ ok }, extra);
    L.t++;
    if (ok) { L.ok++; TEST.ok++; markRight(it.id); }
    else { TEST.wrong.push(it.id); markWrong(it.id); if (S.c[it.id]) S.c[it.id] = nextCard(S.c[it.id], 0); }
    save(); viewTestRun();
  }
  function viewTestResult() {
    const n = TEST.items.length, p = pct(TEST.ok, n);
    if (TEST.key) { const o = S.tests[TEST.key] || { best: 0 }; S.tests[TEST.key] = { best: Math.max(o.best, p), last: p, date: today() }; save(); }
    const wr = [...new Set(TEST.wrong)];
    app().innerHTML = `<main class="page run">
      <header class="top"><h1>${esc(TEST.title)}</h1></header>
      <section class="card result pop">${hamster(p >= 90 ? "cheer" : p >= 60 ? "happy" : "sad", "mascot bob")}<div class="big-score">${TEST.ok}<span> / ${n}</span></div><p class="muted">정답률 ${p}%${p >= 90 ? ". 훌륭해요!" : p >= 70 ? ". 틀린 단어만 다시 보면 돼요." : ". 카드로 한 번 더 외우고 다시 풀어보세요."}</p></section>
      ${wr.length ? `<section class="card"><h2>틀린 단어 ${wr.length}개</h2><ul class="wlist">${wr.map(id => wordRow(BY_ID[id], true)).join("")}</ul>
        <p class="tiny muted">오답 노트에 저장됐어요. 두 번 연속 맞히면 빠져요.</p></section>
        <button class="btn block primary" data-act="cards-ids" data-ids="${wr.join(",")}">틀린 단어 카드로 외우기</button>` : ""}
      <button class="btn block" data-act="retest">같은 범위 다시 풀기</button>
      <button class="btn block" data-act="go" data-v="${TEST.back}">돌아가기</button></main>`;
  }
  function testSource() {
    const t = S.set.test;
    if (t.src === "wrong") return { ids: Object.keys(S.wrong).filter(id => BY_ID[id]), title: "오답 단어 테스트" };
    if (t.src === "star") return { ids: Object.keys(S.star).filter(id => BY_ID[id]), title: "별표 단어 테스트" };
    if (t.src === "recent") { const lim = addDays(today(), -6); return { ids: Object.keys(S.c).filter(id => BY_ID[id] && S.c[id].s >= lim), title: "최근 7일 단어 테스트" }; }
    if (t.src === "leech") return { ids: Object.keys(S.c).filter(id => BY_ID[id] && isLeech(id)), title: "어려운 단어 테스트" };
    const a = Math.min(t.from, t.to), b = Math.max(t.from, t.to), ids = [];
    for (let d = a; d <= b; d++) BY_DAY[t.lv][d].forEach(w => ids.push(w.id));
    return { ids, title: `${LVNAME[t.lv]} Day ${a}${a === b ? "" : "~" + b} 테스트`, key: a === b ? t.lv + a : null };
  }
  function viewTest() {
    const t = S.set.test, src = testSource();
    const dayOpts = sel => DAYS.map(d => `<option value="${d}" ${d === sel ? "selected" : ""}>Day ${d} ${esc(D.topics[d - 1])}</option>`).join("");
    const cnt = (n) => n === "all" ? `전체` : n;
    page("test", `
      <header class="top"><h1>테스트</h1></header>
      <section class="card">
        <div class="field">범위 <div class="chips">${[["day", "Day 선택"], ["wrong", `오답 (${Object.keys(S.wrong).length})`], ["star", `별표 (${Object.keys(S.star).length})`], ["recent", "최근 7일"], ["leech", "어려운 단어"]]
          .map(([v, l]) => `<button class="chip ${t.src === v ? "on" : ""}" data-act="tset" data-k="src" data-v="${v}">${l}</button>`).join("")}</div></div>
        ${t.src === "day" ? `<div class="field">단계 ${seg("tlv", t.lv, D.levels.map(l => [l.id, l.name]))}</div>
          <div class="btns2" style="margin:0 0 12px"><label class="field" style="margin:0">시작<select class="search" data-act="tday" data-k="from" style="margin:4px 0 0">${dayOpts(t.from)}</select></label>
          <label class="field" style="margin:0">끝<select class="search" data-act="tday" data-k="to" style="margin:4px 0 0">${dayOpts(t.to)}</select></label></div>` : ""}
        <div class="field">문제 유형 <div class="chips">${TYPES.map(([v, l]) => `<button class="chip ${t.type === v ? "on" : ""}" data-act="tset" data-k="type" data-v="${v}">${l}</button>`).join("")}</div></div>
        <div class="field">문제 수 ${seg("tcount", t.count, [[10, 10], [20, 20], [30, 30], ["all", "전체"]])}</div>
        <p class="small muted">${src.title} · 단어 ${src.ids.length}개 중 ${t.count === "all" ? src.ids.length : Math.min(t.count, src.ids.length)}문제</p>
        <button class="btn block primary" data-act="start-test" ${src.ids.length ? "" : "disabled"}>시작</button>
      </section>
      <section class="card small muted">
        <b style="color:var(--ink)">문제 유형</b>
        <p>뜻 고르기: 영어 단어를 보고 뜻을 고릅니다. 단어 고르기: 뜻을 보고 영어를 고릅니다.</p>
        <p>철자 쓰기: 뜻을 보고 영어를 직접 씁니다. 괄호 안 내용과 대소문자는 채점하지 않아요.</p>
        <p>듣고 고르기: 발음을 듣고 뜻을 고릅니다. 키보드로는 1~4로 고르고 Enter로 넘어가요.</p>
      </section>`);
  }

  /* ---------- 노트 ---------- */
  function viewNotes(tab) {
    tab = ["wrong", "star", "leech"].includes(tab) ? tab : "wrong";
    let ids;
    if (tab === "wrong") ids = Object.keys(S.wrong).filter(id => BY_ID[id]).sort((a, b) => S.wrong[b].c - S.wrong[a].c || S.wrong[b].ts - S.wrong[a].ts);
    else if (tab === "star") ids = Object.keys(S.star).filter(id => BY_ID[id]);
    else ids = Object.keys(S.c).filter(id => BY_ID[id] && isLeech(id)).sort((a, b) => S.c[b].l - S.c[a].l);
    const desc = { wrong: "테스트나 카드에서 틀린 단어예요. 두 번 연속 맞히면 빠져요.", star: "별표를 누른 단어예요.", leech: '카드에서 "다시"를 세 번 이상 누른 단어예요.' }[tab];
    page("notes", `
      <header class="top"><h1>노트</h1></header>
      <div class="seg wide">${[["wrong", "오답"], ["star", "별표"], ["leech", "어려운 단어"]].map(([v, l]) => `<button data-act="go" data-v="#notes/${v}" class="${tab === v ? "on" : ""}">${l}</button>`).join("")}</div>
      <p class="small muted">${desc}</p>
      ${ids.length ? `<div class="btns2" style="margin-bottom:12px"><button class="btn primary" data-act="cards-ids" data-ids="${ids.join(",")}">카드 복습</button>
        <button class="btn" data-act="note-test" data-v="${tab}">테스트</button></div>
        <section class="card"><ul class="wlist">${ids.map(id => {
          const w = BY_ID[id];
          return wordRow(w, true, tab === "wrong" ? `틀린 횟수 ${S.wrong[id].c}` : tab === "leech" ? `"다시" ${S.c[id].l}번` : "");
        }).join("")}</ul></section>
        ${tab === "wrong" ? `<button class="btn block danger" data-act="clear-wrong">오답 노트 비우기</button>` : ""}`
        : `<div class="empty">${hamster(tab === "wrong" ? "cheer" : "sleep")}아직 단어가 없어요.</div>`}`);
  }

  /* ---------- 검색 ---------- */
  function searchResults(q) {
    q = q.trim().toLowerCase();
    if (!q) return `<div class="empty">${hamster("happy")}영어 단어나 한국어 뜻으로 찾아보세요.</div>`;
    const ko = HANGUL.test(q);
    const hits = W.filter(w => ko ? w.ko.includes(q) : w.en.toLowerCase().includes(q));
    if (!ko) hits.sort((a, b) => (b.en.toLowerCase().startsWith(q) - a.en.toLowerCase().startsWith(q)) || a.en.length - b.en.length);
    if (!hits.length) return `<div class="empty">${hamster("sad")}찾는 단어가 없어요.</div>`;
    return `<p class="small muted">${hits.length}개${hits.length > 80 ? " 중 80개" : ""}</p><section class="card"><ul class="wlist">${hits.slice(0, 80).map(w => wordRow(w, true)).join("")}</ul></section>`;
  }
  let lastQ = "";
  function viewSearch() {
    page("search", `<header class="top"><h1>검색</h1></header>
      <input class="search" id="q" type="search" placeholder="예: apply, 지원" value="${esc(lastQ)}" autocomplete="off">
      <div id="sres">${searchResults(lastQ)}</div>`);
    const q = $("#q");
    q.addEventListener("input", () => { lastQ = q.value; $("#sres").innerHTML = searchResults(lastQ); });
    if (!lastQ) q.focus();
  }

  /* ---------- 설정 ---------- */
  let resetArm = false;
  function openSettings() {
    const s = S.set;
    sheet(`<h2>설정</h2>
      <div class="field">화면 ${seg("theme", s.theme, [["system", "시스템"], ["light", "밝게"], ["dark", "어둡게"]])}</div>
      <div class="field">하루 새 단어 ${seg("cap", s.cap, [[10, 10], [20, 20], [30, 30], [50, 50], [70, 70]])}</div>
      <div class="field">새 단어를 가져올 단계 <div class="chips">${D.levels.map(l => `<button class="chip ${s.lvs[l.id] ? "on" : ""}" data-act="lvs" data-v="${l.id}">${l.name}</button>`).join("")}</div></div>
      <div class="field">새 단어 순서 ${seg("order", s.order, [["day", "Day별로 단계 섞기"], ["level", "단계를 끝까지"]])}
        <span class="tiny">Day별: 기본 Day 1 → 800 Day 1 → 900 Day 1 → 기본 Day 2 순서예요.</span></div>
      <div class="field">카드 앞면 ${seg("front", s.front, [["en", "영어"], ["ko", "뜻"]])}
        <label class="switch"><input type="checkbox" data-act="extra" ${s.extra ? "checked" : ""}> 카드 뒷면에 파생어와 유의어 보기</label></div>
      <div class="field">발음 속도 ${seg("tts-rate", s.rate, [[0.7, "느리게"], [0.9, "보통"], [1.1, "빠르게"]])}
        <label class="switch"><input type="checkbox" data-act="auto" ${s.auto ? "checked" : ""}> 영어 단어가 나오면 자동으로 읽기</label></div>
      <section class="card">
        <b>백업</b><p class="small muted">기록은 이 기기의 브라우저에만 저장돼요. 기기를 바꾸거나 앱을 지우기 전에 파일로 저장하세요.${s.lastBackup ? ` 마지막 백업 ${s.lastBackup}.` : ""}</p>
        <div class="btns2"><button class="btn" data-act="export">파일로 저장</button><button class="btn" data-act="import">파일 불러오기</button></div>
      </section>
      <button class="btn block danger" data-act="reset">${resetArm ? "한 번 더 누르면 모든 기록이 지워져요" : "기록 초기화"}</button>
      <p class="tiny muted" style="text-align:center;margin-top:12px">단어 ${W.length}개 · 기본 ${D.words.b.flat().length} · 800점 ${D.words.e.flat().length} · 900점 ${D.words.n.flat().length}</p>`);
  }
  function exportData() {
    const name = "voca-daily-backup-" + today() + ".json";
    const blob = new Blob([JSON.stringify({ app: "voca-daily", v: 1, date: today(), data: S })], { type: "application/json" });
    const done = () => { S.set.lastBackup = today(); save(); toast("백업 파일을 만들었어요"); route(); };
    const file = typeof File === "function" ? new File([blob], name, { type: "application/json" }) : null;
    if (file && /Android|iPhone|iPad/i.test(navigator.userAgent) && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: name }).then(done).catch(() => {});
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    done();
  }
  function importFile(f) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const j = JSON.parse(r.result), d = j && j.data;
        if (!d || d.v !== 1 || typeof d.c !== "object") throw new Error("bad");
        if (!confirm(`${j.date || ""} 백업을 불러올까요? 지금 기록은 백업 내용으로 바뀌어요.`)) return;
        S = merge(d); save(); applyTheme(); closeSheet(); toast("백업을 불러왔어요"); route();
      } catch (e) { toast("보카 데일리 백업 파일이 아니에요"); }
    };
    r.readAsText(f);
  }

  /* ---------- 이벤트 ---------- */
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el) return;
    const a = el.dataset.act, v = el.dataset.v;
    if (el.tagName === "SELECT" || (el.tagName === "INPUT" && el.type === "checkbox")) return;
    switch (a) {
      case "close-sheet": closeSheet(); break;
      case "go": closeSheet(); if (location.hash === v) route(); else location.hash = v; break;
      case "settings": resetArm = false; openSettings(); break;
      case "theme": S.set.theme = v; applyTheme(); save(); openSettings(); break;
      case "cap": S.set.cap = +v; save(); openSettings(); route(); break;
      case "lvs": S.set.lvs[v] = !S.set.lvs[v]; if (!LVS.some(l => S.set.lvs[l])) { S.set.lvs[v] = true; toast("한 단계는 켜 두어야 해요"); } save(); openSettings(); route(); break;
      case "order": S.set.order = v; save(); openSettings(); break;
      case "front": S.set.front = v; save(); openSettings(); break;
      case "tts-rate": S.set.rate = +v; save(); openSettings(); speak("Welcome to the job fair"); break;
      case "export": exportData(); break;
      case "import": $("#file-in").click(); break;
      case "reset":
        if (!resetArm) { resetArm = true; openSettings(); break; }
        resetArm = false; S = fresh(); save(); applyTheme(); closeSheet(); toast("기록을 초기화했어요"); location.hash = "#home"; route(); break;
      case "say": speak(BY_ID[el.dataset.id].en); break;
      case "star": {
        const id = el.dataset.id; if (S.star[id]) delete S.star[id]; else S.star[id] = Date.now();
        save(); el.classList.toggle("on", !!S.star[id]); break;
      }
      case "reveal": el.querySelectorAll(".w-en, .w-ko").forEach(x => x.classList.toggle("shown")); break;
      case "hide": S.set.hide = v; save(); { const l = $("#wlist"); l.className = "wlist " + (v === "ko" ? "hide-ko" : v === "en" ? "hide-en" : ""); }
        el.parentNode.querySelectorAll("button").forEach(b => b.classList.toggle("on", b === el)); break;
      case "dlv": S.set.dlv = v; save(); viewDays(); break;
      case "start-today": {
        const ids = dueIds().slice(0, 300).concat(newIds(newLeft()));
        startCards(ids, "오늘의 학습", "#home"); break;
      }
      case "more-new": startCards(newIds(10), "새 단어 10개", "#home"); break;
      case "day-cards": { const lv = el.dataset.lv, d = +el.dataset.d; startCards(BY_DAY[lv][d].map(w => w.id), `${LVNAME[lv]} Day ${d}`, `#day/${lv}/${d}`); break; }
      case "day-test": {
        const lv = el.dataset.lv, d = +el.dataset.d;
        Object.assign(S.set.test, { src: "day", lv, from: d, to: d }); save();
        buildTest(BY_DAY[lv][d].map(w => w.id), S.set.test.type, 0, `${LVNAME[lv]} Day ${d} 테스트`, lv + d, `#day/${lv}/${d}`); break;
      }
      case "cards-ids": startCards(shuffle(el.dataset.ids.split(",").filter(id => BY_ID[id])), "복습", location.hash.startsWith("#notes") ? location.hash : "#home"); break;
      case "flip": if (SESS && !SESS.flipped) { SESS.flipped = true; if (S.set.front === "ko" && S.set.auto) speak(BY_ID[SESS.queue[0]].en); viewStudy(); } break;
      case "rate": rateCard(+el.dataset.g); break;
      case "undo": undoCard(); break;
      case "tset": S.set.test[el.dataset.k] = v; save(); viewTest(); break;
      case "tlv": S.set.test.lv = v; save(); viewTest(); break;
      case "tcount": S.set.test.count = v === "all" ? "all" : +v; save(); viewTest(); break;
      case "start-test": {
        const s = testSource(), t = S.set.test;
        buildTest(s.ids, t.type, t.count === "all" ? 0 : t.count, s.title, s.key, "#test"); break;
      }
      case "note-test": {
        S.set.test.src = v; save(); const s = testSource();
        buildTest(s.ids, S.set.test.type, 0, s.title, null, "#notes/" + v); break;
      }
      case "pick": if (TEST && !TEST.ans) { const it = TEST.items[TEST.i]; answer(el.dataset.id === it.id, { pick: el.dataset.id }); } break;
      case "hint": TEST.hint = true; viewTestRun(); break;
      case "submit-spell": submitSpell(); break;
      case "tnext": if (TEST && TEST.ans) { TEST.i++; TEST.ans = null; TEST.hint = false; viewTestRun(); } break;
      case "retest": { const t = TEST; buildTest([...new Set(t.items.map(x => x.id))], S.set.test.type, 0, t.title, t.key, t.back); break; }
      case "clear-wrong": if (confirm("오답 노트를 모두 비울까요?")) { S.wrong = {}; save(); route(); } break;
    }
  });
  document.addEventListener("change", e => {
    const el = e.target;
    if (el.id === "file-in" && el.files[0]) { importFile(el.files[0]); el.value = ""; }
    else if (el.dataset.act === "tday") { S.set.test[el.dataset.k] = +el.value; save(); viewTest(); }
    else if (el.dataset.act === "auto") { S.set.auto = el.checked; save(); }
    else if (el.dataset.act === "extra") { S.set.extra = el.checked; save(); }
  });
  function submitSpell() {
    const ti = $("#typein"); if (!ti || !TEST || TEST.ans) return;
    const typed = ti.value; if (!typed.trim()) { ti.focus(); return; }
    const w = BY_ID[TEST.items[TEST.i].id];
    answer(norm(typed) === norm(w.en), { typed });
  }
  document.addEventListener("keydown", e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const h = location.hash, inInput = e.target.tagName === "INPUT" || e.target.tagName === "SELECT";
    if (h === "#study" && SESS && !inInput) {
      if ((e.key === " " || e.key === "Enter") && !SESS.flipped) { e.preventDefault(); $("[data-act=flip]").click(); }
      else if (SESS.flipped && "1234".includes(e.key) && e.key.length === 1) rateCard(+e.key - 1);
      else if (e.key === "z" || e.key === "u") undoCard();
    } else if (h === "#trun" && TEST && TEST.i < TEST.items.length) {
      const it = TEST.items[TEST.i];
      if (e.key === "Enter") {
        e.preventDefault();
        if (TEST.ans) $("[data-act=tnext]").click(); else if (it.t === "spell") submitSpell();
      } else if (!inInput && !TEST.ans && it.opts && "1234".includes(e.key) && e.key.length === 1) {
        const b = document.querySelectorAll(".opt")[+e.key - 1]; if (b) b.click();
      }
    }
  });

  /* ---------- 라우터 ---------- */
  function route() {
    const [r, a, b] = (location.hash.slice(1) || "home").split("/");
    if (r !== "study" && SESS && !SESS.queue.length) SESS = null;
    switch (r) {
      case "days": viewDays(); break;
      case "day": viewDay(a, +b); break;
      case "study": viewStudy(); break;
      case "test": viewTest(); break;
      case "trun": viewTestRun(); break;
      case "notes": viewNotes(a); break;
      case "search": viewSearch(); break;
      default: viewHome();
    }
  }
  window.addEventListener("hashchange", () => { closeSheet(); route(); });
  applyTheme();
  route();
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
