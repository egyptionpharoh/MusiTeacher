// --- 1. Audio System (Synthesizer للتدوين اللحني) ---
// نستخدم خاصية الـ Deferred Initialization لضمان عمل Tone.js بعد تحميل المكتبة
let audioCtx, pianoSampler;

async function initAudioEngine() {
    if (audioCtx) return; 
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    pianoSampler = new Tone.Sampler({
        urls: {
            "C4": "C4.mp3",
            "D#4": "Ds4.mp3",
            "F#4": "Fs4.mp3",
            "A4": "A4.mp3",
            "C5": "C5.mp3"
        },
        baseUrl: "https://tonejs.github.io/audio/salamander/"
    }).toDestination();
}

// ترددات النغمات الأساسية
const pitchMap = {
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23,
    'G4': 392.00, 'A4': 440.00, 'B4': 493.88, 'C5': 523.25,
    'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99
};

async function playPitch(freq, duration = 0.5, time = null) {
    await initAudioEngine(); // تأكيد تهيئة المحرك قبل التشغيل
    if(audioCtx.state === 'suspended') audioCtx.resume();
    if(Tone.context.state !== 'running') await Tone.start(); 
    
    const vol = document.getElementById('volumeSlider')?.value || 0.8;
    const startTime = time !== null ? time : Tone.now(); 
    
    if (pianoSampler && pianoSampler.loaded) {
        pianoSampler.volume.value = Tone.gainToDb(vol);
        pianoSampler.triggerAttackRelease(freq, duration, startTime);
    } else {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        const ctxTime = time !== null ? time : audioCtx.currentTime;
        
        osc.type = 'sine'; 
        osc.frequency.setValueAtTime(freq, ctxTime);
        
        gain.gain.setValueAtTime(vol * 0.5, ctxTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctxTime + duration);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(ctxTime);
        osc.stop(ctxTime + duration);
    }
}

// --- 2. Game State & Logic ---
let bgMusic = document.getElementById('bgMusic');
let fadeInterval;
let isMusicPermanentlyStopped = false;

// ربط مستوى صوت الموسيقى بمتحكم الصوت العام
const volSlider = document.getElementById('volumeSlider');
if (volSlider) {
    volSlider.addEventListener('input', function() {
        if(bgMusic) bgMusic.volume = this.value;
    });
}

// --- بنية طبقة نماذج البيانات ---
class MusicEvent {
    constructor(type, duration = 0, options = {}) {
        this.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2);
        this.type = type; 
        this.duration = duration; 
        this.step = null; 
        this.octave = null; 
        this.alter = null; 
        this.velocity = 100; 
        this.options = options; 
    }
}

class MusicVoice {
    constructor(id = 1) {
        this.id = id;
        this.events = [];
    }
}

class MusicMeasure {
    constructor(index) {
        this.index = index;
        this.timeSignature = { beats: 4, beatType: 4 };
        this.clef = 'G';
        this.keySignature = 'C'; 
        this.voices = { 1: new MusicVoice(1) };
    }
    get maxDuration() {
        return this.timeSignature.beats * (4 / this.timeSignature.beatType);
    }
}

class MusicStaff {
    constructor(id) {
        this.id = id;
        this.measures = [];
    }
}

class MusicScore {
    constructor() {
        this.staves = { 1: new MusicStaff(1) };
        this.tempoMap = [];
    }
}

class MusicExercise {
    constructor() {
        this.metadata = { title: "", level: 1, scale: 'C', initialTempo: 70 };
        this.status = 'idle';
        this.targetScore = new MusicScore();
        this.studentScore = new MusicScore();
        this.history = { past: [], future: [] };
    }
}

let currentExercise = null; 
let xp = 0;
let correctCount = 0;
let currentTool = { type: 'note', value: 1 };
let currentAccidental = null;

function initNewExercise(beatsPerMeasure) {
    currentExercise = new MusicExercise();
    let firstMeasure = new MusicMeasure(1);
    firstMeasure.timeSignature.beats = beatsPerMeasure;
    currentExercise.studentScore.staves[1].measures.push(firstMeasure);
}

function getPitchFreq(step, octave, alter) {
    const baseMap = { 'C': 261.63, 'D': 293.66, 'E': 329.63, 'F': 349.23, 'G': 392.00, 'A': 440.00, 'B': 493.88 };
    let freq = baseMap[step];
    if (octave !== 4) freq = freq * Math.pow(2, octave - 4);
    if (alter === 1) freq *= 1.059463;
    if (alter === -1) freq /= 1.059463;
    return freq;
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        document.getElementById('fs-text').innerText = "تصغير الشاشة";
        document.getElementById('fs-icon').innerHTML = '<path d="M4 14h6v6M20 10h-6V4M14 20l7-7M10 4L3 11"/>';
    } else {
        document.exitFullscreen();
        document.getElementById('fs-text').innerText = "ملء الشاشة";
        document.getElementById('fs-icon').innerHTML = '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>';
    }
}

function showMusiAlert(msg) {
    document.getElementById('musi-modal-msg').innerText = msg;
    document.getElementById('musi-alert-modal').classList.add('active');
}

function closeMusiAlert() {
    document.getElementById('musi-alert-modal').classList.remove('active');
}

async function launchGame() {
    const name = document.getElementById('pName').value;
    if(!name) { showMusiAlert("⚠️ يرجى تسجيل اسمك أولاً للبدء!"); return; }
    await Tone.start();
    document.getElementById('display-name').innerText = name;
    document.getElementById('login-card').style.opacity = '0';
    document.querySelector('.contest-title').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('neon-right').style.animation = 'none';
        document.getElementById('neon-left').style.animation = 'none';
        document.getElementById('neon-right').style.left = '50%';
        document.getElementById('neon-left').style.left = '50%';
        setTimeout(() => {
            document.getElementById('flash').style.opacity = '1';
            setTimeout(() => { 
                document.getElementById('flash').style.opacity = '0';
                document.getElementById('main-stage').classList.add('exit-zoom');
                setTimeout(() => {
                    document.getElementById('main-stage').style.display = 'none';
                    startCountdown();
                }, 600);
            }, 150);
        }, 350);
    }, 100);
}

function startCountdown() {
    const overlay = document.getElementById('countdown-overlay');
    const numDisplay = document.getElementById('countdown-number');
    overlay.style.display = 'flex';
    const sequence = ['3', '2', '1', 'GO!'];
    let i = 0;
    const timer = setInterval(() => {
        if (i < sequence.length) {
            numDisplay.innerText = sequence[i];
            numDisplay.classList.remove('pulse-num');
            void numDisplay.offsetWidth; 
            numDisplay.classList.add('pulse-num');
            i++;
        } else {
            clearInterval(timer); 
            overlay.style.display = 'none';
            const lab = document.getElementById('game-lab-container');
            lab.style.display = 'block';
            setTimeout(() => lab.classList.add('lab-enter-active'), 50);
        }
    }, 1000);
}

function fadeOutMusic() {
    if (!bgMusic || isMusicPermanentlyStopped) return;
    clearInterval(fadeInterval);
    fadeInterval = setInterval(() => {
        if (bgMusic.volume > 0.05) { bgMusic.volume = Math.max(0, bgMusic.volume - 0.05); }
        else { bgMusic.volume = 0; bgMusic.pause(); isMusicPermanentlyStopped = true; clearInterval(fadeInterval); }
    }, 100);
}

let isDotActive = false;
document.querySelectorAll('.duration-tool').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.duration-tool').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        updateCurrentTool();
    });
});

const dotToggleBtn = document.getElementById('dot-toggle-btn');
if (dotToggleBtn) {
    dotToggleBtn.addEventListener('click', function() {
        this.classList.toggle('active');
        isDotActive = this.classList.contains('active');
        updateCurrentTool();
    });
}

