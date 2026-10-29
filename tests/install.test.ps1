$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$fixture = Join-Path $project 'dist\install-test-vault'
$config = Join-Path $fixture '.obsidian'
New-Item -ItemType Directory -Path (Join-Path $config 'plugins\native-table-resize'),(Join-Path $config 'snippets') -Force | Out-Null
$utf8 = [Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllText((Join-Path $config 'community-plugins.json'),'["other-plugin","compact-rich-paste","relative-scroll-lock","native-table-resize"]',$utf8)
[IO.File]::WriteAllText((Join-Path $config 'appearance.json'),'{"theme":"obsidian","baseFontSize":18,"enabledCssSnippets":["custom","wider-note","prompt-handbook-code","project-progress-dashboard"]}',$utf8)
[IO.File]::WriteAllText((Join-Path $config 'plugins\native-table-resize\data.json'),'{"version":1,"files":{"example.md":{"sample":[100,200]}}}',$utf8)
$first = & (Join-Path $project 'scripts\install.ps1') -VaultPath $fixture | ConvertFrom-Json
$enabled = Get-Content -LiteralPath (Join-Path $config 'community-plugins.json') -Raw | ConvertFrom-Json
if (($enabled -join ',') -ne 'other-plugin,49-notion-gpt') { throw 'Enable-list migration failed' }
$appearance = Get-Content -LiteralPath (Join-Path $config 'appearance.json') -Raw | ConvertFrom-Json
if ($appearance.baseFontSize -ne 18 -or ($appearance.enabledCssSnippets -join ',') -ne 'custom') { throw 'Appearance preservation failed' }
if (!(Test-Path -LiteralPath (Join-Path $first.Backup 'native-table-resize\data.json'))) { throw 'Backup missing' }
$dataFile = Join-Path $config 'plugins\49-notion-gpt\data.json'
[IO.File]::WriteAllText($dataFile,'{"version":1,"tables":{"files":{"saved.md":{}}}}',$utf8)
$saved = Get-Content -LiteralPath $dataFile -Raw
$second = & (Join-Path $project 'scripts\install.ps1') -VaultPath $fixture | ConvertFrom-Json
if ((Get-Content -LiteralPath $dataFile -Raw) -ne $saved) { throw 'Upgrade overwrote user data' }
$enabled = @(Get-Content -LiteralPath (Join-Path $config 'community-plugins.json') -Raw | ConvertFrom-Json)
if (@($enabled | Where-Object { $_ -eq '49-notion-gpt' }).Count -ne 1) { throw 'Duplicate enable entry' }
Write-Output 'PASS: initial installation, isolated backup, unrelated settings, upgrade data preservation, and idempotent enable list.'
