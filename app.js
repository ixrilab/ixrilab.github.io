const DATA_URL = "./data/jobs.json";

const state = { jobs: [], query: "", category: "all", region: "all", sort: "priority" };
const categoryLabels = { 교수: "Faculty", 산업: "Industry", 연구: "Research" };

const elements = {
  list: document.querySelector("#job-list"),
  empty: document.querySelector("#empty-state"),
  error: document.querySelector("#error-state"),
  search: document.querySelector("#search"),
  category: document.querySelector("#category"),
  region: document.querySelector("#region"),
  sort: document.querySelector("#sort"),
  resultCount: document.querySelector("#result-count"),
  updatedAt: document.querySelector("#updated-at"),
  activeCount: document.querySelector("#count-active"),
  facultyCount: document.querySelector("#count-faculty"),
  urgentCount: document.querySelector("#count-urgent"),
};

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function deadlineValue(job) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(job.deadline || "")) return Number.POSITIVE_INFINITY;
  return Date.parse(`${job.deadline}T23:59:59Z`);
}

function filteredJobs() {
  const query = state.query.toLowerCase();
  const jobs = state.jobs.filter((job) => {
    const searchable = [job.institution, job.title, job.field, job.location, job.employment].join(" ").toLowerCase();
    return (!query || searchable.includes(query)) &&
      (state.category === "all" || job.category === state.category) &&
      (state.region === "all" || job.location === state.region);
  });

  return jobs.sort((a, b) => {
    if (state.sort === "deadline") return deadlineValue(a) - deadlineValue(b) || b.score - a.score;
    if (state.sort === "institution") return a.institution.localeCompare(b.institution) || b.score - a.score;
    return b.score - a.score || b.workbookScore - a.workbookScore;
  });
}

function renderCard(job, index) {
  const card = node("article", "job-card");
  const priority = node("div", "priority");
  priority.append(node("span", "rank-number", String(index + 1).padStart(2, "0")));
  priority.append(node("strong", "score", String(job.score)));
  priority.append(node("span", "score-label", "priority"));

  const institution = node("div", "institution");
  institution.append(node("h3", "", job.institution));
  institution.append(node("p", "", job.location));
  const chips = node("div", "chip-row");
  chips.append(node("span", "chip", categoryLabels[job.category] || job.category));
  if (job.ranking && job.ranking !== "N/A") chips.append(node("span", "chip", job.ranking));
  institution.append(chips);

  const role = node("div", "role");
  role.append(node("h3", "", job.title));
  role.append(node("p", "employment", job.employment));
  role.append(node("p", "field", job.field));
  role.append(node("p", "recommendation", job.recommendation));

  const meta = node("div", "meta");
  const deadline = node("div", `deadline${job.daysLeft !== null && job.daysLeft <= 30 ? " urgent" : ""}`);
  deadline.append(node("strong", "", job.daysLeft !== null ? `D-${job.daysLeft}` : "Open / verify"));
  deadline.append(document.createTextNode(job.deadline === "공고 원문 확인" ? "Check original posting" : job.deadline));
  const salary = node("div", "salary");
  salary.append(node("strong", "", job.salary));
  salary.append(document.createTextNode(`Confidence: ${job.salaryConfidence}`));
  const link = node("a", "source-link", "View original ↗");
  link.href = job.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-label", `Open original posting for ${job.title}`);
  meta.append(deadline, salary, link);

  card.append(priority, institution, role, meta);
  return card;
}

function render() {
  const jobs = filteredJobs();
  elements.list.replaceChildren(...jobs.map(renderCard));
  elements.resultCount.textContent = `${jobs.length} of ${state.jobs.length} openings`;
  elements.empty.hidden = jobs.length !== 0;
}

function populateRegions() {
  const regions = [...new Set(state.jobs.map((job) => job.location).filter(Boolean))].sort();
  for (const region of regions) {
    const option = node("option", "", region);
    option.value = region;
    elements.region.append(option);
  }
}

function updateSummary(payload) {
  const urgent = state.jobs.filter((job) => job.daysLeft !== null && job.daysLeft >= 0 && job.daysLeft <= 30).length;
  elements.activeCount.textContent = state.jobs.length;
  elements.facultyCount.textContent = state.jobs.filter((job) => job.category === "교수").length;
  elements.urgentCount.textContent = urgent;
  const generated = new Date(payload.generatedAt);
  elements.updatedAt.textContent = Number.isNaN(generated.valueOf())
    ? `Timezone: ${payload.timezone}`
    : `Dataset generated ${new Intl.DateTimeFormat("en-AU", { dateStyle: "long", timeStyle: "short", timeZone: payload.timezone }).format(generated)}`;
}

function bindFilters() {
  elements.search.addEventListener("input", (event) => { state.query = event.target.value.trim(); render(); });
  elements.category.addEventListener("change", (event) => { state.category = event.target.value; render(); });
  elements.region.addEventListener("change", (event) => { state.region = event.target.value; render(); });
  elements.sort.addEventListener("change", (event) => { state.sort = event.target.value; render(); });
}

async function init() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.jobs)) throw new Error("Invalid dataset");
    state.jobs = payload.jobs;
    populateRegions();
    updateSummary(payload);
    bindFilters();
    render();
  } catch (error) {
    console.error("Unable to load faculty job data", error);
    elements.updatedAt.textContent = "Dataset unavailable";
    elements.error.hidden = false;
  }
}

init();
