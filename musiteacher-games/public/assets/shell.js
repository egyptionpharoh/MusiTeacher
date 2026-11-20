// صفحة اللعبة: شاشة الرمز (خطوة واحدة) ثم تشغيل اللعبة. لا يوجد هنا أي سر: التحقق كله على الخادم.
// + إرشاد ملء الشاشة، تنبيه الأجهزة الصغيرة، وحفظ اللعبة للعمل دون إنترنت (بعد الدخول بالرمز فقط).
(function () {
  var MTG = window.MTG || {}, OFF = MTG.offline || { supported: false };
  var B = document.body, game = B.getAttribute('data-game'), version = B.getAttribute('data-version');
  var $ = function (s) { return document.querySelector(s); };
  var form = $('#gate-form'), input = $('#code'), msg = $('#msg'), go = $('#go'), frame = $('#frame'), banner = $('#banner');
  var fsBtn = $('#fs'), offBtn = $('#off'), box = $('#offbox');
  var keep = null, hinted = false, advising = false, mode = 'online';

  function say(text, ok) { msg.textContent = text || ''; msg.className = 'msg' + (ok ? ' ok' : ''); }
  function api(url, opt) {
    return fetch(url, Object.assign({ credentials: 'same-origin', cache: 'no-store' }, opt || {}))
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .catch(function () { return { ok: false, net: true }; });
  }
  function check() { return api('/api/session?game=' + encodeURIComponent(game)); }
  var noteT = null;
  function note(text, kind) {
    banner.textContent = text; banner.className = 'banner show' + (kind ? ' ' + kind : '');
    clearTimeout(noteT); if (kind === 'off') noteT = setTimeout(function () { banner.classList.remove('show'); }, 7000);   // لا يغطي اللعبة طويلًا
  }

  // ملء الشاشة: يُخفى الزر على الأجهزة التي لا تدعمه (مثل iPhone) بدل أن يكون زرًا بلا فائدة
  var canFs = document.fullscreenEnabled || document.webkitFullscreenEnabled;
  if (fsBtn && !canFs) fsBtn.hidden = true;
  if (fsBtn) fsBtn.addEventListener('click', function () {
    var el = $('#stage');
    if (document.fullscreenElement) document.exitFullscreen();
    else if (el.requestFullscreen) el.requestFullscreen().catch(function () {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  });
  function hintSoon() {
    if (hinted || advising || !MTG.fullscreenHint || !fsBtn || fsBtn.hidden) return;
    hinted = true; setTimeout(function () { MTG.fullscreenHint(fsBtn); }, 1400);
  }

  function start(play) {
    B.classList.add('playing');
    if (frame.getAttribute('src') !== play) frame.setAttribute('src', play);
    frame.addEventListener('load', hintSoon, { once: true });
    clearInterval(keep);
    if (mode === 'online') {
      // نسأل كل 10 دقائق إن كانت صلاحية الرمز ما زالت قائمة. لا نوقف اللعب فجأة: ننبّه فقط.
      keep = setInterval(function () {
        check().then(function (r) {
          if (!r.ok && r.ended) { note((r.message || 'انتهت صلاحية رمز هذه اللعبة.') + ' يمكنك إكمال ما تفعله الآن.'); clearInterval(keep); }
        });
      }, 10 * 60 * 1000);
      offlineReady(true);
    }
  }
  function gate(text) {
    B.classList.remove('playing');
    say(text || '');
    setTimeout(function () { try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); } }, 50);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var code = (input.value || '').trim();
    if (!code) { say('اكتب الرمز الذي أرسله معلمك.'); input.focus(); return; }
    go.disabled = true; var old = go.innerHTML; go.innerHTML = '<span class="loading" aria-hidden="true"></span> جارٍ التحقق…'; say('');
    api('/api/enter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: game, code: code }) })
      .then(function (r) {
        go.disabled = false; go.innerHTML = old;
        if (r.ok) { mode = 'online'; say('تم! جارٍ فتح اللعبة…', true); start(r.play); return; }
        say(r.net ? 'تعذّر الاتصال بالإنترنت. تحقّق من الاتصال ثم حاول مرة أخرى.' : (r.message || 'الرمز غير صحيح. حاول مرة أخرى.'));
        input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake'); input.select();
      });
  });
  // كتابة الأرقام فقط (يقبل الأرقام العربية ٠١٢٣ أيضًا)
  input.addEventListener('input', function () { input.value = input.value.replace(/[^0-9٠-٩۰-۹]/g, '').slice(0, 6); if (msg.textContent) say(''); });

  // ======================= اللعب دون إنترنت =======================
  var level = B.getAttribute('data-offline'), bytes = +B.getAttribute('data-bytes') || 0;
  var canOffline = OFF.supported && !!level;
  function setBtn(st) {
    if (!offBtn) return;
    offBtn.hidden = !canOffline;
    offBtn.classList.toggle('done', st === 'ready');
    offBtn.classList.toggle('warn', st === 'update' || st === 'expired');
    offBtn.querySelector('.lbl').textContent = st === 'ready' ? 'محفوظة دون إنترنت' : st === 'update' ? 'تحديث متاح' : 'العب دون إنترنت';
    offBtn.querySelector('.ic').textContent = st === 'ready' ? '✓' : st === 'update' ? '⟳' : '⤓';
  }
  // بعد الدخول بالرمز: إن كانت اللعبة محفوظة نجدّد صلاحيتها بصمت (دون تنزيل) ونعرض حالتها
  function offlineReady(renew) {
    if (!canOffline) return;
    OFF.status(game, version).then(function (s) {
      setBtn(s.state);
      if (renew && (s.state === 'ready' || s.state === 'expired')) {
        OFF.prepare(game, null, { renewOnly: true }).promise.then(function () { return OFF.status(game, version); }).then(function (s2) { setBtn(s2.state); }).catch(function () {});
      }
    });
  }
  var closeTimer = null;   // مؤقّت إغلاق اللوحة بعد النجاح؛ يُلغى إن فُتحت لوحة جديدة قبل انتهائه
  function panel(s) {
    clearTimeout(closeTimer);
    var g = s.g, html = '<div class="offcard" role="dialog" aria-modal="true" aria-labelledby="off-t"><button type="button" class="x" data-close aria-label="إغلاق">✕</button>' +
      '<h2 id="off-t">📴 العب دون إنترنت</h2>';
    if (s.state === 'ready') html += '<p class="ok">✓ هذه اللعبة محفوظة على هذا الجهاز وتعمل دون إنترنت حتى <b>' + MTG.date(g.until) + '</b>.</p><p class="sm">تتجدد صلاحيتها تلقائيًا كلما فتحتها بالرمز مع وجود الإنترنت.</p>';
    else if (s.state === 'update') html += '<p class="warn">يوجد إصدار أحدث من هذه اللعبة. حدّث الملفات المحفوظة لتحصل على آخر التحسينات.</p>';
    else if (s.state === 'expired') html += '<p class="warn">انتهت صلاحية النسخة المحفوظة. جدّدها الآن (يتطلب رمزًا ما زال صالحًا).</p>';
    else html += '<p>احفظ هذه اللعبة على هذا الجهاز لتعمل لاحقًا حتى لو انقطع الإنترنت في المدرسة.</p>' +
      '<ul class="sm"><li>حجم التنزيل التقريبي: <b>' + (bytes ? MTG.mb(bytes) : '—') + '</b></li><li>تبقى صالحة حتى انتهاء صلاحية الرمز، وبحد أقصى 7 أيام، وتتجدد كلما فُتحت بالرمز مع الإنترنت.</li>' +
      (level === 'adaptable' ? '<li>تعتمد هذه اللعبة على مكتبة من موقع خارجي، وسنحفظها معها.</li>' : '') + '</ul>';
    html += '<div class="bar" hidden><i></i></div><p class="msg" data-m role="status" aria-live="polite"></p><div class="acts">';
    if (s.state === 'none') html += '<button type="button" class="btn sun" data-act="save">⤓ حفظ للعمل دون إنترنت</button>';
    if (s.state === 'update' || s.state === 'expired') html += '<button type="button" class="btn sun" data-act="update">⟳ تحديث ملفات اللعبة</button>';
    if (s.state === 'ready') html += '<button type="button" class="btn ghost-d" data-act="update">⟳ تحديث ملفات اللعبة</button>';
    if (s.state !== 'none') html += '<button type="button" class="btn ghost-d" data-act="remove">🗑 حذف من هذا الجهاز</button>';
    html += '</div></div>';
    box.innerHTML = html; box.hidden = false;
    var m = box.querySelector('[data-m]'), bar = box.querySelector('.bar'), fill = bar.querySelector('i'), job = null;
    box.querySelector('[data-close]').onclick = close;
    box.onclick = function (ev) { if (ev.target === box) close(); };
    function close() { if (job) job.cancel(); box.hidden = true; box.innerHTML = ''; offBtn.focus(); }
    [].forEach.call(box.querySelectorAll('[data-act]'), function (b) {
      b.onclick = function () {
        var act = b.getAttribute('data-act');
        [].forEach.call(box.querySelectorAll('[data-act]'), function (x) { x.disabled = true; });
        if (act === 'remove') {
          OFF.remove(game).then(function () { m.textContent = 'حُذفت النسخة المحفوظة من هذا الجهاز.'; setBtn('none'); closeTimer = setTimeout(close, 1200); });
          return;
        }
        bar.hidden = false; m.textContent = 'جارٍ تجهيز اللعبة… لا تغلق الصفحة.';
        job = OFF.prepare(game, function (d, t) { fill.style.width = Math.round(d / Math.max(t, 1) * 100) + '%'; m.textContent = 'جارٍ الحفظ: ' + d + ' من ' + t + ' ملف'; }, { force: act === 'update' });
        job.promise.then(function (r) {
          job = null; fill.style.width = '100%';
          m.className = 'msg ok'; m.textContent = '✓ اكتمل التجهيز! تعمل اللعبة الآن دون إنترنت حتى ' + MTG.date(r.g.until) + '.';
          setBtn('ready'); closeTimer = setTimeout(close, 2200);
        }, function (e) {
          job = null; bar.hidden = true; m.className = 'msg'; m.textContent = e.message || 'تعذّر التجهيز.';
          [].forEach.call(box.querySelectorAll('[data-act]'), function (x) { x.disabled = false; });
          if (e.ended) note(e.message);
        });
      };
    });
  }
  if (offBtn) offBtn.addEventListener('click', function () { OFF.status(game, version).then(panel); });

  function startOffline(g) {
    mode = 'offline';
    B.classList.add('offline');
    note('📴 تعمل الآن دون إنترنت — النسخة المحفوظة صالحة حتى ' + MTG.date(g.until) + '.', 'off');
    start('/g/' + encodeURIComponent(game) + '/' + (g.entryRel || 'index.html'));
  }

  // ======================= بدء الصفحة =======================
  var devClass = B.getAttribute('data-devices') || '';
  if (MTG.deviceAdvice) advising = MTG.deviceAdvice(devClass, function () { advising = false; if (B.classList.contains('playing')) hintSoon(); });
  setBtn('none');
  // إن كانت لدى الطالب جلسة صالحة تبدأ اللعبة مباشرة؛ وإن لم يوجد إنترنت نستعمل النسخة المحفوظة (إن وُجدت وصلحت)
  check().then(function (r) {
    if (r.ok) { mode = 'online'; start(r.play); return; }
    if (r.net && canOffline) {
      return OFF.status(game, version).then(function (s) {
        if (s.state === 'ready' || s.state === 'update') return startOffline(s.g);
        gate(s.state === 'expired' ? 'لا يوجد اتصال بالإنترنت، وانتهت صلاحية النسخة المحفوظة من هذه اللعبة.' : 'لا يوجد اتصال بالإنترنت. اتصل ثم أدخل رمز اللعبة.');
      });
    }
    gate(r.ended ? r.message : (r.net ? 'لا يوجد اتصال بالإنترنت. اتصل ثم أدخل رمز اللعبة.' : ''));
  });
})();
