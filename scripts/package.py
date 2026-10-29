from pathlib import Path
import json, shutil, zipfile

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))['version']
name = f'49-Obsidian统一优化包-v{version}'
release = root.parent / 'outputs' / name
release.mkdir(parents=True, exist_ok=True)
plugin = release / 'fortynine-notion-gpt'
plugin.mkdir(exist_ok=True)
for filename in ('main.js', 'styles.css', 'manifest.json'):
    shutil.copy2(root / 'dist' / 'fortynine-notion-gpt' / filename, plugin / filename)
shutil.copytree(root / 'dist' / '49-chatgpt-copy-fix', release / '49-chatgpt-copy-fix', dirs_exist_ok=True)
shutil.copy2(root / 'browser-extension' / 'README.zh-CN.md', release / '49-chatgpt-copy-fix' / 'README.zh-CN.md')
shutil.copy2(root / 'scripts' / 'install.ps1', release / 'install.ps1')
shutil.copy2(root / 'README.md', release / 'README.md')
for filename in ('README.zh-CN.md', 'LICENSE', 'CHANGELOG.md'):
    shutil.copy2(root / filename, release / filename)
source = release / '源码'
source.mkdir(exist_ok=True)
for folder in ('src', 'styles', 'tests', 'scripts', 'browser-extension'):
    shutil.copytree(root / folder, source / folder, dirs_exist_ok=True)
for filename in ('manifest.json', 'versions.json', 'package.json', 'package-lock.json', '.gitignore', 'README.md', 'README.zh-CN.md', 'LICENSE', 'CHANGELOG.md', 'eslint.config.mjs', 'tsconfig.json'):
    shutil.copy2(root / filename, source / filename)
archive = release.parent / (name + '.zip')
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for file in sorted(release.rglob('*')):
        if file.is_file():
            assert file.name != 'data.json', 'Local state must not be published'
            z.write(file, file.relative_to(release))
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert {'fortynine-notion-gpt/main.js', 'fortynine-notion-gpt/styles.css', 'fortynine-notion-gpt/manifest.json', 'install.ps1'} <= set(z.namelist())
print(f'{archive}\n{archive.stat().st_size:,} bytes; installable plugin + installer + source; no local data.')
