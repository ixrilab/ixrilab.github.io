const JOBS_DATA_URL = "./data/jobs.json";
const FUNDING_DATA_URL = "./data/funding.json";

const state = {
  activeTab: window.location.hash === "#funding" ? "funding" : "jobs",
  jobs: [],
  jobPayload: null,
  jobQuery: "",
  jobCategory: "all",
  jobRegion: "all",
  jobSort: "priority",
  funding: [],
  fundingPayload: null,
  fundingQuery: "",
  fundingCategory: "all",
  fundingStatus: "all",
  fundingSort: "priority",
};

const elements = {
  tabs: [...document.querySelectorAll("[data-tab]")],
  jobsPanel: document.querySelector("#jobs-panel"),
  fundingPanel: document.querySelector("#funding-panel"),
  heroEyebrow: document.querySelector("#hero-eyebrow"),
  pageTitle: document.querySelector("#page-title"),
  heroCopy: document.querySelector("#hero-copy"),
  updatedAt: document.querySelector("#updated-at"),
  primaryCount: document.querySelector("#count-primary"),
  secondaryCount: document.querySelector("#count-secondary"),
  urgentCount: document.querySelector("#count-urgent"),
  primaryLabel: document.querySelector("#label-primary"),
  secondaryLabel: document.querySelector("#label-secondary"),
  urgentLabel: document.querySelector("#label-urgent"),
  jobList: document.querySelector("#job-list"),
  jobEmpty: document.querySelector("#empty-state"),
  jobError: document.querySelector("#error-state"),
  jobSearch: document.querySelector("#search"),
  jobCategory: document.querySelector("#category"),
  jobRegion: document.querySelector("#region"),
  jobSort: document.querySelector("#sort"),
  jobResultCount: document.querySelector("#result-count"),
  fundingList: document.querySelector("#funding-list"),
  fundingEmpty: document.querySelector("#funding-empty-state"),
  fundingError: document.querySelector("#funding-error-state"),
  fundingSearch: document.querySelector("#funding-search"),
  fundingCategory: document.querySelector("#funding-category"),
  fundingStatus: document.querySelector("#funding-status"),
  fundingSort: document.querySelector("#funding-sort"),
  fundingResultCount: document.querySelector("#funding-result-count"),
};

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function deadlineValue(item) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.deadline || "")) return Number.POSITIVE_INFINITY;
  return Date.parse(`${item.deadline}T23:59:59Z`);
}

function daysUntil(deadline) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline || "")) return null;
  return Math.ceil((Date.parse(`${deadline}T23:59:59+10:00`) - Date.now()) / 86400000);
}

function formatGeneratedAt(payload) {
  const generated = new Date(payload?.generatedAt);
  return Number.isNaN(generated.valueOf())
    ? `Timezone: ${payload?.timezone || "Australia/Sydney"}`
    : `Dataset generated ${new Intl.DateTimeFormat("en-AU", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: payload.timezone,
      }).format(generated)}`;
}

function filteredJobs() {
  const query = state.jobQuery.toLowerCase();
  const jobs = state.jobs.filter((job) => {
    const searchable = [job.institution, job.title, job.field, job.location, job.employment].join(" ").toLowerCase();
    return (!query || searchable.includes(query)) &&
      (state.jobCategory === "all" || job.category === state.jobCategory) &&
      (state.jobRegion === "all" || job.location === state.jobRegion);
  });

  return jobs.sort((a, b) => {
    if (state.jobSort === "deadline") return deadlineValue(a) - deadlineValue(b) || b.score - a.score;
    if (state.jobSort === "institution") return a.institution.localeCompare(b.institution) || b.score - a.score;
    return b.score - a.score || b.workbookScore - a.workbookScore;
  });
}

