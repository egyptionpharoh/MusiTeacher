import asyncio, sys, os, json
from playwright.async_api import async_playwright
IDS=sys.argv[1].split(',')
OUT=os.environ.get('OUT','/home/claude/mt/_shots'); os.makedirs(OUT,exist_ok=True)
CLICK=r'/اضغط للدخول|ابدأ العزف|تفعيل الصوت والبدء|ابدأ/'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist","--enable-unsafe-swiftshader","--autoplay-policy=no-user-gesture-required"])
        for gid in IDS:
            ctx=await b.new_context(viewport={'width':1280,'height':720}); pg=await ctx.new_page(); errs=[]; bad=[]
            pg.on('pageerror',lambda e,errs=errs:errs.append(str(e)[:150]))
            pg.on('response',lambda r,bad=bad:bad.append((r.status,r.url[-60:])) if r.status>=400 and 'fonts.g' not in r.url and 'cdn' not in r.url else None)
            await pg.goto(f'http://localhost:5300/embed.html?id={gid}',wait_until='domcontentloaded')
            await pg.wait_for_timeout(9000)
            fr=[f for f in pg.frames if '/play/' in f.url]
            st=await pg.evaluate("window.__sess")
            clicked=False
            if fr:
                try:
                    await fr[0].locator('button, [role=button], .start, #start, #enter').filter(has_text=__import__('re').compile('ابدأ|اضغط للدخول|تفعيل الصوت|ابدأ العزف')).first.click(timeout=3000, force=True); clicked=True
                except Exception:
                    try:
                        clicked=await fr[0].evaluate("()=>{const els=[...document.querySelectorAll('button,a,div,span')].filter(e=>/^\\s*ابدأ/.test(e.textContent||'')&&e.children.length<4);const e=els.pop();if(e){e.click();return true}return false}")
                    except Exception: pass
            await pg.wait_for_timeout(4000 if clicked else 1500)
            await pg.screenshot(path=f'{OUT}/{gid}.png')
            print(gid,'session',st.get('ok'),'frame',bool(fr),'clicked',clicked,'errs',errs[:2],'bad',bad[:3],flush=True)
            await ctx.close()
        await b.close()
asyncio.run(main())
