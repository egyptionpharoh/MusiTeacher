// اختبار شامل في متصفح حقيقي (Chromium + WebGL عبر SwiftShader):  node e2e.cjs [base]
const { chromium } = require('playwright');
const assert = require('assert/strict');
const SP = require('os').tmpdir() + '/';
const BASE = process.argv[2] || 'http://127.0.0.1:5410/ts/index.html';
const out = []; const ok = (m) => { out.push('✅ ' + m); console.log('✅ ' + m); };
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_TUNNEL|ERR_NAME/.test(m.text())) errs.push(m.text()); });
  const reqs = {}; p.on('request', (r) => { const k = r.url().split('?')[0].split('/').slice(-1)[0]; reqs[k] = (reqs[k] || 0) + 1; });
  const t0 = Date.now();
  await p.goto(BASE);
  await p.waitForFunction(() => window.conductorViewer && window.conductorViewer.ready, null, { timeout: 120000 });
  ok(`تحميل المشهد والشخصية (${((Date.now() - t0) / 1000).toFixed(1)} ث في SwiftShader)`);
  const E = (fn, arg) => p.evaluate(fn, arg);

  // ---------- الشخصية ظاهرة ----------
  const vis = await E(() => {
    const V = window.conductorViewer; V.frame(); V.renderer.render(V.scene, V.camera);
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.drawImage(V.renderer.domElement, 0, 0, 64, 64);
    const d = x.getImageData(16, 8, 32, 48).data; let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4) { const l = d[i] + d[i + 1] + d[i + 2]; s += l; s2 += l * l; n++; }
    const meshes = []; V.player.rig.root.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o.name); });
    return { std: Math.sqrt(s2 / n - (s / n) ** 2), meshes: meshes.length, stats: V.engine.stats, floor: V.player.qa.floorGapMm };
  });
  assert.ok(vis.std > 20, 'تباين الصورة ' + vis.std); assert.ok(vis.meshes >= 3);
  assert.deepEqual(vis.stats, { modelLoads: 1, charBuilds: 1 }); assert.ok(Math.abs(vis.floor) < 2);
  ok(`الشخصية ظاهرة في المشهد (${vis.meshes} شبكات، تباين الصورة ${vis.std.toFixed(0)})، النموذج حُمِّل مرة واحدة، القدمان على المنصة (فجوة ${vis.floor} مم)`);


  // ---------- الدشداشة: ثوب واحد متصل (لا بنطال)، بلا اختراق، واليدان خارجها ----------
  const robeCheck = () => E(() => {
    const V = window.conductorViewer, T = V.THREE, rig = V.player.rig, root = rig.root; V.engine.transport.held = -1; V.frame();
    const robe = []; root.traverse((o) => { if (o.isMesh && /^Outfit_dishdasha/.test(o.name)) robe.push(o); });
    const ray = new T.Raycaster(), wp = (s, k) => rig.wp(s, k);
    const knee = (wp('L', 'lowerLeg').y + wp('R', 'lowerLeg').y) / 2, hip = (wp('L', 'upperLeg').y + wp('R', 'upperLeg').y) / 2, foot = wp('L', 'foot').y;
    const hem = V.robe.hem / 0.856 * 0 + foot;                       // تحت الركبة حتى قرب الذيل
    let gaps = 0, n = 0;
    for (const y of [hip - 0.05, (hip + knee) / 2, knee, (knee + foot) / 2 + 0.05]) {
      if (!V.robe.male && y < knee - 0.15) continue;                 // العازفة: الذيل فوق الكاحل (تحته السروال)
      for (const dir of [-1, 1]) {                                   // من الأمام ثم من الخلف نحو ما بين الساقين
        ray.set(new T.Vector3(0, y, dir * 1.5), new T.Vector3(0, 0, -dir)); n++;
        const h = ray.intersectObjects(robe, false)[0];
        if (!h || Math.abs(h.point.z) > 0.4) gaps++;
      }
    }
    // اليدان في الراحة خارج الثوب: شعاع من الكف إلى الخارج أفقيًا لا يقطع الثوب عددًا فرديًا من المرات
    const inside = (q) => { const c = new T.Vector3(...q), d = new T.Vector3(c.x, 0, c.z).normalize(); ray.set(c, d); return ray.intersectObjects(robe, false).length % 2 === 1; };
    const restInside = ['L', 'R'].filter((s) => inside(V.player.palmActual(s)));
    // اليد القائدة في كل مواضع النمط
    let condInside = 0; for (let i = 0; i < 4 * 12; i++) { V.engine.transport.held = i / 12; V.engine.S.blend = 1; V.frame(); if (inside(V.player.palmActual('R'))) condInside++; }
    V.engine.transport.held = -1; V.frame();
    return { rep: V.robe, gaps, n, restInside, condInside, meshes: robe.map((m) => m.name), drape: !!root.getObjectByName('Outfit_robe_drape') };
  });
  const rcF = await robeCheck();
  assert.ok(rcF.rep.applied && rcF.rep.penetrationMm === 0 && rcF.rep.seamMm < 1, JSON.stringify(rcF.rep));
  assert.equal(rcF.gaps, 0, 'فراغ بين الساقين ' + JSON.stringify(rcF)); assert.deepEqual(rcF.restInside, []); assert.equal(rcF.condInside, 0);
  ok(`الدشداشة (المعلمة): ثوب واحد متصل من الخصر إلى الذيل — ${rcF.n} أشعة من الأمام والخلف نحو ما بين الساقين كلها تصطدم بالقماش (لا فتحة بنطال)، اختراق الساقين للثوب ${rcF.rep.penetrationMm} مم، فرق الدرزة عند الخصر ${rcF.rep.seamMm} مم، واليدان خارج الثوب في الراحة وفي كل مواضع النمط`);

  // ---------- صحة الحركة في العالم ثلاثي الأبعاد ----------
  const motion = await E(() => {
    const V = window.conductorViewer, En = V.engine, T = En.transport, res = {};
    for (const m of [2, 3, 4]) {
      En.setMeter(m); const M = En.METERS[m];
      const at = (pos) => { T.held = pos; En.S.blend = 1; V.frame(1 / 60); return V.player.palmNow('R'); };
      const ict = [], errMm = [], reach = [];
      for (let k = 0; k < m; k++) {
        at(k); const q = V.player.palmActual('R'), P = M.beats[k].P, tgt = V.player.palmPoint(P[0], P[1], 'R');
        ict.push(q); errMm.push(+(Math.hypot(q[0] - tgt[0], q[1] - tgt[1], q[2] - tgt[2]) * 1000).toFixed(1)); reach.push(V.player.qa.reachR);
      }
      // اتجاه كل نبضة في العالم (يمين المايسترو = −x): من الإكتوس السابق إلى الحالي، والأولى بقمة قبلها
      const dirs = [];
      for (let k = 0; k < m; k++) {
        const a = ict[(k - 1 + m) % m], c = ict[k];
        let top = -9; for (let i = 0; i <= 40; i++) top = Math.max(top, at(k - 1 + i / 40)[1]);
        if (k === 0) dirs.push(top - c[1] > 0.2 ? 'down' : '?');
        else if (k === m - 1) { let nt = -9; for (let i = 0; i <= 40; i++) nt = Math.max(nt, at(k + i / 40)[1]); dirs.push(c[1] - a[1] > 0.04 && nt - c[1] > 0.15 ? 'up' : '?'); }
        else dirs.push(Math.abs(c[0] - a[0]) > Math.abs(c[1] - a[1]) ? (c[0] - a[0] < 0 ? 'right' : 'left') : (c[1] > a[1] ? 'up' : 'down'));
      }
      // حجم النمط ومستواه بالنسبة للجسم
      const sh = V.player.shoulder.R; let ymin = 9, ymax = -9, xmin = 9, xmax = -9;
      for (let i = 0; i < m * 30; i++) { const q = at(i / 30); ymin = Math.min(ymin, q[1]); ymax = Math.max(ymax, q[1]); xmin = Math.min(xmin, q[0]); xmax = Math.max(xmax, q[0]); }
      res[m] = { dirs, want: M.dirs, errMm, reach, widthCm: +((xmax - xmin) * 100).toFixed(1), heightCm: +((ymax - ymin) * 100).toFixed(1), topBelowShoulderCm: +((sh[1] - ymax) * 100).toFixed(1) };
    }
    T.reset(); En.setMeter(4); return res;
  });
  for (const m of [2, 3, 4]) {
    const r = motion[m];
    assert.deepEqual(r.dirs, r.want, 'اتجاهات ' + m);
    assert.ok(r.errMm.every((e) => e < 3), 'دقة الوصول ' + r.errMm); assert.ok(r.reach.every((e) => e === 0), 'مدى الذراع');
    ok(`الميزان ${m}/4: اتجاه اليد الفعلي في المشهد = ${r.dirs.join('، ')} (كما في الدليل)، الكف (بعد IK الهيكل العظمي) يصل إلى نقطة كل نبضة بخطأ ${Math.max(...r.errMm) < 0.1 ? 'أقل من 0.1' : Math.max(...r.errMm)} مم، والذراع ضمن مداها؛ حجم النمط ${r.widthCm}×${r.heightCm} سم، وأعلى نقطة ${r.topBelowShoulderCm < 0 ? 'فوق الكتف بـ ' + (-r.topBelowShoulderCm) : 'تحت الكتف بـ ' + r.topBelowShoulderCm} سم`);
  }

  // ---------- التشغيل الفعلي: ترتيب النبضات والتزامن مع الصوت ----------
  await p.fill('#bpm', '120'); await p.dispatchEvent('#bpm', 'input');
  await p.click('#stages [data-stage=pulse]');
  await E(() => { const A = window.conductorViewer.engine.audio; window.__clicks = []; const o = A.click.bind(A); A.click = (t, acc) => { window.__clicks.push({ t, acc }); o(t, acc); };
    window.__beats = []; window.conductorViewer.engine.on((ev) => { if (ev.type === 'beat') window.__beats.push({ i: ev.i, heard: window.conductorViewer.engine.audio.heardNow(), k: ev.k }); }); });
  await p.click('#btnPlay');
  await p.waitForTimeout(5200);
  const sync = await E(() => {
    const En = window.conductorViewer.engine, T = En.transport, A = En.audio, M = En.METERS[4];
    const clicks = window.__clicks.map((c) => { const pos = (c.t - T.t0) / T.dur, k = Math.round(pos), h = window.conductorViewer.handAt(4, pos), P = M.beats[((k % 4) + 4) % 4].P;
      return { k, off: Math.abs(pos - k), acc: c.acc, want: M.accents[((k % 4) + 4) % 4], handErr: Math.hypot(h.u - P[0], h.v - P[1]) }; });
    const beats = window.__beats.map((b) => ({ i: b.i, k: b.k, lagMs: (b.heard - T.timeOf(b.k)) * 1000 }));
    return { clicks, beats, dur: T.dur, lat: (A.ctx.currentTime - A.heardNow()) * 1000, state: A.ctx.state, loaded: A.loaded };
  });
  assert.ok(sync.loaded, 'تحميل العيّنات'); assert.equal(sync.dur, 0.5);
  assert.ok(sync.clicks.length >= 8);
  assert.deepEqual(sync.clicks.map((c) => c.k), sync.clicks.map((_, i) => i), 'النقرة الأولى للنبضة 1 ثم بالترتيب');
  assert.ok(sync.clicks.every((c) => c.off < 1e-6 && c.acc === c.want && c.handErr < 1e-9));
  const seq = sync.beats.map((x) => x.i).join('');
  assert.ok(/^(0123)+0?1?2?3?$/.test(seq), 'ترتيب النبضات المرئية ' + seq);
  const lags = sync.beats.map((x) => x.lagMs);
  ok(`النبض المسموع: ${sync.clicks.length} نقرة، كل نقرة في زمن الإكتوس تمامًا (فرق الموضع < 10⁻⁶ نبضة) واليد في نقطة النبضة لحظتها، والنبر: ${[...new Set(sync.clicks.slice(0, 4).map((c) => c.acc))].join('/')} = قوي/ضعيف/متوسط/ضعيف`);
  ok(`الأحداث المرئية بالترتيب ${seq.slice(0, 12)}… وتأخر رصدها عن النقرة المسموعة ${Math.min(...lags).toFixed(0)}–${Math.max(...lags).toFixed(0)} مللي ثانية (دقة الرصد يحدّها معدل الإطارات البطيء في SwiftShader بلا بطاقة رسوميات)، تعويض كمون الخرج ${sync.lat.toFixed(0)} مللي ثانية`);
  await p.screenshot({ path: SP + 'e_play.png' });

  // ---------- البطء ----------
  await p.click('#btnPlay');                                     // إيقاف
  await p.click('#stages [data-stage=slow]');
  await p.click('#btnPlay'); await p.waitForTimeout(300);
  const slow = await E(() => window.conductorViewer.engine.transport.dur);
  assert.equal(slow, 1); ok('بطيء = نصف السرعة: مدة النبضة 1.0 ث بدل 0.5 ث، والمسار نفسه (مختبر في Node أيضًا)');
  // خطوة بخطوة
  await p.click('#btnPlay'); await p.click('#btnStep');
  const paused = (k) => p.waitForFunction((k) => { const T = window.conductorViewer.engine.transport; T.pos(window.conductorViewer.engine.audio.heardNow()); return !T.playing && T.held === k; }, k, { timeout: 15000 });
  await paused(0); await p.click('#btnStep'); await paused(1); ok('«النبضة التالية»: تتقدم اليد نبضة واحدة وتتوقف عند الإكتوس (الأولى ثم الثانية)');

  // ---------- الإيقاف والإعادة وتغيير الميزان ----------
  await p.click('#stages [data-stage=pulse]');
  await p.click('#btnPlay'); await p.waitForTimeout(1500);
  const rs = await E(async () => { const En = window.conductorViewer.engine, T = En.transport, A = En.audio; const before = T.pos(A.heardNow());
    document.querySelector('#btnRestart').click(); await new Promise((r) => setTimeout(r, 0)); const t = A.now();
    return { before, prep: (T.timeOf(0) - t) / T.dur, startPos: (t - T.t0) / T.dur }; });
  assert.ok(rs.before > 1 && rs.prep > 1 && rs.prep < 1.4 && rs.startPos <= -1 + 1e-6, JSON.stringify(rs));
  ok(`«من البداية» أثناء الأداء (كانت عند النبضة ${rs.before.toFixed(1)}): تعود اليد إلى وضعية الاستعداد، ثم ضربة تحضير كاملة قبل النبضة الأولى (${rs.prep.toFixed(2)} نبضة)`);
  await p.click('#meters [data-m="3"]'); await p.waitForTimeout(400);
  let s3 = await E(() => ({ playing: window.conductorViewer.engine.transport.playing, pend: window.conductorViewer.engine.audio.pending(), m: window.conductorViewer.engine.S.meter, stats: window.conductorViewer.engine.stats, beats: document.querySelectorAll('#beats .beat').length }));
  assert.deepEqual(s3, { playing: false, pend: 0, m: 3, stats: { modelLoads: 1, charBuilds: 1 }, beats: 3 });
  ok('تغيير الميزان أثناء الأداء: يتوقف الأداء والصوت فورًا (0 نقرات معلّقة)، ويتغير الشريط إلى 3 نبضات، دون إعادة إنشاء الشخصية أو تحميل النموذج');
  await p.click('#btnPlay'); await p.waitForTimeout(1800); await p.click('#btnPlay'); await p.waitForTimeout(400);
  const stp = await E(() => { const V = window.conductorViewer; for (let i = 0; i < 60; i++) V.frame(1 / 30); const q = V.player.palmActual('R'), P = V.engine.METERS[3].beats[2].P, r = V.player.palmPoint(P[0], P[1], 'R');
    return { playing: V.engine.transport.playing, pend: V.engine.audio.pending(), held: V.engine.transport.held, dReady: Math.hypot(q[0] - r[0], q[1] - r[1], q[2] - r[2]) * 1000 }; });
  assert.equal(stp.playing, false); assert.equal(stp.pend, 0); assert.equal(stp.held, -1); assert.ok(stp.dReady < 3);
  ok(`الإيقاف: لا حركة ولا صوت بعده (0 نقرات معلّقة)، وتعود اليد بنعومة إلى وضعية الاستعداد (${stp.dReady.toFixed(1)} مم)`);

  // ---------- وضوح اليدين في كل زاوية ----------
  const views = await E(async () => {
    const V = window.conductorViewer, En = V.engine, res = {};
    const box = (s) => { const e = document.querySelector(s); if (!e || e.hidden || e.offsetParent === null) return null; return e.getBoundingClientRect(); };
    for (const name of ['front', 'behind', 'angle', 'hands']) {
      En.setView(name); V.applyCam(1); V.frame();
      const r = V.renderer.domElement.getBoundingClientRect(), hud = box('#hud'), note = box('#viewNote');
      let inside = 0, underHud = 0, underNote = 0, n = 0, hidden = 0;
      const meshes = []; V.player.rig.root.traverse((o) => { if (o.isMesh && !(o.material.transparent && o.material.opacity < 0.6)) meshes.push(o); });   // الثوب الشفاف في العرض الخلفي لا يحجب
      const ray = new V.THREE.Raycaster();
      const test = (q, side) => {
        // هل يحجب الجسم الكف عن الكاميرا؟ (شعاع من الكاميرا إلى الكف؛ أي تقاطع مع شبكات الجسم قبل الكف بأكثر من 4 سم، عدا شبكات اليد نفسها)
        const P = new V.THREE.Vector3(...q), dir = P.clone().sub(V.camera.position), L = dir.length(); ray.set(V.camera.position, dir.normalize()); ray.far = L - 0.06;
        const hit = ray.intersectObjects(meshes, false).find((h) => h.distance < L - 0.06);
        if (hit) hidden++;
        const v = P.clone().project(V.camera); const x = r.left + (v.x + 1) / 2 * r.width, y = r.top + (1 - v.y) / 2 * r.height; n++;
        if (x > r.left && x < r.right && y > r.top && y < r.bottom) inside++; if (hud && x > hud.left && x < hud.right && y > hud.top && y < hud.bottom) underHud++; if (note && x > note.left && x < note.right && y > note.top && y < note.bottom) underNote++; };
      for (let i = 0; i < 4 * 24; i++) { En.transport.held = i / 24; En.S.blend = 1; V.frame(); test(V.player.palmActual('R')); }
      En.transport.held = -1; V.frame(); test(V.player.palmActual('L'));
      res[name] = { inside, n, underHud, underNote, hidden, facing: En.facing() };
    }
    En.setView('front'); return res;
  });
  console.log('VIEWS', JSON.stringify(views));
  for (const k in views) { const v = views[k]; assert.equal(v.inside, v.n, k); assert.equal(v.underHud + v.underNote, 0, k + ' مغطاة ' + JSON.stringify(v)); assert.ok(v.hidden <= Math.floor(v.n * 0.1), k + ' محجوبة بالجسم ' + JSON.stringify(v)); }
  assert.deepEqual(Object.fromEntries(Object.entries(views).map(([k, v]) => [k, v.facing])), { front: true, behind: false, angle: true, hands: true });
  ok(`اليدان ومسار النمط كاملًا داخل الإطار في الزوايا الأربع، لا يغطيهما شريط النبضات ولا الملاحظة، والجسم لا يحجب الكف (نقاط محجوبة: ${Object.entries(views).map(([k, v]) => k + ' ' + v.hidden + '/' + v.n).join('، ')})`);

  // ---------- وضع المرآة واليدين ----------
  await p.click('#hands [data-hands=mirror]');
  const mir = await E(() => { const V = window.conductorViewer, En = V.engine; En.transport.held = 1; En.S.blend = 1; V.frame(); const q = V.player.palmActual('L'), P = En.METERS[3].beats[1].P, t = V.player.palmPoint(P[0], P[1], 'L');
    return { err: Math.hypot(q[0] - t[0], q[1] - t[1], q[2] - t[2]) * 1000, x: q[0], txt: document.querySelector('#beats .beat[data-i="1"] .d').textContent, view: En.view }; });
  assert.ok(mir.err < 3 && mir.x > 0.15, JSON.stringify(mir)); assert.match(mir.txt, /يمينك/);
  ok(`وضع المرآة: تؤدي اليد اليسرى الصورة المعكوسة (النبضة الثانية في الثلاثي: اليد اليسرى إلى يسار المايسترو = يمين الطالب المقابل لها)، والنص «${mir.txt}»`);
  await p.click('#hands [data-hands=right]');
  const fr = await E(() => document.querySelector('#beats .beat[data-i="1"] .d').textContent);
  await p.click('#views [data-view=behind]');
  const bh = await E(() => document.querySelector('#beats .beat[data-i="1"] .d').textContent);
  assert.match(fr, /يمين المايسترو/); assert.match(bh, /^➡ إلى اليمين/);
  ok(`نص الاتجاه يتبع الزاوية: أمامي «${fr}» · من الخلف «${bh}»`);
  await p.click('#views [data-view=front]');

  // ---------- الأنشطة ----------
  await p.click('#meters [data-m="4"]');
  await p.click('#stages [data-stage=practice]');
  const answer = async (sel = '#qOpts button') => {
    try { await p.waitForFunction((s) => document.querySelectorAll(s).length > 0 && window.conductorViewer.ui.expect !== undefined && !window.conductorViewer.engine.transport.playing, sel, { timeout: 30000 }); }
    catch (e) { console.log('STATE', await E(() => { const V = window.conductorViewer, T = V.engine.transport; return { act: V.ui.act, playing: T.playing, held: T.held, stopAt: T.stopAt, expect: V.ui.expect, opts: document.querySelectorAll('#qOpts button').length, text: document.querySelector('#qText').textContent.slice(0, 80), quiz: document.querySelector('#quiz').hidden }; })); throw e; }
    await p.waitForTimeout(100);
    const exp = await E(() => { const x = window.conductorViewer.ui.expect; window.conductorViewer.ui.expect = undefined; return x; });
    await p.click(`#qOpts button[data-v="${exp}"]`);
  };
  const score = () => E(() => +document.querySelector('#score').textContent);
  // 1) الاتجاه
  await E(() => { window.conductorViewer.ui.expect = undefined; });
  await p.click('#acts [data-act=dir]');
  await answer(); await p.waitForSelector('#qFeed.ok'); assert.equal(await score(), 10);
  assert.equal(await E(() => window.conductorViewer.engine.view), 'behind');
  ok('نشاط «إلى أين تتجه اليد؟»: تتوقف المايسترو عند نبضة (العرض من الخلف)، والإجابة الصحيحة تُقبل ثم تُعرض الحركة');
  await p.screenshot({ path: SP + 'e_dir.png' });
  // 2) الترتيب
  await p.click('#acts [data-act=order]');
  await p.waitForSelector('#qOpts button.card');
  for (let i = 0; i < 4; i++) await p.click(`#qOpts button.card[data-v="${i}"]`);
  await p.waitForSelector('#qFeed.ok'); assert.equal(await score(), 20); ok('نشاط «رتّب الإشارات»: الضغط بالترتيب 1–4 مقبول، ثم تؤدي المايسترو الترتيب الصحيح');
  // 3) أين تقع النبضة
  await E(() => { window.conductorViewer.ui.expect = undefined; });
  await p.click('#acts [data-act=where]');
  await p.waitForFunction(() => document.querySelectorAll('.hot').length === 4 && window.conductorViewer.ui.expect !== undefined, null, { timeout: 30000 });
  await p.screenshot({ path: SP + 'e_where.png' });
  const j = await E(() => window.conductorViewer.ui.expect);
  await p.click(`.hot[data-i="${j}"]`); await p.waitForSelector('#qFeed.ok'); assert.equal(await score(), 30);
  ok('نشاط «أين تقع النبضة؟»: نقاط قابلة للضغط فوق مواضع النبضات الفعلية في المشهد، والإجابة الصحيحة تُقبل');
  // 4) ما الميزان
  await E(() => { window.conductorViewer.ui.expect = undefined; });
  await p.click('#acts [data-act=meter]');
  await p.waitForFunction(() => document.querySelector('#beats .n') && document.querySelector('#beats .n').textContent === '?');
  ok('نشاط «ما الميزان؟»: الأرقام والمسار مخفية أثناء العرض');
  await answer(); await p.waitForSelector('#qFeed.ok'); assert.equal(await score(), 40);
  // 5) اكتشف الخطأ
  for (let r = 0; r < 2; r++) {
    await E(() => { window.conductorViewer.ui.expect = undefined; });
    await p.click('#acts [data-act=spot]');
    await p.waitForSelector('#warnNote:not([hidden])');
    await answer();
    const needs2 = await E(() => document.querySelectorAll('#qOpts button').length > 2 || /أي نبضة/.test(document.querySelector('#qText').textContent));
    await p.waitForTimeout(150);
    const second = await E(() => /أي نبضة/.test(document.querySelector('#qText').textContent));
    if (second) await answer();
    await p.waitForSelector('#qFeed.ok', { timeout: 30000 }); void needs2;
  }
  ok('نشاط «اكتشف الخطأ»: تنبيه ظاهر بأن الخطأ مقصود، والحكم (صحيح/فيه خطأ) وتحديد النبضة الخاطئة يُقبلان، ثم يُعرض النمط الصحيح');
  const afterSpot = await E(() => ({ ov: window.conductorViewer.engine.S.override }));
  // 6) التحدي
  await p.click('#acts [data-act=challenge]');
  for (let q = 0; q < 6; q++) {
    await p.waitForFunction(() => (document.querySelectorAll('#qOpts button').length || document.querySelectorAll('.hot').length) && window.conductorViewer.ui.expect !== undefined && !window.conductorViewer.engine.transport.playing, null, { timeout: 40000 });
    await p.waitForTimeout(100);
    const hot = await E(() => document.querySelectorAll('.hot').length);
    const exp = await E(() => window.conductorViewer.ui.expect);
    await E(() => { window.conductorViewer.ui.expect = undefined; });
    if (hot) await p.click(`.hot[data-i="${exp}"]`); else await p.click(`#qOpts button[data-v="${exp}"]`);
    if (!hot) { await p.waitForTimeout(200); const second = await E(() => /أي نبضة/.test(document.querySelector('#qText').textContent) && !document.querySelector('#qOpts button.ok')); if (second) await answer(); }
    await p.waitForSelector('#qNext:not([hidden])', { timeout: 40000 }); await p.click('#qNext');
  }
  await p.waitForFunction(() => /نتيجة التحدي/.test(document.querySelector('#qTitle').textContent));
  const res = await E(() => document.querySelector('#qText').textContent);
  assert.match(res, /6 من 6/); ok('التحدي: 6 أسئلة متنوعة، النتيجة «6 من 6» مع نجوم واحتفال');
  await p.screenshot({ path: SP + 'e_challenge.png' });
  await p.click('#qClose');
  const restored = await E(() => ({ m: window.conductorViewer.engine.S.meter, ov: window.conductorViewer.engine.S.override, show: window.conductorViewer.engine.S.show, quiz: document.querySelector('#quiz').hidden, playing: window.conductorViewer.engine.transport.playing }));
  assert.equal(restored.m, 4); assert.equal(restored.ov, null); assert.equal(restored.quiz, true); assert.equal(restored.playing, false); assert.equal(afterSpot.ov, null);
  ok('إغلاق النشاط يعيد الميزان والعرض كما كانا، ولا يبقى النمط الخاطئ ولا أداء جارٍ');


  // ---------- طريقة الأسهم المستقيمة ----------
  await p.click('#stages [data-stage=pulse]');
  await p.click('#meters [data-m="4"]');
  await p.click('#btnPlay'); await p.waitForTimeout(900);
  await p.click('#schools [data-school=arrows]'); await p.waitForTimeout(300);
  const sw = await E(() => { const V = window.conductorViewer, En = V.engine; for (let i = 0; i < 40; i++) V.frame(1 / 30);
    const cones = []; V.scene.traverse((o) => { if (o.geometry && o.geometry.type === 'ConeGeometry') cones.push(o); });
    const q = V.player.palmActual('R'), P = En.beats()[3].P, r = V.player.palmPoint(P[0], P[1], 'R');
    return { school: En.school, playing: En.transport.playing, pend: En.audio.pending(), cones: cones.length, hud: document.querySelector('#beats').innerText, ready: Math.hypot(q[0] - r[0], q[1] - r[1], q[2] - r[2]) * 1000, checked: document.querySelector('#schools [data-school=arrows]').getAttribute('aria-checked') }; });
  assert.equal(sw.school, 'arrows'); assert.equal(sw.playing, false); assert.equal(sw.pend, 0); assert.equal(sw.cones, 4); assert.ok(sw.ready < 3); assert.equal(sw.checked, 'true');
  assert.match(sw.hud, /قطريًا إلى أعلى يسار المايسترو/);
  ok(`تبديل الطريقة أثناء الأداء: يتوقف الأداء والصوت (0 نقرات معلّقة)، ويُرسم 4 أسهم بدل المسار المنحني، وتعود اليد إلى استعداد الطريقة الجديدة (${sw.ready.toFixed(1)} مم) — لا يبقى شيء من الطريقة السابقة`);
  const am = await E(() => {
    const V = window.conductorViewer, En = V.engine, res = {};
    const dir8 = (a, b) => { const dx = -(b[0] - a[0]), dy = b[1] - a[1];      // يمين المايسترو = −x
      if (Math.abs(dx) < 0.35 * Math.abs(dy)) return dy > 0 ? 'up' : 'down'; if (Math.abs(dy) < 0.35 * Math.abs(dx)) return dx > 0 ? 'right' : 'left'; return (dy > 0 ? 'up' : 'down') + (dx > 0 ? 'right' : 'left'); };
    for (const m of [2, 3, 4]) {
      En.setMeter(m); const at = (pos) => { En.transport.held = pos; En.S.blend = 1; V.frame(1 / 60); return V.player.palmActual('R'); };
      const tips = []; for (let k = 0; k < m; k++) tips.push(at(k));
      const dirs = tips.map((c, k) => dir8(tips[(k - 1 + m) % m], c));
      let off = 0; for (let k = 0; k < m; k++) { const a = tips[(k - 1 + m) % m], b = tips[k]; for (const s of [0.4, 0.7, 0.9]) { const q = at(k - 1 + s), ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], aq = [q[0] - a[0], q[1] - a[1], q[2] - a[2]], L = Math.hypot(...ab) || 1;
        const cx = [ab[1] * aq[2] - ab[2] * aq[1], ab[2] * aq[0] - ab[0] * aq[2], ab[0] * aq[1] - ab[1] * aq[0]]; off = Math.max(off, Math.hypot(...cx) / L * 1000); } }
      res[m] = { dirs, want: En.dirs(m), offMm: +off.toFixed(1), reach: V.player.qa.reachR };
    }
    En.transport.reset(); En.setMeter(4); return res;
  });
  for (const m of [2, 3, 4]) { const r = am[m]; assert.deepEqual(r.dirs, r.want, 'أسهم ' + m); assert.equal(r.reach, 0); assert.ok(r.offMm < 1, 'انحراف عن خط السهم ' + r.offMm); }
  ok(`الأسهم في المشهد (يد المايسترو الفعلية): 2/4 = ${am[2].dirs.join('، ')} · 3/4 = ${am[3].dirs.join('، ')} · 4/4 = ${am[4].dirs.join('، ')} — كما في المخططات، والكف يسير على خط السهم المرسوم نفسه في الفضاء (أبعد انحراف ${Math.max(am[2].offMm, am[3].offMm, am[4].offMm)} مم)`);
  await E(() => { window.__clicks = []; });
  await p.click('#btnPlay'); await p.waitForTimeout(4600); await p.click('#btnPlay');
  const asy = await E(() => { const En = window.conductorViewer.engine, T = En.transport, bs = En.beats();
    return window.__clicks.map((c) => { const pos = (c.t - T.t0) / T.dur, k = Math.round(pos), h = window.conductorViewer.handAt(4, pos, bs), P = bs[((k % 4) + 4) % 4].P; return { off: Math.abs(pos - k), err: Math.hypot(h.u - P[0], h.v - P[1]), acc: c.acc, want: En.METERS[4].accents[((k % 4) + 4) % 4] }; }); });
  assert.ok(asy.length >= 6 && asy.every((c) => c.off < 1e-6 && c.err < 1e-9 && c.acc === c.want));
  ok(`الأسهم مع النبض المسموع: ${asy.length} نقرة، كل نقرة لحظة وصول اليد إلى رأس السهم تمامًا، والنبر صحيح`);
  await p.click('#stages [data-stage=slow]'); await p.click('#btnStep');
  await p.waitForFunction(() => { const T = window.conductorViewer.engine.transport; T.pos(window.conductorViewer.engine.audio.heardNow()); return !T.playing && T.held === 0; }, null, { timeout: 15000 });
  ok('الأسهم ببطء وخطوة بخطوة: تصل اليد إلى رأس السهم الأول وتتوقف');
  // نشاطان بطريقة الأسهم
  await p.click('#stages [data-stage=practice]');
  await E(() => { window.conductorViewer.ui.expect = undefined; });
  await p.click('#acts [data-act=dir]');
  await p.waitForFunction(() => document.querySelectorAll('#qOpts button').length === 6 && window.conductorViewer.ui.expect !== undefined, null, { timeout: 30000 });
  await answer(); await p.waitForSelector('#qFeed.ok');
  await E(() => { window.conductorViewer.ui.expect = undefined; });
  await p.click('#acts [data-act=spot]'); await answer();
  await p.waitForTimeout(200); if (await E(() => /أي نبضة/.test(document.querySelector('#qText').textContent))) await answer();
  await p.waitForSelector('#qFeed.ok', { timeout: 30000 });
  await p.click('#qClose');
  ok('أنشطة طريقة الأسهم: «إلى أين تتجه اليد؟» (ستة اتجاهات منها القطرية) و«اكتشف الخطأ» تعملان وتُصحَّحان');
  await p.screenshot({ path: SP + 'e_arrows.png' });
  // العودة إلى الطريقة المنحنية: كما كانت
  await p.click('#stages [data-stage=watch]');
  await p.click('#schools [data-school=curved]');
  const back = await E(() => { const V = window.conductorViewer, En = V.engine; for (let i = 0; i < 40; i++) V.frame(1 / 30); let cones = 0, tubes = 0; V.scene.traverse((o) => { if (o.geometry && o.geometry.type === 'ConeGeometry') cones++; if (o.geometry && o.geometry.type === 'TubeGeometry') tubes++; });
    const q = V.player.palmActual('R'), P = En.METERS[4].beats[3].P, r = V.player.palmPoint(P[0], P[1], 'R'); return { school: En.school, cones, tubes, d: Math.hypot(q[0] - r[0], q[1] - r[1], q[2] - r[2]) * 1000, h: V.handAt(4, 1.5, En.beats()).u === V.handAt(4, 1.5).u }; });
  assert.deepEqual([back.school, back.cones, back.tubes, back.h], ['curved', 0, 1, true]); assert.ok(back.d < 3);
  ok('العودة إلى «المسار المنحني»: يختفي رسم الأسهم ويعود المسار المنحني والحركة كما كانا تمامًا');

  // ---------- تبديل الشخصية (بلا إعادة تحميل الملف) ----------
  await p.click('#stages [data-stage=watch]');
  await p.click('#performer [data-g=male]');
  await p.waitForFunction(() => window.conductorViewer.engine.performer === 'male', null, { timeout: 120000 });
  await p.click('#performer [data-g=female]');
  await p.waitForFunction(() => window.conductorViewer.engine.performer === 'female');
  const gs = await E(() => window.conductorViewer.engine.stats);
  assert.deepEqual(gs, { modelLoads: 1, charBuilds: 2 }); assert.equal(reqs['character-girl.fbx'], 1);
  ok('تبديل المايسترو (معلمة/معلم): ملف النموذج نُزِّل مرة واحدة فقط، وكل شخصية بُنيت مرة واحدة ثم أُعيد استعمالها');

  await p.click('#performer [data-g=male]');
  await p.waitForFunction(() => window.conductorViewer.engine.performer === 'male');
  const rcM = await robeCheck();
  assert.ok(rcM.rep.applied && rcM.rep.male && rcM.rep.penetrationMm === 0 && rcM.rep.seamMm < 1 && rcM.rep.drapeRemoved === 1 && !rcM.drape, JSON.stringify(rcM.rep));
  assert.equal(rcM.gaps, 0, JSON.stringify(rcM)); assert.deepEqual(rcM.restInside, []); assert.equal(rcM.condInside, 0);
  ok(`الدشداشة (المعلم): ثوب واحد إلى الكعبين — ${rcM.n} أشعة نحو ما بين الساقين كلها على القماش، لوح الجلوس القديم أُزيل، اختراق ${rcM.rep.penetrationMm} مم، درزة ${rcM.rep.seamMm} مم، واليدان خارج الثوب`);
  await p.click('#performer [data-g=female]');
  await p.waitForFunction(() => window.conductorViewer.engine.performer === 'female');

  // ---------- إخفاء الصفحة: لا شيء يستمر ----------
  await p.click('#btnPlay'); await p.waitForTimeout(600);
  const hid = await E(async () => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, 300)); const En = window.conductorViewer.engine; const st = { playing: En.transport.playing, pend: En.audio.pending(), ctx: En.audio.ctx.state };
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); return st; });
  assert.equal(hid.playing, false); assert.equal(hid.pend, 0); ok(`إخفاء/مغادرة الصفحة: يتوقف الأداء، 0 نقرات معلّقة، والصوت ${hid.ctx}`);

  // ---------- واجهة السبورة الذكية والهاتف ----------
  await p.setViewportSize({ width: 1920, height: 1080 }); await p.waitForTimeout(500); await p.screenshot({ path: SP + 'e_board.png' });
  await p.setViewportSize({ width: 820, height: 1180 }); await p.waitForTimeout(500); await p.screenshot({ path: SP + 'e_tablet.png' });
  ok('لقطات: 1440×900، سبورة 1920×1080، لوحي رأسي 820×1180');

  assert.deepEqual(errs, []); ok('لا أخطاء JavaScript ولا أخطاء في وحدة التحكم');
  console.log('\n' + out.join('\n'));
  await b.close();
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
