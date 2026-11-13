import importlib, sys, datetime as dt, os, json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.properties import PageSetupProperties
P={}
for f in ['data_g1_4','data_g5_10','data_g11_12']: P.update(importlib.import_module(f).P)
GN=['الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر']
ORD=['الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر','الثالث عشر','الرابع عشر','الخامس عشر','السادس عشر','السابع عشر','الثامن عشر','التاسع عشر']
SN={1:'الفصل الدراسي الأول',2:'الفصل الدراسي الثاني'}
YEAR='2026/2027'
SOURCE='المصدر: الخطط الدراسية الصادرة عن وزارة التربية والتعليم بسلطنة عُمان («النشرة التوجيهية للعام الدراسي 2026-2027» – خطة توزيع المحتوى لمدارس الفترة الواحدة ومدارس الفترتين). أُعيد تنظيم الملف إلكترونيًا بصيغة Excel لتيسير المعاينة والتنزيل والاستخدام الشخصي من قبل المعلم.'
SYM_NOTE='الرمز الموسيقي داخل القوسين يظهر في النشرة كصورة؛ كُتب هنا بأقرب رمز نصي — راجعه في النشرة الأصلية.'
FONT='Tahoma'
OUT=sys.argv[1]
HEAD=['العام الدراسي','الفصل الدراسي','الصف','الأسبوع','التاريخ كما ورد في النشرة','بداية الفترة الزمنية','نهاية الفترة الزمنية','الوحدة','الدرس','مدارس الفترة الواحدة','مدارس الفترترين'.replace('الفترترين','الفترتين'),'ملاحظات']
WID=[12,18,13,12,18,15,15,11,46,11,11,40]
blue=PatternFill('solid',fgColor='5066B0'); light=PatternFill('solid',fgColor='EEF1F8'); zebra=PatternFill('solid',fgColor='F7F6F1'); warn=PatternFill('solid',fgColor='FFF4D6')
thin=Side(style='thin',color='A7B0C8'); border=Border(left=thin,right=thin,top=thin,bottom=thin)
manifest=[]
def ymd(s,md):
    m,d=map(int,md.split('/')); return dt.date(2026 if s==1 else 2027,m,d)
def src_text(s,a,b):
    if a==b: return f'{a.day}/{a.month}/{a.year}'
    if a.month==b.month: return f'{a.day}-{b.day}/{b.month}/{b.year}'
    return f'{a.day}/{a.month}-{b.day}/{b.month}/{b.year}'
