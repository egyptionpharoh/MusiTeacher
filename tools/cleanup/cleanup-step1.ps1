# تنظيف آمن لمشروع MusiTeacher — الخطوة 1 (المجموعة الأولى فقط: ملفات ثبت عدم استعمالها)
# لا يحذف شيئًا: ينقل العناصر إلى مجلد حجز خارج المشروع (يمكن إرجاعها بـ restore-step1.bat)،
# ويكتب تقريرًا بالحجم قبل/بعد وحجم سجل Git وأكبر الملفات فيه.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
$quar = Join-Path (Split-Path $root -Parent) ("MusiTeacher-cleanup-quarantine\" + $stamp)
$report = Join-Path $root ("cleanup-report-" + $stamp + ".txt")
$skip = @('node_modules', '.next', '.git')

function Measure-Project {
  $bytes = 0; $files = 0; $dirs = 0
  Get-ChildItem -LiteralPath $root -Force | Where-Object { $skip -notcontains $_.Name } | ForEach-Object {
    if ($_.PSIsContainer) {
      $all = Get-ChildItem -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
      $f = $all | Where-Object { -not $_.PSIsContainer }
      $bytes += ($f | Measure-Object Length -Sum).Sum; $files += @($f).Count; $dirs += @($all | Where-Object { $_.PSIsContainer }).Count + 1
    } else { $bytes += $_.Length; $files++ }
  }
  [pscustomobject]@{ MB = [math]::Round($bytes / 1MB, 2); Files = $files; Dirs = $dirs }
}
function SizeOf($p) { [math]::Round(((Get-ChildItem -LiteralPath $p -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum) / 1KB, 1) }

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("تقرير تنظيف MusiTeacher — $stamp"); $lines.Add("المشروع: $root"); $lines.Add('(القياس يستثني node_modules و .next و .git لأنها لا تُرفع)'); $lines.Add('')
$before = Measure-Project
$lines.Add("قبل التنظيف: $($before.MB) MB · $($before.Files) ملف · $($before.Dirs) مجلد")

# ---- المجموعة الأولى ----
$items = @()
# 1) نسخ احتياطية قديمة داخل مجلدات الألعاب (لقطات قبل تعديلات سابقة؛ لا تُحمَّل في أي لعبة، وتُضمَّن خطأً في حزمة /play على Vercel)
Get-ChildItem -LiteralPath (Join-Path $root 'private-games') -Directory | ForEach-Object {
  Get-ChildItem -LiteralPath $_.FullName -Directory -Filter '_backup_*' | ForEach-Object { $items += $_ }
}
# 2) نسخ احتياطية وسيطة لمشروع الألعاب الطلابية (تجاوزتها النسخ الحالية العاملة، وهي محفوظة أيضًا في سجل Git الخاص بـ musiteacher-games)
#    نُبقي backups\student-games-2026-11-19 لأنه حالة المنصة الأصلية قبل إضافة الألعاب الطلابية.
foreach ($n in @('student-games-security-2026-11-20', 'student-games-paths-2026-11-20', 'student-games-bridge-2026-11-20')) {
  $p = Join-Path $root ("backups\" + $n); if (Test-Path -LiteralPath $p) { $items += Get-Item -LiteralPath $p }
}

# 3) بقايا النسخ القديمة العامة من ألعاب نُقلت إلى المشغّل المحمي (مجلدات public مكشوفة للجميع بلا تسجيل دخول)
#    نُبقي صفحات index.html لأنها تحوّل الروابط القديمة إلى المشغّل المحمي.
foreach ($r in @('public\games\melodic-dictation\audio', 'public\games\melodic-dictation\css', 'public\games\melodic-dictation\js', 'public\games\rhythm-dictation\canvas.png')) {
  $p = Join-Path $root $r; if (Test-Path -LiteralPath $p) { $items += Get-Item -LiteralPath $p }
}
# 4) ملفات بناء قديمة لأداة العجلة العشوائية لا تشير إليها نسختها الحالية (index-7H3NVY4Q.js / index-JT2PT6OX.css)
foreach ($r in @('index-1kL30Q1w.js', 'index-AVLP3EFO.js', 'index-xlFSKxj4.css')) {
  $p = Join-Path $root ("public\games\musiteacher-randomizer\assets\" + $r); if (Test-Path -LiteralPath $p) { $items += Get-Item -LiteralPath $p }
}

$moved = @()
$lines.Add(''); $lines.Add('نُقل إلى مجلد الحجز (قابل للاسترجاع):')
foreach ($it in $items) {
  $rel = $it.FullName.Substring($root.Length).TrimStart('\')
  $kb = SizeOf $it.FullName
  $dest = Join-Path $quar $rel
  New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
  Move-Item -LiteralPath $it.FullName -Destination $dest
  $moved += [pscustomobject]@{ Rel = $rel; KB = $kb }
  $lines.Add("  - $rel  ($kb KB)")
}
if ($moved.Count) { $moved | Export-Csv -NoTypeInformation -Encoding UTF8 -Path (Join-Path $quar 'moved.csv') }

$after = Measure-Project
$lines.Add(''); $lines.Add("بعد التنظيف: $($after.MB) MB · $($after.Files) ملف · $($after.Dirs) مجلد")
$lines.Add("الفرق: $([math]::Round($before.MB - $after.MB, 2)) MB · $($before.Files - $after.Files) ملف · $($moved.Count) مجلد رئيسي نُقل")
$lines.Add("مجلد الحجز: $quar"); $lines.Add('للتراجع: شغّل tools\cleanup\restore-step1.bat')

# ---- معلومات Git (للقرار لاحقًا؛ لا يُعدَّل أي شيء في السجل) ----
if (Get-Command git -ErrorAction SilentlyContinue) {
  foreach ($repo in @($root, (Join-Path $root 'musiteacher-games'))) {
    if (-not (Test-Path -LiteralPath (Join-Path $repo '.git'))) { continue }
    Push-Location $repo
    $lines.Add(''); $lines.Add("== Git: $repo ==")
    (git count-objects -vH) | ForEach-Object { $lines.Add('  ' + $_) }
    $tracked = @(git ls-files) 
    $lines.Add("  ملفات متتبَّعة: $($tracked.Count)")
    $bk = @($tracked | Where-Object { $_ -match '(^|/)_backup_|^backups/' }).Count
    $lines.Add("  منها نسخ احتياطية متتبَّعة في Git: $bk")
    $lines.Add('  أكبر 25 ملفًا في سجل Git كاملًا (الحجم بالكيلوبايت):')
    git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectsize) %(rest)' |
      Where-Object { $_ -like 'blob *' } | ForEach-Object { $p = $_.Split(' ', 3); [pscustomobject]@{ S = [int64]$p[1]; N = $p[2] } } |
      Sort-Object S -Descending | Select-Object -First 25 | ForEach-Object { $lines.Add(('    {0,10:N0}  {1}' -f ($_.S / 1KB), $_.N)) }
    Pop-Location
  }
}
$lines | Out-File -FilePath $report -Encoding UTF8
Write-Host ''
Write-Host "Done. Moved $($moved.Count) folders. Before: $($before.MB) MB  After: $($after.MB) MB"
Write-Host "Report: $report"
