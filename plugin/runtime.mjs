import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {inputCommand} from './keys.mjs';
const execute=promisify(execFile);
export const ACTION='com.cooldead.wowforever.macro';
export function createRuntime({send, catalog, readIcon, run=execute}) {
 const settings=new Map(), busy=new Set(), revisions=new Map();
 const allowed=new Set(catalog.icons);
 const emit=(event,context,payload={})=>send({event,context,payload});
 const status=(context,error)=>emit('sendToPropertyInspector',context,{error});
 async function draw(context,s) {
  const rev=(revisions.get(context)||0)+1; revisions.set(context,rev);
  const icon=allowed.has(s.icon)?s.icon:'inv_misc_questionmark';
  const image=await readIcon(icon);
  if(revisions.get(context)!==rev) return;
  emit('setImage',context,{image:'data:image/jpeg;base64,'+image.toString('base64'),target:0});
  emit('setTitle',context,{title:typeof s.title==='string'?s.title.slice(0,80):'',target:0});
 }
 async function handle(msg) {
  const {event,context,payload={}}=msg;
  if(msg.action && msg.action!==ACTION) return;
  if(!context) return;
  if(event==='willDisappear') { settings.delete(context); revisions.delete(context); return; }
  if(event==='willAppear'||event==='didReceiveSettings') {
   const s=payload.settings||{}; settings.set(context,s); await draw(context,s); return;
  }
  if(event==='keyDown') {
   if(busy.has(context)) return;
   busy.add(context);
   try {
    const s=payload.settings||settings.get(context)||{};
    const command=inputCommand(s);
    await run(command.file,command.args,{timeout:4000,maxBuffer:8192});
    status(context,null);
   } catch(e) {
    const reason=e.code==='ENOENT'?'Keyboard tool not installed. See README for xdotool or ydotool setup.':e.message;
    status(context,reason); emit('showAlert',context); console.error(reason);
   } finally {busy.delete(context);}
  }
 }
 return {handle};
}
export async function loadRuntime(send) {
 const catalog=JSON.parse(await readFile(new URL('./catalog.json',import.meta.url),'utf8'));
 return createRuntime({send,catalog,readIcon:icon=>readFile(new URL(`./icons/${icon}.jpg`,import.meta.url))});
}
