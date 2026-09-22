'use client'; // ضروري جداً لأننا نستخدم useState في مكون تفاعلي
import { useState } from 'react';

export default function ChatInput({ onSendMessage, disabled }) {
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (!inputValue.trim()) return;
    onSendMessage(inputValue);
    setInputValue('');
  };

  return (
    <div className="teacher-chat-footer">
      <input 
        suppressHydrationWarning
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        disabled={disabled}
      />
    </div>
  );
}