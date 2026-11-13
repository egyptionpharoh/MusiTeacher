import os
import json, re, datetime as dt, importlib, sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
P={}
for f in ['data_g1_4','data_g5_10','data_g11_12']: P.update(importlib.import_module(f).P)
W1={1:dt.date(2026,9,6),2:dt.date(2027,1,31)}
def d(sem,md):
    if md is None: return None
    m,dd=map(int,md.split('/')); y=2026 if sem==1 else 2027
    return dt.date(y,m,dd)
problems=[]
for (g,s),v in sorted(P.items()):
    rows=v['rows']; prev_end=None; weeks=[]
    persession={}
    for r in rows:
        wk=r[0]; a=d(s,r[1]); b=d(s,r[2])
        ws=W1[s]+dt.timedelta(days=7*(wk-1)); we=ws+dt.timedelta(days=4)
        if a is None:
            problems.append(f'G{g}S{s} w{wk}: تاريخ غير محدد (تعارض موثّق) {r[7] if len(r)>7 else ""}'); continue
        if not (ws<=a<=b<=we): problems.append(f'G{g}S{s} w{wk}: {a}–{b} خارج أسبوعه {ws}–{we}')
        if prev_end and a<=prev_end: problems.append(f'G{g}S{s} w{wk}: تداخل/عدم ترتيب {a} بعد {prev_end}')
        prev_end=b; weeks.append(wk); persession[wk]=persession.get(wk,0)+r[5]
        if r[5]!=r[6]: problems.append(f'G{g}S{s} w{wk}: حصص مختلفة بين النظامين {r[5]}/{r[6]}')
    us=sorted(set(weeks+[r[0] for r in rows]))
    if us!=list(range(1,us[-1]+1)): problems.append(f'G{g}S{s}: أسابيع ناقصة {us}')
    if g>=11:
        bad={w:n for w,n in persession.items() if n!=5}
        if bad: problems.append(f'G{g}S{s}: مجموع حصص أسبوعي ≠5: {bad}')
print('\n'.join(problems) or 'OK')
# مقارنة مع semester-plans.json (استخراج سابق مستقل لنفس النشرة: أسماء الدروس وأسابيعها)
J=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'../../src/data/semester-plans.json')))
GN=['الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر']
SN={1:'الفصل الدراسي الأول',2:'الفصل الدراسي الثاني'}
ORD=['الاول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر','الثالث عشر','الرابع عشر','الخامس عشر','السادس عشر','السابع عشر','الثامن عشر','التاسع عشر']
def norm(t): 
    t=re.sub('[ً-ْـ]','',t); t=t.replace('أ','ا').replace('إ','ا').replace('آ','ا').replace('ى','ي').replace('ة','ه')
    t=re.sub(r'\([^)]*[♩♪♫♬𝄽𝄾𝅗𝅥𝄼𝅝𝄻♯♭♮][^)]*\)','',t)
    return re.sub(r'[^؀-ۿA-Za-z0-9]','',t)
def wnums(s):
    out=set()
    for p in re.split('[،,]',s.replace('أ','ا')):
        p=p.strip()
        if p in ORD: out.add(ORD.index(p)+1)
    return out
mism=[]; matched=0; total=0
for (g,s),v in sorted(P.items()):
    jl=J[SN[s]]['الصف '+GN[g-1]]
    mine={}
    for r in v['rows']: mine.setdefault(norm(r[4]),set()).add(r[0])
    for title,meta in jl.items():
        total+=1; k=norm(title); ws=wnums(meta['weeks'])
        if k not in mine: mism.append(f'G{g}S{s}: في JSON فقط: «{title}» ({meta["weeks"]})'); continue
        if ws and ws!=mine[k]: mism.append(f'G{g}S{s}: «{title}» أسابيع JSON {sorted(ws)} ≠ المستخرج {sorted(mine[k])}')
        else: matched+=1
    jk={norm(t) for t in jl}
    for k in mine:
        if k not in jk: mism.append(f'G{g}S{s}: في المستخرج فقط: {k} أسابيع {sorted(mine[k])}')
print(f'\nمطابقة مع الاستخراج السابق: {matched}/{total}')
print('\n'.join(mism))