function updateCurrentTool() {
    const activeBtn = document.querySelector('.duration-tool.active');
    if (!activeBtn) return;
    if (activeBtn.dataset.type === 'repeat') {
        currentTool = { type: 'repeat', value: activeBtn.dataset.value };
        return;
    }
    let baseVal = parseFloat(activeBtn.dataset.value);
    currentTool = { type: activeBtn.dataset.type, value: isDotActive ? baseVal * 1.5 : baseVal };
}

document.querySelectorAll('.acc-tool').forEach(btn => {
    btn.addEventListener('click', function() {
        if(this.classList.contains('active')) {
            this.classList.remove('active');
            currentAccidental = null;
        } else {
            document.querySelectorAll('.acc-tool').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentAccidental = this.dataset.acc;
        }
    });
});

function generateExercise() {
    const btn = document.getElementById('btn-generate');
    const setup = document.getElementById('setup-bar');
    const scale = document.getElementById('scale-type').value;
    const level = document.getElementById('diff-level').value;
    const noteCountElem = document.getElementById('note-count');
    const noteCount = noteCountElem ? parseInt(noteCountElem.value) : 4;
    const measuresCountElem = document.getElementById('measuresCount');
    const measuresCount = measuresCountElem ? parseInt(measuresCountElem.value) : 2;
    const timeSigVal = document.getElementById('timeSig').value;
    const keySigElem = document.getElementById('key-signature');
    if(scale === 'G') keySigElem.innerHTML = '♯';
    else if(scale === 'F') keySigElem.innerHTML = '♭';
    else keySigElem.innerHTML = '';
    setup.style.opacity = '0.5';
    setup.style.pointerEvents = 'none';
    btn.innerText = 'التمرين قيد العمل 🔒';
    document.getElementById('tools-area').style.display = 'flex';
    document.getElementById('staff-container').style.display = 'block';
    document.getElementById('controls-area').style.display = 'flex';
    document.getElementById('transport-controls').style.display = 'flex';
    document.getElementById('feedback-area').style.display = 'none';
    clearStaff();
    const beatsPerMeasure = parseInt(timeSigVal);
    initNewExercise(beatsPerMeasure);
    currentExercise.metadata.scale = scale;
    currentExercise.metadata.level = level;
    currentExercise.metadata.initialTempo = parseInt(document.getElementById('bpm').value) || 70;
    for (let i = 1; i <= measuresCount; i++) {
        let measure = new MusicMeasure(i);
        measure.timeSignature.beats = beatsPerMeasure;
        currentExercise.targetScore.staves[1].measures.push(measure);
    }
    const rawMelody = createDynamicMelody(scale, level, noteCount);
    let currentMeasureIndex = 0;
    let currentBeatInMeasure = 0;
    rawMelody.forEach(noteData => {
        if (currentMeasureIndex >= currentExercise.targetScore.staves[1].measures.length) {
            let extraMeasure = new MusicMeasure(currentMeasureIndex + 1);
            extraMeasure.timeSignature.beats = beatsPerMeasure;
            currentExercise.targetScore.staves[1].measures.push(extraMeasure);
        }
        let ev = new MusicEvent('note', 1); 
        ev.step = noteData.step; ev.octave = noteData.octave; ev.alter = noteData.alter;
        currentExercise.targetScore.staves[1].measures[currentMeasureIndex].voices[1].events.push(ev);
        currentBeatInMeasure++;
        if (currentBeatInMeasure >= beatsPerMeasure) { currentBeatInMeasure = 0; currentMeasureIndex++; }
    });
    playPitch(getPitchFreq(rawMelody[0].step, rawMelody[0].octave, rawMelody[0].alter), 1);
    renderExercise();
}

function drawMeasureLines(count) {
    document.querySelectorAll('.measure-line').forEach(l => l.remove());
    const wrapper = document.getElementById('staff-lines');
    for(let i = 1; i <= count; i++) {
        const line = document.createElement('div');
        line.className = 'measure-line';
        line.style.left = (100 / count) * i + '%';
        if(i === count) { line.style.borderRight = '6px double #2c3e50'; line.style.width = '0'; }
        wrapper.appendChild(line);
    }
}

function createDynamicMelody(scale, level, count) {
    let scaleNotes = [];
    if (scale === 'G') scaleNotes = [{step:'G',octave:4,alter:0}, {step:'A',octave:4,alter:0}, {step:'B',octave:4,alter:0}, {step:'C',octave:5,alter:0}, {step:'D',octave:5,alter:0}, {step:'E',octave:5,alter:0}, {step:'F',octave:5,alter:1}, {step:'G',octave:5,alter:0}];
    else if (scale === 'F') scaleNotes = [{step:'F',octave:4,alter:0}, {step:'G',octave:4,alter:0}, {step:'A',octave:4,alter:0}, {step:'B',octave:4,alter:-1}, {step:'C',octave:5,alter:0}, {step:'D',octave:5,alter:0}, {step:'E',octave:5,alter:0}, {step:'F',octave:5,alter:0}];
    else scaleNotes = [{step:'C',octave:4,alter:0}, {step:'D',octave:4,alter:0}, {step:'E',octave:4,alter:0}, {step:'F',octave:4,alter:0}, {step:'G',octave:4,alter:0}, {step:'A',octave:4,alter:0}, {step:'B',octave:4,alter:0}, {step:'C',octave:5,alter:0}];
    let melody = [];
    let currentIndex = 0; 
    melody.push(scaleNotes[currentIndex]);
    for (let i = 1; i < count - 1; i++) {
        let step;
        if (level === '1') step = Math.random() > 0.5 ? 1 : -1;
        else { step = Math.floor(Math.random() * 5) - 2; if(step === 0) step = 1; }
        currentIndex += step;
        if (currentIndex >= scaleNotes.length) currentIndex = scaleNotes.length - 2;
        if (currentIndex < 0) currentIndex = 1;
        melody.push(scaleNotes[currentIndex]);
    }
    let finalNote = Math.random() > 0.5 ? scaleNotes[0] : scaleNotes[4];
    melody.push(finalNote);
    return melody;
}

let draggedNoteInfo = null;
let selectedNoteInfo = null;

window.addEventListener('mousemove', (e) => {
    if (!draggedNoteInfo || !currentExercise) return;
    const stepIndex = currentRenderer.calculateStepIndexFromClick(e);
    if (draggedNoteInfo.lastStep !== stepIndex) {
        draggedNoteInfo.lastStep = stepIndex;
        const measure = currentExercise.studentScore.staves[1].measures[draggedNoteInfo.mIndex];
        const noteEvent = measure.voices[1].events[draggedNoteInfo.eIndex];
        const newPitch = getPitchFromStepIndex(stepIndex);
        noteEvent.step = newPitch.step; noteEvent.octave = newPitch.octave;
        renderExercise();
        let targetPitchFreq = getPitchFreq(noteEvent.step, noteEvent.octave, noteEvent.alter || 0);
        playPitch(targetPitchFreq, 0.1);
    }
});

window.addEventListener('mouseup', () => { if (draggedNoteInfo) draggedNoteInfo = null; });

window.previewStepIndex = null;
window.addEventListener('mousemove', (e) => {
    const staffContainer = document.getElementById('staff-container');
    if (!staffContainer || !currentExercise) return;
    const rect = staffContainer.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
        if (window.previewStepIndex !== null) { window.previewStepIndex = null; renderExercise(); }
        return;
    }
    const stepIndex = currentRenderer.calculateStepIndexFromClick(e);
    if (window.previewStepIndex !== stepIndex) { window.previewStepIndex = stepIndex; renderExercise(); }
});

window.addEventListener('mouseleave', () => { if (window.previewStepIndex !== null) { window.previewStepIndex = null; renderExercise(); } });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && PlaybackEngine.loopMode) PlaybackEngine.toggleLoop(); });

