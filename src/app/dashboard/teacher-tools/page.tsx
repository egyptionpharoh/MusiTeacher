import { teacherTools } from '../../../config/toolsConfig';
import { ToolCard } from '../../../modules/teacher-tools/ToolCard';

export default function TeacherToolsPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">مركز أدوات المعلم</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teacherTools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  );
}