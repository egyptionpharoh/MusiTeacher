// دالة التحكم في شكل وحالة الزر
function toggleMeasureState() {
    const checkbox = document.getElementById('toggle-measure-numbers');
    const btn = document.getElementById('btn-toggle-measures');
    
    checkbox.checked = !checkbox.checked; // عكس الحالة
    
    if (checkbox.checked) {
        // حالة الإظهار: الزر يطلب الإخفاء (لونه أحمر)
        btn.innerText = 'إخفاء';
        btn.style.background = 'linear-gradient(to bottom, #e74c3c, #c0392b)';
        btn.style.boxShadow = '0 5px 0 #922b21, 0 6px 5px rgba(0,0,0,0.3)';
        btn.onmousedown = function() { this.style.transform='translateY(5px)'; this.style.boxShadow='0 0px 0 #922b21, 0 1px 2px rgba(0,0,0,0.3)'; };
        btn.onmouseup = btn.onmouseleave = function() { this.style.transform='translateY(0)'; this.style.boxShadow='0 5px 0 #922b21, 0 6px 5px rgba(0,0,0,0.3)'; };
    } else {
        // حالة الإخفاء: الزر يطلب الإظهار (لونه أخضر)
        btn.innerText = 'إظهار';
        btn.style.background = 'linear-gradient(to bottom, #2ecc71, #27ae60)';
        btn.style.boxShadow = '0 5px 0 #1e8449, 0 6px 5px rgba(0,0,0,0.3)';
        btn.onmousedown = function() { this.style.transform='translateY(5px)'; this.style.boxShadow='0 0px 0 #1e8449, 0 1px 2px rgba(0,0,0,0.3)'; };
        btn.onmouseup = btn.onmouseleave = function() { this.style.transform='translateY(0)'; this.style.boxShadow='0 5px 0 #1e8449, 0 6px 5px rgba(0,0,0,0.3)'; };
    }
    
    // تحديث اللوحة فوراً
    if (typeof renderExercise === 'function') {
        renderExercise();
    }
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

function resetMeasures() {
    const selectedTimeSig = document.getElementById('timeSig').value;
    const timeSigContainer = document.querySelector('.time-signature');
    if (timeSigContainer) {
        timeSigContainer.innerHTML = `<span>${selectedTimeSig}</span><span>4</span>`;
    }
}

function updateActivityMode() {
    // تم اختصار الوظيفة للتأكد من أن لوحة رموز النغمات والسكتات تظل ظاهرة دائماً أمام المستخدم بشكل ثابت ومستقر
    const toolsArea = document.getElementById('tools-area');
    if (toolsArea) {
        toolsArea.style.display = 'flex';
    }
}

// تهيئة الواجهة على الوضع الافتراضي فور تحميل الصفحة
window.addEventListener('DOMContentLoaded', updateActivityMode);