function placeNoteOnStaff(e) {
    if (!currentExercise) return;
    if (PlaybackEngine.loopMode) {
        const totalMeasures = parseInt(document.getElementById('measuresCount').value) || 2;
        let closestSystemIndex = 0; let minDistance = Infinity;
        for (let i = 0; i < currentRenderer.systems.length; i++) {
            const sys = currentRenderer.systems[i];
            const rect = sys.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2;
            const dist = Math.abs(e.clientY - centerY);
            if (dist < minDistance) { minDistance = dist; closestSystemIndex = i; }
        }
        const sys = currentRenderer.systems[closestSystemIndex];
        const rect = sys.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const measuresInThisSystem = Math.min(4, totalMeasures - closestSystemIndex * 4);
        const measureWidth = rect.width / measuresInThisSystem;
        let clickedMeasureInSystem = Math.floor(clickX / measureWidth);
        clickedMeasureInSystem = Math.max(0, Math.min(clickedMeasureInSystem, measuresInThisSystem - 1));
        let clickedMeasure = closestSystemIndex * 4 + clickedMeasureInSystem;
        if (clickedMeasure < PlaybackEngine.loopStartMeasure) PlaybackEngine.loopStartMeasure = clickedMeasure;
        else if (clickedMeasure > PlaybackEngine.loopEndMeasure) PlaybackEngine.loopEndMeasure = clickedMeasure;
        else { PlaybackEngine.loopStartMeasure = clickedMeasure; PlaybackEngine.loopEndMeasure = clickedMeasure; }
        PlaybackEngine.updateTransportLoop(); renderExercise(); return;
    }
    selectedNoteInfo = null;
    let studentStaves = currentExercise.studentScore.staves[1].measures;
    if (studentStaves.length === 0) {
        let firstMeasure = new MusicMeasure(1);
        firstMeasure.timeSignature.beats = parseInt(document.getElementById('timeSig').value);
        studentStaves.push(firstMeasure);
    }
    const stepIndex = currentRenderer.calculateStepIndexFromClick(e);
    let selectedPitch = getPitchFromStepIndex(stepIndex);
    let beatsPerMeasure = parseInt(document.getElementById('timeSig').value);
    let totalMeasures = parseInt(document.getElementById('measuresCount').value);
    let currentMeasureIndex = studentStaves.length - 1;
    let currentMeasure = studentStaves[currentMeasureIndex];
    let currentMeasureDuration = currentMeasure.voices[1].events.reduce((sum, ev) => sum + ev.duration, 0);
    let toolDuration = (currentTool.type === 'repeat') ? 0 : currentTool.value;
    if (currentMeasureDuration + toolDuration > beatsPerMeasure) {
        if (studentStaves.length < totalMeasures) {
            let newMeasure = new MusicMeasure(studentStaves.length + 1);
            newMeasure.timeSignature.beats = beatsPerMeasure;
            studentStaves.push(newMeasure);
            currentMeasure = newMeasure;
        } else { showMusiAlert("⚠️ اكتملت جميع الموازير!"); return; }
    }
    let alterVal = currentAccidental === 'sharp' ? 1 : (currentAccidental === 'flat' ? -1 : (currentAccidental === 'natural' ? 0 : null));
    let newEvent;
    if (currentTool.type === 'repeat') { newEvent = new MusicEvent('repeat', 0); newEvent.symbol = currentTool.value; }
    else { newEvent = new MusicEvent(currentTool.type, currentTool.value); newEvent.step = selectedPitch.step; newEvent.octave = selectedPitch.octave; newEvent.alter = alterVal; }
    currentMeasure.voices[1].events.push(newEvent);
    if (isDotActive) { isDotActive = false; document.getElementById('dot-toggle-btn').classList.remove('active'); updateCurrentTool(); }
    if (currentAccidental !== null) { currentAccidental = null; document.querySelectorAll('.acc-tool').forEach(btn => btn.classList.remove('active')); }
    if(newEvent.type === 'note') { let soundAlter = alterVal || 0; let targetPitchFreq = getPitchFreq(newEvent.step, newEvent.octave, soundAlter); playPitch(targetPitchFreq, newEvent.duration * 0.5); }
    renderExercise();
}

function deleteSelectedNote() {
    if (!currentExercise) return;
    if (selectedNoteInfo) {
        let measure = currentExercise.studentScore.staves[1].measures[selectedNoteInfo.mIndex];
        measure.voices[1].events.splice(selectedNoteInfo.eIndex, 1);
        selectedNoteInfo = null; 
    } else {
        let studentStaves = currentExercise.studentScore.staves[1].measures;
        for (let i = studentStaves.length - 1; i >= 0; i--) {
            if (studentStaves[i].voices[1].events.length > 0) { studentStaves[i].voices[1].events.pop(); break; }
        }
    }
    renderExercise();
}

function clearStaff() {
    if (!currentExercise) return;
    currentExercise.studentScore.staves[1].measures = [new MusicMeasure(1)];
    currentRenderer.clearSolution();
    renderExercise();
}

class MusicRenderer { activate() {} render(exercise) { throw new Error("render() must be implemented"); } drawMeasureLines(count) { throw new Error("drawMeasureLines() must be implemented"); } calculateStepIndexFromClick(event) { throw new Error("calculateStepIndexFromClick() must be implemented"); } }

