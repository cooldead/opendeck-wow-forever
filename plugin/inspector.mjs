import {KEYS,binding} from './keys.mjs';
const $=id=>document.getElementById(id);
let settings={}, catalog, socket, context, action, page=0, recording=false;
const pageSize=60;
const showError=e=>{$('error').hidden=!e;$('error').textContent=e||'';};
function save(){
 if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({event:'setSettings',context,payload:settings}));$('saveStatus').textContent='Saved to this button';}
}
function updateSelection(){
 $('selectedIcon').src=`icons/${catalog.icons.includes(settings.icon)?settings.icon:'inv_misc_questionmark'}.jpg`;
 const entry=catalog.entries.find(e=>e.id===settings.entryId);
 $('selectedName').textContent=entry?.name||settings.ability||'Choose an ability';
 $('selectedDetail').textContent=entry?[entry.className,entry.tree,entry.kind,entry.passive?'Passive':''].filter(Boolean).join(' · '):'Custom icon';
 $('description').textContent=entry?.description||'';
 try{$('chord').textContent=binding(settings).label;}catch{$('chord').textContent='No key assigned';}
}
function render(){
 if(!catalog)return;
 let entries;
 const kind=$('kind').value, cls=$('className').value, q=$('search').value.trim().toLowerCase();
 if(kind==='Library') entries=catalog.icons.map(icon=>({id:icon,name:icon,icon,kind:'Icon'}));
 else entries=catalog.entries.filter(e=>(e.className===cls||e.className==='Shared')&&(!kind||e.kind===kind));
 entries=entries.filter(e=>`${e.name} ${e.icon} ${e.tree||''}`.toLowerCase().includes(q));
 entries.sort((a,b)=>Number(a.icon==='inv_misc_questionmark')-Number(b.icon==='inv_misc_questionmark')||Number(!!a.passive)-Number(!!b.passive)||a.name.localeCompare(b.name));
 const pages=Math.max(1,Math.ceil(entries.length/pageSize));page=Math.min(page,pages-1);
 $('count').textContent=`${entries.length} icons · ${page+1}/${pages}`;
 $('previous').disabled=page===0;$('next').disabled=page>=pages-1;
 $('icons').replaceChildren();
 for(const e of entries.slice(page*pageSize,(page+1)*pageSize)){
  const button=document.createElement('button');button.className='icon';button.title=`${e.name}${e.tree?' · '+e.tree:''} (${e.kind})`;
  button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',String(settings.entryId===e.id));
  const img=document.createElement('img');img.src=`icons/${e.icon}.jpg`;img.alt='';img.loading='lazy';button.append(img);
  button.onclick=()=>{settings={...settings,entryId:e.id,icon:e.icon,ability:e.name,passive:!!e.passive};save();updateSelection();render();};
  $('icons').append(button);
 }
 if(!entries.length){const p=document.createElement('p');p.textContent='No matching icons.';$('icons').append(p);}
}
function hydrate(){
 if(!catalog)return;
 $('className').value=catalog.classes.includes(settings.className)?settings.className:catalog.classes[0];
 for(const name of ['key','title','macroText']) $(name).value=settings[name]||'';
 $('backend').value=settings.backend||'xdotool';
 for(const name of ['ctrl','shift','alt']) $(name).checked=settings[name]===true;
 updateSelection();render();
}
window.connectElgatoStreamDeckSocket=(port,uuid,registerEvent,info,actionInfo)=>{
 const data=JSON.parse(actionInfo);settings=data.payload.settings||{};context=data.context;action=data.action;
 socket=new WebSocket(`ws://127.0.0.1:${port}`);
 socket.onopen=()=>{socket.send(JSON.stringify({event:registerEvent,uuid}));$('saveStatus').textContent='Connected · changes save automatically';};
 socket.onmessage=e=>{const msg=JSON.parse(e.data);if(msg.event==='sendToPropertyInspector')showError(msg.payload.error);if(msg.event==='didReceiveSettings'){settings=msg.payload.settings||{};hydrate();}};
 socket.onclose=()=>{$('saveStatus').textContent='Disconnected · changes are not saved';};
 socket.onerror=()=>showError('Cannot connect to OpenDeck. Reopen this action’s settings.');hydrate();
};
for(const [code,key] of Object.entries(KEYS)){const option=document.createElement('option');option.value=code;option.textContent=key.label;$('key').append(option);}
for(const name of ['className','key','title','macroText','backend','ctrl','shift','alt']){
 $(name).addEventListener(name==='title'||name==='macroText'?'input':'change',()=>{
  settings[name]=$(name).type==='checkbox'?$(name).checked:$(name).value;
  if(name==='className')page=0;save();updateSelection();render();
 });
}
for(const name of ['kind','search'])$(name).addEventListener(name==='search'?'input':'change',()=>{page=0;render();});
$('previous').onclick=()=>{page--;render();};$('next').onclick=()=>{page++;render();};
function stopRecording(){recording=false;$('record').textContent='Record keys';$('record').classList.remove('active');}
$('record').onclick=()=>{if(recording){stopRecording();return;}recording=true;$('record').textContent='Press keys…';$('record').classList.add('active');};
window.addEventListener('keydown',e=>{
 if(!recording)return;e.preventDefault();e.stopPropagation();
 if(!KEYS[e.code])return;
 settings={...settings,key:e.code,ctrl:e.ctrlKey,alt:e.altKey,shift:e.shiftKey};stopRecording();hydrate();save();
},true);
window.addEventListener('blur',stopRecording);
$('generate').onclick=()=>{
 const entry=catalog.entries.find(e=>e.id===settings.entryId);
 if(!entry||entry.passive||!['Ability','Talent','Racial'].includes(entry.kind)){showError('Select an active ability to generate a /cast macro.');return;}
 if(settings.macroText&&!window.confirm('Replace your existing macro text?'))return;
 settings.macroText=`#showtooltip ${entry.name}\n/cast ${entry.name}`;$('macroText').value=settings.macroText;showError(null);save();
};
$('copy').onclick=async()=>{
 try{await navigator.clipboard.writeText($('macroText').value);$('copyStatus').textContent=' Copied';}
 catch{$('macroText').focus();$('macroText').select();$('copyStatus').textContent=' Press Ctrl+C to copy';}
};
try{
 const response=await fetch('catalog.json');if(!response.ok)throw new Error('Cannot load icon catalog');catalog=await response.json();
 for(const cls of catalog.classes){const option=document.createElement('option');option.textContent=cls;$('className').append(option);}
 $('version').textContent=`Forever ${catalog.build} · data ${catalog.generated}`;hydrate();
}catch(e){showError(e.message);}
