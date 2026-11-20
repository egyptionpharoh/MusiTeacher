// صفحة اللعبة: شاشة الرمز (خطوة واحدة) ثم تشغيل اللعبة. لا يوجد هنا أي سر: التحقق كله على الخادم.
(function () {
  var game = document.body.getAttribute('data-game');
  var $ = function (s) { return document.querySelector(s); };
  var form = $('#gate-form'), input = $('#code'), msg = $('#msg'), go = $('#go'), frame = $('#frame'), banner = $('#banner');
  var keep = null;

  function say(text, ok) { msg.textContent = text || ''; msg.className = 'msg' + (ok ? ' ok' : ''); }
  function api(url, opt) {
    return fetch(url, Object.assign({ credentials: 'same-origin', cache: 'no-store' }, opt || {}))
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .catch(function () { return { ok: false, net: true }; });
  }
  function check() { return api('/api/session?game=' + encodeURIComponent(game)); }

  function start(play) {
    document.body.classList.add('playing');
    if (frame.getAttribute('src') !== play) frame.setAttribute('src', play);
    clearInterval(keep);
    // نسأل كل 10 دقائق إن كانت صلاحية الرمز ما زالت قائمة. لا نوقف اللعب فجأة: ننبّه فقط.
    keep = setInterval(function () {
      check().then(function (r) {
        if (!r.ok && r.ended) { banner.textContent = (r.message || 'انتهت صلاحية رمز هذه اللعبة.') + ' يمكنك إكمال ما تفعله الآن.'; banner.classList.add('show'); clearInterval(keep); }
      });
    }, 10 * 60 * 1000);
  }
  function gate(text) {
    document.body.classList.remove('playing');
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
        if (r.ok) { say('تم! جارٍ فتح اللعبة…', true); start(r.play); return; }
        say(r.net ? 'تعذّر الاتصال بالإنترنت. تحقّق من الاتصال ثم حاول مرة أخرى.' : (r.message || 'الرمز غير صحيح. حاول مرة أخرى.'));
        input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake'); input.select();
      });
  });
  // كتابة الأرقام فقط (يقبل الأرقام العربية ٠١٢٣ أيضًا)
  input.addEventListener('input', function () { input.value = input.value.replace(/[^0-9٠-٩۰-۹]/g, '').slice(0, 6); if (msg.textContent) say(''); });

  var fs = $('#fs');
  if (fs) fs.addEventListener('click', function () {
    var el = $('#stage');
    if (document.fullscreenElement) document.exitFullscreen();
    else if (el.requestFullscreen) el.requestFullscreen().catch(function () {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  });

  // عند فتح الصفحة: إن كانت لدى الطالب جلسة صالحة تبدأ اللعبة مباشرة (لا يُطلب الرمز بعد التحديث)
  check().then(function (r) { if (r.ok) start(r.play); else gate(r.ended ? r.message : ''); });
})();