class ManualRenderer extends MusicRenderer {
    constructor() { super(); this.container = document.getElementById('manual-ui-container'); this.vexContainer = document.getElementById('vexflow-container'); this.systems = []; }
    activate() { this.vexContainer.style.display = 'none'; this.container.style.display = 'flex'; this.container.style.flexDirection = 'column'; this.container.style.gap = '70px'; }
    calculateStepIndexFromClick(e) {
        if (this.systems.length === 0) return 8;
        let closestSys = this.systems[0]; let minDistance = Infinity;
        this.systems.forEach(sys => {
            const rect = sys.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2;
            const dist = Math.abs(e.clientY - centerY);
            if (dist < minDistance) { minDistance = dist; closestSys = sys; }
        });
        const rect = closestSys.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        const stepSize = rect.height / 8;
        return Math.round(clickY / stepSize);
    }
    drawBeamLine(container, x1, y1, x2, y2, thickness, color = '#000') {
        const length = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        const line = document.createElement('div');
        line.className = 'beam-line'; line.style.position = 'absolute'; line.style.left = x1 + 'px'; line.style.top = y1 + 'px'; line.style.width = length + 'px'; line.style.height = thickness + 'px'; line.style.background = color; line.style.transformOrigin = '0 50%'; line.style.transform = `rotate(${angle}deg)`; line.style.zIndex = '5'; line.style.pointerEvents = 'none'; container.appendChild(line);
    }
    render(exercise) {
        this.activate(); this.container.innerHTML = ''; this.systems = [];
        const totalMeasures = parseInt(document.getElementById('measuresCount').value) || 2;
        const beatsPerMeasure = parseInt(document.getElementById('timeSig').value) || 4;
        const scale = document.getElementById('scale-type').value || 'C';
        let keySigHtml = ''; if(scale === 'G') keySigHtml = '♯'; else if(scale === 'F') keySigHtml = '♭';
        let measuresToRender = exercise.studentScore ? exercise.studentScore.staves[1].measures : [];
        if (measuresToRender.length === 0) return;
        const measuresPerSystem = 4; const numSystems = Math.ceil(totalMeasures / measuresPerSystem);
        for (let s = 0; s < numSystems; s++) {
            const systemDiv = document.createElement('div'); systemDiv.className = 'staff-system';
            const staffWrapper = document.createElement('div'); staffWrapper.className = 'staff-lines-wrapper';
            for (let i = 0; i < 5; i++) { const line = document.createElement('div'); line.className = 'staff-line'; staffWrapper.appendChild(line); }
            const clefArea = document.createElement('div'); clefArea.className = 'clef-area'; clefArea.style.display = 'block'; 
            let clefHtml = `<span style="position: absolute; font-size: 6.5rem; left: 2px; top: -18px; line-height: 1;">𝄞</span>`;
            let keySigAndTimeHtml = '';
            if (s === 0) { keySigAndTimeHtml = `<span style="position: absolute; font-size: 2rem; left: 85px; top: 32px;">${keySigHtml}</span><div class="time-signature" style="position: absolute; left: ${keySigHtml ? '110px' : '90px'}; top: 0;"><span style="font-size: 2.5rem; font-weight: 900; line-height: 0.85; margin-bottom: -5px;">${beatsPerMeasure}</span><span style="font-size: 2.5rem; font-weight: 900; line-height: 0.85;">4</span></div>`; }
            clefArea.innerHTML = clefHtml + keySigAndTimeHtml;
            systemDiv.appendChild(staffWrapper); systemDiv.appendChild(clefArea); this.container.appendChild(systemDiv); this.systems.push(staffWrapper);
            const startMeasureIdx = s * measuresPerSystem; const endMeasureIdx = Math.min(startMeasureIdx + measuresPerSystem, totalMeasures); const measuresInThisSystem = endMeasureIdx - startMeasureIdx;
            const showMeasureNumbers = document.getElementById('toggle-measure-numbers')?.checked;
            for (let i = 1; i <= measuresInThisSystem; i++) {
                const measureLeftPos = (100 / measuresInThisSystem) * (i - 1); const measureRightPos = (100 / measuresInThisSystem) * i;
                if (showMeasureNumbers) {
                    const measureNum = startMeasureIdx + i; const numDiv = document.createElement('div'); numDiv.innerText = measureNum; numDiv.style.position = 'absolute'; numDiv.style.left = `calc(${measureLeftPos}% + 8px)`; numDiv.style.top = '-48px'; numDiv.style.color = '#0056b3'; numDiv.style.fontSize = '1.3rem'; numDiv.style.fontWeight = '900'; numDiv.style.fontFamily = 'Cairo, sans-serif'; numDiv.style.textShadow = '1px 1px 0px #fff, -1px -1px 0px #fff, 1px -1px 0px #fff, -1px 1px 0px #fff'; numDiv.style.pointerEvents = 'none'; staffWrapper.appendChild(numDiv);
                }
                if (i > 0) { const mLine = document.createElement('div'); mLine.className = 'measure-line'; mLine.style.left = measureRightPos + '%'; if (i === measuresInThisSystem && s === numSystems - 1 && totalMeasures === endMeasureIdx) { mLine.style.background = 'transparent'; mLine.style.borderLeft = '1.5px solid #2c3e50'; mLine.style.borderRight = '6px solid #2c3e50'; mLine.style.width = '3.5px'; mLine.style.transform = 'translateX(-8px)'; } staffWrapper.appendChild(mLine); }
            }
        }
        measuresToRender.forEach((measure, mIndex) => {
            if (mIndex >= totalMeasures) return;
            const systemIndex = Math.floor(mIndex / measuresPerSystem); const measureIndexInSystem = mIndex % measuresPerSystem; const targetWrapper = this.systems[systemIndex]; if (!targetWrapper) return;
            const rect = targetWrapper.getBoundingClientRect(); const stepSize = rect.height / 8; const measuresInThisSystem = Math.min(measuresPerSystem, totalMeasures - systemIndex * measuresPerSystem); const measureWidth = rect.width / measuresInThisSystem;
            let margin = (mIndex === 0) ? 280 : (measureIndexInSystem === 0 ? 140 : 90);
            let startX = measureIndexInSystem * measureWidth + margin; let availableWidth = measureWidth - margin - 20; let pixelsPerBeat = availableWidth / beatsPerMeasure; let currentBeatPos = 0; let noteRenderData = []; let beamGroups = []; let currentGroup = []; let currentBeatIndex = -1;
            let notesToRender = measure.voices[1] ? measure.voices[1].events.slice() : [];
            if (window.previewStepIndex !== undefined && window.previewStepIndex !== null && mIndex === measuresToRender.length - 1) {
                let currentMeasureDuration = notesToRender.reduce((sum, ev) => sum + ev.duration, 0);
                if (currentMeasureDuration + currentTool.value <= beatsPerMeasure) { let previewPitch = getPitchFromStepIndex(window.previewStepIndex); let alterVal = currentAccidental === 'sharp' ? 1 : (currentAccidental === 'flat' ? -1 : (currentAccidental === 'natural' ? 0 : null)); let previewEvent = new MusicEvent(currentTool.type, currentTool.value); previewEvent.step = previewPitch.step; previewEvent.octave = previewPitch.octave; previewEvent.alter = alterVal; previewEvent.isPreview = true; notesToRender.push(previewEvent); }
            }
            notesToRender.forEach((note, eventIndex) => {
                if (note.alter === 1) note.accidental = 'sharp'; else if (note.alter === -1) note.accidental = 'flat'; else if (note.alter === 0) note.accidental = 'natural';
                let noteX = startX + (currentBeatPos * pixelsPerBeat); let offset = (note.duration >= 4 && beatsPerMeasure === 4) ? (pixelsPerBeat * 1.5) : 0; noteX += offset;
                let stepIndex = (note.type === 'rest') ? (note.duration >= 4 ? 2 : 4) : ((note.type === 'repeat') ? 1 : getStepIndexFromPitch(note.step, note.octave));
                let noteY = stepIndex * stepSize; let beatOfNote = Math.floor(currentBeatPos);
                let data = { note, x: noteX, y: noteY, stepIndex, currentBeatPos, hasBeam: false, eIndex: eventIndex, mIndex: mIndex }; noteRenderData.push(data);
                if (note.type === 'note' && note.duration < 1) { if (currentGroup.length > 0 && currentBeatIndex === beatOfNote) currentGroup.push(data); else { if (currentGroup.length > 1) beamGroups.push(currentGroup); currentGroup = [data]; currentBeatIndex = beatOfNote; } } else { if (currentGroup.length > 1) beamGroups.push(currentGroup); currentGroup = []; }
                currentBeatPos += note.duration;
            });
            if (currentGroup.length > 1) beamGroups.push(currentGroup); beamGroups.forEach(group => group.forEach(n => n.hasBeam = true));
            noteRenderData.forEach((data) => {
                const note = data.note; const noteColor = note.isPreview ? 'rgba(52, 152, 219, 0.7)' : '#000';
                const noteDiv = document.createElement('div'); noteDiv.className = 'placed-note';
                if (selectedNoteInfo && selectedNoteInfo.mIndex === data.mIndex && selectedNoteInfo.eIndex === data.eIndex) noteDiv.classList.add('selected');
                noteDiv.style.fontSize = (stepSize * 1.8) + 'px'; noteDiv.style.left = data.x + 'px'; noteDiv.style.top = data.y + 'px';
                if (note.type === 'note') { if (note.isPreview) noteDiv.style.pointerEvents = 'none'; else { noteDiv.style.cursor = 'grab'; noteDiv.onmousedown = (e) => { e.preventDefault(); e.stopPropagation(); selectedNoteInfo = { mIndex: data.mIndex, eIndex: data.eIndex }; draggedNoteInfo = { mIndex: data.mIndex, eIndex: data.eIndex, lastStep: data.stepIndex }; renderExercise(); }; } }
                if (note.type === 'repeat') {
            noteDiv.style.fontWeight = 'bold';
            let symbolHtml = '';
            const measuresPerSystem = 4;
            const systemIndex = Math.floor(data.mIndex / measuresPerSystem);
            const measureIndexInSystem = data.mIndex % measuresPerSystem;
            const targetWrapper = this.systems[systemIndex];
            const rect = targetWrapper.getBoundingClientRect();
            const totalMeasures = parseInt(document.getElementById('measuresCount').value) || 2;
            const measuresInThisSystem = Math.min(measuresPerSystem, totalMeasures - systemIndex * measuresPerSystem);
            const measureWidth = rect.width / measuresInThisSystem;
            const measureStartX = measureIndexInSystem * measureWidth;
            const measureEndX = (measureIndexInSystem + 1) * measureWidth;

            if (note.symbol === 'start_repeat') {
                noteDiv.style.transform = 'translate(-50%, 0)';
                noteDiv.style.top = '0px';
                noteDiv.style.height = '120px';
                noteDiv.style.width = '20px';
                noteDiv.style.left = (data.mIndex === 0) ? (measureStartX + 150) + 'px' : (measureStartX + 5) + 'px';
                symbolHtml = `<div style="position:absolute; left:5px; top:0; width:5px; height:100%; background:${noteColor};"></div><div style="position:absolute; left:13px; top:0; width:1.5px; height:100%; background:${noteColor};"></div><div style="position:absolute; left:19px; top:41.5px; width:7px; height:7px; border-radius:50%; background:${noteColor};"></div><div style="position:absolute; left:19px; top:71.5px; width:7px; height:7px; border-radius:50%; background:${noteColor};"></div>`;
            } else if (note.symbol === 'end_repeat') {
                noteDiv.style.transform = 'translate(-50%, 0)';
                noteDiv.style.top = '0px';
                noteDiv.style.height = '120px';
                noteDiv.style.width = '20px';
                noteDiv.style.left = (measureEndX - 5) + 'px';
                symbolHtml = `<div style="position:absolute; left:-5px; top:41.5px; width:7px; height:7px; border-radius:50%; background:${noteColor};"></div><div style="position:absolute; left:-5px; top:71.5px; width:7px; height:7px; border-radius:50%; background:${noteColor};"></div><div style="position:absolute; left:5px; top:0; width:1.5px; height:100%; background:${noteColor};"></div><div style="position:absolute; left:10px; top:0; width:5px; height:100%; background:${noteColor};"></div>`;
            } else if (note.symbol === 'end_start_repeat') {
                noteDiv.style.transform = 'translate(-50%, 0)';
                noteDiv.style.top = '0px';
                noteDiv.style.height = '120px';
                noteDiv.style.width = '24px';
                noteDiv.style.left = measureEndX + 'px';
                symbolHtml = `<div style="position:absolute; left:-5px; top:41.5px; width:7px; height:7px; border-radius:50%; background:${noteColor};"></div><div style="position:absolute; left:-5px; top:71.5px; width:7px; height:7px; border-radius:50%; background:${noteColor};"></div><div style="position:absolute; left:5px; top:0; width:2px; height:100%; background:${noteColor};"></div><div style="position:absolute; left:13px; top:0; width:2px; height:100%; background:${noteColor};"></div><div style="position:absolute; left:21px; top:41.5px; width:7px; height:7px; border-radius:50%; background:${noteColor};"></div><div style="position:absolute; left:21px; top:71.5px; width:7px; height:7px; border-radius:50%; background:${noteColor};"></div>`;
            } else {
                noteDiv.style.top = '-35px';
                symbolHtml = (note.symbol === 'segno') ? `<div style="font-family:serif; font-size:2.2rem; color:${noteColor};">𝄋</div>` : (note.symbol === 'coda') ? `<div style="font-family:serif; font-size:2.2rem; color:${noteColor};">𝄌</div>` : (note.symbol === 'fine') ? `<div style="font-family:serif; font-size:1.3rem; color:${noteColor}; font-weight:bold;">Fine</div>` : (note.symbol === 'dc_al_fine') ? `<div style="font-family:serif; font-size:1.2rem; color:${noteColor}; font-weight:bold; white-space:nowrap;">D.C. al Fine</div>` : (note.symbol === 'dc') ? `<div style="font-family:serif; font-size:1.3rem; color:${noteColor}; font-weight:bold; white-space:nowrap;">D.C.</div>` : (note.symbol === 'ds_al_coda') ? `<div style="font-family:serif; font-size:1.2rem; color:${noteColor}; font-weight:bold; white-space:nowrap;">D.S. al Coda</div>` : (note.symbol === 'ds_al_fine') ? `<div style="font-family:serif; font-size:1.2rem; color:${noteColor}; font-weight:bold; white-space:nowrap;">D.S. al Fine</div>` : (note.symbol === 'ds') ? `<div style="font-family:serif; font-size:1.3rem; color:${noteColor}; font-weight:bold; white-space:nowrap;">D.S.</div>` : (note.symbol === 'to_coda') ? `<div style="font-family:serif; font-size:1.3rem; color:${noteColor}; font-weight:bold; white-space:nowrap;">To Coda</div>` : '';
            }
            noteDiv.innerHTML = symbolHtml;
        } else if (note.type === 'rest') {
            noteDiv.style.fontSize = (stepSize * 4) + 'px';
            let restSymbol = (note.duration >= 4) ? `<div style="width:0.8em; height:0.25em; background:${noteColor}; position:absolute; top:0; left:-0.4em;"></div>` : (note.duration >= 2) ? `<div style="width:0.8em; height:0.25em; background:${noteColor}; position:absolute; top:-0.25em; left:-0.4em;"></div>` : (note.duration >= 1) ? `<span style="color:${noteColor}; font-family:serif; position:absolute; top:-0.7em; left:-0.25em;">&#x1D13D;</span>` : (note.duration >= 0.5) ? `<span style="color:${noteColor}; font-family:serif; position:absolute; top:-0.7em; left:-0.25em;">&#x1D13E;</span>` : `<span style="color:${noteColor}; font-family:serif; position:absolute; top:-0.7em; left:-0.25em;">&#x1D13F;</span>`;
            noteDiv.innerHTML = restSymbol;
        } else {
            let isHollow = note.duration >= 2;
            let head = `<div style="position:absolute; width:0.8em; height:0.6em; ${isHollow ? `border:0.18em solid ${noteColor};` : `background:${noteColor};`} border-radius:50%; transform:rotate(-25deg); left:-0.4em; top:-0.3em; box-sizing:border-box;"></div>`;
            let accidentalHtml = '';
            if (note.accidental) {
                let accSymbol = note.accidental === 'sharp' ? '♯' : (note.accidental === 'flat' ? '♭' : '♮');
                accidentalHtml = `<div style="position:absolute; left:-1.2em; top:-0.6em; font-size:1.2em; font-family:serif; color:${noteColor};">${accSymbol}</div>`;
            }
            let stem = '';
            let dot = '';
            if ([1.5, 0.75, 3, 6].includes(note.duration)) dot = `<div style="position:absolute; width:0.18em; height:0.18em; background:${noteColor}; border-radius:50%; left:0.6em; top:-0.1em;"></div>`;
            if (note.duration < 4) {
                let stemDir = (data.stepIndex >= 4) ? 'up' : 'down';
                if (data.hasBeam) {
                    let group = beamGroups.find(g => g.includes(data));
                    let avgStep = group.reduce((sum, n) => sum + n.stepIndex, 0) / group.length;
                    stemDir = (avgStep >= 4) ? 'up' : 'down';
                }
                data.stemDir = stemDir;
                let stemHeight = stepSize * 3;
                let stemPos = stemDir === 'up' ? `bottom:0; left:0.35em;` : `top:0; left:-0.45em;`;
                let flag = '';
                if (!data.hasBeam) {
                    if (note.duration === 0.5 || note.duration === 0.75) flag = `<div style="position:absolute; ${stemDir==='up'?'top:0':'bottom:0'}; left:0.1em; width:0.5em; height:1em; border-right:0.2em solid ${noteColor}; ${stemDir==='up'?'border-top':'border-bottom'}:0.2em solid ${noteColor}; border-radius:0 0.5em 0.5em 0;"></div>`;
                    else if (note.duration === 0.25) flag = `<div style="position:absolute; ${stemDir==='up'?'top:0':'bottom:0'}; left:0.1em; width:0.5em; height:1em; border-right:0.2em solid ${noteColor}; ${stemDir==='up'?'border-top':'border-bottom'}:0.2em solid ${noteColor}; border-radius:0 0.5em 0.5em 0;"></div><div style="position:absolute; ${stemDir==='up'?'top:0.4em':'bottom:0.4em'}; left:0.1em; width:0.5em; height:1em; border-right:0.2em solid ${noteColor}; ${stemDir==='up'?'border-top':'border-bottom'}:0.2em solid ${noteColor}; border-radius:0 0.5em 0.5em 0;"></div>`;
                }
                stem = `<div style="position:absolute; width:0.15em; height:${stemHeight}px; background:${noteColor}; ${stemPos}">${flag}</div>`;
            }
            let ledgerHtml = '';
            if (data.stepIndex >= 10) {
                for (let l = 10; l <= data.stepIndex; l += 2) {
                    let offset = (l - data.stepIndex) * stepSize;
                    ledgerHtml += `<div style="position:absolute; width:1.5em; height:0.15em; background:${noteColor}; top:${offset}px; left:-0.75em; z-index:-1;"></div>`;
                }
            } else if (data.stepIndex <= -2) {
                for (let l = -2; l >= data.stepIndex; l -= 2) {
                    let offset = (l - data.stepIndex) * stepSize;
                    ledgerHtml += `<div style="position:absolute; width:1.5em; height:0.15em; background:${noteColor}; top:${offset}px; left:-0.75em; z-index:-1;"></div>`;
                }
            }
            noteDiv.innerHTML = ledgerHtml + accidentalHtml + head + stem + dot;
        }
        targetWrapper.appendChild(noteDiv);
    });

    beamGroups.forEach(group => {
        let first = group[0];
        let last = group[group.length - 1];
        let stemDir = first.stemDir;
        let beamColor = group.some(n => n.note.isPreview) ? 'rgba(52, 152, 219, 0.7)' : '#000';
        let stemOffsetTop = stemDir === 'up' ? -(stepSize * 3) : (stepSize * 3);
        let xOffset = stemDir === 'up' ? (stepSize * 1.8 * 0.35) : -(stepSize * 1.8 * 0.45) + 2;
        let startXBeam = first.x + xOffset;
        let endXBeam = last.x + xOffset;
        let startYBeam = first.y + stemOffsetTop;
        let endYBeam = last.y + stemOffsetTop;
        this.drawBeamLine(targetWrapper, startXBeam, startYBeam, endXBeam, endYBeam, 5, beamColor);
        
        let connectedSixteenths = new Set();
        for (let idx = 0; idx < group.length - 1; idx++) {
            if (group[idx].note.duration <= 0.25 && group[idx+1].note.duration <= 0.25) {
                let secStartX = group[idx].x + xOffset;
                let secEndX = group[idx+1].x + xOffset;
                let getInterpY = (tx) => startYBeam + (endYBeam - startYBeam) * ((tx - startXBeam) / (endXBeam - startXBeam));
                let sy1 = getInterpY(secStartX) + (stemDir === 'up' ? 7 : -7);
                let sy2 = getInterpY(secEndX) + (stemDir === 'up' ? 7 : -7);
                this.drawBeamLine(targetWrapper, secStartX, sy1, secEndX, sy2, 5, beamColor);
                connectedSixteenths.add(idx);
                connectedSixteenths.add(idx+1);
            }
        }
        for (let idx = 0; idx < group.length; idx++) {
            if (group[idx].note.duration <= 0.25 && !connectedSixteenths.has(idx)) {
                let secStartX = group[idx].x + xOffset;
                let direction = (idx === 0) ? 1 : -1;
                let secEndX = secStartX + (direction * 12);
                let getInterpY = (tx) => startYBeam + (endYBeam - startYBeam) * ((tx - startXBeam) / (endXBeam - startXBeam));
                let sy1 = getInterpY(secStartX) + (stemDir === 'up' ? 7 : -7);
                let sy2 = getInterpY(secEndX) + (stemDir === 'up' ? 7 : -7);
                this.drawBeamLine(targetWrapper, secStartX, sy1, secEndX, sy2, 5, beamColor);
            }
        }
    });
});
        this.drawLoopOverlay(totalMeasures);
    }

