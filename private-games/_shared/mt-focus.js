/*!
 * MusiTeacher — «وضع التركيز»: الآلة هي بطلة المشهد.
 * يُضيف لألعاب القالب المشترك (سلالم البيانو/الكمان/الأكورديون والإكسيليفون):
 *   1) زر «تركيز» في أدوات المسرح: يُخفي المدرج الموسيقي ولوحة الدليل وأزرار اختيار السلم، فتتسع الآلة.
 *   2) زر طيّ داخل بطاقة النغمة: يُبقي اسم النغمة فقط ويُخفي الشرح.
 *   3) خيار في «خيارات المعلم»: «تركيز تلقائي عند التشغيل».
 * لا يغيّر شيئًا من منطق اللعبة: فقط يضيف أصنافًا (classes) وأزرارًا. إن لم يجد العناصر المطلوبة لا يفعل شيئًا.
 * الحالة تُحفظ في localStorage (اختياريًا؛ إن تعذّر التخزين يعمل بدونه).
 */
(function () {
  'use strict';
  var KEY_AUTO = 'mt-focus-auto', KEY_CARD = 'mt-card-collapsed';
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* لا بأس */ } }

  var css = [
    '.app.mt-focus .staff-card{display:none!important}',
    '.app.mt-focus .legend{display:none!important}',
    '.app.mt-focus .top .titles p{display:none}',
    '.app.mt-focus .top .seg:not(#modeTabs){display:none!important}',
    '.app.mt-focus{grid-template-rows:auto minmax(var(--stage-min,200px),1fr) auto!important}',
    '.note-card .mt-fold{position:absolute;inset-inline-end:6px;top:6px;width:26px;height:26px;border-radius:8px;border:1px solid rgba(255,255,255,.18);',
    'background:rgba(0,0,0,.25);color:inherit;cursor:pointer;font:700 14px/1 inherit;display:grid;place-items:center;padding:0;z-index:2}',
    '.note-card .mt-fold:hover{border-color:var(--gold,#e8b84a)}',
    '.note-card.mt-collapsed .nc-chips,.note-card.mt-collapsed .nc-hint,.note-card.mt-collapsed .nc-count{display:none!important}',
    '.note-card.mt-collapsed{max-height:none!important;width:auto!important;min-width:0!important;padding-block:8px!important}',
    '.stage-tools #mtFocus{font-size:.8rem;gap:6px;display:inline-flex;align-items:center;white-space:nowrap}',
    '.stage-tools #mtFocus[aria-pressed="true"]{border-color:var(--gold,#e8b84a);color:var(--gold,#e8b84a)}'
  ].join('\n');

  function init() {
    var app = document.querySelector('.app'), tools = document.querySelector('.stage-tools');
    if (!app || !tools || document.getElementById('mtFocus')) return;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    // 1) زر التركيز
    var btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'mtFocus'; btn.className = 'icon-btn'; btn.setAttribute('aria-pressed', 'false');
    btn.title = 'وضع التركيز: إخفاء المدرج واللوحات وتكبير الآلة'; btn.textContent = '🎯 تركيز';
    function setFocus(on) {
      app.classList.toggle('mt-focus', !!on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.textContent = on ? '🎯 إظهار اللوحات' : '🎯 تركيز';
      window.dispatchEvent(new Event('resize'));
    }
    btn.addEventListener('click', function () { setFocus(!app.classList.contains('mt-focus')); });
    tools.insertBefore(btn, tools.firstChild);

    // 2) طيّ بطاقة النغمة
    var card = document.querySelector('.note-card');
    if (card) {
      var fold = document.createElement('button');
      fold.type = 'button'; fold.className = 'mt-fold'; fold.setAttribute('aria-label', 'طيّ/فتح بطاقة النغمة');
      function paint() { var c = card.classList.contains('mt-collapsed'); fold.textContent = c ? '▾' : '▴'; fold.title = c ? 'إظهار الشرح' : 'إخفاء الشرح'; }
      fold.addEventListener('click', function () { card.classList.toggle('mt-collapsed'); set(KEY_CARD, card.classList.contains('mt-collapsed') ? '1' : '0'); paint(); });
      card.appendChild(fold);
      if (get(KEY_CARD) === '1') card.classList.add('mt-collapsed');
      paint();
    }

    // 3) تركيز تلقائي عند التشغيل (خيار في لوحة المعلم)
    var auto = get(KEY_AUTO) === '1';
    var sheetSec = null, hs = document.querySelectorAll('#sheet .sec h3');
    for (var i = 0; i < hs.length; i++) if ((hs[i].textContent || '').trim() === 'العرض') { sheetSec = hs[i].parentNode; break; }
    if (sheetSec) {
      var row = document.createElement('div'); row.className = 'row';
      row.innerHTML = '<span>تركيز تلقائي عند التشغيل</span><label class="switch"><input type="checkbox" id="tFocusAuto"><span></span></label>';
      sheetSec.appendChild(row);
      var cb = row.querySelector('input'); cb.checked = auto;
      cb.addEventListener('change', function () { auto = cb.checked; set(KEY_AUTO, auto ? '1' : '0'); });
    }
    var play = document.getElementById('play');
    if (play) play.addEventListener('click', function () { if (auto && !app.classList.contains('mt-focus')) setFocus(true); }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
