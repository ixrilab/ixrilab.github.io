const IDS=['R1','R2','R3','R4','LEAD'];
const defaults=()=>IDS.map(id=>({id,name:id==='LEAD'?'연구 총괄':id,shortName:id,role:id==='LEAD'?'연구 총괄':'리뷰어',focus:''}));
export const PEOPLE=defaults();
export function setPeople(people){if(!Array.isArray(people)||people.length!==5||IDS.some(id=>!people.find(p=>p.id===id)))throw Error('계정 정보가 다릅니다.');PEOPLE.splice(0,PEOPLE.length,...people.map(p=>({...p})));}
export function clearPeople(){PEOPLE.splice(0,PEOPLE.length,...defaults());}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function namedHTML(html){for(const p of PEOPLE){html=html.replaceAll(`__${p.id}_NAME__`,escape(p.name)).replaceAll(`__${p.id}_SHORT__`,escape(p.shortName||p.name));}return html;}
