// هذا المسار مخصص فقط لصفحة المساعد الذكي
export async function POST(req) {
  const { lessonId } = await req.json();
  const lesson = await Lesson.findOne({ 'metadata.id': lessonId });
  
  // يرسل فقط بيانات المساعد الذكي والألعاب المقترحة
  return NextResponse.json({ 
    success: true, 
    data: lesson.smartAssistantData 
  });
}