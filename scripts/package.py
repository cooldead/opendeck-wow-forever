#!/usr/bin/env python3
import json, shutil, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
name='com.cooldead.wowforever.sdPlugin'
folder=ROOT/'dist'/name
folder.mkdir(parents=True,exist_ok=True)
shutil.copytree(ROOT/'plugin',folder,dirs_exist_ok=True)
for file in ['README.md','NOTICE.md']:
    shutil.copy2(ROOT/file,folder/file)
version=json.loads((folder/'manifest.json').read_text())['Version']
archive=ROOT/'dist'/f'wow-forever-{version}.streamDeckPlugin'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as out:
    for file in sorted(folder.rglob('*')):
        if file.is_file():out.write(file,file.relative_to(folder.parent))
print(archive)
