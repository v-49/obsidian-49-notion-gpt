param([Parameter(Mandatory=$true)][string]$VaultPath)
$ErrorActionPreference = 'Stop'
$vaultRoot = (Resolve-Path -LiteralPath $VaultPath).Path
$configRoot = Join-Path $vaultRoot '.obsidian'
if (!(Test-Path -LiteralPath $configRoot -PathType Container)) { throw '请选择已有的 Obsidian 仓库目录，目录中应包含 .obsidian。' }
$payload = Join-Path $PSScriptRoot '49-notion-gpt'
if (!(Test-Path -LiteralPath (Join-Path $payload 'manifest.json'))) {
  $payload = Join-Path $PSScriptRoot '..\dist\49-notion-gpt'
}
foreach ($name in @('manifest.json','main.js','styles.css')) {
  if (!(Test-Path -LiteralPath (Join-Path $payload $name) -PathType Leaf)) { throw "安装包不完整：$name" }
}
$meta = Get-Content -LiteralPath (Join-Path $payload 'manifest.json') -Raw | ConvertFrom-Json
if ($meta.id -ne '49-notion-gpt') { throw '插件标识不匹配。' }
$target = [IO.Path]::GetFullPath((Join-Path $configRoot 'plugins\49-notion-gpt'))
if (!$target.StartsWith([IO.Path]::GetFullPath($configRoot) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw '目标目录不在仓库配置中。' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$backup = Join-Path $configRoot "backups\49-notion-gpt-$stamp"
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$configNames = @('community-plugins.json','appearance.json')
$existed = @{}
foreach ($name in $configNames) {
  $file = Join-Path $configRoot $name
  $existed[$name] = Test-Path -LiteralPath $file
  if ($existed[$name]) { Copy-Item -LiteralPath $file -Destination (Join-Path $backup $name) }
}
foreach ($legacy in @('compact-rich-paste','relative-scroll-lock','native-table-resize','49-notion-gpt')) {
  $folder = Join-Path $configRoot "plugins\$legacy"
  if (Test-Path -LiteralPath $folder) { Copy-Item -LiteralPath $folder -Destination (Join-Path $backup $legacy) -Recurse }
}
foreach ($name in @('wider-note','prompt-handbook-code','project-progress-dashboard')) {
  $file = Join-Path $configRoot "snippets\$name.css"
  if (Test-Path -LiteralPath $file) { Copy-Item -LiteralPath $file -Destination (Join-Path $backup "$name.css") }
}
$utf8 = [Text.UTF8Encoding]::new($false)
try {
  New-Item -ItemType Directory -Path $target -Force | Out-Null
  foreach ($name in @('manifest.json','main.js','styles.css')) { Copy-Item -LiteralPath (Join-Path $payload $name) -Destination (Join-Path $target $name) -Force }
  $enabledFile = Join-Path $configRoot 'community-plugins.json'
  $enabled = if ($existed['community-plugins.json']) { @(Get-Content -LiteralPath $enabledFile -Raw | ConvertFrom-Json) } else { @() }
  $enabled = @($enabled | Where-Object { $_ -notin @('compact-rich-paste','relative-scroll-lock','native-table-resize','49-notion-gpt') }) + @('49-notion-gpt')
  [IO.File]::WriteAllText($enabledFile, (ConvertTo-Json -InputObject $enabled), $utf8)
  $appearanceFile = Join-Path $configRoot 'appearance.json'
  $appearance = if ($existed['appearance.json']) { Get-Content -LiteralPath $appearanceFile -Raw | ConvertFrom-Json } else { [pscustomobject]@{} }
  $snippets = @($appearance.enabledCssSnippets | Where-Object { $_ -and $_ -notin @('wider-note','prompt-handbook-code','project-progress-dashboard') })
  $appearance | Add-Member -NotePropertyName enabledCssSnippets -NotePropertyValue $snippets -Force
  [IO.File]::WriteAllText($appearanceFile, ($appearance | ConvertTo-Json -Depth 32), $utf8)
} catch {
  foreach ($name in $configNames) {
    if ($existed[$name]) { Copy-Item -LiteralPath (Join-Path $backup $name) -Destination (Join-Path $configRoot $name) -Force }
  }
  throw
}
[pscustomobject]@{ Plugin=$meta.name; Version=$meta.version; InstalledTo=$target; Backup=$backup; Status='已安装；重启 Obsidian 后加载。旧插件和样式文件已保留、仅停用。' } | ConvertTo-Json
