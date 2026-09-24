import {createServer} from 'node:http';
import {readFile,mkdtemp,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=new URL('../plugin/',import.meta.url);
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.includes('..'))throw Error();const path=new URL('.'+url.pathname,root);const bytes=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg'})[extname(path.pathname)]||'text/plain');res.end(bytes);}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const profile=await mkdtemp(join(tmpdir(),'forever-browser-'));
const browser=spawn('brave',['--headless','--disable-gpu','--disable-background-networking','--no-first-run','--no-default-browser-check',`--user-data-dir=${profile}`,'--remote-debugging-port=0',`http://127.0.0.1:${server.address().port}/inspector.html`],{stdio:'ignore'});
let ws;
const pause=()=>new Promise(r=>setTimeout(r,100));
try{
 let port;for(let i=0;i<100;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await pause();}}
 assert.ok(port,'Browser started');
 let pages=await(await fetch(`http://127.0.0.1:${port}/json`)).json();const page=pages.find(p=>p.type==='page');assert.ok(page);
 ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let id=0;const pending=new Map();ws.onmessage=e=>{const msg=JSON.parse(e.data);if(msg.id){const {resolve,reject}=pending.get(msg.id);pending.delete(msg.id);msg.error?reject(Error(JSON.stringify(msg.error))):resolve(msg.result);}};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
 await call('Emulation.setDeviceMetricsOverride',{width:380,height:1100,deviceScaleFactor:1,mobile:false});
 for(let i=0;i<100;i++){if(await evaluate('document.querySelectorAll(".icon").length>0'))break;await pause();}
 assert.equal(await evaluate('document.querySelectorAll("#className option").length'),9);
 assert.equal(await evaluate('document.getElementById("error").hidden'),true);
 // Mock only the inspector host transport; exercise real browser DOM and event handlers.
 await evaluate(`window.sent=[];window.WebSocket=class { static OPEN=1;readyState=1;constructor(){window.hostSocket=this;setTimeout(()=>this.onopen?.(),0)}send(s){window.sent.push(JSON.parse(s))}};window.connectElgatoStreamDeckSocket(1234,'inspector','registerPropertyInspector','{}',JSON.stringify({action:'com.cooldead.wowforever.macro',context:'button-1',payload:{settings:{className:'Mage',key:'Digit3',ctrl:true}}}));`);
 await pause();assert.equal(await evaluate('document.getElementById("className").value'),'Mage');
 await evaluate(`document.getElementById('search').value='Frostfire Bolt';document.getElementById('search').dispatchEvent(new Event('input'));document.querySelector('.icon').click();document.getElementById('generate').click();`);
 assert.ok((await evaluate('document.getElementById("macroText").value')).includes('/cast Frostfire Bolt'));
 await evaluate(`document.getElementById('record').click();window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyF',ctrlKey:true,altKey:true,shiftKey:true,bubbles:true}));`);
 assert.equal(await evaluate('document.getElementById("chord").textContent'),'Ctrl+Alt+Shift+F');
 assert.ok(await evaluate(`window.sent.some(m=>m.event==='setSettings'&&m.context==='button-1'&&m.payload.key==='KeyF'&&m.payload.shift&&m.payload.ctrl&&m.payload.alt)`));
 await evaluate(`document.getElementById('search').value='';document.getElementById('search').dispatchEvent(new Event('input'));`);
 for(const cls of ['Warrior','Paladin','Hunter','Rogue','Priest','Shaman','Mage','Warlock','Druid']){
  await evaluate(`document.getElementById('className').value=${JSON.stringify(cls)};document.getElementById('className').dispatchEvent(new Event('change'));`);
  assert.ok(await evaluate('document.querySelectorAll(".icon").length>0'),cls);
 }
 await evaluate(`document.getElementById('className').value='Mage';document.getElementById('className').dispatchEvent(new Event('change'));`);
 await pause();
 assert.equal(await evaluate('document.documentElement.scrollWidth>window.innerWidth'),false,'No horizontal overflow');
 assert.equal(await evaluate('Array.from(document.querySelectorAll(".icon img")).filter(i=>i.complete&&i.naturalWidth===0).length'),0,'No broken loaded icons');
 const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(new URL('../dist/inspector-preview.png',import.meta.url),Buffer.from(shot.data,'base64'));
 console.log('Browser checks passed: all classes, icon selection, macro generation, modifiers, settings transport, images and layout.');
}finally{ws?.close();browser.kill();server.close();}
