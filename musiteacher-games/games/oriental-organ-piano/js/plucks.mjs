// plucks.mjs — نمذجة فيزيائية لأوتار القانون والعود (Karplus–Strong موسّع)، منقولة من قانون وعود MusiTeacher
// ومن النسخة السابقة من الأورج دون تغيير في النمذجة. دوال خالصة تُرجع Float32Array (تُختبر في Node).
// ليست تسجيلات: صوت مولَّد من معادلات الوتر وصندوق الرنين، فلا حقوق خارجية.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const LETTER_SEMI = [0, 2, 4, 5, 7, 9, 11];
export function seededRandom(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ---- وتر Karplus-Strong موسّع (منقول من القانون والعود في MusiTeacher)
function renderString(out, start, freq, sr, p, rnd) {
    const w = 2 * Math.PI * freq / sr;
    // فلتر الفقد لا يجوز أن يُخمد الوتر أسرع من زمن الخمود المطلوب (يحدث في النغمات الحادة جدًا)
    const gd = Math.pow(10, -3 / (p.t60 * freq));
    const lossOf = (s) => 1 - Math.sqrt(1 - 2 * s * (1 - s) * (1 - Math.cos(w)));
    let S = p.S;
    if (lossOf(S) > (1 - gd) * 0.85) {
        let lo = 0, hi = S;
        for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (lossOf(mid) > (1 - gd) * 0.85) hi = mid; else lo = mid; }
        S = lo;
    }
    const re = (1 - S) + S * Math.cos(w), im = -S * Math.sin(w);
    const magH = Math.hypot(re, im);
    const tauH = -Math.atan2(im, re) / w;
    const d = sr / freq - tauH;
    const N = Math.max(2, Math.floor(d - 0.5));
    const frac = d - N;
    const C = (1 - frac) / (1 + frac);
    // حلقة مستقرة دائمًا: كسب الحلقة عند التردد صفر = rho يجب أن يبقى أقل من 1 (مهم للنغمات العالية جدًا)
    const rho = Math.min(0.9998, Math.pow(10, -3 / (p.t60 * freq)) / magH);
    const len = out.length - start;
    if (len <= 0) return;
    const ex = new Float32Array(N);
    let lp = 0;
    const a = p.aBase + p.aMul * p.hard;
    for (let i = 0; i < N; i++) { lp += a * ((rnd() * 2 - 1) - lp); ex[i] = lp; }
    const P = Math.max(1, Math.round(p.pick * N));
    const ex2 = new Float32Array(N);
    let mean = 0;
    for (let i = 0; i < N; i++) { ex2[i] = ex[i] - (i >= P ? ex[i - P] : 0); mean += ex2[i]; }
    mean /= N;
    let rms = 0;
    for (let i = 0; i < N; i++) { ex2[i] -= mean; rms += ex2[i] * ex2[i]; }
    rms = Math.sqrt(rms / N) || 1;
    const g = p.amp / rms;
    const y = new Float32Array(len);
    let lpPrevIn = 0, apPrevIn = 0, apPrevOut = 0;
    for (let n = 0; n < len; n++) {
        const v = n >= N ? y[n - N] : 0;
        const lpOut = (1 - S) * v + S * lpPrevIn;
        lpPrevIn = v;
        const apOut = C * lpOut + apPrevIn - C * apPrevOut;
        apPrevIn = lpOut;
        apPrevOut = apOut;
        y[n] = (n < N ? ex2[n] * g : 0) + rho * apOut;
    }
    let xPrev = 0, yPrev = 0;
    for (let n = 0; n < len; n++) {
        const yy = y[n] - xPrev + 0.995 * yPrev;
        xPrev = y[n];
        yPrev = yy;
        out[start + n] += yy;
    }
}

// معايرة علو القانون لكل درجة (مقيسة في قانون MusiTeacher) – تُستكمل بالاستيفاء حسب التردد
const QANUN_TRIM_DB = [-0.9, -0.7, -1.7, -2.1, -0.5, 0.2, 0.1, 1.3, 2.4, 1.0, 1.1, 4.1, 5.0, 6.8, 5.8, 6.3, 6.7, 7.9, 6.6, 8.9, 8.9, 10.0, 11.3, 11.2, 13.9, 15.3];
const QANUN_COURSE_MIDI = (() => {           // 26 درجة دياتونية من صول2
    const out = []; let li = 4, oct = 2;
    for (let i = 0; i < 26; i++) { out.push(12 * (oct + 1) + LETTER_SEMI[li]); li++; if (li === 7) { li = 0; oct++; } }
    return out;
})();
function qanunCoursePos(midi) {
    const c = QANUN_COURSE_MIDI;
    if (midi <= c[0]) return 0;
    if (midi >= c[c.length - 1]) return c.length - 1;
    for (let i = 0; i < c.length - 1; i++) if (midi <= c[i + 1]) return i + (midi - c[i]) / (c[i + 1] - c[i]);
    return c.length - 1;
}
function qanunTrimDb(midi) {
    const p = qanunCoursePos(midi), i = Math.floor(p), f = p - i;
    const a = QANUN_TRIM_DB[i], b = QANUN_TRIM_DB[Math.min(i + 1, QANUN_TRIM_DB.length - 1)];
    return a + (b - a) * f;
}
const OUD_COURSES = [36, 41, 45, 50, 55, 60].map((m, i) => ({ index: i, midi: m, double: i > 0, nylon: i >= 4 }));

