'use client';
// شريط التنقل الموحد لأدوات المعلم: شعار MusiTeacher (← الرئيسية) + زر صريح للمستوى الأعلى + مسار «أنت هنا».
// يُعرض من src/app/dashboard/tools/layout.js، فيظهر في كل أداة حتى عند فتحها مباشرة من رابط.
// كل الروابط مسارات ثابتة (لا router.back) حتى لا يدور المستخدم بين صفحتين.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Music } from 'lucide-react';
import HomeLogoLink from '../HomeLogoLink';
import { navFor, HOME_PATH, TOOLS_PATH } from './routes';
import './tools-nav.css';

export default function ToolsNavBar() {
  const pathname = usePathname();
  const nav = navFor(pathname);
  if (!nav) return null;
  return (
    <nav className="mt-toolsnav" aria-label="التنقل في أدوات المعلم" dir="rtl" data-kind={nav.kind}>
      <div className="mt-toolsnav__in">
        <div className="mt-toolsnav__start">
          <Link href={nav.up.href} className="mt-toolsnav__up" id="mt-toolsnav-up">
            <ArrowRight size={18} aria-hidden="true" className="mt-toolsnav__arrow" />
            <span>{nav.up.label}</span>
          </Link>
          <ol className="mt-toolsnav__crumbs" aria-label="أنت هنا">
            <li><Link href={HOME_PATH}>الرئيسية</Link></li>
            {nav.kind === 'tools'
              ? <li><span aria-current="page">أدوات المعلم</span></li>
              : <><li><Link href={TOOLS_PATH}>أدوات المعلم</Link></li><li><span aria-current="page">{nav.title}</span></li></>}
          </ol>
        </div>
        <HomeLogoLink className="mt-toolsnav__logo">
          <span className="mt-toolsnav__word">MusiTeacher</span>
          <Music size={20} aria-hidden="true" className="mt-toolsnav__note" />
        </HomeLogoLink>
      </div>
    </nav>
  );
}
