export function parseCsv(text:string):string[][]{
 const src=text.replace(/^﻿/,''),first=src.split(/\r?\n/,1)[0]??'';
 const count=(c:string)=>{let n=0,q=false;for(const ch of first){if(ch==='"')q=!q;else if(ch===c&&!q)n++;}return n;};
 const sep=count(';')>count(',')?';':count('\t')>count(',')?'\t':',';
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 const end=()=>{row.push(cell);cell='';if(row.some(c=>c.trim()))rows.push(row);row=[];};
 for(let i=0;i<src.length;i++){const ch=src[i];
  if(quoted){if(ch==='"'){if(src[i+1]==='"'){cell+='"';i++;}else quoted=false;}else cell+=ch;continue;}
  if(ch==='"')quoted=true;else if(ch===sep){row.push(cell);cell='';}else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&src[i+1]==='\n')i++;end();}else cell+=ch;}
 end();return rows;
}
