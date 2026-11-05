export const TRIAL_KEY='xrmemory-encrypted-ux-trial-0005-v1';
export const TRIAL_VERSION='UX-FULLTEXT-DRAFT-3';
const EMPTY_CASE={"id":"XRMR-SCR-0005","title":"4D Facial Avatar Reconstruction from Monocular Video via Efficient and Controllable Neural Radiance Fields","year":2024,"doi":"10.1109/access.2024.3355052","pdf":"./papers/XRMR-SCR-0005.pdf","pages":9,"reviewer":"__R1_NAME__","partner":"__R2_NAME__","lead":"__LEAD_NAME__","pair":["R1","R2"],"adjudicator":"LEAD","priorDecision":"","priorReason":"","priorSource":"","sourceVersion":"archived-accepted-manuscript-sha256:8fa594a6d30ce5174bfb44792cc5d90f77f206727ade94442c436e6ee9c60c7f"};
export const CASE={...EMPTY_CASE};
export function configureCase(info){for(const key of Object.keys(CASE))delete CASE[key];Object.assign(CASE,EMPTY_CASE,info||{});}
export const CRITERIA={scope:'§1 · 경험 기록의 공통 문제에 대한 기여',instance:'§2 · 분야 관련성과 직접 재경험 사례의 구별',insufficient:'§3 · 원문 근거 부족·기준 해석의 추가 확인'};
const decisions=['Include','Exclude','Unclear'],roles=['C0','C1','C2','C3'],directs=['Yes','No','Unclear','NA'];
const now=()=>new Date().toISOString();
function event(s,type,actor='R1',data={}){s.events.push({at:now(),type,actor,simulation:true,...data});}
export function readyToPass(a,b){return !!(a&&b&&a.decision===b.decision&&['Include','Exclude'].includes(a.decision)&&a.ruleVersion===TRIAL_VERSION&&a.ruleVersion===b.ruleVersion&&a.sourceVersion===CASE.sourceVersion&&a.sourceVersion===b.sourceVersion&&a.criterion===b.criterion&&a.locator?.trim()&&b.locator?.trim()&&a.reason?.trim()&&b.reason?.trim());}
function completeExercise(s,v,via){const a=s.postDiscussion.R1||s.review,b=s.postDiscussion.R2||s.partner;const classificationPending=v.decision==='Include'&&['roles','direct'].some(f=>JSON.stringify(a[f])!==JSON.stringify(b[f]));s.completion={...coding(v),at:now(),flowRevision:'fast-match-1',simulation:true,realResearchDecision:false,via,classificationPending,xy:'후속 분석 단계에서 별도 확인',nextTask:v.decision==='Unclear'?'원문·기준 추가 확인 대기. 해결 전 포함·제외 집계 보류':v.decision==='Include'?'포함 기록 보존. 유형·직접 사례·역량·평가 정보는 후속 검증':'대표 제외 이유·원문 위치·원평정과 최종 기록 보존'};if(s.followUp)s.followUp.resolvedAt=now();s.stage='complete';event(s,'exercise_completed','SYSTEM',{via,automaticAgreementRecord:via!=='adjudicator_exercise'});}
export function freshTrial(){return {schemaVersion:3,simulation:true,realResearchDecision:false,caseId:CASE.id,runId:'UX-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),ruleVersion:TRIAL_VERSION,stage:'intro',accepted:false,draft:{change:'',decision:'',roles:[],direct:'',locator:'',sourceNote:'',criterion:'',reason:'',readConfirmed:false},review:null,partner:null,comments:[],proposal:null,proposalHistory:[],postDiscussion:{R1:null,R2:null},positionHistory:[],ack:null,adjudication:null,completion:null,feedback:{},events:[]};}
export function normalizeIndependent(v){
 const result={...v};
 if(v.change==='keep')Object.assign(result,{decision:CASE.priorDecision,reason:CASE.priorReason,reasonSource:{type:'reaffirmed_archived_reason',reference:CASE.priorSource,originalText:CASE.priorReason},sourceNote:v.sourceNote||'',criterion:v.criterion||''});
 else if(v.change==='supplement')Object.assign(result,{decision:CASE.priorDecision,reason:CASE.priorReason+'\n\n[이번 원문 검토에서 보완]\n'+(v.reason||'').trim(),reasonSource:{type:'archived_reason_with_addendum',reference:CASE.priorSource,originalText:CASE.priorReason}});
 else result.reasonSource={type:'new_fulltext_reason'};
 if(result.decision==='Exclude')Object.assign(result,{roles:[],direct:'NA'});
 return result;
}
export function validateCoding(v,{independent=false}={}){
 if(independent&&!v.readConfirmed)return '논문 원문을 읽고 확인한 항목에 표시해 주세요.';
 if(independent&&!['keep','supplement','change'].includes(v.change))return '의견 같음·이유 보완·판정 변경 중 하나를 선택해 주세요.';
 if(independent&&((['keep','supplement'].includes(v.change)&&v.decision!==CASE.priorDecision)||(v.change==='change'&&v.decision===CASE.priorDecision)))return '판정은 같고 이유만 달라졌다면 이유 보완을 선택해 주세요.';
 if(independent&&v.change==='keep'&&!CASE.priorReason?.trim())return '이전 사유가 비어 있어 재사용할 수 없습니다. 원문 검토 이유를 작성해 주세요.';
 if(!decisions.includes(v.decision))return '포함·제외·추가 확인 중 하나를 선택해 주세요.';
 if(!Array.isArray(v.roles)||v.roles.some(x=>!roles.includes(x))||new Set(v.roles).size!==v.roles.length)return '잠정 분류 선택을 확인해 주세요.';
 if(v.decision==='Include'&&!v.roles.length)return '포함을 제안하면 근거가 있는 유형을 한 개 이상 선택해 주세요.';
 if(!directs.includes(v.direct))return '직접 재경험 사례 여부를 선택해 주세요.';
 if(!v.locator?.trim())return '재확인한 PDF 쪽수와 절·그림·표 등 원문 위치를 남겨 주세요. 이유를 다시 쓸 필요는 없습니다.';
 const reuse=independent&&v.change==='keep';
 if(!reuse&&!v.sourceNote?.trim())return '원문에서 확인한 내용을 적어 주세요.';
 if(!reuse&&!Object.hasOwn(CRITERIA,v.criterion))return '판단에 적용한 기준을 선택해 주세요.';
 if(!reuse&&!v.reason?.trim())return '변경·보완한 내용 또는 최종 판단 이유를 적어 주세요.';
 if(independent&&v.change==='supplement'&&!v.addendum?.trim())return '기존 이유에 보완할 내용을 적어 주세요.';
 return null;
}
function coding(v){return {decision:v.decision,roles:v.decision==='Exclude'?[]:[...v.roles].sort(),direct:v.decision==='Exclude'?'NA':v.direct,locator:(v.locator||'').trim(),sourceNote:(v.sourceNote||'').trim(),criterion:v.criterion||'',reason:(v.reason||'').trim(),reasonSource:v.reasonSource||{type:'authored_in_exercise'}};}
function peerReview(){return {actor:'SIM-R2',name:CASE.partner,simulation:true,decision:'Include',roles:['C2'],direct:'Unclear',locator:'PDF p.1 Abstract; p.8 V. Conclusion',sourceNote:'[가상 검토 메모] 단안 영상 기반 얼굴 아바타 재구성, 표정·자세 제어, 렌더링 효율 및 시각적 품질을 다루는 논문입니다. 실제 __R2_NAME__의 원문 검토 기록이 아닙니다.',criterion:'scope',reason:'[가상 의견] 경험 기록과의 연결을 검토할 기반 기술(C2)로 포함을 제안합니다. 그 연결이 실제 포함 기준을 충족하는지 확인해야 하며, 직접 사례는 추가 확인으로 남깁니다.',ruleVersion:TRIAL_VERSION,sourceVersion:CASE.sourceVersion,at:now()};}
export function visiblePeer(s){return s.review?s.partner:null;}
export function comparison(s){if(!s.review||!s.partner)return null;return ['decision','roles','direct'].map(field=>({field,mine:s.review[field],peer:s.partner[field],match:JSON.stringify(s.review[field])===JSON.stringify(s.partner[field])}));}
function replyFor(issue){return ({
 '분야 관련성':'[가상 답변] 아바타라는 기술명만으로 포함을 확정할 수는 없습니다. 원문에서 어떤 기능을 확인했는지와, 그 기능이 경험 기록의 공통 문제에 어떻게 연결되는지 나눠 비교하겠습니다. 직접 재경험 사례가 없다는 사실만으로 모든 기반 기술을 제외하는 기준도 아닙니다.',
 '직접 사례 여부':'[가상 답변] 기반 기술의 관련성과 특정 사건의 기록·이후 XR 재경험을 별도로 판단하겠습니다. 포함 여부는 같고 직접 사례 분류만 다르면 후속 분석 쟁점으로 남길 수 있습니다. 이 차이가 적격성에 영향을 주는지도 확인해야 합니다.',
 '원문 근거':'[가상 답변] 두 사람이 서로 다른 원문 내용을 읽었는지, 같은 내용을 다른 기준으로 해석했는지 구분하겠습니다. 원문 위치와 기준 조항을 한 번 대조해도 의견이 다르면 총괄의 제3판정으로 넘길 수 있습니다. 이 자동 답변은 실제 원문 검증이 아닙니다.',
 '기준 해석':'[가상 답변] 여러 논문에서 같은 기준 해석이 반복된다면 공통 기준 쟁점으로 묶겠습니다. 기준이 바뀌면 적용일·이유·영향 논문을 남기고 재검토해야 합니다. 한 논문의 결론에 맞춰 조용히 기준을 바꾸지 않겠습니다.'
 })[issue]||'[가상 답변] 근거와 기준을 비교했습니다. 논의 후 각자 자기 입장을 유지하거나 보완해 기록하겠습니다.';}
export function dispatchTrial(s,{type,value}){
 if(s.schemaVersion!==3||!s.simulation||s.realResearchDecision!==false||s.caseId!==CASE.id||s.ruleVersion!==TRIAL_VERSION)throw Error('연습 버전이 다릅니다. 새 검토 연습을 시작해 주세요. 이전 연습 기록은 별도 보관됩니다.');
 if(s.completion&&type!=='FEEDBACK')throw Error('완료한 연습입니다. 다시 시작하면 다른 경로를 시험할 수 있습니다.');
 switch(type){
  case 'BEGIN':if(s.stage!=='intro'||!value)throw Error('작업 순서와 공통 기준을 먼저 확인해 주세요.');s.accepted=true;s.stage='review';event(s,'draft_rules_acknowledged');break;
  case 'SAVE_DRAFT':if(s.stage!=='review'||s.review)throw Error('독립 검토 작성 단계가 아닙니다.');s.draft={...s.draft,...value};break;
  case 'SUBMIT_REVIEW':{
   if(s.stage!=='review'||s.review)throw Error('독립 검토를 제출할 수 없습니다.');
   if(['keep','supplement'].includes(value.change)&&value.decision!==CASE.priorDecision)throw Error('이전 판정 재사용과 제출한 판정이 다릅니다.');
   const v=normalizeIndependent(value);if(value.change==='supplement')v.addendum=value.reason;
   const error=validateCoding(v,{independent:true});if(error)throw Error(error);
   s.review={...coding(v),change:value.change,readConfirmed:true,actor:'R1',simulation:true,ruleVersion:TRIAL_VERSION,sourceVersion:CASE.sourceVersion,at:now()};
   event(s,'independent_fulltext_review_submitted','R1',{reasonReused:value.change==='keep'});s.partner=peerReview();s.stage='compare';
   if(readyToPass(s.review,s.partner)){event(s,'matching_independent_submissions_recorded','SYSTEM');completeExercise(s,s.review,'matched_independent_submissions');}break;}
  case 'OPEN_DISCUSSION':if(s.stage!=='compare')throw Error('두 검토 결과를 먼저 비교해 주세요.');s.stage='discussion';break;
  case 'COMMENT':if(s.stage!=='discussion'||!value?.text?.trim())throw Error('공동 댓글에 질문이나 의견을 적어 주세요.');s.comments.push({actor:'R1',name:CASE.reviewer,text:value.text.trim(),issue:value.issue,at:now(),simulation:true},{actor:'SIM-R2',name:CASE.partner,text:replyFor(value.issue),issue:value.issue,at:now(),simulation:true});event(s,'comment_and_mock_reply_added');break;
  case 'OPEN_RESOLUTION':if(!['compare','discussion'].includes(s.stage))throw Error('의견을 수정할 단계가 아닙니다.');s.stage='resolution';break;
  case 'PROPOSE':{
   if(s.stage!=='resolution')throw Error('논의 후 내 입장 확인 단계가 아닙니다.');
   let v;
   if(value?.reuseIndependent)v={...s.review};
   else {v=coding(value);const error=validateCoding(v);if(error)throw Error(error);if(v.decision!==s.review.decision&&v.reason===s.review.reason)throw Error('판정이 바뀌면 기존 이유를 그대로 두지 말고 바뀐 판단 이유를 적어 주세요.');}
   if(s.proposal)s.proposalHistory.push(s.proposal);
   if(s.postDiscussion.R2)s.positionHistory.push({...s.postDiscussion});
   s.proposal={...coding(v),id:'F'+(s.proposalHistory.length+1),actor:'R1',simulation:true,independent:false,positionChange:value?.reuseIndependent?'unchanged':'revised',changeNote:value?.reuseIndependent?'독립 의견과 이유 유지':(value.changeNote||value.reason).trim(),basedOnIndependentAt:s.review.at,ruleVersion:TRIAL_VERSION,sourceVersion:CASE.sourceVersion,at:now()};
   s.postDiscussion={R1:s.proposal,R2:null};s.ack=null;s.adjudication=null;s.stage='approval';event(s,'updated_position_submitted');
   if(readyToPass(s.proposal,s.partner)){event(s,'revision_now_matches_other_submission','SYSTEM');completeExercise(s,s.proposal,'matched_after_revision');}break;}
  case 'SIMULATE_ACK':{
   if(s.stage!=='approval'||!s.proposal||s.ack)throw Error('두 번째 코더의 최종 입장을 확인할 단계가 아닙니다.');
   const agree=value!=='hold',peer=agree?s.proposal:s.partner;
   const p={...coding(peer),actor:'SIM-R2',simulation:true,independent:false,positionChange:agree?'agrees_with_R1':'maintains_independent',basedOnIndependentAt:s.partner.at,ruleVersion:TRIAL_VERSION,sourceVersion:CASE.sourceVersion,at:now(),reason:agree?'[가상 최종 입장] 제안의 근거와 대표 이유를 확인하고 같은 결론에 동의했다고 가정합니다.\n'+s.proposal.reason:'[가상 최종 입장] 논의 후에도 제 독립 의견을 유지합니다.\n'+s.partner.reason};
   s.postDiscussion.R2=p;
   const status=s.proposal.decision!==p.decision?'conflict':p.decision==='Unclear'?'pending':'accepted';
   s.ack={actor:'SIM-R2',simulation:true,status,proposalId:s.proposal.id,at:now(),text:status==='accepted'?'[가상 확인] 두 코더가 같은 포함·제외 결론과 근거를 명시적으로 확인한 상황입니다. 분류의 차이는 필요 시 별도 분석 쟁점으로 남깁니다.':status==='conflict'?'[가상 확인] 논의 후에도 포함·제외 입장이 다릅니다. 의견 변경을 강요하지 않고 __LEAD_NAME__ 총괄의 제3판정 단계로 넘길 수 있습니다.':'[가상 확인] 두 사람 모두 추가 확인 상태입니다. 적격성 합의 완료로 처리하지 않습니다.'};
   event(s,'mock_second_final_position','SIM-R2',{status});if(status==='accepted'&&readyToPass(s.proposal,p))completeExercise(s,s.proposal,'matched_after_peer_revision');break;}
  case 'MARK_MEETING':if(!['compare','discussion','approval'].includes(s.stage))throw Error('미해결 논문만 회의 안건으로 남길 수 있습니다.');s.followUp={mode:'meeting_agenda',at:now(),caseId:CASE.id,mine:(s.proposal||s.review).decision,peer:(s.postDiscussion.R2||s.partner).decision,question:s.comments.filter(c=>c.actor==='R1').at(-1)?.text||'두 코더의 적격성 근거·기준 해석 차이 확인 필요',simulation:true};event(s,'meeting_agenda_saved');break;
  case 'REVISE':if(s.stage!=='approval'||!s.proposal)throw Error('수정할 최종 입장이 없습니다.');s.stage='resolution';break;
  case 'REQUEST_ADJUDICATION':
   if(s.stage!=='approval'||!['conflict','pending'].includes(s.ack?.status)||!s.postDiscussion.R1||!s.postDiscussion.R2)throw Error('두 입장이 제출된 미해결 사례만 넘길 수 있습니다.');
   if(CASE.pair.includes(CASE.adjudicator))throw Error('제3판정자는 해당 논문의 두 코더와 달라야 합니다.');
   s.stage='adjudication';event(s,'adjudication_requested','R1',{adjudicator:CASE.adjudicator});break;
  case 'SUBMIT_ADJUDICATION':{
   if(s.stage!=='adjudication'||s.adjudication||CASE.pair.includes(CASE.adjudicator))throw Error('제3판정 단계가 아닙니다.');
   if(!value?.readConfirmed)throw Error('두 입장·원문·동일 기준을 확인했다는 표시가 필요합니다.');
   const v=coding(value),error=validateCoding(v);if(error)throw Error(error);
   s.adjudication={...v,actor:CASE.adjudicator,name:CASE.lead,simulation:true,realResearchDecision:false,readConfirmed:true,ruleVersion:TRIAL_VERSION,sourceVersion:CASE.sourceVersion,at:now()};event(s,'adjudication_exercise_submitted',CASE.adjudicator);completeExercise(s,s.adjudication,'adjudicator_exercise');break;}
  case 'FINISH':{
   if(s.stage!=='approval'||!s.proposal||!s.ack||s.ack.proposalId!==s.proposal.id||!(s.ack.status==='accepted'||s.adjudication))throw Error('두 사람의 명시적 합의 또는 제3판정 기록이 필요합니다.');
   const positions=[s.postDiscussion.R1,s.postDiscussion.R2];
   if(positions.some(p=>!p||p.ruleVersion!==s.ruleVersion||p.sourceVersion!==CASE.sourceVersion))throw Error('같은 기준·원문 버전인지 확인해야 합니다.');
   const v=s.adjudication||s.proposal;
   const classificationPending=!s.adjudication&&v.decision==='Include'&&(['roles','direct'].some(f=>JSON.stringify(s.postDiscussion.R1[f])!==JSON.stringify(s.postDiscussion.R2[f])));
   s.completion={...coding(v),at:now(),simulation:true,realResearchDecision:false,via:s.adjudication?'adjudicator_exercise':'mock_pair_agreement',classificationPending,xy:'후속 분석 단계에서 별도 확인',nextTask:v.decision==='Unclear'?'원문·기준 추가 확인 대기. 해결 전 포함·제외 집계 보류':v.decision==='Include'?'적격성 결정과 별도로 잠정 유형·직접 사례·역량·평가 정보를 후속 검증':'대표 제외 이유·원문 위치·독립/최종/제3판정 기록 보존'};
   s.stage='complete';event(s,'ux_exercise_completed');break;}
  case 'FEEDBACK':s.feedback={...value,at:now()};event(s,'local_feedback_saved');break;
  default:throw Error('알 수 없는 검토 동작입니다.');
 }
 return s;
}
