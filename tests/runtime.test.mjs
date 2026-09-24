import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {inputCommand,KEYS} from '../plugin/keys.mjs';
import {createRuntime,ACTION} from '../plugin/runtime.mjs';
const catalog=JSON.parse(await readFile(new URL('../plugin/catalog.json',import.meta.url)));
test('source coverage and bundled images',async()=>{
 assert.equal(catalog.classes.length,9);
 for(const cls of catalog.classes)assert.ok(catalog.entries.some(e=>e.className===cls&&e.kind==='Ability'));
 assert.equal(new Set(catalog.entries.map(e=>e.id)).size,catalog.entries.length);
 for(const e of catalog.entries)assert.ok(catalog.icons.includes(e.icon));
 for(const icon of catalog.icons){const b=await readFile(new URL(`../plugin/icons/${icon}.jpg`,import.meta.url));assert.equal(b.readUInt16BE(),0xffd8);}
 const src=JSON.parse(await readFile(new URL('../data/source.json',import.meta.url)));
 for(const [cls,book] of Object.entries(src.spellbooks))for(const tab of book.tabs)for(const [name] of tab.spells)assert.ok(catalog.entries.some(e=>e.className===cls&&e.name===name),`${cls}: ${name}`);
});
test('all eight modifier combinations and backend allowlist',()=>{
 for(let n=0;n<8;n++){
  const s={key:'Digit1',ctrl:!!(n&1),shift:!!(n&2),alt:!!(n&4)};
  const x=inputCommand(s);assert.equal(x.file,'xdotool');assert.ok(x.args.at(-1).endsWith('1'));
  const y=inputCommand({...s,backend:'ydotool'});const events=y.args.slice(3);
  const held=new Set();for(const e of events){const [key,state]=e.split(':');if(state==='1')held.add(key);else{assert.ok(held.has(key));held.delete(key);}}assert.equal(held.size,0);
 }
 for(const key of Object.keys(KEYS))assert.doesNotThrow(()=>inputCommand({key}));
 assert.throws(()=>inputCommand({key:'; touch /tmp/injected'}));assert.throws(()=>inputCommand({key:'KeyA',backend:'shell'}));
});
test('independent settings, safe image paths, one chord on down only',async()=>{
 const messages=[],calls=[],images=[];
 const runtime=createRuntime({send:m=>messages.push(m),catalog,readIcon:async i=>{images.push(i);return Buffer.from('jpg');},run:async(...args)=>calls.push(args)});
 const event=(event,context,payload={})=>runtime.handle({event,context,payload,action:ACTION});
 await event('willAppear','a',{settings:{key:'Digit1',ctrl:true,icon:catalog.icons[0]}});
 await event('willAppear','b',{settings:{key:'KeyF',alt:true,icon:'../../etc/passwd'}});
 assert.equal(images.at(-1),'inv_misc_questionmark');
 await event('keyDown','a');await event('keyUp','a');await event('keyDown','b');
 assert.equal(calls.length,2);assert.equal(calls[0][1].at(-1),'ctrl+1');assert.equal(calls[1][1].at(-1),'alt+f');
 await event('didReceiveSettings','a',{settings:{key:'F2',shift:true}});await event('keyDown','a');assert.equal(calls[2][1].at(-1),'shift+F2');
 assert.ok(messages.some(m=>m.event==='setImage'&&m.payload.image.startsWith('data:image/jpeg;base64,')));
});
test('busy press suppression and error feedback',async()=>{
 const sent=[];let release,calls=0;
 const runtime=createRuntime({send:m=>sent.push(m),catalog,readIcon:async()=>Buffer.from(''),run:()=>{calls++;return new Promise(resolve=>release=resolve);}});
 const msg={event:'keyDown',context:'a',payload:{settings:{key:'KeyA'}}};
 const pending=runtime.handle(msg);await runtime.handle(msg);assert.equal(calls,1);release();await pending;
 await runtime.handle({event:'keyDown',context:'bad',payload:{settings:{}}});assert.ok(sent.some(m=>m.event==='showAlert'&&m.context==='bad'));
});
