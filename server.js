import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { teacherPrompt } from './prompt-engine/teacher-prompt.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const PORT = process.env.PORT || 4000;

app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `${teacherPrompt} \n\n سؤال المعلم: ${message}`;
        
        const result = await model.generateContent(prompt);
        const reply = result.response.text();

        res.json({ success: true, reply });
    } catch (error) {
        console.error("خطأ في الاتصال بـ Gemini:", error);
        res.status(500).json({ success: false, error: "حدث خطأ أثناء التواصل مع العقل الذكي" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 السمارت تيتشر جاهز للعمل على بورت ${PORT}`);
});