export function renderQanunPluck(sr, freq, rnd) {
    const dyn = { amp: 0.72, hard: 0.66, click: 0.022 };
    const midi = 69 + 12 * Math.log2(freq / 440);
    const t60 = clamp(3.4 * Math.pow(98 / freq, 0.45), 0.95, 3.4);
    const S = freq < 215 ? 0.16 : 0.24;
    const dur = Math.min(4.4, t60 * 1.15 + 0.15);
    const len = Math.ceil(dur * sr);
    const out = new Float32Array(len);
    const pick = 0.11 + rnd() * 0.03;
    const det = [-1.2 - rnd() * 0.6, 0, 1.0 + rnd() * 0.6];
    const amps = [1, 0.92, 0.86];
    for (let k = 0; k < 3; k++) {
        const lag = k === 0 ? 0 : Math.floor((0.0004 + rnd() * 0.0016) * k * sr);
        const hard = dyn.hard * (1 - 0.4 * clamp((freq - 350) / 800, 0, 1));
        renderString(out, lag, freq * Math.pow(2, det[k] / 1200), sr,
            { t60: t60 * (1 - 0.06 * k), S, hard, pick: pick + 0.01 * k, amp: amps[k], aBase: 0.2, aMul: 0.78 }, rnd);
    }
    let e = 0;
    const e0 = Math.floor(0.004 * sr), e1 = Math.min(len, Math.floor(0.45 * sr));   // نافذة أطول: علو متسق رغم تموّج الأوتار الثلاثة
    for (let i = e0; i < e1; i++) e += out[i] * out[i];
    const rms = Math.sqrt(e / Math.max(1, e1 - e0)) || 1;
    const reg = 1 + 0.25 * clamp((300 - freq) / 200, 0, 1) - 0.3 * clamp((freq - 500) / 700, 0, 1);
    const target = 0.085 * dyn.amp * reg * Math.pow(10, qanunTrimDb(midi) / 20);
    const gain = target / rms;
    const fade = Math.floor(0.05 * sr);
    for (let i = 0; i < len; i++) {
        let v = out[i] * gain;
        if (i > len - fade) v *= (len - i) / fade;
        out[i] = v;
    }
    const clickLen = Math.floor(0.003 * sr);
    let b1 = 0, b2 = 0;
    for (let i = 0; i < clickLen; i++) {
        const en = Math.sin(Math.PI * i / clickLen);
        b1 += 0.5 * ((rnd() * 2 - 1) - b1);
        b2 += 0.5 * (b1 - b2);
        out[i] += (b1 - b2) * target * 9 * en;
    }
    for (let i = 0; i < len; i++) {
        const v = out[i];
        if (v > 0.5 || v < -0.5) out[i] = Math.sign(v) * (0.5 + 0.45 * Math.tanh((Math.abs(v) - 0.5) / 0.45));
    }
    return out;
}

export function renderOudPluck(sr, freq, rnd) {
    const dyn = { amp: 0.68, hard: 0.55, click: 0.018 };
    const midi = 69 + 12 * Math.log2(freq / 440);
    let course = OUD_COURSES[0];
    for (const c of OUD_COURSES) if (c.midi <= midi + 0.05) course = c;
    const open = Math.abs(midi - course.midi) < 0.03;
    const baseT60 = [3.6, 3.3, 3.0, 2.7, 2.2, 1.9][course.index];
    const t60 = open ? baseT60 : baseT60 * 0.85;
    // فوق مدى العود المعتاد يخف فلتر الفقد حتى لا تموت النغمة الحادة فورًا
    const S = (course.nylon ? 0.34 : 0.22) + (open ? 0 : 0.07) + (1 - dyn.hard) * 0.08;
    const dur = Math.min(5, t60 * 1.15 + 0.2);
    const len = Math.ceil(dur * sr);
    const out = new Float32Array(len);
    const pick = 0.2 + rnd() * 0.05;
    const common = { t60, S, hard: dyn.hard, amp: 1, aBase: 0.15, aMul: 0.8 };
    renderString(out, 0, freq * Math.pow(2, (course.double ? -0.9 : 0) / 1200), sr, Object.assign({}, common, { pick }), rnd);
    if (course.double) {
        const lag = Math.floor((0.0012 + rnd() * 0.0025) * sr);
        const det = 0.8 + rnd() * 1.4;
        renderString(out, lag, freq * Math.pow(2, det / 1200), sr, Object.assign({}, common, { pick: pick + 0.015, amp: 0.85 }), rnd);
    }
    const clickLen = Math.floor(0.004 * sr);
    let bp1 = 0, bp2 = 0;
    for (let i = 0; i < clickLen; i++) {
        const en = Math.sin(Math.PI * i / clickLen);
        bp1 += 0.45 * ((rnd() * 2 - 1) - bp1);
        bp2 += 0.45 * (bp1 - bp2);
        out[i] += (bp1 - bp2) * dyn.click * 12 * en;
    }
    let peak = 0, e = 0;
    const e0 = Math.floor(0.006 * sr), e1 = Math.min(len, Math.floor(0.45 * sr));
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
    for (let i = e0; i < e1; i++) e += out[i] * out[i];
    const rms = Math.sqrt(e / Math.max(1, e1 - e0)) || 1;
    const lowBoost = 1 + 0.12 * (5 - course.index) / 5;
    const trim = [1, 1, 1, 1, 0.9, 0.55][course.index];
    // النغمات العالية جدًا (فوق مدى العود المعتاد) أخف قليلًا
    const hiTrim = midi > 72 ? Math.pow(10, -(midi - 72) * 0.25 / 20) : 1;
    let gain = (0.15 * dyn.amp * lowBoost * trim * hiTrim) / rms;
    if (peak * gain > 0.9) gain = 0.9 / peak;
    const fade = Math.floor(0.05 * sr);
    for (let i = 0; i < len; i++) {
        let v = out[i] * gain;
        if (i > len - fade) v *= (len - i) / fade;
        out[i] = v;
    }
    return out;
}

