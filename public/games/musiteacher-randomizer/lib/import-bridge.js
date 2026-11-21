// =====================================================================
//  جسر «استيراد أسئلة من درس جاهز» داخل عجلة الاختيار العشوائي (index.html).
//  • زر في خطوة «إعداد الاسئلة» يستدعي window.__rzOpenLibrary() → تُفتح مكتبة الدروس فوق العجلة
//    (library.html?mode=import) في نافذة منبثقة، ولا تتغير واجهة العجلة.
//  • عند اختيار الدرس/النشاط ترسل المكتبة {type:'rz-import', questions:[…]} → العجلة نفسها تضيف
//    الأسئلة إلى قائمتها الحالية (مستمِع داخل الحزمة)، وهذا الجسر يغلق النافذة ويعرض رسالة تأكيد.
//  • طلب رمز دخول المعلم (mt-token-request) من المكتبة يُمرَّر إلى صفحة MusiTeacher الأم ويُعاد إليها كما هو.
//  لا يُرسل أي شيء خارج الموقع نفسه، ولا تُرسل أسماء الطلاب إلى أي جهة.
// =====================================================================
(function () {
  'use strict';
  var LIB_URL = '/games/musiteacher-randomizer/library.html?mode=import';
  var ov = null, fr = null, lastFocus = null;

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'style') e.style.cssText = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }

  function qn(n) { return n === 1 ? 'سؤال واحد' : n === 2 ? 'سؤالان' : n + (n % 100 >= 3 && n % 100 <= 10 ? ' أسئلة' : ' سؤالًا'); }

  function toast(msg) {
    var t = el('div', { role: 'status', 'data-testid': 'rz-import-toast', text: msg,
      style: 'position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:100001;background:#1b5e20;color:#fff;' +
        'font:700 16px/1.6 Cairo,Tahoma,sans-serif;padding:12px 20px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.35);direction:rtl;max-width:92vw;text-align:center' });
    document.body.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; }, 4200);
    setTimeout(function () { t.remove(); }, 4700);
  }

  function close() {
    if (!ov) return;
    ov.remove(); ov = null; fr = null;
    document.removeEventListener('keydown', onKey, true);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* ignore */ } }
  }
  function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }

  window.__rzOpenLibrary = function () {
    if (ov) return;
    lastFocus = document.activeElement;
    var closeBtn = el('button', { type: 'button', 'data-testid': 'rz-library-close', onclick: close, text: '✕ رجوع إلى العجلة',
      style: 'flex-shrink:0;background:#8b0000;color:#fff8dc;border:1px solid #5c0000;border-radius:8px;padding:8px 14px;font:700 15px Cairo,Tahoma,sans-serif;cursor:pointer' });
    var head = el('div', { style: 'display:flex;align-items:center;gap:12px;padding:10px 14px;background:linear-gradient(135deg,#3e2723,#5c3a1e);color:#fff8dc;border-bottom:3px solid #d4af37;direction:rtl;flex-wrap:wrap' }, [
      el('style', { text: '@media (max-width:640px){#rz-lib-overlay .rz-sub{display:none}#rz-lib-overlay{padding:0!important}}' }),
      el('div', { style: 'flex:1;min-width:160px;font:800 17px/1.5 Cairo,Tahoma,sans-serif', text: '📚 مكتبة الدروس التفاعلية' },
        [el('div', { class: 'rz-sub', style: 'font:500 13px/1.5 Cairo,Tahoma,sans-serif;color:#f3e5c4', text: 'اختر الصف ثم الدرس ثم النشاط، واضغط «استيراد إلى العجلة» — تُضاف الأسئلة إلى قائمتك لتراجعها وتعدّلها.' })]),
      closeBtn]);
    fr = el('iframe', { src: LIB_URL, title: 'مكتبة الدروس التفاعلية', 'data-testid': 'rz-library-frame', allow: 'fullscreen',
      style: 'flex:1;width:100%;border:0;background:#0b1222' });
    var panel = el('div', { style: 'display:flex;flex-direction:column;width:100%;max-width:1280px;height:100%;margin:0 auto;border:3px solid #d4af37;border-radius:14px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.6);background:#0b1222' }, [head, fr]);
    ov = el('div', { id: 'rz-lib-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'مكتبة الدروس التفاعلية',
      style: 'position:fixed;inset:0;z-index:100000;background:rgba(20,12,4,.78);padding:clamp(0px,2vw,24px);box-sizing:border-box;display:flex' }, [panel]);
    document.body.appendChild(ov);
    document.addEventListener('keydown', onKey, true);
    closeBtn.focus();
  };

  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !fr || e.source !== fr.contentWindow || !e.data) return;
    var d = e.data;
    if (d.type === 'rz-import') {
      var n = Array.isArray(d.questions) ? d.questions.length : 0;
      // العجلة تستقبل الرسالة نفسها وتضيف الأسئلة؛ نؤخر الإغلاق حتى ينتهي مستمِعها من التحقق من مصدرها
      setTimeout(close, 0);
      if (n) toast('✓ أُضيف ' + qn(n) + (d.title ? ' من «' + d.title + '»' : '') + ' — راجعها وعدّلها كما تريد ثم انطلق.');
    } else if (d.type === 'rz-close') {
      close();
    } else if (d.type === 'mt-token-request' && typeof d.nonce === 'string') {
      var nonce = d.nonce, target = fr.contentWindow;
      var reply = function (token) { try { target.postMessage({ type: 'mt-token', nonce: nonce, token: token || null }, location.origin); } catch (x) { /* ignore */ } };
      if (window.parent === window) return reply(null);
      var on = function (ev) {
        if (ev.origin === location.origin && ev.source === window.parent && ev.data && ev.data.type === 'mt-token' && ev.data.nonce === nonce) {
          window.removeEventListener('message', on); reply(ev.data.token);
        }
      };
      window.addEventListener('message', on);
      setTimeout(function () { window.removeEventListener('message', on); }, 5000);
      try { window.parent.postMessage({ type: 'mt-token-request', nonce: nonce }, location.origin); } catch (x) { reply(null); }
    }
  });
})();
