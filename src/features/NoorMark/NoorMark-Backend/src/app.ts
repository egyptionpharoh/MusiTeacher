import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import cors from 'cors';
import * as xlsx from 'xlsx';
import * as fs from 'fs';

const app = express();

// السماح بالاتصال من أي دومين (CORS)
app.use(cors());

const upload = multer({ dest: 'uploads/' });

app.post('/api/upload', upload.single('file'), (req: Request, res: Response, next: NextFunction): void => {
    try {
        if (!req.file) {
            res.status(400).json({ success: false, error: 'لم يتم رفع ملف.' });
            return;
        }

        const workbook = xlsx.readFile(req.file.path, { raw: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const jsonData = xlsx.utils.sheet_to_json(worksheet, { 
            range: 8, 
            defval: "" 
        });

        const students: any[] = [];
        
        jsonData.forEach((row: any, index: number) => {
            const name = row['اسم الطالب'];
            const score = row['المجموع']; 

            if (name) {
                students.push({
                    id: index + 1,
                    name: name,
                    score: score || '0'
                });
            }
        });

        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        
        res.status(200).json({ success: true, data: { className: 'الخامس', students } });
    } catch (error) {
        console.error("خطأ في معالجة الملف:", error);
        res.status(500).json({ success: false, error: 'مشكلة في قراءة أعمدة الملف.' });
    }
});

// مفتاح التشغيل النهائي (مرة واحدة فقط)
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 السيرفر جاهز ويعمل بالكامل على البورت: ${PORT}`);
});