    drawLoopOverlay(totalMeasures) {
        document.querySelectorAll('.loop-overlay-ui').forEach(el => el.remove());
        if (!PlaybackEngine.loopMode) return;
        const measuresPerSystem = 4; const startSysIdx = Math.floor(PlaybackEngine.loopStartMeasure / measuresPerSystem); const endSysIdx = Math.floor(PlaybackEngine.loopEndMeasure / measuresPerSystem);
        for (let s = startSysIdx; s <= endSysIdx; s++) {
            const wrapper = this.systems[s]; if (!wrapper) continue;
            const rect = wrapper.getBoundingClientRect(); const measuresInThisSystem = Math.min(measuresPerSystem, totalMeasures - s * measuresPerSystem); const measureWidth = rect.width / measuresInThisSystem;
            let startMInSys = (s === startSysIdx) ? (PlaybackEngine.loopStartMeasure % measuresPerSystem) : 0; let endMInSys = (s === endSysIdx) ? (PlaybackEngine.loopEndMeasure % measuresPerSystem) : (measuresInThisSystem - 1);
            const startX = startMInSys * measureWidth; const endX = (endMInSys + 1) * measureWidth; const width = endX - startX;
            const overlay = document.createElement('div'); overlay.className = 'loop-overlay-ui'; overlay.style.position = 'absolute'; overlay.style.left = startX + 'px'; overlay.style.top = '-30px'; overlay.style.width = width + 'px'; overlay.style.height = (rect.height + 60) + 'px'; overlay.style.background = 'rgba(52, 152, 219, 0.12)'; 
            if (s === startSysIdx) overlay.style.borderLeft = '4px solid var(--primary-color)'; if (s === endSysIdx) overlay.style.borderRight = '4px solid var(--primary-color)';
            overlay.style.pointerEvents = 'none'; overlay.style.zIndex = '0'; overlay.style.boxSizing = 'border-box';
            const topBar = document.createElement('div'); topBar.style.position = 'absolute'; topBar.style.left = (s === startSysIdx) ? '-4px' : '0'; topBar.style.top = '0'; topBar.style.width = `calc(100% + ${(s === startSysIdx && s === endSysIdx) ? '8px' : '4px'})`; topBar.style.height = '4px'; topBar.style.background = 'var(--primary-color)'; overlay.appendChild(topBar);
            if (s === startSysIdx) { const icon = document.createElement('div'); icon.innerHTML = '🔁'; icon.style.position = 'absolute'; icon.style.left = '50%'; icon.style.top = '-15px'; icon.style.transform = 'translate(-50%, -50%)'; icon.style.color = '#fff'; icon.style.background = 'var(--primary-color)'; icon.style.borderRadius = '50%'; icon.style.width = '30px'; icon.style.height = '30px'; icon.style.display = 'flex'; icon.style.alignItems = 'center'; icon.style.justifyContent = 'center'; icon.style.fontSize = '1.2rem'; icon.style.boxShadow = '0 0 10px rgba(0,0,0,0.2)'; overlay.appendChild(icon); }
            wrapper.appendChild(overlay);
        }
    }
}

