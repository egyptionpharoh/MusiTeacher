# openpyxl يكتب النص العربي كمراجع رقمية (&#NNNN;)؛ بعض القارئات (SheetJS) تفك الرموز خارج المستوى الأساسي (الرموز الموسيقية 𝄽 𝅗𝅥 …) خطأ.
# نحوّل المراجع الرقمية إلى نص UTF-8 مباشر داخل XML (صالح تمامًا) دون أي تغيير في المحتوى.
import zipfile, re, sys, os, shutil, html
def fix(path):
    tmp=path+'.tmp'
    with zipfile.ZipFile(path) as zi, zipfile.ZipFile(tmp,'w',zipfile.ZIP_DEFLATED) as zo:
        for it in zi.infolist():
            data=zi.read(it.filename)
            if it.filename.endswith('.xml'):
                s=data.decode('utf-8')
                s=re.sub(r'&#(\d+);',lambda m: chr(int(m.group(1))) if int(m.group(1))>=0x20 and chr(int(m.group(1))) not in '<>&"\'' else m.group(0),s)
                s=re.sub(r'&#x([0-9a-fA-F]+);',lambda m: chr(int(m.group(1),16)) if int(m.group(1),16)>=0x20 and chr(int(m.group(1),16)) not in '<>&"\'' else m.group(0),s)
                data=s.encode('utf-8')
            zo.writestr(it,data)
    os.replace(tmp,path)
for root,_,fs in os.walk(sys.argv[1]):
    for f in fs:
        if f.endswith('.xlsx'): fix(os.path.join(root,f))
print('fixed')
