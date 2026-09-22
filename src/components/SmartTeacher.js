'use client';
import { useState } from 'react';
import ChatInput from './ChatInput';

export default function SmartTeacher() {
  // التعديل هنا: وضعنا مصفوفة سليمة بدلاً من [...]
  const [messages, setMessages] = useState([
    { id: 1, type: 'ai', text: 'أهلاً يا أستاذي! أنا مساعدك الذكي لدروس الموسيقى، اسألني عن أي تحضير.' }
  ]);

  const handleSendMessage = async (text) => {
    const userMsg = { id: Date.now(), type: 'user', text };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }), // مستقبلاً هنجيب بيانات المستخدم من Firebase Auth
      });

      const data = await res.json();
      const aiMsg = { id: Date.now() + 1, type: 'ai', text: data.reply };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error("خطأ:", error);
    }
  };

  return (
    <div className="teacher-chat-window">
      <div className="teacher-chat-body">
        {messages.map(msg => <div key={msg.id} className={`msg ${msg.type}`}>{msg.text}</div>)}
      </div>
      <ChatInput onSendMessage={handleSendMessage} />
    </div>
  );
}