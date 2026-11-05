export const ACCOUNTS=['R1','R2','R3','R4','LEAD'];
const VERSION=1,ITERATIONS=600000,encoder=new TextEncoder(),decoder=new TextDecoder();
let active=null,queue=Promise.resolve(),generation=0;
const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const b64=b=>{let s='';for(const v of new Uint8Array(b))s+=String.fromCharCode(v);return btoa(s);};
const aad=(account,purpose='source')=>encoder.encode(`XRMR-VAULT-${VERSION}:${account}:${purpose}`);
function validateEnvelope(e,account){if(!ACCOUNTS.includes(account)||e?.version!==VERSION||e.account!==account||e.cipher!=='AES-GCM'||e.kdf!=='PBKDF2'||e.hash!=='SHA-256'||e.iterations!==ITERATIONS||bytes(e.salt).length!==16||bytes(e.iv).length!==12)throw Error('Invalid encrypted envelope');}
export async function openEnvelope(envelope,password,account){
 validateEnvelope(envelope,account);
 const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
 const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(envelope.salt),iterations:ITERATIONS,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(envelope.iv),additionalData:aad(account),tagLength:128},key,bytes(envelope.ciphertext));
 const payload=JSON.parse(decoder.decode(plain));
 if(payload?.accountId!==account||payload.schemaVersion!==VERSION)throw Error('Account mismatch');
 return {payload,key};
}
const storageKey=account=>`xrmemory-encrypted-local-v1:${account}`;
export async function unlock(account,password){
 if(!ACCOUNTS.includes(account)||!/^.{10}$/.test(password))throw Error('계정과 10자리 암호를 확인해 주세요.');
 const attempt=++generation;
 const response=await fetch("https://xrmemory-access-20261105.banana960521.chatgpt.site/api/unlock",{method:"POST",mode:"cors",credentials:"omit",cache:"no-store",redirect:"error",referrerPolicy:"no-referrer",headers:{"Content-Type":"application/json"},body:JSON.stringify({account,password})});
 if(response.status===401)throw Object.assign(new Error("Access denied"),{publicMessage:"계정과 암호를 확인해 주세요. 암호는 대소문자를 구분합니다."});
 if(response.status===429)throw Object.assign(new Error("Rate limited"),{publicMessage:"시도가 너무 많습니다. 잠시 뒤 다시 시도해 주세요."});
 if(!response.ok)throw Object.assign(new Error("Unavailable"),{publicMessage:"지금 검토 자료를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요."});
 const {payload,key}=await openEnvelope(await response.json(),password,account);
 let local={},localWarning=false;
 try{const raw=localStorage.getItem(storageKey(account));if(raw){const saved=JSON.parse(raw);if(saved.version!==VERSION||saved.account!==account)throw Error('Local account mismatch');const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(saved.iv),additionalData:aad(account,'local'),tagLength:128},key,bytes(saved.ciphertext));local=JSON.parse(decoder.decode(plain));}}
 catch{localWarning=true;}
 if(attempt!==generation)throw Error('취소된 로그인입니다.');
 active={account,key,payload,local};return {payload,localWarning};
}
export const accountId=()=>active?.account||null;
export const isUnlocked=()=>!!active;
export const loadLocal=slot=>clone(active?.local[slot]??null);
export function saveLocal(slot,value){
 if(!active)throw Error('먼저 암호를 입력해 주세요.');
 active.local[slot]=clone(value);
 const {account,key}=active,snapshot=JSON.stringify(active.local);
 queue=queue.catch(()=>{}).then(async()=>{const iv=crypto.getRandomValues(new Uint8Array(12));const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(account,'local'),tagLength:128},key,encoder.encode(snapshot));localStorage.setItem(storageKey(account),JSON.stringify({version:VERSION,account,iv:b64(iv),ciphertext:b64(cipher)}));});
 queue.catch(()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event('xrmemory-storage-error'));});
 return queue;
}
export const flushLocal=()=>queue;
export async function lock(){++generation;try{await queue.catch(()=>{});}finally{active=null;}}
