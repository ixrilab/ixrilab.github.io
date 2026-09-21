const JOBS_DATA_URL = "./data/jobs.json";
const FUNDING_DATA_URL = "./data/funding.json";
const TRACKER_TIMEZONE = "Australia/Sydney";

const state = {
  activeTab: window.location.hash === "#funding" ? "funding" : "jobs",
  jobs: [],
  jobPayload: null,
  jobQuery: "",
  jobFit: "all",
  jobCountry: "all",
  jobStatus: "active",
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
  jobFit: document.querySelector("#fit"),
  jobCountry: document.querySelector("#country"),
  jobStatus: document.querySelector("#job-status"),
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
  const deadline = item.finalDeadline ?? item.deadline;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline || "")) return Number.POSITIVE_INFINITY;
  return Date.parse(`${deadline}T23:59:59Z`);
}

function daysUntil(deadline) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline || "")) return null;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: TRACKER_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}

function scoreBreakdown(job) {
  const fit = { Direct: 70, Strong: 40, Broad: 15 }[job.fitLevel] || 0;
  const rank = {
    "Assistant Professor": 4,
    "Assistant/Associate Professor": 3,
    "Open Rank (Assistant accepted)": 2,
  }[job.rankTrack] || 0;
  const priorityRemaining = daysUntil(job.priorityDate);
  const finalRemaining = daysUntil(job.finalDeadline);
  const timing = (job.postingAgeStatus === "Under 6 months" ? 2 : 0)
    + (priorityRemaining !== null && priorityRemaining >= 0 ? 2 : 0)
    + (finalRemaining !== null && finalRemaining >= 0 ? 2 : 0);
  const collaboration = Math.round(Math.min(job.collaborationEvidenceScore || 0, 180) / 180 * 12);
  return `Fit ${fit} · collaborators ${collaboration} · institution ${job.institutionScore} · rank ${rank} · posting clarity ${timing}`;
}

function hasPassedDeadline(item) {
  const remaining = daysUntil(item.deadline);
  return remaining !== null && remaining < 0;
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
    const searchable = [
      job.university,
      job.department,
      job.title,
      job.researchArea,
      job.fitNote,
      ...(job.collaborationFaculty || []).flatMap((person) => [person.name, person.areas, person.venueEvidence]),
    ].join(" ").toLowerCase();
    const statusMatches = state.jobStatus === "all"
      || (state.jobStatus === "active" && job.status !== "Closed")
      || job.status === state.jobStatus;
    return (!query || searchable.includes(query)) &&
      (state.jobFit === "all" || job.fitLevel === state.jobFit) &&
      (state.jobCountry === "all" || job.country === state.jobCountry) &&
      statusMatches;
  });

  return jobs.sort((a, b) => {
    if (state.jobSort === "deadline") return deadlineValue(a) - deadlineValue(b) || b.priorityScore - a.priorityScore;
    if (state.jobSort === "institution") return a.university.localeCompare(b.university) || b.priorityScore - a.priorityScore;
    return b.priorityScore - a.priorityScore;
  });
}