for (g,s),v in sorted(P.items()):
    grade='الصف '+GN[g-1]; sem=SN[s]
    wb=Workbook(); ws=wb.active; ws.title='الخطة'
    ws.sheet_view.rightToLeft=True
    ncol=len(HEAD); last=get_column_letter(ncol)
    ws.merge_cells(f'A1:{last}1'); ws['A1']=f'خطة توزيع المحتوى – {grade} – {sem} – العام الدراسي {YEAR}'
    ws['A1'].font=Font(name=FONT,size=15,bold=True,color='2D3E8C'); ws['A1'].alignment=Alignment(horizontal='center',vertical='center'); ws.row_dimensions[1].height=30
    ws.merge_cells(f'A2:{last}2'); ws['A2']='مادة المهارات الموسيقية • لمدارس الفترة الواحدة ومدارس الفترتين'
    ws['A2'].font=Font(name=FONT,size=11,color='4A4A4A'); ws['A2'].alignment=Alignment(horizontal='center')
    ws.merge_cells(f'A3:{last}3'); ws['A3']=SOURCE
    ws['A3'].font=Font(name=FONT,size=9,italic=True,color='6B6B6B'); ws['A3'].alignment=Alignment(horizontal='right',vertical='center',wrap_text=True); ws.row_dimensions[3].height=32
    r0=4
    notes=v.get('notes',[])
    for n in notes:
        ws.merge_cells(f'A{r0}:{last}{r0}'); ws[f'A{r0}']=f'ملاحظة من النشرة: {n.lstrip("* ")}'
        ws[f'A{r0}'].font=Font(name=FONT,size=10,bold=True,color='A23B2A'); ws[f'A{r0}'].alignment=Alignment(horizontal='right'); r0+=1
    hr=r0+1
    for i,h in enumerate(HEAD,1):
        c=ws.cell(hr,i,h); c.font=Font(name=FONT,size=11,bold=True,color='FFFFFF'); c.fill=blue if i<10 else PatternFill('solid',fgColor='6F82C4')
        c.alignment=Alignment(horizontal='center',vertical='center',wrap_text=True); c.border=border
    ws.row_dimensions[hr].height=36
    rr=hr
    flagged=0
    for idx,row in enumerate(v['rows']):
        wk,a,b,unit,lesson,s1,s2=row[:7]
        rr+=1
        note=[]
        if a is None:
            raw=row[7]; A=B=None; txt=raw
            note.append(f'تعارض في النشرة: التاريخ مكتوب «{raw}» بينما الأسبوع {ORD[wk-1]} يقع في نوفمبر 2026؛ تُرك التاريخ فارغًا للمراجعة.')
        else:
            A=ymd(s,a); B=ymd(s,b); txt=src_text(s,A,B)
        if any(ch in lesson for ch in '♩♪♫♬𝄽𝄾𝅗𝅥𝄼𝅝𝄻♯♭♮'): note.append(SYM_NOTE)
        vals=[YEAR,sem,grade,ORD[wk-1],txt,A,B,unit,lesson,s1,s2,' '.join(note)]
        for i,val in enumerate(vals,1):
            c=ws.cell(rr,i,val); c.font=Font(name=FONT,size=10.5,bold=(i==9)); c.border=border
            c.alignment=Alignment(horizontal='center' if i not in (9,12) else 'right',vertical='center',wrap_text=True)
            c.fill=warn if (a is None and i in (5,6,7,12)) else (zebra if idx%2 else light)
            if i in (6,7) and val is not None: c.number_format='yyyy/mm/dd'
        if a is None: flagged+=1
        ws.row_dimensions[rr].height=34 if len(lesson)<40 else 48
    for i,w in enumerate(WID,1): ws.column_dimensions[get_column_letter(i)].width=w
    ws.freeze_panes=ws.cell(hr+1,1)
    ws.auto_filter.ref=f'A{hr}:{last}{rr}'
    ws.print_title_rows=f'{hr}:{hr}'
    ws.page_setup.orientation='landscape'; ws.page_setup.paperSize=ws.PAPERSIZE_A4
    ws.sheet_properties.pageSetUpPr=PageSetupProperties(fitToPage=True); ws.page_setup.fitToWidth=1; ws.page_setup.fitToHeight=0
    ws.print_options.horizontalCentered=True
    ws.page_margins.left=ws.page_margins.right=0.4; ws.page_margins.top=ws.page_margins.bottom=0.5
    ws.oddFooter.center.text='&P / &N'; ws.oddFooter.right.text=f'{grade} – {sem}'
    # ورقة التعليمات (لا يقرؤها المحلّل لأن اسمها يحتوي «تعليمات»)
    t=wb.create_sheet('تعليمات ومصدر الخطة'); t.sheet_view.rightToLeft=True; t.column_dimensions['A'].width=110
    lines=[('عن هذا الملف',True),(SOURCE,False),(f'المرجع داخل النشرة: {v["src"]} (صفحات خطة {grade} – {sem}).',False),
      ('هذه نسخة مقترحة للاسترشاد؛ لا تعني أنها معتمدة أو رسمية من منصة MusiTeacher، والمرجع الحاكم هو النشرة الأصلية الصادرة عن الوزارة.',False),('',False),
      ('طريقة الاستخدام',True),('1) عدّل الدروس أو الأعمدة بما يناسب مدرستك دون تغيير أسماء رؤوس الأعمدة في ورقة «الخطة».',False),
      ('2) عمود «مدارس الفترة الواحدة» و«مدارس الفترتين» = عدد الحصص لكل صف (أسبوع أو جزء أسبوع). عند الرفع تختار العمود المناسب لمدرستك.',False),
      ('3) «بداية/نهاية الفترة الزمنية» تواريخ فعلية؛ و«التاريخ كما ورد في النشرة» للمطابقة فقط ولا يُستخدم في الحساب.',False),
      ('4) احفظ الملف بصيغة xlsx ثم ارفعه من «مولد الخطط الفصلية» ← ⚙️ ← خططي حسب الصف ← بطاقة الصف.',False),('',False),
      ('ملاحظات المراجعة',True)]
    for n in notes: lines.append((f'• من النشرة: {n.lstrip("* ")}',False))
    if any(any(ch in r[4] for ch in '♩♪♫♬𝄽𝄾𝅗𝅥𝄼𝅝𝄻♯♭♮') for r in v['rows']): lines.append(('• '+SYM_NOTE,False))
    if flagged: lines.append((f'• يوجد {flagged} صف بتاريخ متعارض في النشرة (مظلل بالأصفر) — تُرك فارغًا ولم يُخمَّن.',False))
    if len(lines)==12: lines.append(('• لا توجد ملاحظات؛ طوبق الملف مع صفحات النشرة صفًا بصف.',False))
    for i,(txt,bold) in enumerate(lines,1):
        c=t.cell(i,1,txt); c.font=Font(name=FONT,size=12 if bold else 10.5,bold=bold,color='2D3E8C' if bold else '222222'); c.alignment=Alignment(horizontal='right',wrap_text=True,vertical='top')
    wb.properties.title=f'{grade} - {sem}'; wb.properties.subject='خطة توزيع المحتوى – المهارات الموسيقية'; wb.properties.creator='MusiTeacher (إعادة تنظيم إلكتروني)'
    wb.properties.description=SOURCE; wb.properties.keywords=f'{grade};{sem};{YEAR}'
    d=os.path.join(OUT,grade); os.makedirs(d,exist_ok=True)
    fn=os.path.join(d,f'{sem}.xlsx'); wb.save(fn)
    manifest.append({'grade':g,'semester':sem,'year':YEAR,'gradeName':grade,'rows':len(v['rows']),'flagged':flagged,'notes':notes,'src':v['src'],'path':f'{grade}/{sem}.xlsx'})
json.dump(manifest,open(os.path.join(OUT,'_build.json'),'w'),ensure_ascii=False,indent=1)
print(len(manifest),'files')
