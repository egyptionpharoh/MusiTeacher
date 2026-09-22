import devImage from './assets/developer.jpg';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, User, Check, FileText } from 'lucide-react';

interface LandingPageProps {
  onEnter: () => void;
}

export default function LandingPage({ onEnter }: LandingPageProps) {
  const [imgError, setImgError] = useState(false);
  const [isBioExpanded, setIsBioExpanded] = useState(false);

  return (
    <div className="landing-wrapper" dir="rtl">
      <div className="landing-container">
        
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}
        >
          <div className="folded-paper-container">
            <div className="folded-paper-logo">
              {/* الـ SVG الخاص بحرف N وعلامة الصح البارزة */}
              <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" className="n-check-svg">
                <defs>
                  {/* تدرج لوني يعطي إيحاء المعدن المصقول (Bevel Effect) */}
                  <linearGradient id="n3dGradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#1e3a8a" />
                    <stop offset="50%" stopColor="#0f172a" />
                    <stop offset="100%" stopColor="#1e3a8a" />
                  </linearGradient>
                </defs>

                {/* حرف N ككتلة مجسمة - بخط هندسي قوي */}
                <path 
                  d="M 30 90 L 30 30 L 45 30 L 75 75 L 75 30 L 90 30 L 90 90 L 75 90 L 45 45 L 45 90 Z" 
                  fill="url(#n3dGradient)"
                  stroke="#1e3a8a"
                  strokeWidth="2"
                />
                
                {/* علامة الصح الحمراء الرشيقة - أعدنا لها تأثير النبض */}
                <path 
                  d="M 60 70 L 80 95 L 115 35" 
                  stroke="#ef4444" 
                  strokeWidth="6" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  fill="none"
                  className="red-check-mark"
                />
              </svg>
            </div>
          </div>
          
          <h1 className="glow-title">NoorMark</h1>
          
          {/* النص الجديد المطور والأكثر دقة لواجهة المنصة */}
          <p className="platform-desc">
            أداة ذكية صُممت خصيصاً لتسهيل إعداد كشوف درجات التقويم المستمر للمعلمين بضغطة زر واحدة؛ حيث تقوم باستخراج المجموع الكلي لدرجات الطلبة تلقائياً من ملف Excel المُصَدَّر من منصة «نور» عبر حساب المعلم، ثم تحويلها إلى كشف درجات مختصر ومنظم وجاهز للطباعة والاعتماد.
          </p>

          {/* تم تعديل النص هنا ليتوافق مع صياغة "كشف الدرجات" الإدارية */}
          <button className="cta-button" onClick={onEnter}>
            إنشاء كشف درجات
            <ArrowLeft size={20} />
          </button>
        </motion.div>

        <motion.div 
          className="cards-wrapper"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25 }}
        >
          <div className="glass-card expandable-card" onClick={() => setIsBioExpanded(!isBioExpanded)}>
            <div className="developer-header" style={{ justifyContent: isBioExpanded ? 'flex-start' : 'center', flexDirection: isBioExpanded ? 'row' : 'column' }}>
              <div className={`dev-avatar-container ${isBioExpanded ? 'avatar-large' : ''}`}>
                {!imgError ? (
                  <img 
                    src={devImage}
                    alt="حسين الملك" 
                    className="dev-avatar-img" 
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <User size={isBioExpanded ? 40 : 28} color="#cbd5e1" />
                )}
              </div>
              <div className="dev-info" style={{ textAlign: isBioExpanded ? 'right' : 'center' }}>
                <h3>حسين الملك</h3>
              </div>
            </div>
            
            {/* هذا الجزء يظهر فقط عند الضغط */}
            {isBioExpanded ? (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <p className="glass-card-text">
                  هو حسين محمد سيد عبدالعال، ملحن وشاعر غنائي مصري، مهتم بتطوير أنظمة وبرمجيات موسيقية وتعليمية تخدم المعلمين والموسيقيين، مع تركيز خاص على تبسيط الأعمال الأكاديمية والإدارية المرتبطة بالتعليم لتمكين المعلم من التركيز على الإبداع.
                </p>
                <div className="contact-email">
                  <span>musicfactory4444@gmail.com</span>
                  <Mail size={16} color="#d4af37" />
                </div>
              </motion.div>
            ) : (
              <div className="click-to-expand">مبرمج المنصة </div>
            )}
          </div>
        </motion.div>

      </div>
    </div>
  );
}