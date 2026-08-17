import { readFile, writeFile } from "node:fs/promises";

const dataUrl = new URL("../data/jobs.json", import.meta.url);
const payload = JSON.parse(await readFile(dataUrl, "utf8"));

const categoryMap = { "교수": "Faculty", "산업": "Industry", "연구": "Research" };
const confidenceMap = { "높음": "High", "중간": "Medium", "낮음": "Low" };
const fieldMap = new Map([
  ["XR·AI·interactive technology 직접", "Direct fit: XR, AI, and interactive technology"],
  ["HCI 인접: user-centred digital health / socio-technical systems", "Adjacent fit: user-centred digital health and socio-technical systems"],
  ["HCI를 명시한 CS faculty call", "Direct fit: the faculty call explicitly includes HCI"],
  ["광범위 CS; HCI는 명시 목록에 없으나 related/all areas 가능", "Broad computer science call; HCI may qualify under related or all areas"],
  ["HCI 인접: Information Systems / human-AI 가능", "Adjacent fit: information systems and human-AI interaction"],
  ["HCI / human-AI interaction 직접", "Direct fit: HCI and human-AI interaction"],
  ["AI/IoT 중심; HCI 직접 명시 없음", "Adjacent fit: AI and IoT; HCI is not explicitly listed"],
  ["HCI 직접", "Direct fit: HCI"],
  ["HCI·AR/VR·Vision Pro interaction 직접", "Direct fit: HCI, AR/VR, and Vision Pro interaction"],
  ["차세대 센서 기반 HCI prototyping 직접", "Direct fit: next-generation sensor-based HCI prototyping"],
  ["Human factors / emerging interaction 직접", "Direct fit: human factors and emerging interaction"],
  ["XR·AR/VR·human factors·정량 UX 연구 직접", "Direct fit: XR, AR/VR, human factors, and quantitative UX research"],
  ["HCI·VR device·immersive user research 직접", "Direct fit: HCI, VR devices, and immersive user research"],
  ["HCI·immersive UX research 직접", "Direct fit: HCI and immersive UX research"],
  ["AR/VR·UX 직접", "Direct fit: AR/VR and UX"],
  ["AR/VR·AI·환자/의료진 인터페이스 직접", "Direct fit: AR/VR, AI, and patient/clinician interfaces"],
  ["XR 앱·body tracking·clinician interface 직접", "Direct fit: XR applications, body tracking, and clinician interfaces"],
]);

function employment(value, category) {
  if (category === "Industry") return "Full-time industry position";
  if (category === "Research") return "Research appointment; not a faculty position";
  if (value.includes("Tenure stream")) return "Tenure-stream faculty position";
  if (value.includes("3년+갱신")) return "Tenure-track faculty position; renewable three-year appointment with tenure review";
  if (value.includes("tenure/영구성")) return "Full-time academic position; tenure or permanence is not specified";
  return "Faculty position; verify the employment track in the original posting";
}

function visa(job) {
  const value = String(job.visa ?? "");
  if (value.includes("보장하지")) return "Sponsorship is explicitly not guaranteed; confirm eligibility with university HR.";
  if (value.includes("캐나다 시민/PR 우선")) return "International applicants may apply; Canadian citizens and permanent residents receive priority.";
  if (value.includes("국제 지원자 환영")) return "International applicants are welcome; confirm work-authorization support with university HR.";
  if (value.includes("Macao 영주권자")) return "Macao permanent residents receive preference under equal conditions; confirm work-permit support with HR.";
  if (job.category === "Industry" && job.location === "United States") return "Sponsorship is not stated; confirm H-1B, O-1, or transfer support with the recruiter.";
  if (job.location === "United States") return "Sponsorship and work-authorization support are not stated; confirm with university HR.";
  return "Sponsorship or work-permit support is not stated; confirm with the employer.";
}

function recommendation(job) {
  if (job.category === "Faculty") return "Priority faculty opportunity. Verify research fit, employment track, deadline, and sponsorship before applying.";
  if (job.category === "Industry") return "Priority industry opportunity. Confirm role fit, work authorization, and sponsorship with the recruiter.";
  return "Secondary research opportunity. Prioritize permanent faculty roles and verify sponsorship before applying.";
}

function salaryBasis(value) {
  if (String(value).includes("추정")) return "Estimate based on comparable institutional or regional salary ranges; the posting does not state a range.";
  return "Range stated in the original posting or official institutional salary information.";
}

function ranking(value, category) {
  if (category === "Industry") return "Selected global HCI/XR employer";
  return String(value)
    .replace("KAIST 공식 근거:", "Official KAIST evidence:")
    .replace("글로벌 HCI/XR 기업", "Selected global HCI/XR employer")
    .replace("세계적 HCI/XR 기업", "Selected global HCI/XR employer")
    .replace("산업직", "Industry role");
}

function salary(value) {
  return String(value)
    .replace(/\s*\/\s*년/g, " / year")
    .replace(/\s*\/\s*월/g, " / month")
    .replace(/또는/g, "or");
}

for (const job of payload.jobs) {
  job.category = categoryMap[job.category] ?? job.category;
  job.employment = employment(String(job.employment ?? ""), job.category);
  job.field = fieldMap.get(job.field) ?? "Relevant HCI/XR opportunity; review the original posting for detailed research fit.";
  job.ranking = ranking(job.ranking, job.category);
  job.aboveLaTrobe = job.category === "Industry" ? "N/A (selected global HCI/XR employer)" : "Yes (ranked above La Trobe)";
  if (job.deadline === "공고 원문 확인") job.deadline = "Check original posting";
  job.status = String(job.status).includes("포털") ? "Recheck original portal" : "Active";
  job.visa = visa(job);
  job.recommendation = recommendation(job);
  job.salary = salary(job.salary);
  job.salaryBasis = salaryBasis(job.salaryBasis);
  job.salaryConfidence = confidenceMap[job.salaryConfidence] ?? job.salaryConfidence;
}

payload.salaryDisclaimer = "Salary figures are pre-tax base-pay ranges stated in the posting or estimates based on institutional and regional benchmarks. Actual pay may vary by rank, experience, and allowances.";

const output = `${JSON.stringify(payload, null, 2)}\n`;
if (/[가-힣]/.test(output)) throw new Error("English normalization left Hangul in the public dataset");
await writeFile(dataUrl, output, "utf8");

console.log(JSON.stringify({ jobs: payload.jobs.length, language: "English", status: "normalized" }, null, 2));
