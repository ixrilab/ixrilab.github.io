import {CODEBOOK_VERSION,CODEBOOK_DATE,ROUTES,criterionState,routeState,scopeState} from './codebook-data.mjs';
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let checks={};
export function resetCodebookChecks(){checks={};}
const STATE={yes:['근거 확인','green'],no:['미충족','amber'],unsure:['확인 필요','amber'],unset:['미확인','gray']};
function itemView(item){
 if(item.any)return `<fieldset class="cb-any"><legend><span class="cb-id">${item.id}</span>${h(item.text)} <span class="pill blue">둘 중 하나</span></legend>${item.any.map(itemView).join('')}</fieldset>`;
 const selected=checks[item.id]||'';
 return `<article class="cb-item"><div class="cb-item-title"><span class="cb-id">${item.id}</span><h3>${h(item.text)}</h3></div><p class="cb-find"><b>찾을 곳</b> ${h(item.find)}</p><p class="cb-note">${h(item.note)}</p><div class="cb-choices" role="group" aria-label="${h(item.id+' '+item.text)}">${['yes','no','unsure'].map(v=>`<button type="button" data-cb-item="${item.id}" data-cb-value="${v}" aria-pressed="${selected===v}">${selected===v?'✓ ':''}${STATE[v][0]}</button>`).join('')}</div></article>`;
}
function resultView(){const result=scopeState(checks);return result.state==='yes'?`<strong>범위에 맞는 경로: ${result.passing.join(' · ')}</strong><p>원문 근거와 해당 유형을 검토 화면에 남겨 주세요. 문헌군별 서지 범위도 확인합니다.</p>`:result.state==='no'?'<strong>네 경로 모두 미충족으로 체크했습니다.</strong><p>놓친 경로가 없는지 확인하고, 제외 판단의 원문 근거를 검토 화면에 남겨 주세요.</p>':'<strong>유형별 근거를 확인해 주세요.</strong><p>한 경로의 모든 요건을 충족하면 범위에 맞는 경로가 있습니다. 미확인·확인 필요는 미충족과 다릅니다.</p>';}
export function codebookPage(selected='C1'){
 const route=ROUTES.find(r=>r.id===selected)||ROUTES[0];
 return `<div class="page-heading"><div><div class="eyebrow">CODEBOOK / ${CODEBOOK_DATE}</div><h1>판정 기준표</h1><p class="sub">원문에서 근거를 찾고, 해당하는 유형을 확인하세요.</p></div><a class="secondary" href="#trial">원문 검토로 →</a></div>
 <div class="cb-logic panel"><strong>유형 사이는 OR · 유형 안의 요건은 AND</strong><p>C0–C3 중 <b>한 유형 이상의 요건</b>을 충족하면 범위에 맞습니다. 여러 유형에 해당할 수 있습니다. C1의 마지막 참여 조건은 <b>공간 탐색 또는 콘텐츠 상호작용</b> 중 하나면 됩니다.</p><div class="rule-meta"><span class="pill amber">연구팀 보정 전 기준안</span><span class="paper-id">${CODEBOOK_VERSION}</span><a class="small-link" href="./codebook.md" download>기준표 내려받기 ↓</a></div></div>
 <nav class="cb-routes" aria-label="문헌 유형">${ROUTES.map(r=>{const s=STATE[routeState(r,checks)];return `<a href="#codebook/${r.id}" class="cb-route ${r.id===route.id?'active':''}" ${r.id===route.id?'aria-current="page"':''}><b>${r.id}</b><span>${r.name}</span><small class="pill ${s[1]}">${s[0]}</small></a>`;}).join('')}</nav>
 <section class="cb-route-content panel" aria-labelledby="cb-route-title"><div class="section-head"><div><div class="eyebrow">${route.id}</div><h2 id="cb-route-title">${route.name}</h2><p class="sub">${route.summary}</p></div></div><p class="cb-instruction">아래 요건을 모두 확인하세요. 근거는 논문의 PDF 쪽수·절·그림·표와 연결합니다.</p>${route.items.map(itemView).join('')}<details class="cb-examples"><summary>인정·제외 경계 사례</summary><ul>${route.examples.map(([label,text])=>`<li><b>${h(label)}</b> ${h(text)}</li>`).join('')}</ul></details><p class="caption">합의 근거: 2026.11.04 정의 질의 ${route.refs}</p></section>
 <section class="cb-result notice" aria-live="polite"><div>${resultView()}</div></section><div class="cb-actions"><a class="primary" href="#trial">원문 검토로 →</a><button class="text-button" data-cb-clear>기준표 체크만 지우기</button></div><p class="caption">이 체크표는 범위 확인용입니다. 판정과 근거는 원문 검토 화면에 남겨 주세요.</p>
 <details class="panel cb-details"><summary>포함 여부와 별도로 기록할 항목</summary><p>공간 적응·콘텐츠 반응의 수준, AI·룰 기반 구현 방식, 원기록·생성 내용의 구분 표시, 인물 충실도·회상 정확성의 평가를 기록합니다. 특정 기능이 없다는 이유만으로 제외하지 않습니다. 적용 대상에는 같은 항목을 확인하고, 미지원·미보고·해당 없음을 구별합니다.</p><p>C1에는 최소 참여 조건이 필요하지만 고도화된 공간 적응과 콘텐츠 반응 모두를 요구하지 않습니다. C0/C3처럼 구현 기능을 평가하지 않은 문헌의 X/Y는 N/A로 구별합니다.</p></details>
 <details class="panel cb-details"><summary>문헌 범위·적용 상태</summary><ul><li>경험적 baseline: 2021–2025. C0 개념·역사 문헌은 별도 범위로 관리합니다.</li><li>2026 문헌은 별도 갱신 검색으로 기록합니다. 기존 분모에 자동 추가하지 않습니다.</li><li>중복 문헌·출판 형식·언어·원문 미확보의 처리 규칙은 기존 프로토콜과 대조합니다. 언어 문구의 충돌과 미해결 건의 최종 처리 방식은 확정 전입니다.</li><li>C0 개념 근거, 경험적 연구, 기술 역량 지도의 적용 대상 수를 구별합니다. 여러 유형에 해당해도 같은 문헌을 중복 집계하지 않습니다.</li><li>항목과 사례의 범위는 총괄과의 정의 질의를 반영했습니다. 질문·체크 논리는 운영안이며 인간 코더의 사례 보정 전입니다.</li></ul></details>`;
}
export function bindCodebookControls({render}){
 document.querySelectorAll('[data-cb-item]').forEach(button=>button.addEventListener('click',()=>{const id=button.dataset.cbItem,value=button.dataset.cbValue;if(checks[id]===value)delete checks[id];else checks[id]=value;const scroll=window.scrollY;render();window.scrollTo({top:scroll});}));
 document.querySelector('[data-cb-clear]')?.addEventListener('click',()=>{checks={};render();});
}
