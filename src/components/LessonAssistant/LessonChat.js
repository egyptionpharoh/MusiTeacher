'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import ChatInput from '../ChatInput'; // تأكد أن ChatInput.js موجود في src/components/
import { buildLessonContext, generateResponse } from '../../lib/LessonAssistant/knowledgeEngine';

const TypingBubble = ({ messageData }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    let i = 0;
    const text = messageData.message || '';
    setDisplayedText('');
    setIsTyping(true);
    
    const interval = setInterval(() => {
      setDisplayedText(text.slice(0, i));
      i++;
      if (i > text.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 15);
    return () => clearInterval(interval);
  }, [messageData]);

  return (
    <div className="bg-gray-100 text-gray-800 p-4 rounded-2xl rounded-tr-sm max-w-[85%] shadow-sm border border-gray-200">
      <div className="whitespace-pre-wrap leading-relaxed">{displayedText}</div>
      {!isTyping && messageData.action && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <Link href={messageData.action.route}>
            <button className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-2 px-6 rounded-lg transition-all shadow-md">
              {messageData.action.label}
            </button>
          </Link>
        </div>
      )}
    </div>
  );
};

export default function LessonChat({ rawLessonData }) {
  const [context, setContext] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (rawLessonData) {
      const lessonCtx = buildLessonContext(rawLessonData);
      setContext(lessonCtx);
      setMessages([{ 
        id: Date.now(), 
        type: 'ai', 
        data: { message: `أهلاً بيك يا أستاذي! أنا مساعدك الذكي لدرس (${lessonCtx.title}). يمكنك سؤالي عن خطة التمهيد، الإجراءات، أو اقتراح ألعاب.`, action: null } 
      }]);
    }
  }, [rawLessonData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSendMessage = (text) => {
    setMessages(prev => [...prev, { id: Date.now(), type: 'user', text }]);
    setIsThinking(true);
    setTimeout(() => {
      setIsThinking(false);
      const replyObject = generateResponse(text, context);
      setMessages(prev => [...prev, { id: Date.now() + 1, type: 'ai', data: replyObject }]);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100" dir="rtl">
      <div className="bg-gradient-to-r from-[#0f2027] to-[#203a43] p-4 text-white text-center shadow-md relative z-10">
        <h3 className="font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-300">
          المعلم المساعد الذكي 🤖
        </h3>
        {context && <p className="text-xs text-gray-300 mt-1">الدرس الحالي: {context.title}</p>}
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 relative">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.type === 'user' ? (
              <div className="bg-blue-600 text-white p-4 rounded-2xl rounded-tl-sm max-w-[80%] shadow-md">
                {msg.text}
              </div>
            ) : (
              <TypingBubble messageData={msg.data} />
            )}
          </div>
        ))}
        
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-gray-200 p-4 rounded-2xl rounded-tr-sm flex gap-2 items-center">
              <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 bg-white border-t border-gray-100">
        <ChatInput onSendMessage={handleSendMessage} disabled={isThinking} />
      </div>
    </div>
  );
}