class VexFlowRenderer extends MusicRenderer {
    constructor() { super(); this.container = document.getElementById('vexflow-container'); this.manualContainer = document.getElementById('manual-ui-container'); this.VF = window.Vex ? window.Vex.Flow : null; this.systemHeight = 160; }
    activate() { this.manualContainer.style.display = 'none'; this.container.style.display = 'block'; }
    calculateStepIndexFromClick(e) {
        const rect = this.container.getBoundingClientRect(); const clickY = e.clientY - rect.top; 
        const systemIndex = Math.floor(clickY / this.systemHeight); const relativeY = clickY - (systemIndex * this.systemHeight) - 40; 
        const stepSize = 100 / 8; let index = Math.floor(relativeY / stepSize); return Math.max(0, Math.min(index, 8));
    }
    drawMeasureLines(count) {}
    render(exercise) {
        if (!this.VF) { console.error("VexFlow is not loaded!"); return; }
        this.activate(); this.container.innerHTML = ""; 
        const renderer = new this.VF.Renderer(this.container, this.VF.Renderer.Backends.SVG); const totalMeasures = parseInt(document.getElementById('measuresCount').value) || 2;
        const measuresPerSystem = 4; const numSystems = Math.ceil(totalMeasures / measuresPerSystem);
        const availableWidth = this.container.clientWidth || document.querySelector('.container').clientWidth - 40; const measureWidth = Math.floor(availableWidth / measuresPerSystem);
        renderer.resize(availableWidth, numSystems * this.systemHeight + 50); const context = renderer.getContext(); const beatsPerMeasure = parseInt(document.getElementById('timeSig').value) || 4; const timeSigStr = beatsPerMeasure + "/4"; const scale = document.getElementById('scale-type').value || 'C';
        let measuresToRender = exercise.studentScore ? exercise.studentScore.staves[1].measures : [];
        measuresToRender.forEach((measure, mIndex) => {
            const systemIndex = Math.floor(mIndex / measuresPerSystem); const measureIndexInSystem = mIndex % measuresPerSystem; 
            let startX = measureIndexInSystem * measureWidth; let startY = 20 + (systemIndex * this.systemHeight); let currentMeasureWidth = measureWidth;
            if (mIndex === 0) { startX += 15; currentMeasureWidth -= 15; } else if (measureIndexInSystem === 0) { startX += 10; currentMeasureWidth -= 10; }
            const stave = new this.VF.Stave(startX, startY, currentMeasureWidth); 
            if (measureIndexInSystem === 0) { stave.addClef("treble").addKeySignature(scale); if (mIndex === 0) stave.addTimeSignature(timeSigStr); }
            if (mIndex === measuresToRender.length - 1) stave.setEndBarType(3);
            stave.setContext(context).draw(); const notes = []; let notesToRender = measure.voices[1] ? measure.voices[1].events : [];
            notesToRender.forEach(noteData => {
                if (noteData.alter === 1) noteData.accidental = 'sharp'; else if (noteData.alter === -1) noteData.accidental = 'flat'; else if (noteData.alter === 0) noteData.accidental = 'natural';
                let dur = ""; if (noteData.duration === 4) dur = "w"; else if (noteData.duration === 3) dur = "h"; else if (noteData.duration === 2) dur = "h"; else if (noteData.duration === 1.5) dur = "q"; else if (noteData.duration === 1) dur = "q"; else if (noteData.duration === 0.75) dur = "8"; else if (noteData.duration === 0.5) dur = "8"; else if (noteData.duration === 0.25) dur = "16"; else dur = "q"; 
                if (noteData.type === 'rest') dur += "r";
                let vfNote = new this.VF.StaveNote({ keys: [`${noteData.step.toLowerCase()}/${noteData.octave}`], duration: dur });
                if (noteData.type === 'note' && noteData.accidental) { if (noteData.accidental === 'sharp') vfNote.addModifier(new this.VF.Accidental("#")); else if (noteData.accidental === 'flat') vfNote.addModifier(new this.VF.Accidental("b")); else if (noteData.accidental === 'natural') vfNote.addModifier(new this.VF.Accidental("n")); }
                if ([1.5, 0.75, 3].includes(noteData.duration)) this.VF.Dot.addToObject(vfNote, 0);
                notes.push(vfNote);
            });
            if (notes.length > 0) { const beams = this.VF.Beam.generateBeams(notes); this.VF.Formatter.FormatAndDraw(context, stave, notes); beams.forEach(b => b.setContext(context).draw()); }
        });
    }
    renderSolution(targetScore) { console.log("VexFlowRenderer: rendering solution..."); } clearSolution() {}
}

