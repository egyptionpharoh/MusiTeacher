// مكتبة الألعاب: تصفية حسب التصنيف + بحث بالاسم + حالة الألعاب المحفوظة للعمل دون إنترنت على هذا الجهاز.
(function () {
  var cards = [].slice.call(document.querySelectorAll('.gcard'));
  var chips = [].slice.call(document.querySelectorAll('.chip[data-cat]'));
  var q = document.getElementById('q'), empty = document.getElementById('empty'), cat = 'all';
  var norm = function (s) { return (s || '').toLowerCase().replace(/[ً-ٟ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي'); };
  function apply() {
    var t = norm(q.value.trim()), n = 0;
    cards.forEach(function (c) {
      var ok = (cat === 'all' || (cat === 'offline' ? c.classList.contains('saved') : c.getAttribute('data-cat') === cat)) && (!t || norm(c.getAttribute('data-text')).indexOf(t) >= 0);
      c.hidden = !ok; if (ok) n++;
    });
    empty.hidden = n > 0;
  }
  function bindChip(b) { b.addEventListener('click', function () { cat = b.getAttribute('data-cat'); [].forEach.call(document.querySelectorAll('.chip[data-cat]'), function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); apply(); }); }
  chips.forEach(bindChip);
  q.addEventListener('input', apply);

  // ======================= الألعاب المحفوظة على هذا الجهاز =======================
  var MTG = window.MTG || {}, OFF = MTG.offline;
  if (!OFF || !OFF.supported) return;
  var panel = document.getElementById('saved'), banner = document.getElementById('netbar');
  function render() {
    return OFF.meta().then(function (m) {
      var ids = Object.keys(m.games), now = Date.now() / 1000, rows = [];
      cards.forEach(function (c) {
        var id = c.getAttribute('data-id'), g = m.games[id], b = c.querySelector('.offbadge');
        c.classList.toggle('saved', !!g && g.until > now);
        if (!b) return;
        if (!g) { b.hidden = true; return; }
        b.hidden = false;
        var upd = String(g.version) !== String(c.getAttribute('data-version'));
        b.className = 'offbadge' + (g.until < now ? ' exp' : upd ? ' upd' : '');
        b.textContent = g.until < now ? '⌛ انتهت صلاحية النسخة المحفوظة' : upd ? '⟳ تحديث متاح للنسخة المحفوظة' : '✓ جاهزة دون إنترنت';
      });
      ids.forEach(function (id) {
        var g = m.games[id];
        rows.push('<li><b>' + (g.title || id).replace(/[<>&]/g, '') + '</b><span>' + MTG.mb(g.bytes || 0) + ' · ' + (g.until > now ? 'صالحة حتى ' + MTG.date(g.until) : 'انتهت صلاحيتها') + '</span>' +
          '<a class="btn ghost-d sm" href="/games/' + encodeURIComponent(id) + '">فتح</a><button type="button" class="btn ghost-d sm" data-del="' + id + '">حذف</button></li>');
      });
      if (!panel) return;
      panel.hidden = !ids.length;
      if (!ids.length) return;
      OFF.usage().then(function (u) {
        panel.innerHTML = '<h2>📴 محفوظة على هذا الجهاز (' + ids.length + ')</h2><ul>' + rows.join('') + '</ul>' +
          (u && u.usage ? '<p class="sm">المساحة المستخدمة: ' + MTG.mb(u.usage) + (u.quota ? ' من ' + MTG.mb(u.quota) + ' متاحة للمتصفح' : '') + '</p>' : '') +
          '<p class="sm">لحفظ لعبة: افتحها برمزها ثم اضغط «⤓ العب دون إنترنت» أعلى الشاشة.</p>';
        [].forEach.call(panel.querySelectorAll('[data-del]'), function (b) {
          b.onclick = function () { b.disabled = true; OFF.remove(b.getAttribute('data-del')).then(render); };
        });
      });
      // فلتر «المحفوظة» يظهر فقط عند وجود ألعاب محفوظة
      if (ids.length && !document.querySelector('.chip[data-cat="offline"]')) {
        var c = document.createElement('button'); c.className = 'chip'; c.setAttribute('data-cat', 'offline'); c.setAttribute('aria-pressed', 'false');
        c.textContent = '📴 المحفوظة'; q.parentNode.insertBefore(c, q.previousElementSibling); bindChip(c);
      }
    });
  }
  function net() {
    var offline = navigator.onLine === false;
    document.body.classList.toggle('offline', offline);
    if (banner) { banner.hidden = !offline; banner.textContent = '📴 لا يوجد اتصال بالإنترنت — تعمل الآن الألعاب المحفوظة على هذا الجهاز فقط.'; }
  }
  addEventListener('online', net); addEventListener('offline', net); net();
  OFF.registered().then(function (yes) { if (yes) { render(); try { navigator.serviceWorker.controller && navigator.serviceWorker.controller.postMessage('purge'); } catch (e) { /* */ } } });
})();
