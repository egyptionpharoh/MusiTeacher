const mongoose = require('mongoose');

const founderSchema = new mongoose.Schema({
    name: { type: String, default: 'حسين محمد سيد عبدالعال' },
    alias: { type: String, default: 'حسين الملك' },
    title: { type: String, default: 'مؤسس منصة MusiTeacher' },
    bio: { 
        type: String, 
        default: 'فنان ومبرمج مصري متخصص في دمج الذكاء الاصطناعي بالتعليم الموسيقي، أسس MusiTeacher لتمكين معلمي المهارات الموسيقية في سلطنة عُمان.' 
    },
    vision: { type: String, default: 'تحويل التعليم الموسيقي إلى تجربة ذكية وإبداعية.' }
}, { timestamps: true });

module.exports = mongoose.models.Founder || mongoose.model('Founder', founderSchema);