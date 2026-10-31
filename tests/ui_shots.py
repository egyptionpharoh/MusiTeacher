from playwright.sync_api import sync_playwright
B='http://localhost:5300'; out='/home/claude/mt/_shots/'
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    for name,q,vp in [('lab-light','',{'width':1280,'height':900}),('lab-dark','?dark=1',{'width':1280,'height':900}),('lab-mobile','',{'width':390,'height':844})]:
        pg=b.new_page(viewport=vp); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto(f'{B}/lab.html{q}'); pg.wait_for_timeout(1200)
        n=pg.locator('.vl-card').count()
        pg.screenshot(path=out+name+'.png',full_page=True)
        print(name,'cards',n,'errors',errs)
        if name=='lab-light':
            pg.click('.vl-chip:has-text("الآلات الوترية")'); print(' strings filter ->',pg.locator('.vl-card').count())
            pg.click('.vl-chip:has-text("الكل")'); pg.fill('.vl-search','عود'); print(' search عود ->',pg.locator('.vl-card').count())
            pg.fill('.vl-search','zzzz'); print(' search none ->',pg.locator('.vl-empty').count())
        pg.close()
    for gid in ['violinist-3d','virtual-oud','xylophone']:
        for dark in ['','?dark=1']:
            pg=b.new_page(viewport={'width':1280,'height':900}); errs=[]
            pg.on('pageerror',lambda e:errs.append(str(e)))
            pg.goto(f'{B}/lab.html{dark}#/lab/{gid}'); pg.wait_for_timeout(6000)
            fr=pg.locator('iframe.vlp-frame'); 
            print(gid,'dark' if dark else 'light','iframe',fr.count(),'src',fr.get_attribute('src') if fr.count() else None,'errs',errs)
            pg.screenshot(path=out+f'player-{gid}-{"dark" if dark else "light"}.png'); pg.close()
    # unauthorized user: free account
    pg=b.new_page(); pg.goto(f'{B}/lab.html?u=free#/lab/xylophone'); pg.wait_for_timeout(2500)
    print('free user state:',pg.locator('.vlp-state').inner_text().replace('\n',' | '), 'iframe',pg.locator('iframe').count())
    b.close()
