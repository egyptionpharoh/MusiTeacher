/*!
 * MusiTeacher — «وضع التركيز» لألعاب الآلات المرسومة بـ SVG (الكمان/العود/القانون الافتراضي).
 * زر عائم «تركيز» يُخفي العنوان وصفوف الأزرار والإرشادات وتدريب الأذن والتذييل، ويُبقي لوحة المعلومات (الوتر/النغمة/الإصبع)
 * والآلة نفسها وقد اتسعت لتملأ الشاشة. إعادة الضغط تُعيد كل شيء. لا يغيّر منطق اللعبة إطلاقًا.
 * يعمل بتتبّع الشجرة: كل ما يسبق غلاف الآلة أو يليه (على أي مستوى) يُخفى ما عدا لوحة المعلومات والإشعارات.
 */
(function () {
  'use strict';
  var KEEP = '.info-panel,.toast,#toast,[role=status],.rotate-hint';
  var css = [
    '.mt-fx-hide{display:none!important}',
    'body.mt-focus-on [data-mt-wrap]{max-width:min(1500px,98vw)!important}',
    '#mtFocusBtn{position:fixed;top:10px;inset-inline-start:10px;z-index:60;border:1px solid rgba(255,255,255,.25);background:rgba(20,20,20,.78);',
    'color:#f1e4c8;font:700 13px/1 inherit;padding:9px 13px;border-radius:12px;cursor:pointer;backdrop-filter:blur(6px)}',
    '#mtFocusBtn:hover{border-color:#e8b84a}',
    '#mtFocusBtn[aria-pressed="true"]{border-color:#e8b84a;color:#e8b84a}',
    'body.mt-focus-on{padding-top:8px!important}',
    'body.mt-focus-on .info-panel{margin-top:44px}'
  ].join('\n');

  function init() {
    var cont = document.querySelector('#violin-container,#oud-container,#qanun-container');
    if (!cont || document.getElementById('mtFocusBtn')) return;
    var wrap = cont.parentElement; wrap.setAttribute('data-mt-wrap', '1');
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    // نجمع العناصر المرشحة للإخفاء: أشقاء كل سلف بين الغلاف و body
    var hide = [];
    for (var n = wrap; n && n !== document.body; n = n.parentElement) {
      var p = n.parentElement; if (!p) break;
      for (var s = p.firstElementChild; s; s = s.nextElementSibling) {
        if (s === n) continue;
        var tag = s.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK') continue;
        if (s.matches(KEEP) || s.querySelector(KEEP) && !s.matches('.controls,details,header,footer,section')) continue;
        hide.push(s);
      }
    }
    var btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'mtFocusBtn'; btn.setAttribute('aria-pressed', 'false');
    btn.title = 'وضع التركيز: إخفاء الأزرار والإرشادات وتكبير الآلة';
    function paint(on) { btn.textContent = on ? '🎯 إظهار اللوحات' : '🎯 تركيز'; btn.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    function setFocus(on) {
      document.body.classList.toggle('mt-focus-on', on);
      for (var i = 0; i < hide.length; i++) hide[i].classList.toggle('mt-fx-hide', on);
      paint(on); window.dispatchEvent(new Event('resize'));
    }
    btn.addEventListener('click', function () { setFocus(!document.body.classList.contains('mt-focus-on')); });
    paint(false); document.body.appendChild(btn);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