function renderJobCard(job, index) {
  const card = node("article", "job-card");
  const priority = node("div", "priority");
  priority.append(node("span", "rank-number", String(index + 1).padStart(2, "0")));
  priority.append(node("strong", "score", String(job.priorityScore)));
  priority.append(node("span", "score-label", "match / 100"));

  const institution = node("div", "institution");
  institution.append(node("h3", "", job.university));
  institution.append(node("p", "", `${job.country} · ${job.department}`));
  const chips = node("div", "chip-row");
  chips.append(node("span", `chip fit-${job.fitLevel.toLowerCase()}`, `${job.fitLevel} fit`));
  chips.append(node("span", `chip status-chip status-${job.status.toLowerCase()}`, job.status));
  if (job.changeType && job.changeType !== "Unchanged") chips.append(node("span", "chip change-chip", job.changeType));
  if (job.postingAgeStatus === "Older than 6 months — reconfirm") chips.append(node("span", "chip age-warning", "6+ months — reconfirm"));
  if (job.postingAgeStatus === "Date unavailable") chips.append(node("span", "chip age-unknown", "Posted date unknown"));
  institution.append(chips);
  institution.append(node("p", "score-breakdown", scoreBreakdown(job)));

  const role = node("div", "role");
  role.append(node("h3", "", job.title));
  role.append(node("p", "employment", job.rankTrack));
  role.append(node("p", "field", job.researchArea));
  role.append(node("p", "recommendation", job.fitNote));
  if (job.collaborationFaculty?.length) {
    const collaborators = node("div", "collaborators");
    collaborators.append(node("strong", "", "Potential collaborators"));
    const list = node("ul", "");
    for (const person of job.collaborationFaculty) {
      const item = node("li", "");
      const link = node("a", "", person.name);
      link.href = person.profileUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      item.append(link, document.createTextNode(` — ${person.areas}`));
      if (person.venueEvidence) item.append(node("span", "venue-evidence", person.venueEvidence));
      list.append(item);
    }
    collaborators.append(list);
    role.append(collaborators);
  }

  const meta = node("div", "meta");
  const remaining = daysUntil(job.finalDeadline);
  const deadline = node("div", `deadline${remaining !== null && remaining >= 0 && remaining <= 30 ? " urgent" : ""}`);
  deadline.append(node("strong", "", remaining !== null && remaining >= 0 ? `D-${remaining}` : job.status));
  deadline.append(document.createTextNode(`Final: ${job.finalDeadline || "Not stated"}`));
  const review = node("div", "salary");
  review.append(node("strong", "", `Review: ${job.priorityDate || "Not stated"}`));
  review.append(document.createTextNode(`Verified ${job.lastVerified}`));
  const link = node("a", "source-link", "Official posting ↗");
  link.href = job.officialUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-label", `Open original posting for ${job.title}`);
  meta.append(deadline, review, link);

  card.append(priority, institution, role, meta);
  return card;
}

function renderJobs() {
  const jobs = filteredJobs();
  elements.jobList.replaceChildren(...jobs.map(renderJobCard));
  elements.jobResultCount.textContent = `${jobs.length} of ${state.jobs.length} tracked searches`;
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

  const active = state.jobs.filter((job) => job.status !== "Closed");
  const direct = active.filter((job) => job.fitLevel === "Direct").length;
  const ageChecks = active.filter((job) => job.postingAgeStatus !== "Under 6 months").length;
  elements.heroEyebrow.textContent = "US R1 · KOREA · SINGAPORE · SELECT UK";
  elements.pageTitle.innerHTML = "Faculty openings<br><em>worth tracking.</em>";
  elements.heroCopy.textContent = "Tenure-track and permanent faculty searches ranked by research fit, evidenced collaborators, and relevant institutional strength—not by deadline alone.";
  elements.updatedAt.textContent = state.jobPayload ? formatGeneratedAt(state.jobPayload) : "Loading the latest job scan…";
  elements.primaryCount.textContent = state.jobPayload ? active.length : "—";
  elements.secondaryCount.textContent = state.jobPayload ? direct : "—";
  elements.urgentCount.textContent = state.jobPayload ? ageChecks : "—";
  elements.primaryLabel.textContent = "open faculty searches";
  elements.secondaryLabel.textContent = "direct-fit searches";
  elements.urgentLabel.textContent = "posting ages to confirm";
  document.title = "Faculty Radar · HCI · XR Career Radar";
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

function populateCountries() {
  const countries = [...new Set(state.jobs.map((job) => job.country).filter(Boolean))].sort();
  for (const country of countries) {
    const option = node("option", "", country);
    option.value = country;
    elements.jobCountry.append(option);
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
  elements.jobFit.addEventListener("change", (event) => { state.jobFit = event.target.value; renderJobs(); });
  elements.jobCountry.addEventListener("change", (event) => { state.jobCountry = event.target.value; renderJobs(); });
  elements.jobStatus.addEventListener("change", (event) => { state.jobStatus = event.target.value; renderJobs(); });
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
    populateCountries();
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
    state.funding = payload.opportunities.filter((item) => !hasPassedDeadline(item));
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
