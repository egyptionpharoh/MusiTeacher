// مكتبة الألعاب: تصفية حسب التصنيف + بحث بالاسم (بلا أي اتصال بالخادم)
(function () {
  var cards = [].slice.call(document.querySelectorAll('.gcard'));
  var chips = [].slice.call(document.querySelectorAll('.chip[data-cat]'));
  var q = document.getElementById('q'), empty = document.getElementById('empty'), cat = 'all';
  var norm = function (s) { return (s || '').toLowerCase().replace(/[ً-ٟ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي'); };
  function apply() {
    var t = norm(q.value.trim()), n = 0;
    cards.forEach(function (c) {
      var ok = (cat === 'all' || c.getAttribute('data-cat') === cat) && (!t || norm(c.getAttribute('data-text')).indexOf(t) >= 0);
      c.hidden = !ok; if (ok) n++;
    });
    empty.hidden = n > 0;
  }
  chips.forEach(function (b) { b.addEventListener('click', function () { cat = b.getAttribute('data-cat'); chips.forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); apply(); }); });
  q.addEventListener('input', apply);
})();