function renderJobCard(job, index) {
  const card = node("article", "job-card");
  const priority = node("div", "priority");
  priority.append(node("span", "rank-number", String(index + 1).padStart(2, "0")));
  priority.append(node("strong", "score", String(job.score)));
  priority.append(node("span", "score-label", "priority"));

  const institution = node("div", "institution");
  institution.append(node("h3", "", job.institution));
  institution.append(node("p", "", job.location));
  const chips = node("div", "chip-row");
  chips.append(node("span", "chip", job.category));
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
  deadline.append(document.createTextNode(job.deadline));
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

function renderJobs() {
  const jobs = filteredJobs();
  elements.jobList.replaceChildren(...jobs.map(renderJobCard));
  elements.jobResultCount.textContent = `${jobs.length} of ${state.jobs.length} openings`;
  elements.jobEmpty.hidden = jobs.length !== 0;
}

function filteredFunding() {
  const query = state.fundingQuery.toLowerCase();
  const opportunities = state.funding.filter((item) => {
    const searchable = [
      item.funder,
      item.title,
      item.regionCategory,
      item.status,
      item.eligibilityRoute,
      item.partnerRequirement,
      item.fieldFit,
      item.recommendation,
    ].join(" ").toLowerCase();
    return (!query || searchable.includes(query)) &&
      (state.fundingCategory === "all" || item.regionCategory === state.fundingCategory) &&
      (state.fundingStatus === "all" || item.status === state.fundingStatus);
  });

  return opportunities.sort((a, b) => {
    if (state.fundingSort === "deadline") return deadlineValue(a) - deadlineValue(b) || b.score - a.score;
    if (state.fundingSort === "funder") return a.funder.localeCompare(b.funder) || b.score - a.score;
    return b.score - a.score;
  });
}

function renderFundingCard(item, index) {
  const card = node("article", "job-card funding-card");
  const priority = node("div", "priority");
  priority.append(node("span", "rank-number", String(index + 1).padStart(2, "0")));
  priority.append(node("strong", "score", String(item.score)));
  priority.append(node("span", "score-label", "fit score"));

  const funder = node("div", "institution");
  funder.append(node("h3", "", item.funder));
  funder.append(node("p", "", item.regionCategory));
  const chips = node("div", "chip-row");
  chips.append(node("span", "chip", item.regionCategory));
  chips.append(node("span", `chip status-chip status-${item.status.toLowerCase()}`, item.status));
  funder.append(chips);

  const detail = node("div", "role");
  detail.append(node("h3", "", item.title));
  detail.append(node("p", "employment", item.eligibilityRoute));
  detail.append(node("p", "partner-note", `Partner route: ${item.partnerRequirement}`));
  detail.append(node("p", "field", item.fieldFit));
  detail.append(node("p", "recommendation", item.recommendation));

  const meta = node("div", "meta");
  const remaining = daysUntil(item.deadline);
  const deadline = node("div", `deadline${remaining !== null && remaining >= 0 && remaining <= 30 ? " urgent" : ""}`);
  const deadlineHeading = remaining === null
    ? item.deadlineLabel
    : remaining >= 0
      ? `D-${remaining}`
      : "Verify status";
  deadline.append(node("strong", "", deadlineHeading));
  if (remaining !== null) deadline.append(document.createTextNode(item.deadlineLabel));
  const amount = node("div", "salary funding-amount");
  amount.append(node("strong", "", item.funding));
  amount.append(document.createTextNode(item.fundingType));
  const link = node("a", "source-link", "Official source ↗");
  link.href = item.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-label", `Open official source for ${item.title}`);
  meta.append(deadline, amount, link);

  card.append(priority, funder, detail, meta);
  return card;
}

function renderFunding() {
  const opportunities = filteredFunding();
  elements.fundingList.replaceChildren(...opportunities.map(renderFundingCard));
  elements.fundingResultCount.textContent = `${opportunities.length} of ${state.funding.length} opportunities`;
  elements.fundingEmpty.hidden = opportunities.length !== 0;
}

function updateHero() {
  if (state.activeTab === "funding") {
    const actionable = state.funding.filter((item) => ["Open", "Rolling"].includes(item.status)).length;
    const bilateral = state.funding.filter((item) => item.regionCategory === "Korea-Australia").length;
    const urgent = state.funding.filter((item) => {
      const days = daysUntil(item.deadline);
      return days !== null && days >= 0 && days <= 30 && ["Open", "Conditional"].includes(item.status);
    }).length;
    elements.heroEyebrow.textContent = "AUSTRALIA · KOREA · GLOBAL PROGRAMS";
    elements.pageTitle.innerHTML = "Research funding<br><em>worth pursuing.</em>";
    elements.heroCopy.textContent = "Official funding calls for Australian university researchers, Korea–Australia collaboration, and global HCI/XR innovation.";
    elements.updatedAt.textContent = state.fundingPayload ? formatGeneratedAt(state.fundingPayload) : "Loading the latest funding scan…";
    elements.primaryCount.textContent = state.fundingPayload ? actionable : "—";
    elements.secondaryCount.textContent = state.fundingPayload ? bilateral : "—";
    elements.urgentCount.textContent = state.fundingPayload ? urgent : "—";
    elements.primaryLabel.textContent = "actionable now";
    elements.secondaryLabel.textContent = "bilateral routes";
    elements.urgentLabel.textContent = "close in 30 days";
    document.title = "Funding Radar · HCI · XR Career Radar";
    return;
  }

  const urgent = state.jobs.filter((job) => job.daysLeft !== null && job.daysLeft >= 0 && job.daysLeft <= 30).length;
  elements.heroEyebrow.textContent = "GLOBAL ACADEMIC OPPORTUNITIES";
  elements.pageTitle.innerHTML = "Faculty openings<br><em>worth tracking.</em>";
  elements.heroCopy.textContent = "Ranked computer science roles, adjacent research positions, and selected industry opportunities—checked against original sources.";
  elements.updatedAt.textContent = state.jobPayload ? formatGeneratedAt(state.jobPayload) : "Loading the latest job scan…";
  elements.primaryCount.textContent = state.jobPayload ? state.jobs.length : "—";
  elements.secondaryCount.textContent = state.jobPayload ? state.jobs.filter((job) => job.category === "Faculty").length : "—";
  elements.urgentCount.textContent = state.jobPayload ? urgent : "—";
  elements.primaryLabel.textContent = "active roles";
  elements.secondaryLabel.textContent = "faculty roles";
  elements.urgentLabel.textContent = "close in 30 days";
  document.title = "Jobs Radar · HCI · XR Career Radar";
}

function activateTab(tab, updateHash = true) {
  const nextTab = tab === "funding" ? "funding" : "jobs";
  state.activeTab = nextTab;
  elements.jobsPanel.hidden = nextTab !== "jobs";
  elements.fundingPanel.hidden = nextTab !== "funding";
  for (const tabElement of elements.tabs) {
    const selected = tabElement.dataset.tab === nextTab;
    tabElement.classList.toggle("is-active", selected);
    tabElement.setAttribute("aria-selected", String(selected));
    tabElement.tabIndex = selected ? 0 : -1;
  }
  if (updateHash && window.location.hash !== `#${nextTab}`) history.replaceState(null, "", `#${nextTab}`);
  updateHero();
}

function populateRegions() {
  const regions = [...new Set(state.jobs.map((job) => job.location).filter(Boolean))].sort();
  for (const region of regions) {
    const option = node("option", "", region);
    option.value = region;
    elements.jobRegion.append(option);
  }
}

function bindControls() {
  for (const tab of elements.tabs) {
    tab.addEventListener("click", (event) => {
      event.preventDefault();
      activateTab(tab.dataset.tab);
    });
    tab.addEventListener("keydown", (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      activateTab(state.activeTab === "jobs" ? "funding" : "jobs");
      elements.tabs.find((item) => item.dataset.tab === state.activeTab)?.focus();
    });
  }

  window.addEventListener("hashchange", () => activateTab(window.location.hash.slice(1), false));
  elements.jobSearch.addEventListener("input", (event) => { state.jobQuery = event.target.value.trim(); renderJobs(); });
  elements.jobCategory.addEventListener("change", (event) => { state.jobCategory = event.target.value; renderJobs(); });
  elements.jobRegion.addEventListener("change", (event) => { state.jobRegion = event.target.value; renderJobs(); });
  elements.jobSort.addEventListener("change", (event) => { state.jobSort = event.target.value; renderJobs(); });
  elements.fundingSearch.addEventListener("input", (event) => { state.fundingQuery = event.target.value.trim(); renderFunding(); });
  elements.fundingCategory.addEventListener("change", (event) => { state.fundingCategory = event.target.value; renderFunding(); });
  elements.fundingStatus.addEventListener("change", (event) => { state.fundingStatus = event.target.value; renderFunding(); });
  elements.fundingSort.addEventListener("change", (event) => { state.fundingSort = event.target.value; renderFunding(); });
}

async function loadJobs() {
  try {
    const response = await fetch(JOBS_DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.jobs)) throw new Error("Invalid dataset");
    state.jobs = payload.jobs;
    state.jobPayload = payload;
    populateRegions();
    renderJobs();
  } catch (error) {
    console.error("Unable to load faculty job data", error);
    elements.jobError.hidden = false;
  }
}

async function loadFunding() {
  try {
    const response = await fetch(FUNDING_DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.opportunities)) throw new Error("Invalid dataset");
    state.funding = payload.opportunities;
    state.fundingPayload = payload;
    renderFunding();
  } catch (error) {
    console.error("Unable to load funding data", error);
    elements.fundingError.hidden = false;
  }
}

async function init() {
  bindControls();
  activateTab(state.activeTab, false);
  await Promise.allSettled([loadJobs(), loadFunding()]);
  updateHero();
}

init();
