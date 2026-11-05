export const RULE='DEMO-CB-1';
export function ready(task){return task.pair.every(id=>!!task.reviews[id]?.submitted);}
export function sameVersion(task){return ready(task)&&task.pair.every(id=>task.reviews[id].rule===task.reviews[task.pair[0]].rule&&task.reviews[id].sourceVersion===task.reviews[task.pair[0]].sourceVersion);}
export function myReview(task,actor){return task.reviews[actor]||{};}
export function reviewView(task,actor){return Object.fromEntries(Object.entries(task.reviews).filter(([id])=>id===actor||sameVersion(task)));}
export function validateReview(task,actor,value,ack){
 if(!task.pair.includes(actor))return '이 예시의 배정된 코더로 전환하세요.';
 if(task.reviews[actor]?.submitted)return '제출된 독립 판정은 잠겨 있습니다.';
 if(!ack)return '예시 기준을 먼저 확인하세요.';
 if(!['Include','Exclude','Unclear'].includes(value.decision))return '판정 제안을 선택하세요.';
 if(!value.locator?.trim()||!value.reason?.trim()||!value.clause?.trim())return '근거 위치·기준 조항·판정 이유를 모두 입력하세요.';
 return null;
}
export function submit(task,actor,value,ack){const e=validateReview(task,actor,value,ack);if(e)throw Error(e);task.reviews[actor]={...value,submitted:true,rule:RULE,sourceVersion:'DEMO-SOURCE-1',at:new Date().toISOString()};return task;}
export function outcome(task){
 if(task.final)return 'final';
 if(task.proposal)return 'proposal';
 if(!ready(task))return Object.values(task.reviews).some(r=>r.submitted)?'waiting':'independent';
 if(!sameVersion(task))return 'version';
 const rs=Object.values(task.reviews);return rs.every(r=>r.decision===rs[0].decision)&&rs[0].decision!=='Unclear'?'agree':'conflict';
}
export function propose(task,actor,decision,reason,locator){
 if(!sameVersion(task)||!task.pair.includes(actor))throw Error('같은 규칙·원문 버전의 두 독립 판정 제출 후 제안할 수 있습니다.');
 if(task.escalated)throw Error('제3판정 요청 중입니다. 현재 예시에서는 담당 코더의 확정을 보류합니다.');
 if(!['Include','Exclude'].includes(decision)||!reason.trim()||!locator.trim())throw Error('최종 제안·합의 근거·근거 위치가 필요합니다.');
 if(task.final)throw Error('확정한 예시는 잠겨 있습니다.');
 task.proposal={by:actor,decision,reason,locator,rule:RULE,at:new Date().toISOString()};return task;
}
export function confirm(task,actor){
 if(task.final||!sameVersion(task)||task.escalated)throw Error('현재 버전·판정 상태에서는 확정할 수 없습니다.');
 if(!task.proposal||actor===task.proposal.by||!task.pair.includes(actor))throw Error('제안자와 다른 담당 코더가 명시적으로 확인해야 합니다.');
 if(task.ruleIssue)throw Error('기준 쟁점이 열린 동안에는 확정할 수 없습니다.');
 task.final={...task.proposal,confirmedBy:actor,confirmedAt:new Date().toISOString()};return task;
}
