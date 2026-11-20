// توليد صفحات المشروع الثابتة (المكتبة + صفحة لكل لعبة + أغلفة بديلة) من سجل الألعاب.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const head = (title, desc) => `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="referrer" content="same-origin">
<meta name="theme-color" content="#113f67">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<link rel="icon" href="/assets/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/mtg.css?v=${Date.now().toString(36)}"></head>`;

const topBar = (extra = '') => `<header class="top"><div class="top-in">
  <a class="brand" href="/" aria-label="MusiTeacher Games — المكتبة"><img src="/assets/logo.png" alt=""><b>MusiTeacher <span>Games</span></b></a>
  <span class="sp"></span>${extra}</div></header>`;

export function libraryPage(games, cats) {
  const used = [...new Set(games.map((g) => g.category))].filter((c) => cats[c]);
  return `${head('MusiTeacher Games — مكتبة الألعاب الموسيقية', 'ألعاب موسيقية تعليمية تفاعلية من MusiTeacher')}
<body>${topBar()}
<section class="hero"><h1>العب وتعلّم الموسيقى</h1>
  <p>اختر لعبتك، ثم اكتب رمز اللعبة الذي أرسله لك معلمك — وابدأ فورًا. لا تحتاج إلى حساب أو كلمة مرور.</p></section>
<nav class="tools" aria-label="التصنيفات">
  <button class="chip on" data-cat="all" aria-pressed="true">كل الألعاب (${games.length})</button>
  ${used.map((c) => `<button class="chip" data-cat="${esc(c)}" aria-pressed="false">${esc(cats[c].label)} (${games.filter((g) => g.category === c).length})</button>`).join('\n  ')}
  <label class="sr" for="q">ابحث عن لعبة</label><input id="q" class="search" type="search" placeholder="ابحث عن لعبة…" autocomplete="off">
</nav>
<main class="grid">
${games.map((g) => `  <article class="gcard" data-cat="${esc(g.category)}" data-text="${esc(g.title + ' ' + (g.tags || []).join(' '))}">
    <a class="pic" href="/games/${g.id}" tabindex="-1" aria-hidden="true"><img src="${esc(g.cover)}" alt="" loading="lazy"></a>
    <div class="body"><span class="cat">${esc((cats[g.category] || {}).label || 'لعبة')}</span>
      <h2>${esc(g.title)}</h2><p>${esc(g.description)}</p>
      <a class="btn go" href="/games/${g.id}">▶ العب الآن</a></div></article>`).join('\n')}
  <p class="empty" id="empty" hidden>لا توجد لعبة بهذا الاسم.</p>
</main>
<p class="foot">© MusiTeacher Games – All Rights Reserved – ${new Date().getFullYear()}</p>
<script src="/assets/library.js" defer></script></body></html>
`;
}

export function gamePage(g, cats) {
  const cat = (cats[g.category] || {}).label || '';
  return `${head(`${g.title} — MusiTeacher Games`, g.description)}
<body data-game="${esc(g.id)}">${topBar(`<span class="title-sm">${esc(g.title)}</span>
  <button class="btn ghost" id="fs" type="button" title="ملء الشاشة">⛶ <span class="lbl">ملء الشاشة</span></button>`)}
<main class="gate"><div class="gate-card">
  <div class="pic"><img src="${esc(g.cover)}" alt=""></div>
  <form class="in" id="gate-form" autocomplete="off" novalidate>
    <h1>${esc(g.title)}</h1>
    <p class="lead">${cat ? esc(cat) + ' · ' : ''}أدخل رمز اللعبة</p>
    <label class="sr" for="code">رمز اللعبة</label>
    <input id="code" class="code" name="code" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" maxlength="6" placeholder="••••••" required>
    <p class="msg" id="msg" role="status" aria-live="polite"></p>
    <button class="btn sun wide" id="go" type="submit">▶ ابدأ اللعب</button>
    <p class="note">الرمز من معلمك. لا حاجة لحساب أو بريد أو كلمة مرور.</p>
  </form></div></main>
<section class="stage-wrap"><div class="stage" id="stage">
  <div class="banner" id="banner" role="status"></div>
  <iframe id="frame" title="${esc(g.title)}" allow="autoplay; fullscreen; pointer-lock; accelerometer; gyroscope; midi"
    sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-modals${g.allowDownloads ? ' allow-downloads' : ''}" referrerpolicy="same-origin"></iframe>
</div></section>
<script src="/assets/shell.js" defer></script></body></html>
`;
}

/** غلاف بديل (SVG) للألعاب التي ليس لها صورة غلاف في MusiTeacher */
const PALETTE = { strings: ['#7b3fa0', '#c06bd1'], keys: ['#113f67', '#2f7fb5'], percussion: ['#b4462f', '#f08a4b'], scales: ['#1f7a5c', '#3fb68b'], notation: ['#7a5a12', '#f6b73c'] };
export function coverSvg(g, cats) {
  const [a, b] = PALETTE[g.category] || ['#113f67', '#226597'];
  const t = esc(g.title).slice(0, 60);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<rect width="1280" height="720" fill="url(#g)"/>
<g fill="#fff" opacity=".13" font-family="Arial, sans-serif" font-size="150"><text x="90" y="200">♪</text><text x="980" y="260">♫</text><text x="300" y="640">♩</text><text x="1050" y="650">♬</text><text x="620" y="180">♪</text></g>
<circle cx="640" cy="300" r="128" fill="#fff" opacity=".16"/>
<text x="640" y="355" text-anchor="middle" fill="#fff" font-family="Arial, sans-serif" font-size="170">♫</text>
<text x="640" y="560" text-anchor="middle" fill="#fff" font-family="Cairo, Tahoma, Arial, sans-serif" font-size="64" font-weight="700" direction="rtl">${t}</text>
<text x="640" y="630" text-anchor="middle" fill="#fff" opacity=".8" font-family="Cairo, Tahoma, Arial, sans-serif" font-size="34" direction="rtl">${esc((cats[g.category] || {}).label || '')}</text>
</svg>`;
}
