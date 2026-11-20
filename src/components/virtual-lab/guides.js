// إرشادات مشغّل الألعاب في MusiTeacher: تنبيه الأجهزة الصغيرة + إرشاد ملء الشاشة.
// نفس المنطق المستعمل والمختبَر في MusiTeacher Games (public/assets/mtg-ui.js) — يُستدعى من داخل useEffect فقط (متصفح).
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* وضع التصفح الخاص */ } },
  };
  var reduced = function () { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  function el(tag, cls, html) { var x = document.createElement(tag); if (cls) x.className = cls; if (html != null) x.innerHTML = html; return x; }
  var _mb = function (b) { return (b / 1048576).toLocaleString('ar-EG', { maximumFractionDigits: b > 10485760 ? 0 : 1 }) + ' ميجابايت'; };
  var _date = function (sec) { try { return new Date(sec * 1000).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return ''; } };

  // ======================= تصنيف الجهاز (مساحة الشاشة + طبيعة اللمس، وليس اسم المتصفح وحده) =======================
  var deviceClass = function () {
    var mq = function (q) { try { return matchMedia(q).matches; } catch (e) { return false; } };
    var minSide = Math.min(screen.width || innerWidth, screen.height || innerHeight);
    var touchOnly = mq('(pointer: coarse)') && !mq('(hover: hover)');
    var uaMobile = navigator.userAgentData ? !!navigator.userAgentData.mobile : /Mobi|iPhone|iPod|Android.+Mobile/i.test(navigator.userAgent || '');
    if (touchOnly) return (minSide < 600 || uaMobile) ? 'phone' : 'tablet';
    if (uaMobile && minSide < 600) return 'phone';
    return 'desktop';
  };

  // ======================= تنبيه الأجهزة الصغيرة =======================
  // يظهر فقط حين يكون الجهاز أصغر مما تحتاجه اللعبة، لا يمنع اللعب، ويمكن إيقافه نهائيًا.
  var deviceAdvice = function (gameClass, done) {
    var dev = deviceClass(), need = gameClass || 'desktop';
    var show = (dev === 'phone' && need !== 'mobile') || (dev === 'tablet' && need === 'desktop');
    if (!show || store.get('mtg.devAdvice.off', false)) { if (done) done(false); return false; }
    var portrait = innerHeight > innerWidth;
    var box = el('div', 'mtg-advice', '<div class="mtg-advice-card" role="dialog" aria-modal="true" aria-labelledby="mtg-adv-t">' +
      '<div class="mtg-advice-ic" aria-hidden="true">' + (dev === 'phone' ? '📱➜🖥️' : '💻➜🖥️') + '</div>' +
      '<h2 id="mtg-adv-t">مرحبًا بك في عالم MusiTeacher!</h2>' +
      (dev === 'phone'
        ? '<p>صُممت هذه اللعبة لتمنحك أفضل تجربة على الشاشات الكبيرة: الحاسوب المحمول أو المكتبي أو السبورة الذكية. افتحها من جهاز بشاشة أكبر لتستمتع بكل تفاصيلها وأدواتها التفاعلية.</p>'
        : '<p>تعمل هذه اللعبة على الجهاز اللوحي، لكن تفاصيلها وأدواتها تظهر بأفضل صورة على شاشة الحاسوب أو السبورة الذكية.</p>') +
      (dev === 'phone' && portrait ? '<p class="mtg-advice-tip">💡 إن تابعت على الهاتف: أدِر الهاتف أفقيًا لمساحة أكبر.</p>' : '') +
      '<button type="button" class="btn sun wide" data-go>متابعة على أي حال</button>' +
      '<label class="mtg-advice-never"><input type="checkbox" data-never> لا تُظهر هذه الرسالة مجددًا</label></div>');
    document.body.appendChild(box);
    var go = box.querySelector('[data-go]');
    setTimeout(function () { try { go.focus({ preventScroll: true }); } catch (e) { go.focus(); } }, 30);
    function close() {
      if (box.querySelector('[data-never]').checked) store.set('mtg.devAdvice.off', true);
      box.classList.add('out'); setTimeout(function () { box.remove(); }, reduced() ? 0 : 220);
      document.removeEventListener('keydown', esc); if (done) done(true);
    }
    function esc(ev) { if (ev.key === 'Escape') close(); }
    go.addEventListener('click', close); document.addEventListener('keydown', esc);
    return true;
  };

  // ======================= إرشاد ملء الشاشة =======================
  // سهم متحرك يشير إلى زر ⛶ الحقيقي أينما كان على الشاشة (يُحسب موضعه من الزر نفسه، ويتبعه عند تغيّر المقاس).
  // يظهر في أول 3 مرات تُفتح فيها لعبة فقط، ويختفي نهائيًا عند استعمال ملء الشاشة أو الضغط على «فهمت».
  var fullscreenHint = function (target, opts) {
    opts = opts || {};
    var KEY = 'mtg.fsHint', st = store.get(KEY, { n: 0, done: false });
    var canFs = document.fullscreenEnabled || document.webkitFullscreenEnabled;
    if (!target || !canFs || st.done || st.n >= 3 || document.fullscreenElement) return null;
    var r0 = target.getBoundingClientRect(); if (!r0.width) return null;
    st.n++; store.set(KEY, st);
    var tip = el('div', 'mtg-fs-hint' + (reduced() ? ' still' : ''),
      '<span class="mtg-fs-arrow" aria-hidden="true"></span>' +
      '<span class="mtg-fs-txt"><b>كبّر الشاشة ⛶</b> لتعيش تجربة تعليمية أوضح وأمتع!</span>' +
      '<button type="button" class="mtg-fs-ok">فهمت</button>');
    tip.setAttribute('role', 'status'); tip.setAttribute('aria-live', 'polite');
    document.body.appendChild(tip); target.classList.add('mtg-attn');
    function place() {
      var r = target.getBoundingClientRect(), W = innerWidth, tw = tip.offsetWidth, th = tip.offsetHeight, gap = 30;   // طول السهم 22px + 8px هواء: رأس السهم يشير للزر دون أن يلمسه
      // لا يغطي أي زر أو رابط آخر في نفس الشريط (مثل زر «العب دون إنترنت» أو عنوان اللعبة)
      var bar = target.closest(opts.within || 'header, .top, .vlp-top') || target.parentElement;
      var others = [].slice.call(bar.querySelectorAll('button, a, .title-sm, h1')).filter(function (x) { return x !== target && !tip.contains(x) && x.offsetParent !== null; })
        .map(function (x) { return x.getBoundingClientRect(); });
      var hits = function (L, T) { return others.some(function (o) { return !(L + tw <= o.left || L >= o.right || T + th <= o.top || T >= o.bottom); }); };
      var midT = r.top + r.height / 2 - th / 2, side;
      if (W - r.right >= tw + gap + 8 && !hits(r.right + gap, midT)) side = 'right';
      else if (r.left >= tw + gap + 8 && !hits(r.left - gap - tw, midT)) side = 'left';
      else side = 'below';
      tip.setAttribute('data-side', side);
      var top, left;
      if (side === 'below') { top = r.bottom + gap; left = Math.max(8, Math.min(W - tw - 8, r.left + r.width / 2 - tw / 2)); tip.style.setProperty('--ax', (r.left + r.width / 2 - left) + 'px'); }
      else { top = r.top + r.height / 2 - th / 2; left = side === 'right' ? r.right + gap : r.left - gap - tw; }
      tip.style.top = Math.max(6, top) + 'px'; tip.style.left = left + 'px';
    }
    place(); requestAnimationFrame(place);
    var timer = setTimeout(function () { hide(false); }, opts.duration || 14000);
    function hide(forever) {
      if (!tip.parentNode) return;
      clearTimeout(timer); removeEventListener('resize', place); removeEventListener('scroll', place, true);
      target.classList.remove('mtg-attn');
      if (forever) { st.done = true; store.set(KEY, st); }
      tip.classList.add('out'); setTimeout(function () { tip.remove(); }, reduced() ? 0 : 250);
    }
    addEventListener('resize', place); addEventListener('scroll', place, true);
    tip.querySelector('.mtg-fs-ok').addEventListener('click', function () { hide(true); });
    target.addEventListener('click', function () { hide(true); }, { once: true });
    document.addEventListener('fullscreenchange', function () { if (document.fullscreenElement) hide(true); }, { once: true });
    return { hide: hide, el: tip };
  };


export { deviceClass, deviceAdvice, fullscreenHint };
