# استرجاع ما نقلته خطوة التنظيف 1 (آخر مجلد حجز، أو المسار الذي تمرّره)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$base = Join-Path (Split-Path $root -Parent) 'MusiTeacher-cleanup-quarantine'
$q = if ($args.Count) { $args[0] } else { (Get-ChildItem -LiteralPath $base -Directory | Sort-Object Name -Descending | Select-Object -First 1).FullName }
$list = Import-Csv -Path (Join-Path $q 'moved.csv')
foreach ($m in $list) {
  $src = Join-Path $q $m.Rel; $dst = Join-Path $root $m.Rel
  if (Test-Path -LiteralPath $dst) { Write-Host "Exists, skipped: $($m.Rel)"; continue }
  New-Item -ItemType Directory -Force -Path (Split-Path $dst -Parent) | Out-Null
  Move-Item -LiteralPath $src -Destination $dst; Write-Host "Restored: $($m.Rel)"
}
Write-Host 'Restore finished.'
