import re, json
T='/tmp/pp/tpl/'
P='/usr/local/lib/python3.13/site-packages/pptx/templates/'
def mini(s):
    s=re.sub(r'>\s+<','><',s.strip())
    s=re.sub(r'\s+',' ',s)
    return s
master=open(T+'ppt/slideMasters/slideMaster1.xml').read()
master=re.sub(r'<p:sldLayoutIdLst>.*?</p:sldLayoutIdLst>','<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>',master,flags=re.S)
layout=open(T+'ppt/slideLayouts/slideLayout7.xml').read()
theme=open(T+'ppt/theme/theme1.xml').read()
# خطوط عربية افتراضية للعرض
theme=theme.replace('<a:font script="Arab" typeface="Times New Roman"/>','<a:font script="Arab" typeface="Segoe UI"/>').replace('<a:font script="Arab" typeface="Arial"/>','<a:font script="Arab" typeface="Segoe UI"/>')
notesMaster=open(P+'notesMaster.xml').read()
theme2=open(P+'theme.xml').read()
out={'master':mini(master),'layout':mini(layout),'theme':mini(theme),'notesMaster':mini(notesMaster),'notesTheme':mini(theme2)}
js='// قوالب PowerPoint أساسية (Office theme) مأخوذة من مكتبة python-pptx (رخصة MIT) بعد تبسيطها:\n// ماستر واحد بتخطيط فارغ، وماستر ملاحظات. لا تُعدَّل يدويًا — يولّدها scripts/gen-pptx-template.py\n'
for k,v in out.items(): js+=f'export const {k.upper() if False else k} = {json.dumps(v, ensure_ascii=False)};\n'
open('/home/claude/mt/src/lib/pd-workshops/pptx-template.js','w').write(js)
print({k:len(v) for k,v in out.items()})
print(theme.count('script="Arab"'))
