const fs = require('fs').promises;
const path = require('path');

// 💡 وضع المعاينة (Dry Run): مضبوط على true عشان يعرضلك اللي هيحصل من غير ما ينفذ.
// بعد ما تتطمن للنتيجة، غير الكلمة دي لـ false وشغل السكريبت تاني عشان ينقل بجد.
const DRY_RUN = false;

const gradeMap = {
  "الصف الأول": "grade1", "الصف الثاني": "grade2", "الصف الثالث": "grade3",
  "الصف الرابع": "grade4", "الصف الخامس": "grade5", "الصف السادس": "grade6",
  "الصف السابع": "grade7", "الصف الثامن": "grade8", "الصف التاسع": "grade9",
  "الصف العاشر": "grade10", "الصف الحادي عشر": "grade11", "الصف الثاني عشر": "grade12"
};

async function migrate() {
  const semesters = ['semester1', 'semester2'];
  const baseContentDir = path.join(process.cwd(), 'src', 'content-bank');
  const baseImagesDir = path.join(process.cwd(), 'public', 'images', 'lessons');

  for (const semester of semesters) {
    const otherJsonDir = path.join(baseContentDir, semester, 'other');

    try {
      const files = await fs.readdir(otherJsonDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(otherJsonDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        let json;
        
        try {
          json = JSON.parse(content);
        } catch (e) {
          console.error(`⚠️ مقدرتش أقرأ ملف ${file} لأنه مش JSON سليم.`);
          continue;
        }

        const gradeName = json.metadata?.grade;
        if (!gradeName || !gradeMap[gradeName]) {
          console.log(`⚠️ تخطي ${file}: مفيهوش اسم صف معروف.`);
          continue;
        }

        const newGradeFolder = gradeMap[gradeName];
        
        // استخراج اسم الدرس النظيف من اسم الملف (عشان مجلد الصور)
        const safeTitle = file.replace('-preparation.json', '').replace('-summary.json', '');

        console.log(`\n🔍 لقيت درس: "${json.metadata.title}" (${gradeName})`);

        // 1. استبدال مسارات الصور القديمة في ملف الـ JSON نفسه
        const searchRegex = new RegExp(`/images/lessons/${semester}/other/`, 'g');
        const replaceString = `/images/lessons/${semester}/${newGradeFolder}/`;
        const updatedContent = content.replace(searchRegex, replaceString);

        // 2. مسارات النقل
        const newJsonDir = path.join(baseContentDir, semester, newGradeFolder);
        const newJsonPath = path.join(newJsonDir, file);

        const oldImagesDir = path.join(baseImagesDir, semester, 'other', safeTitle);
        const newImagesTargetDir = path.join(baseImagesDir, semester, newGradeFolder, safeTitle);

        if (!DRY_RUN) {
          // إنشاء المجلدات لو مش موجودة
          await fs.mkdir(newJsonDir, { recursive: true });
          await fs.mkdir(path.join(baseImagesDir, semester, newGradeFolder), { recursive: true });

          // نقل الصور (لو الدرس فيه صور)
          try {
            await fs.rename(oldImagesDir, newImagesTargetDir);
            console.log(`✅ تم نقل مجلد الصور.`);
          } catch (imgErr) {
            if (imgErr.code !== 'ENOENT') console.error(`⚠️ مشكلة في نقل صور ${safeTitle}:`, imgErr);
          }

          // حفظ JSON الجديد وحذف القديم
          await fs.writeFile(newJsonPath, updatedContent, 'utf8');
          await fs.unlink(filePath);
          console.log(`✅ تم نقل الـ JSON بنجاح إلى مجلد ${newGradeFolder}.`);
        } else {
          console.log(`[DRY RUN - وضع المعاينة] سيتم النقل إلى: ${newGradeFolder}`);
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(`Error in ${semester}:`, err);
      }
    }
  }
  console.log("\n🚀 خلصنا الفحص!");
}

migrate();