// بديل اختبار لـ next/link و next/navigation: تنقل حقيقي عبر History API (pushState) حتى نختبر زر الرجوع في المتصفح.
import React, { useSyncExternalStore } from 'react';
const listeners = new Set();
const notify = () => listeners.forEach((l) => l());
if (typeof window !== 'undefined') window.addEventListener('popstate', notify);
export function navigate(href, replace) { const u = new URL(href, location.href); if (replace) history.replaceState({}, '', u.pathname + u.search); else history.pushState({}, '', u.pathname + u.search); window.scrollTo(0, 0); notify(); }
const sub = (l) => { listeners.add(l); return () => listeners.delete(l); };
export function usePathname() { return useSyncExternalStore(sub, () => location.pathname, () => '/'); }
export function useSearchParams() { return new URLSearchParams(location.search); }
export function useRouter() { return { push: (h) => navigate(h), replace: (h) => navigate(h, true), back: () => history.back(), prefetch() {}, refresh() {} }; }
export function useParams() { return {}; }
export function redirect(h) { navigate(h, true); }
export function notFound() { throw new Error('notFound'); }
export default function Link({ href, children, prefetch, replace, scroll, ...rest }) {
  return React.createElement('a', { href, ...rest, onClick: (e) => { if (rest.onClick) rest.onClick(e); if (e.defaultPrevented || e.metaKey || e.ctrlKey || rest.target === '_blank') return; e.preventDefault(); navigate(href, replace); } }, children);
}
