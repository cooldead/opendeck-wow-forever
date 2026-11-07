#!/usr/bin/env python3
"""Import the public CC-BY dataset and cache every referenced icon. Re-runnable."""
import concurrent.futures, json, re, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://talentsforever.com'
def fetch(url, path):
    tmp = path.with_suffix(path.suffix + '.tmp')
    subprocess.run(['curl', '--fail', '--silent', '--show-error', '--location', '--retry', '3', '--max-time', '60', url, '-o', str(tmp)], check=True)
    if path.suffix == '.jpg' and not tmp.read_bytes().startswith(b'\xff\xd8'):
        raise ValueError(f'Not a JPEG: {url}')
    tmp.replace(path)
if '--refresh' in sys.argv or not (ROOT/'data/source.json').exists():
    fetch(BASE+'/data.json', ROOT/'data/source.json')
src = json.loads((ROOT/'data/source.json').read_text())
entries, icons = [], {'inv_misc_questionmark'}
def add(cls, name, icon, kind, tree='', description='', passive=False, ranks=None):
    if not re.fullmatch(r'[a-z0-9_]+', icon):
        raise ValueError(f'Invalid icon: {icon}')
    icons.add(icon)
    entries.append(dict(id=f'{cls}|{kind}|{tree}|{name}', className=cls, name=name, icon=icon, kind=kind, tree=tree, description=description, passive=passive, ranks=ranks or []))
for cls, book in src['spellbooks'].items():
    mapping = book['icons']
    for tab in [dict(name='General', spells=book.get('general', [])), *book['tabs']]:
        grouped = {}
        for name, rank in tab['spells']:
            grouped.setdefault(name, []).append(rank)
        for name, ranks in grouped.items():
            detail = src['spell_desc'].get(f'{cls}|{name}|{ranks[-1]}', {})
            add(cls, name, mapping.get(name, 'inv_misc_questionmark'), 'Ability', tab['name'], detail.get('d',''), 'Passive' in ranks, ranks)
for cls, data in src['talents'].items():
    icons.add(data['icon'])
    for tree in data['trees']:
        icons.add(tree['icon'])
        for t in tree['talents']:
            add(cls,t['name'],t['icon'],'Talent',tree['name'], '\n'.join(t['desc']),t.get('passive',False))
for faction in src['racials'].values():
    for race in faction:
        icons.add(race['icon'])
        for cls in race['classes']:
            for name, desc, icon in race['abilities']:
                add(cls,name,icon,'Racial',race['race'],desc)
for cls, data in src.get('class_racials',{}).items():
    for race, abilities in data['races'].items():
        for name, desc, icon in abilities:
            add(cls,name,icon,'Racial',race,desc)
for cls, abilities in src.get('class_abilities',{}).items():
    for name, desc, icon in abilities:
        if not any(e['className']==cls and e['name']==name for e in entries):
            add(cls,name,icon,'Ability','Forever',desc)
for tree in src['legacy']['trees']:
    icons.add(tree['icon'])
    for t in tree['perks']:
        add('Shared', t['name'],t['icon'],'Legacy',tree['name'],'\n'.join(t['ranks']),True)
        entries[-1]['id'] += f"|{t['row']}|{t['col']}"
# Also preserve icon references present outside the normalized lists.
def scan(obj):
    if isinstance(obj,dict):
        for k,v in obj.items():
            if k=='icon' and isinstance(v,str): icons.add(v)
            else: scan(v)
    elif isinstance(obj,list):
        for x in obj: scan(x)
scan(src)
for book in src['spellbooks'].values(): icons.update(book['icons'].values())
# Keep icons from earlier snapshots: buttons saved with a retired ability's icon would
# otherwise fall back to the question mark (runtime.mjs only draws catalog icons).
icons.update(p.stem for p in (ROOT/'plugin/icons').glob('*.jpg'))
missing = []
def download(icon):
    path = ROOT/'plugin/icons'/f'{icon}.jpg'
    if not path.exists(): fetch(f'{BASE}/assets/icons/{icon}.jpg?i=2',path)
    return icon
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    futures={pool.submit(download,icon):icon for icon in sorted(icons)}
    for i,f in enumerate(concurrent.futures.as_completed(futures),1):
        try: f.result()
        except Exception as e: missing.append(futures[f]); print(e,file=sys.stderr)
        if i%100==0: print(f'{i}/{len(icons)} icons',flush=True)
if missing: raise SystemExit(f'Failed icons: {missing}; run again to retry.')
catalog=dict(source=BASE,generated=src['generated'],build=next(iter(src['spellbooks'].values()))['build'],classes=list(src['talents']),entries=entries,icons=sorted(icons))
(ROOT/'plugin/catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':')))
print(f'{len(entries)} entries, {len(icons)} icons. All downloaded.')
