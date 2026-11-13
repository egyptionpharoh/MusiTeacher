// ⚙️ تشغيل المنبه داخل المتصفح.
// • نبضة كل ثانية من Web Worker (مؤقتات الـ Worker لا تخضع للتقييد الشديد الذي يطبقه Chrome على التبويبات الخلفية)
//   + نبضة احتياطية من الصفحة + فحص فوري عند العودة للتبويب أو استيقاظ الجهاز.
// • كل نبضة تقارن ساعة الحائط بالمواعيد (engine.decide) فلا يضيع تنبيه ولا يتكرر.
// • تبويب واحد فقط «قائد» يطلق التنبيهات (Web Locks) حتى لا يرن المنبه مرتين إن فُتحت الأداة في تبويبين.
import { decide, record, nextDue } from '../core/engine.js';
import { upcomingAlerts } from '../core/schedule.js';
import { loadFired, saveFired } from './storage.js';

const LOCK = 'musiteacher-class-alarm-leader';
const WORKER_SRC = `let t=null;onmessage=(e)=>{if(e.data==='start'&&!t)t=setInterval(()=>postMessage(Date.now()),1000);if(e.data==='stop'){clearInterval(t);t=null}}`;

export class AlarmRuntime {
  constructor({ getState, onFire, onStatus, onBeat }) {
    this.getState = getState; this.onFire = onFire; this.onStatus = onStatus || (() => {}); this.onBeat = onBeat || (() => {});
    this.leader = false; this.lastTick = 0; this.worker = null; this.timer = null; this.stopped = false;
    this.status = { leader: false, worker: false, locks: false, lastTick: 0, sleptMs: 0, next: null };
    this.tick = this.tick.bind(this);
    this.onVis = () => this.tick();
  }

  start() {
    this.stopped = false;
    try {
      const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
      this.worker = new Worker(url);
      this.worker.onmessage = () => this.tick();
      this.worker.postMessage('start');
      this.status.worker = true;
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch { this.status.worker = false; }
    this.timer = setInterval(this.tick, 1000);
    for (const ev of ['visibilitychange', 'focus', 'pageshow', 'online']) window.addEventListener(ev, this.onVis);
    document.addEventListener('visibilitychange', this.onVis);

    if (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request) {
      this.status.locks = true;
      this.abort = new AbortController();
      navigator.locks.request(LOCK, { signal: this.abort.signal }, () => {
        if (this.stopped) return undefined;
        this.leader = true; this.status.leader = true; this.emit(); this.tick();
        return new Promise((resolve) => { this.release = resolve; });
      }).catch(() => { /* أُلغي عند الإغلاق */ });
      // إن لم نحصل على القفل بسرعة فهناك تبويب آخر يقود
      setTimeout(() => this.emit(), 400);
    } else { this.leader = true; this.status.leader = true; }
    this.tick();
  }

  stop() {
    this.stopped = true;
    if (this.worker) { try { this.worker.postMessage('stop'); this.worker.terminate(); } catch { /* */ } this.worker = null; }
    clearInterval(this.timer);
    for (const ev of ['visibilitychange', 'focus', 'pageshow', 'online']) window.removeEventListener(ev, this.onVis);
    document.removeEventListener('visibilitychange', this.onVis);
    if (this.release) this.release();
    if (this.abort) try { this.abort.abort(); } catch { /* */ }
    this.leader = false;
  }

  emit() { this.onStatus({ ...this.status }); }

  /** قائمة التنبيهات المراقبة الآن (الجدول النشط + تنبيهات «ذكّرني لاحقًا» + التجارب) */
  alerts(now) {
    const st = this.getState();
    if (!st || !st.profile) return [];
    const list = upcomingAlerts(st.profile, st.settings, now, st.ctx || {});
    return [...list, ...(st.adhoc || [])];
  }

  tick() {
    if (this.stopped) return;
    const now = Date.now();
    const gap = this.lastTick ? now - this.lastTick : 0;
    if (gap > 2000 && Math.abs(gap - 1000) > 2000) this.status.sleptMs = gap; // الصفحة كانت معلقة/الجهاز نائم
    this.lastTick = now; this.status.lastTick = now;
    try { this.onBeat(now); } catch (e) { console.warn('[class-alarm] beat:', e); }
    if (!this.leader) { this.emit(); return; }
    const st = this.getState();
    if (!st) return;
    const alerts = this.alerts(now);
    const fired = loadFired();
    const d = decide(now, alerts, fired, (st.settings.graceSec || 90) * 1000);
    if (d.fire.length || d.miss.length) {
      saveFired(record(fired, d, now));
      if (d.fire.length) this.onFire(d.fire, d.miss);
      else if (d.miss.length) this.onFire([], d.miss);
    }
    const nd = nextDue(alerts, loadFired(), now);
    if (nd !== this.status.next) { this.status.next = nd; this.emit(); }
  }
}

// ---------- إشعارات النظام ----------
export const notifySupported = () => typeof window !== 'undefined' && 'Notification' in window;
export const notifyPermission = () => (notifySupported() ? Notification.permission : 'unsupported');
export async function askNotify() {
  if (!notifySupported()) return 'unsupported';
  try { return await Notification.requestPermission(); } catch { return Notification.permission; }
}

let swReg = null;
export async function registerSW(scope) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    swReg = await navigator.serviceWorker.register('/class-alarm-sw.js', { scope });
    return swReg;
  } catch (e) { console.warn('[class-alarm] service worker:', e && e.message); return null; }
}
export const swReady = () => !!swReg;

/** إشعار نظام: عبر الـ Service Worker إن وُجد (يلزم على Android)، وإلا Notification مباشرة */
export async function showSystemNotification(a, { silent = false, url } = {}) {
  if (notifyPermission() !== 'granted') return false;
  const opts = { body: a.body, tag: a.id, renotify: true, requireInteraction: true, silent, lang: 'ar', dir: 'rtl', icon: '/class-alarm/icon-192.png', badge: '/class-alarm/badge-72.png', data: { id: a.id, url: url || location.href }, vibrate: [300, 120, 300, 120, 600] };
  try {
    if (swReg && swReg.showNotification) { await swReg.showNotification(a.title, opts); return true; }
    const n = new Notification(a.title, opts);
    n.onclick = () => { window.focus(); n.close(); window.dispatchEvent(new CustomEvent('class-alarm-ack', { detail: { id: a.id } })); };
    return true;
  } catch (e) { console.warn('[class-alarm] notification:', e && e.message); return false; }
}
export async function closeSystemNotification(id) {
  try { if (swReg && swReg.getNotifications) for (const n of await swReg.getNotifications({ tag: id })) n.close(); } catch { /* */ }
}

// ---------- إبقاء الشاشة مضاءة (وضع العرض) ----------
export async function keepAwake() {
  try { if ('wakeLock' in navigator) return await navigator.wakeLock.request('screen'); } catch { /* */ }
  return null;
}
