// Shared allowlist: browser KeyboardEvent.code -> X keysym and Linux evdev code.
export const KEYS = {};
const add = (code, label, x, linux) => KEYS[code] = {label, x, linux};
const letterCodes = [30,48,46,32,18,33,34,35,23,36,37,38,50,49,24,25,16,19,31,20,22,47,17,45,21,44];
for (let i=0;i<26;i++) { const c=String.fromCharCode(65+i); add('Key'+c,c,c.toLowerCase(),letterCodes[i]); }
for (let i=0;i<10;i++) add('Digit'+i,String(i),String(i),i===0?11:i+1);
for (let i=1;i<=12;i++) add('F'+i,'F'+i,'F'+i,i<=10?58+i:76+i);
for (const [code,label,x,linux] of [
 ['Space','Space','space',57],['Tab','Tab','Tab',15],['Enter','Enter','Return',28],['Escape','Escape','Escape',1],
 ['Backspace','Backspace','BackSpace',14],['Minus','-','minus',12],['Equal','=','equal',13],['BracketLeft','[','bracketleft',26],['BracketRight',']','bracketright',27],
 ['Backslash','\\','backslash',43],['Semicolon',';','semicolon',39],['Quote',"'",'apostrophe',40],['Backquote','`','grave',41],['Comma',',','comma',51],['Period','.','period',52],['Slash','/','slash',53],
 ['ArrowUp','Up','Up',103],['ArrowDown','Down','Down',108],['ArrowLeft','Left','Left',105],['ArrowRight','Right','Right',106],
 ['Insert','Insert','Insert',110],['Delete','Delete','Delete',111],['Home','Home','Home',102],['End','End','End',107],['PageUp','Page Up','Prior',104],['PageDown','Page Down','Next',109],
 ['Numpad0','Num 0','KP_0',82],['Numpad1','Num 1','KP_1',79],['Numpad2','Num 2','KP_2',80],['Numpad3','Num 3','KP_3',81],['Numpad4','Num 4','KP_4',75],['Numpad5','Num 5','KP_5',76],['Numpad6','Num 6','KP_6',77],['Numpad7','Num 7','KP_7',71],['Numpad8','Num 8','KP_8',72],['Numpad9','Num 9','KP_9',73],['NumpadAdd','Num +','KP_Add',78],['NumpadSubtract','Num -','KP_Subtract',74],['NumpadMultiply','Num *','KP_Multiply',55],['NumpadDivide','Num /','KP_Divide',98],['NumpadDecimal','Num .','KP_Decimal',83],['NumpadEnter','Num Enter','KP_Enter',96]
]) add(code,label,x,linux);
export function binding(settings) {
 const key=KEYS[settings.key]; if (!key) throw new Error('Choose a keyboard key first.');
 const mods=['ctrl','alt','shift'].filter(m=>settings[m]===true);
 return {key,mods,label:[...mods.map(m=>m[0].toUpperCase()+m.slice(1)),key.label].join('+')};
}
export function inputCommand(s) {
 const {key,mods}=binding(s);
 if (s.backend==='ydotool') {
  const codes=mods.map(m=>({ctrl:29,alt:56,shift:42})[m]);
  return {file:'ydotool',args:['key','--key-delay','80',...codes.map(c=>`${c}:1`),`${key.linux}:1`,`${key.linux}:0`,...codes.reverse().map(c=>`${c}:0`)]};
 }
 if (s.backend && s.backend!=='xdotool') throw new Error('Unknown keyboard backend.');
 return {file:'xdotool',args:['key','--clearmodifiers','--delay','80',[...mods,key.x].join('+')]};
}