let currentRenderer = new ManualRenderer();
function renderExercise() { if (currentExercise) currentRenderer.render(currentExercise); }
function getStepIndexFromPitch(step, octave) {
    const stepsMap = { 'C7': -11, 'B6': -10, 'A6': -9, 'G6': -8, 'F6': -7, 'E6': -6, 'D6': -5, 'C6': -4, 'B5': -3, 'A5': -2, 'G5': -1, 'F5': 0, 'E5': 1, 'D5': 2, 'C5': 3, 'B4': 4, 'A4': 5, 'G4': 6, 'F4': 7, 'E4': 8, 'D4': 9, 'C4': 10, 'B3': 11, 'A3': 12, 'G3': 13, 'F3': 14, 'E3': 15, 'D3': 16, 'C3': 17, 'B2': 18, 'A2': 19, 'G2': 20, 'F2': 21, 'E2': 22, 'D2': 23, 'C2': 24 };
    const key = step + octave; return stepsMap[key] !== undefined ? stepsMap[key] : 8;
}
function getPitchFromStepIndex(stepIndex) {
    const stepsMap = { '-11': {step:'C', octave:7}, '-10': {step:'B', octave:6}, '-9': {step:'A', octave:6}, '-8': {step:'G', octave:6}, '-7': {step:'F', octave:6}, '-6': {step:'E', octave:6}, '-5': {step:'D', octave:6}, '-4': {step:'C', octave:6}, '-3': {step:'B', octave:5}, '-2': {step:'A', octave:5}, '-1': {step:'G', octave:5}, '0': {step:'F', octave:5}, '1': {step:'E', octave:5}, '2': {step:'D', octave:5}, '3': {step:'C', octave:5}, '4': {step:'B', octave:4}, '5': {step:'A', octave:4}, '6': {step:'G', octave:4}, '7': {step:'F', octave:4}, '8': {step:'E', octave:4}, '9': {step:'D', octave:4}, '10': {step:'C', octave:4}, '11': {step:'B', octave:3}, '12': {step:'A', octave:3}, '13': {step:'G', octave:3}, '14': {step:'F', octave:3}, '15': {step:'E', octave:3}, '16': {step:'D', octave:3}, '17': {step:'C', octave:3}, '18': {step:'B', octave:2}, '19': {step:'A', octave:2}, '20': {step:'G', octave:2}, '21': {step:'F', octave:2}, '22': {step:'E', octave:2}, '23': {step:'D', octave:2}, '24': {step:'C', octave:2} };
    return stepsMap[stepIndex] || {step:'C', octave:4};
}

