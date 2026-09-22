import React from 'react';
import Link from 'next/link';
import { FileSpreadsheet, Bot, GraduationCap } from 'lucide-react'; // استيراد الأيقونات

// خريطة بسيطة للأيقونات عشان نربط اسم الأيقونة بالمكون
const iconMap: { [key: string]: any } = {
  FileSpreadsheet: FileSpreadsheet,
  Bot: Bot,
  GraduationCap: GraduationCap,
};

interface ToolCardProps {
  tool: {
    id: string;
    title: string;
    description: string;
    path: string;
    icon: string;
    isActive: boolean;
  };
}

export const ToolCard: React.FC<ToolCardProps> = ({ tool }) => {
  const IconComponent = iconMap[tool.icon];

  return (
    <Link 
      href={tool.path}
      className={`p-6 rounded-xl border transition-all hover:shadow-lg ${
        tool.isActive ? 'bg-white border-blue-100 hover:border-blue-500' : 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
      }`}
    >
      <div className="flex items-center gap-4 mb-4">
        {IconComponent && <IconComponent className="w-8 h-8 text-blue-600" />}
        <h3 className="text-lg font-bold text-gray-800">{tool.title}</h3>
      </div>
      <p className="text-sm text-gray-600">{tool.description}</p>
    </Link>
  );
};