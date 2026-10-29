param([Parameter(Mandatory=$true)][string]$VaultPath)
$ErrorActionPreference = 'Stop'
$vaultRoot = (Resolve-Path -LiteralPath $VaultPath).Path
$configRoot = Join-Path $vaultRoot '.obsidian'
if (!(Test-Path -LiteralPath $configRoot -PathType Container)) { throw '请选择已有的 Obsidian 仓库目录，目录中应包含 .obsidian。' }
$payload = Join-Path $PSScriptRoot 'fortynine-notion-gpt'
if (!(Test-Path -LiteralPath (Join-Path $payload 'manifest.json'))) {
  $payload = Join-Path $PSScriptRoot '..\dist\fortynine-notion-gpt'
}
foreach ($name in @('manifest.json','main.js','styles.css')) {
  if (!(Test-Path -LiteralPath (Join-Path $payload $name) -PathType Leaf)) { throw "安装包不完整：$name" }
}
$meta = Get-Content -LiteralPath (Join-Path $payload 'manifest.json') -Raw | ConvertFrom-Json
if ($meta.id -ne 'fortynine-notion-gpt') { throw '插件标识不匹配。' }
$target = [IO.Path]::GetFullPath((Join-Path $configRoot 'plugins\fortynine-notion-gpt'))
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
foreach ($legacy in @('compact-rich-paste','relative-scroll-lock','native-table-resize','49-notion-gpt','fortynine-notion-gpt')) {
  $folder = Join-Path $configRoot "plugins\$legacy"
  if (Test-Path -LiteralPath $folder) { Copy-Item -LiteralPath $folder -Destination (Join-Path $backup $legacy) -Recurse }
}
foreach ($name in @('wider-note','prompt-handbook-code','project-progress-dashboard')) {
  $file = Join-Path $configRoot "snippets\$name.css"
  if (Test-Path -LiteralPath $file) { Copy-Item -LiteralPath $file -Destination (Join-Path $backup "$name.css") }
}
$utf8 = [Text.UTF8Encoding]::new($false)
$moved = @()
try {
  New-Item -ItemType Directory -Path $target -Force | Out-Null
  foreach ($name in @('manifest.json','main.js','styles.css')) { Copy-Item -LiteralPath (Join-Path $payload $name) -Destination (Join-Path $target $name) -Force }
  $dataFile = Join-Path $target 'data.json'
  if (!(Test-Path -LiteralPath $dataFile)) {
    $unifiedData = Join-Path $configRoot 'plugins\49-notion-gpt\data.json'
    $tableData = Join-Path $configRoot 'plugins\native-table-resize\data.json'
    if (Test-Path -LiteralPath $unifiedData) { Copy-Item -LiteralPath $unifiedData -Destination $dataFile }
    elseif (Test-Path -LiteralPath $tableData) {
      $tables = Get-Content -LiteralPath $tableData -Raw | ConvertFrom-Json
      if ($tables.version -eq 1 -and $tables.files) {
        [IO.File]::WriteAllText($dataFile, (@{version=1;tables=$tables} | ConvertTo-Json -Depth 64), $utf8)
      }
    }
  }
  $enabledFile = Join-Path $configRoot 'community-plugins.json'
  $enabled = if ($existed['community-plugins.json']) { @(Get-Content -LiteralPath $enabledFile -Raw | ConvertFrom-Json) } else { @() }
  $enabled = @($enabled | Where-Object { $_ -notin @('compact-rich-paste','relative-scroll-lock','native-table-resize','49-notion-gpt','fortynine-notion-gpt') }) + @('fortynine-notion-gpt')
  [IO.File]::WriteAllText($enabledFile, (ConvertTo-Json -InputObject $enabled), $utf8)
  $appearanceFile = Join-Path $configRoot 'appearance.json'
  $appearance = if ($existed['appearance.json']) { Get-Content -LiteralPath $appearanceFile -Raw | ConvertFrom-Json } else { [pscustomobject]@{} }
  $snippets = @($appearance.enabledCssSnippets | Where-Object { $_ -and $_ -notin @('wider-note','prompt-handbook-code','project-progress-dashboard') })
  $appearance | Add-Member -NotePropertyName enabledCssSnippets -NotePropertyValue $snippets -Force
  [IO.File]::WriteAllText($appearanceFile, ($appearance | ConvertTo-Json -Depth 32), $utf8)
  # Keep superseded local IDs out of the installed-plugin list, where their
  # built-in community links still point to a nonexistent entry. Preserve all
  # code and state in this installation's backup instead of deleting them.
  $inactive = Join-Path $backup 'inactive-plugins'
  New-Item -ItemType Directory -Path $inactive -Force | Out-Null
  $configPrefix = [IO.Path]::GetFullPath($configRoot) + [IO.Path]::DirectorySeparatorChar
  foreach ($legacy in @('compact-rich-paste','relative-scroll-lock','native-table-resize','49-notion-gpt')) {
    $legacySource = [IO.Path]::GetFullPath((Join-Path $configRoot "plugins\$legacy"))
    $legacyTarget = [IO.Path]::GetFullPath((Join-Path $inactive $legacy))
    if (!$legacySource.StartsWith($configPrefix,[StringComparison]::OrdinalIgnoreCase) -or !$legacyTarget.StartsWith($configPrefix,[StringComparison]::OrdinalIgnoreCase)) { throw '旧插件归档路径不在仓库配置目录中。' }
    if (Test-Path -LiteralPath $legacySource -PathType Container) {
      Move-Item -LiteralPath $legacySource -Destination $legacyTarget
      $moved += @{Source=$legacySource;Target=$legacyTarget}
    }
  }
} catch {
  foreach ($entry in $moved) { Move-Item -LiteralPath $entry.Target -Destination $entry.Source }
  foreach ($name in $configNames) {
    if ($existed[$name]) { Copy-Item -LiteralPath (Join-Path $backup $name) -Destination (Join-Path $configRoot $name) -Force }
  }
  throw
}
[pscustomobject]@{ Plugin=$meta.name; Version=$meta.version; InstalledTo=$target; Backup=$backup; Status='已安装；重启 Obsidian 后加载。旧插件已归档到备份，旧样式已停用。' } | ConvertTo-Json