const PlaybackEngine = {
    state: 'STOPPED', part: null, metroPart: null, visualNotes: [], loopMode: false, loopStartMeasure: 0, loopEndMeasure: 0, btnPlay: null, btnLoop: null, countInSynth: null,
    initUI() {
        this.btnPlay = document.getElementById('btn-play-pause'); this.btnLoop = document.getElementById('btn-loop');
        if (!this.countInSynth) { this.countInSynth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 } }).toDestination(); }
    },
    load() {
        if (!currentExercise) return false;
        this.stop(); this.initUI();
        const bpm = currentExercise.metadata.initialTempo || parseInt(document.getElementById('bpm').value) || 70;
        Tone.Transport.bpm.value = bpm; const score = currentExercise.studentScore;
        this.visualNotes = Array.from(document.querySelectorAll('.placed-note')).filter(n => n.id !== 'ghost-note' && !n.classList.contains('solution-note'));
        this.visualNotes.forEach(vn => { if (!vn.hasAttribute('data-orig-transform')) vn.setAttribute('data-orig-transform', vn.style.transform || ''); });
        const beatsPerMeasure = parseInt(document.getElementById('timeSig').value) || 4; const useMetro = document.getElementById('metro-toggle').checked; const startTimeOffset = useMetro ? beatsPerMeasure : 0;
        let rawEvents = []; let domIndex = 0; score.staves[1].measures.forEach((m) => { if (m.voices[1]) { m.voices[1].events.forEach(note => { rawEvents.push({ note: note, visualIndex: domIndex }); domIndex++; }); } });
        if (rawEvents.length === 0) return false;
        let playbackSequence = []; let currentTick = 0; let repeatSequence = [];
        rawEvents.forEach(ev => {
            let note = ev.note;
            if (note.type === 'repeat') {
                if (note.symbol === 'start_repeat') repeatSequence = [];
                else if (note.symbol === 'end_repeat' || note.symbol === 'end_start_repeat') {
                    repeatSequence.forEach(repEv => { playbackSequence.push({ time: (currentTick + startTimeOffset) + " * 4n", note: repEv.note, visualIndex: repEv.visualIndex }); currentTick += repEv.note.duration; });
                    if (note.symbol === 'end_start_repeat') repeatSequence = [];
                }
            } else { playbackSequence.push({ time: (currentTick + startTimeOffset) + " * 4n", note: note, visualIndex: ev.visualIndex }); repeatSequence.push(ev); currentTick += note.duration; }
        });
        this.part = new Tone.Part((time, value) => {
            const note = value.note;
            if (note.type !== 'rest' && !note.isPreview) { const alter = note.alter || 0; const pitchFreq = getPitchFreq(note.step, note.octave, alter); const beatLen = 60 / Tone.Transport.bpm.value; playPitch(pitchFreq, note.duration * beatLen * 0.9, time); }
            if (value.visualIndex >= 0) { Tone.Draw.schedule(() => { this.resetVisuals(); let vn = this.visualNotes[value.visualIndex]; if (vn && vn.style) { vn.style.color = "var(--primary-color)"; vn.style.filter = "drop-shadow(0 0 5px var(--primary-color))"; let orig = vn.getAttribute('data-orig-transform') || ""; vn.style.transform = orig + " scale(1.15)"; vn.style.zIndex = "20"; } }, time); }
        }, playbackSequence).start(0);
        let metroEvents = []; for (let i = 0; i < Math.ceil(currentTick) + startTimeOffset; i++) { metroEvents.push({ time: i + " * 4n", beatIndex: i % beatsPerMeasure, isCountIn: i < startTimeOffset }); }
        this.metroPart = new Tone.Part((time, value) => { if (useMetro) this.playMetronomeSound(time, value.beatIndex, beatsPerMeasure); }, metroEvents).start(0);
        
        // جدولة حدث الإيقاف عند الزمن الإجمالي للحن
        const totalTime = (currentTick + startTimeOffset) + " * 4n";
        Tone.Transport.schedule((time) => {
            if (!this.loopMode) {
                Tone.Draw.schedule(() => {
                    this.stop();
                }, time);
            }
        }, totalTime);

        return true;
    },
    playMetronomeSound(time, beatIndex, beatsPerMeasure) {
        let freq, vel;
        if (beatsPerMeasure === 2) { if (beatIndex === 0) { freq = 880; vel = 0.8; } else { freq = 440; vel = 0.4; } } 
        else if (beatsPerMeasure === 3) { if (beatIndex === 0) { freq = 880; vel = 0.8; } else if (beatIndex === 1) { freq = 550; vel = 0.5; } else { freq = 440; vel = 0.3; } } 
        else { if (beatIndex === 0) { freq = 880; vel = 0.8; } else if (beatIndex === 1) { freq = 550; vel = 0.5; } else if (beatIndex === 2) { freq = 660; vel = 0.6; } else { freq = 440; vel = 0.3; } }
        const volControl = parseFloat(document.getElementById('volumeSlider').value) || 0.8; vel = vel * volControl * 0.4;
        this.countInSynth.volume.value = Tone.gainToDb(vel); this.countInSynth.triggerAttackRelease(freq, 0.1, time);
    },
    async togglePlayPause() {
        if (this.state === 'STOPPED' || this.state === 'IDLE') {
            if (Tone.context.state !== 'running') await Tone.start();
            if (this.load()) { 
                Tone.Transport.position = 0; 
                // إعطاء مهلة استباقية 100 مللي ثانية لتأمين تزامن الإطار الأول
                Tone.Transport.start("+0.1"); 
                this.state = 'PLAYING'; 
            } else {
                showMusiAlert("❌ المدرج فارغ!");
            }
        } else if (this.state === 'PLAYING') { 
            Tone.Transport.pause(); 
            this.state = 'PAUSED'; 
        } else if (this.state === 'PAUSED') { 
            Tone.Transport.start(); 
            this.state = 'PLAYING'; 
        }
        this.updateUI();
    },
    stop() { Tone.Transport.stop(); Tone.Transport.cancel(0); if (this.part) { this.part.dispose(); this.part = null; } if (this.metroPart) { this.metroPart.dispose(); this.metroPart = null; } this.state = 'STOPPED'; Tone.Transport.position = 0; this.resetVisuals(); this.updateUI(); },
    toggleLoop() {
        this.loopMode = !this.loopMode;
        if (this.loopMode) { this.loopStartMeasure = 0; this.loopEndMeasure = 0; if (!this.btnLoop) this.initUI(); if (this.btnLoop) { this.btnLoop.style.color = '#fff'; this.btnLoop.style.background = 'var(--primary-color)'; this.btnLoop.style.boxShadow = '0 0 15px var(--primary-color)'; } } 
        else { if (!this.btnLoop) this.initUI(); if (this.btnLoop) { this.btnLoop.style.color = '#7f8c8d'; this.btnLoop.style.background = 'transparent'; this.btnLoop.style.boxShadow = 'none'; } }
        this.updateTransportLoop(); renderExercise();
    },
    updateTransportLoop() {
        if (this.loopMode) {
            const beatsPerMeasure = parseInt(document.getElementById('timeSig').value) || 4; const useMetro = document.getElementById('metro-toggle').checked; const startTimeOffset = useMetro ? beatsPerMeasure : 0;
            const startBeat = (this.loopStartMeasure * beatsPerMeasure) + startTimeOffset; const endBeat = ((this.loopEndMeasure + 1) * beatsPerMeasure) + startTimeOffset;
            Tone.Transport.loop = true; Tone.Transport.loopStart = startBeat + " * 4n"; Tone.Transport.loopEnd = endBeat + " * 4n";
        } else Tone.Transport.loop = false;
    },
    resetVisuals() { this.visualNotes.forEach(vn => { if (vn && vn.style) { vn.style.color = ""; vn.style.filter = ""; vn.style.transform = vn.getAttribute('data-orig-transform') || ""; vn.style.zIndex = ""; } }); },
    updateUI() { if (!this.btnPlay) this.initUI(); if (this.btnPlay) { if (this.state === 'PLAYING') { this.btnPlay.innerHTML = '⏸'; this.btnPlay.style.color = '#e67e22'; this.btnPlay.title = 'إيقاف مؤقت'; } else { this.btnPlay.innerHTML = '▶'; this.btnPlay.style.color = '#2ecc71'; this.btnPlay.title = 'تشغيل / استئناف'; } } }
};

function checkAnswer() {
    const feedback = document.getElementById('feedback-area'); feedback.style.display = 'block';
    if (!currentExercise) return;
    let studentEvents = []; currentExercise.studentScore.staves[1].measures.forEach(m => { if (m.voices[1]) studentEvents = studentEvents.concat(m.voices[1].events); });
    if(studentEvents.length === 0) { feedback.innerHTML = '❌ المدرج فارغ! دوّن اللحن أولاً يا فنان.'; feedback.style.background = '#fadbd8'; feedback.style.color = '#c0392b'; return; }
    feedback.innerHTML = 'إجابتك رائعة يا فنان! تم تدوين اللحن بنجاح 🌟'; feedback.style.background = '#d1f2eb'; feedback.style.color = '#16a085'; confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    xp += 50; correctCount++; document.getElementById('player-xp').innerText = xp; document.getElementById('correct-count').innerText = correctCount;
    setTimeout(() => { document.getElementById('setup-bar').style.opacity = '1'; document.getElementById('setup-bar').style.pointerEvents = 'auto'; document.getElementById('btn-generate').innerText = 'جولة جديدة 🔄'; }, 3000);
}