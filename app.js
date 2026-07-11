const STATUS_GROUPS = [
  { id: "saved", label: "Saved" },
  { id: "preparing", label: "Preparing" },
  { id: "applied", label: "Applied" },
  { id: "interviewing", label: "Interviewing" },
  { id: "closed", label: "Closed" }
];

const STATUS_LABELS = {
  saved: "Saved",
  preparing: "Preparing",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  ghosted: "Ghosted",
  closed: "Closed"
};

const PRIORITY_ORDER = [
  "A+",
  "A",
  "A-",
  "A-/B+",
  "B+",
  "B",
  "B-",
  "C",
  "Closed / archive"
];

const SANDY_MESSAGES = [
  "Every champion was once a contender who refused to give up. 🥊",
  "Remember, the mind is your best muscle. 💪",
  "All I wanna do is go the distance. 🏁",
  "You are gonna have to go through hell. Keep going. 🔥",
  "It ain't about how hard you hit. It is about how hard you can get hit and keep moving forward. 🥊",
  "Going in one more round when you do not think you can. That is what makes the difference. 🏆",
  "To beat me, he is going to have to kill me. ❤️",
  "All I wanna do is go the distance. ⭐",
  "Time takes everybody out. Make this round count. ⏳",
  "Life is unfair. Get over it. 🥊",
  "Nobody owes nobody nothing. You owe yourself. 💙",
  "Winners are the ones who really listen to the truth of their hearts. ✨",
  "Life is about how many hits you can take and still keep moving forward. That is how winning is done. 🥊",
  "Our greatest glory is not in falling, but rising every time we fall. 🌊",
  "If you know what you are worth, go out and get what you are worth. 🎯",
  "I do not know if you are special. Only you are gonna know that. 🌟",
  "The world ain't all sunshine and rainbows. Nobody is gonna hit as hard as life. Keep moving. 🌧️",
  "Until you start believing in yourself, you ain't gonna have a life. 💫",
  "Every champion was a contender that refused to give up. 🏆"
];

const state = {
  applications: [],
  cvs: [],
  contacts: [],
  query: "",
  statusFilter: "all",
  sourceFilter: "all",
  tagFilter: "all"
};

const cvFileDb = {
  name: "careerWithSandyFiles",
  store: "cvFiles",
  version: 1
};

let cvDbPromise;
let pendingCvFile = null;
let draggedJobId = null;

const els = {
  board: document.querySelector("#board"),
  applicationRows: document.querySelector("#applicationRows"),
  cvGrid: document.querySelector("#cvGrid"),
  contactGrid: document.querySelector("#contactGrid"),
  searchInput: document.querySelector("#searchInput"),
  statusFilter: document.querySelector("#statusFilter"),
  sourceFilter: document.querySelector("#sourceFilter"),
  tagFilter: document.querySelector("#tagFilter"),
  dashboardClock: document.querySelector("#dashboardClock"),
  metricActive: document.querySelector("#metricActive"),
  metricApplied: document.querySelector("#metricApplied"),
  metricInterviews: document.querySelector("#metricInterviews"),
  metricResponse: document.querySelector("#metricResponse"),
  jobDialog: document.querySelector("#jobDialog"),
  cvDialog: document.querySelector("#cvDialog"),
  contactDialog: document.querySelector("#contactDialog")
};

const jobForm = document.querySelector("#jobForm");
const cvForm = document.querySelector("#cvForm");
const contactForm = document.querySelector("#contactForm");
const appShell = document.querySelector(".app-shell");

function uid(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(dateText) {
  if (!dateText) return null;
  const start = new Date(`${dateText}T00:00:00`);
  const now = new Date(`${today()}T00:00:00`);
  return Math.round((now - start) / 86400000);
}

function formatClock() {
  const now = new Date();
  els.dashboardClock.textContent = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(now);
}

function save() {
  localStorage.setItem("jobSearchCommandCenter", JSON.stringify(state));
}

function setSidebarClosed(isClosed) {
  appShell.classList.toggle("sidebar-closed", isClosed);
  localStorage.setItem("careerWithSandySidebarClosed", isClosed ? "true" : "false");
}

function parseTags(value) {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag, index, tags) => tags.findIndex((item) => item.toLowerCase() === tag.toLowerCase()) === index);
}

function tagsText(tags) {
  return (tags || []).join(", ");
}

function priorityTag(priority) {
  const value = String(priority || "").trim();
  if (!value) return "";
  return value.split(" - ")[0].trim();
}

function pipelineTags(row) {
  const tags = [
    priorityTag(row.Priority),
    row.Role_Family ? row.Role_Family.split("/")[0].trim() : "",
    String(row.Work_Model || "").toLowerCase().includes("remote") ? "Remote" : ""
  ];
  return parseTags(tags.join(","));
}

function priorityRank(job) {
  const tags = job.tags || [];
  const exactPriority = tags.find((tag) => PRIORITY_ORDER.includes(tag));
  if (exactPriority) return PRIORITY_ORDER.indexOf(exactPriority);

  const normalized = tags.map((tag) => tag.toLowerCase());
  if (normalized.some((tag) => tag.includes("apply first") || tag.includes("apply immediately"))) return 0;
  if (normalized.some((tag) => tag.includes("interested") || tag.includes("priority"))) return 2;
  return PRIORITY_ORDER.length;
}

function extractDateFound(job) {
  return String(job.notes || "").match(/Date found: (\d{4}-\d{2}-\d{2})/)?.[1] || "";
}

function sortDateKey(job) {
  return job.nextActionDate || job.appliedDate || extractDateFound(job) || "9999-12-31";
}

function compareJobs(first, second) {
  const priorityDifference = priorityRank(first) - priorityRank(second);
  if (priorityDifference) return priorityDifference;

  const timeDifference = sortDateKey(first).localeCompare(sortDateKey(second));
  if (timeDifference) return timeDifference;

  return `${first.company} ${first.role}`.localeCompare(`${second.company} ${second.role}`);
}

function load() {
  const stored = localStorage.getItem("jobSearchCommandCenter");
  if (stored) {
    const parsed = JSON.parse(stored);
    state.applications = parsed.applications || [];
    state.cvs = parsed.cvs || [];
    state.contacts = parsed.contacts || [];
    return;
  }

  state.cvs = [
    {
      id: uid("cv"),
      name: "General CV v1",
      focus: "General applications",
      fileName: "",
      fileType: "",
      fileSize: 0,
      hasStoredFile: false,
      updated: today(),
      notes: "Baseline version. Add links to your real CV files when ready."
    }
  ];
  state.contacts = [];
  state.applications = [
    {
      id: uid("job"),
      role: "Example Product Analyst",
      company: "Example Co",
      jobLink: "https://example.com/job",
      source: "LinkedIn",
      status: "saved",
      location: "London / hybrid",
      salary: "",
      appliedDate: "",
      nextAction: "Tailor CV",
      nextActionDate: today(),
      tags: ["Example"],
      cvVersion: state.cvs[0].id,
      contactId: "",
      description: "Paste job descriptions here to track keywords.",
      notes: "Replace this sample with a real opportunity."
    }
  ];
  save();
}

function filteredApplications() {
  const query = state.query.trim().toLowerCase();
  return state.applications.filter((job) => {
    const haystack = [
      job.role,
      job.company,
      job.source,
      job.location,
      job.description,
      job.notes,
      ...(job.tags || []),
      STATUS_LABELS[job.status]
    ].join(" ").toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    const matchesStatus = state.statusFilter === "all" || job.status === state.statusFilter;
    const matchesSource = state.sourceFilter === "all" || job.source === state.sourceFilter;
    const matchesTag = state.tagFilter === "all" || (job.tags || []).some((tag) => tag === state.tagFilter);
    return matchesQuery && matchesStatus && matchesSource && matchesTag;
  }).sort(compareJobs);
}

function getCvName(id) {
  return state.cvs.find((cv) => cv.id === id)?.name || "Not selected";
}

function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function openCvDb() {
  if (cvDbPromise) return cvDbPromise;
  cvDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(cvFileDb.name, cvFileDb.version);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(cvFileDb.store);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return cvDbPromise;
}

async function storeCvFile(cvId, file) {
  const db = await openCvDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(cvFileDb.store, "readwrite");
    transaction.objectStore(cvFileDb.store).put(file, cvId);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

async function getStoredCvFile(cvId) {
  const db = await openCvDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(cvFileDb.store, "readonly");
    const request = transaction.objectStore(cvFileDb.store).get(cvId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function deleteStoredCvFile(cvId) {
  const db = await openCvDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(cvFileDb.store, "readwrite");
    transaction.objectStore(cvFileDb.store).delete(cvId);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

function getContactName(id) {
  return state.contacts.find((person) => person.id === id)?.name || "No contact";
}

function cvIdForName(name) {
  if (!name) return "";
  let cv = state.cvs.find((item) => item.name === name);
  if (!cv) {
    cv = {
      id: uid("cv"),
      name,
      focus: name,
      fileName: "",
      fileType: "",
      fileSize: 0,
      hasStoredFile: false,
      updated: today(),
      notes: "Imported from Sophia job-search pipeline. Choose the local CV file when it is ready."
    };
    state.cvs.push(cv);
  }
  return cv.id;
}

function contactIdForPipeline(row) {
  if (!row.Referral_or_Contact) return "";
  const name = row.Referral_or_Contact.split(" - ")[0].trim();
  let person = state.contacts.find((item) => item.name === name && item.company === row.Company);
  if (!person) {
    person = {
      id: uid("person"),
      name,
      company: row.Company,
      role: row.Referral_or_Contact.replace(name, "").replace(/^ - /, "") || "Contact",
      link: row.Referral_or_Contact.includes("@") ? `mailto:${row.Referral_or_Contact.split(" ").find((part) => part.includes("@"))}` : "",
      lastContact: "",
      nextDate: row.Next_Action_Due || "",
      notes: [row.Referral_or_Contact, row.Networking_Status].filter(Boolean).join("\n")
    };
    state.contacts.push(person);
  }
  return person.id;
}

function mapPipelineStatus(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("deadline") || normalized.includes("closed") || normalized.includes("archive")) return "closed";
  if (normalized.includes("interview")) return "interviewing";
  if (normalized.includes("applied")) return "applied";
  if (normalized.includes("ready")) return "preparing";
  return "saved";
}

function fieldLine(label, value) {
  return value ? `${label}: ${value}` : "";
}

function pipelineToApplication(row) {
  const cvVersion = cvIdForName(row.CV_Version);
  const contactId = contactIdForPipeline(row);
  return {
    id: `sophia-${row.Job_ID}`,
    sourceId: row.Job_ID,
    role: row.Role_Title || "",
    company: row.Company || "",
    jobLink: row.Job_Link || "",
    source: row.Source || "",
    status: mapPipelineStatus(row.Status),
    location: [row.Location, row.Country, row.Work_Model].filter(Boolean).join(" | "),
    salary: row.Salary || "",
    appliedDate: row.Applied_Date || "",
    nextAction: row.Next_Action || "",
    nextActionDate: row.Next_Action_Due || row.Follow_Up_Date || "",
    tags: pipelineTags(row),
    cvVersion,
    contactId,
    description: [
      fieldLine("Role family", row.Role_Family),
      fieldLine("Seniority", row.Seniority),
      fieldLine("Key requirements", row.Key_Requirements),
      fieldLine("Match evidence", row.Match_Evidence),
      fieldLine("Skill gaps", row.Skill_Gaps)
    ].filter(Boolean).join("\n\n"),
    notes: [
      fieldLine("Pipeline ID", row.Job_ID),
      fieldLine("Priority", row.Priority),
      fieldLine("Original status", row.Status),
      fieldLine("Date found", row.Date_Found),
      fieldLine("Deadline", row.Application_Deadline),
      fieldLine("Match score /10", row.Match_Score_10),
      fieldLine("Interest score /10", row.Interest_Score_10),
      fieldLine("Visa feasibility /10", row.Visa_Feasibility_10),
      fieldLine("Urgency score /10", row.Urgency_Score_10),
      fieldLine("Application effort /5", row.Application_Effort_5),
      fieldLine("Strategic score /100", row.Strategic_Score_100),
      fieldLine("Visa sponsorship", row.Visa_Sponsorship),
      fieldLine("Relocation support", row.Relocation_Support),
      fieldLine("Japanese requirement", row.Japanese_Requirement),
      fieldLine("Cover letter", row.Cover_Letter_Status),
      fieldLine("Networking", row.Networking_Status),
      fieldLine("Interview stage", row.Interview_Stage),
      fieldLine("Outcome", row.Outcome),
      fieldLine("Notes", row.Notes)
    ].filter(Boolean).join("\n")
  };
}

function importSophiaPipeline({ silent = false } = {}) {
  const rows = window.SOPHIA_PIPELINE || [];
  const version = window.SOPHIA_PIPELINE_VERSION || "legacy";
  if (!rows.length) return 0;
  const imported = rows.map(pipelineToApplication);
  const importedIds = new Set(imported.map((job) => job.sourceId));
  state.applications = state.applications
    .filter((job) => !importedIds.has(job.sourceId) && job.company !== "Example Co")
    .concat(imported);
  localStorage.setItem("careerWithSandySophiaPipelineImported", "true");
  localStorage.setItem("careerWithSandySophiaPipelineVersion", version);
  save();
  render();
  if (!silent) {
    const bubble = document.querySelector("#sandyBubble");
    bubble.textContent = `Imported ${imported.length} Sophia pipeline jobs.`;
    bubble.classList.add("show");
    clearTimeout(sandyBubbleTimer);
    sandyBubbleTimer = setTimeout(() => bubble.classList.remove("show"), 5200);
  }
  return imported.length;
}

function groupForStatus(status) {
  if (["offer", "rejected", "ghosted", "closed"].includes(status)) return "closed";
  return status || "saved";
}

function statusForColumn(columnId) {
  return columnId === "closed" ? "closed" : columnId;
}

function renderStatusTags(selected = "saved") {
  const current = STATUS_LABELS[selected] ? selected : "saved";
  const statusInput = document.querySelector("#status");
  const statusTagRow = document.querySelector("#statusTagRow");
  statusInput.value = current;
  statusTagRow.innerHTML = Object.entries(STATUS_LABELS)
    .map(([value, label]) => `
      <button class="tag status-choice ${value === current ? "selected" : ""}" data-status="${value}" type="button" role="radio" aria-checked="${value === current}">
        ${escapeHtml(label)}
      </button>
    `)
    .join("");
}

function setJobTags(tags) {
  const uniqueTags = parseTags(tagsText(tags));
  document.querySelector("#jobTags").value = tagsText(uniqueTags);
  document.querySelector("#jobTagChips").innerHTML = uniqueTags.length
    ? uniqueTags.map((tag) => `
      <button class="tag custom-tag removable-tag" data-tag="${escapeHtml(tag)}" type="button" aria-label="Remove ${escapeHtml(tag)}">
        ${escapeHtml(tag)} <span aria-hidden="true">×</span>
      </button>
    `).join("")
    : '<span class="empty-tag-note">No tags yet</span>';
}

function addJobTag() {
  const input = document.querySelector("#tagEntry");
  const nextTag = input.value.trim();
  if (!nextTag) return;
  setJobTags(parseTags(`${document.querySelector("#jobTags").value},${nextTag}`));
  input.value = "";
  input.focus();
}

function countdownInfo(job) {
  if (job.nextActionDate) {
    const daysLate = daysBetween(job.nextActionDate);
    if (daysLate === 0) return { label: "Due today", tone: "due" };
    if (daysLate > 0) return { label: `${daysLate} day${daysLate === 1 ? "" : "s"} late`, tone: "overdue" };
    const daysLeft = Math.abs(daysLate);
    return { label: `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`, tone: "good" };
  }

  if (job.appliedDate) {
    const daysSince = daysBetween(job.appliedDate);
    return { label: `${daysSince} day${daysSince === 1 ? "" : "s"} since applied`, tone: "quiet" };
  }

  return { label: "No due date", tone: "quiet" };
}

function countdownTag(job) {
  const countdown = countdownInfo(job);
  return `<span class="tag countdown-tag ${countdown.tone}">${escapeHtml(countdown.label)}</span>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderMetrics() {
  const active = state.applications.filter((job) => !["offer", "rejected", "ghosted", "closed"].includes(job.status)).length;
  const applied = state.applications.filter((job) => ["applied", "interviewing", "offer", "rejected", "ghosted"].includes(job.status)).length;
  const interviews = state.applications.filter((job) => ["interviewing", "offer"].includes(job.status)).length;
  const responses = state.applications.filter((job) => ["interviewing", "offer", "rejected"].includes(job.status)).length;
  const rate = applied ? Math.round((responses / applied) * 100) : 0;

  els.metricActive.textContent = active;
  els.metricApplied.textContent = applied;
  els.metricInterviews.textContent = interviews;
  els.metricResponse.textContent = `${rate}%`;
}

function renderFilters() {
  const sources = [...new Set(state.applications.map((job) => job.source).filter(Boolean))].sort();
  const tags = [...new Set(state.applications.flatMap((job) => job.tags || []))].sort((a, b) => a.localeCompare(b));
  els.statusFilter.innerHTML = `<option value="all">All statuses</option>${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}`;
  els.sourceFilter.innerHTML = `<option value="all">All sources</option>${sources.map((source) => `<option value="${escapeHtml(source)}">${escapeHtml(source)}</option>`).join("")}`;
  els.tagFilter.innerHTML = `<option value="all">All tags</option>${tags.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join("")}`;
  els.statusFilter.value = state.statusFilter;
  els.sourceFilter.value = state.sourceFilter;
  els.tagFilter.value = tags.includes(state.tagFilter) ? state.tagFilter : "all";
  state.tagFilter = els.tagFilter.value;
}

function renderBoard() {
  const jobs = filteredApplications();
  els.board.innerHTML = STATUS_GROUPS.map((group) => {
    const groupJobs = jobs.filter((job) => groupForStatus(job.status) === group.id);
    const cards = groupJobs.map(renderJobCard).join("");
    return `
      <section class="column" data-status="${group.id}">
        <h3>${group.label}<span class="column-count">${groupJobs.length}</span></h3>
        ${cards || '<div class="empty-state">No applications here yet.</div>'}
      </section>
    `;
  }).join("");
}

function renderJobCard(job) {
  const nextDays = daysBetween(job.nextActionDate);
  const nextTag = job.nextActionDate
    ? `<span class="tag ${nextDays !== null && nextDays >= 0 ? "warn" : "good"}">${escapeHtml(job.nextActionDate)}</span>`
    : "";
  return `
    <article class="job-card" draggable="true" data-id="${job.id}">
      <div>
        <h4>${escapeHtml(job.role)}</h4>
        <p>${escapeHtml(job.company)}</p>
      </div>
      <div class="tag-row">
        <span class="tag">${escapeHtml(STATUS_LABELS[job.status] || job.status)}</span>
        ${job.source ? `<span class="tag">${escapeHtml(job.source)}</span>` : ""}
        ${nextTag}
        ${countdownTag(job)}
        ${(job.tags || []).map((tag) => `<span class="tag custom-tag">${escapeHtml(tag)}</span>`).join("")}
      </div>
      <p>${escapeHtml(job.nextAction || "No next action set")}</p>
      <button class="secondary-action edit-job" data-id="${job.id}" type="button">Open</button>
    </article>
  `;
}

function renderRows() {
  const jobs = filteredApplications();
  els.applicationRows.innerHTML = jobs.length
    ? jobs.map((job) => `
      <tr>
        <td><button class="link-button edit-job" data-id="${job.id}" type="button">${escapeHtml(job.role)}</button></td>
        <td>${escapeHtml(job.company)}</td>
        <td>${escapeHtml(STATUS_LABELS[job.status] || job.status)}</td>
        <td>${(job.tags || []).map((tag) => `<span class="tag custom-tag">${escapeHtml(tag)}</span>`).join("")}</td>
        <td>${countdownTag(job)}</td>
        <td>${escapeHtml(job.appliedDate || "Not yet")}</td>
        <td>${escapeHtml(getCvName(job.cvVersion))}</td>
        <td>${escapeHtml(job.nextAction || "")}</td>
      </tr>
    `).join("")
    : '<tr><td colspan="8">No applications match your filters.</td></tr>';
}

function renderCvs() {
  els.cvGrid.innerHTML = state.cvs.length
    ? state.cvs.map((cv) => {
      const usedCount = state.applications.filter((job) => job.cvVersion === cv.id).length;
      return `
        <article class="cv-card">
          <h3>${escapeHtml(cv.name)}</h3>
          <p>${escapeHtml(cv.focus || "No role focus")}</p>
          <div class="tag-row">
            <span class="tag">${usedCount} application${usedCount === 1 ? "" : "s"}</span>
            ${cv.updated ? `<span class="tag">Updated ${escapeHtml(cv.updated)}</span>` : ""}
          </div>
          ${cv.fileName ? `<p>${escapeHtml(cv.fileName)} ${cv.fileSize ? `(${escapeHtml(formatFileSize(cv.fileSize))})` : ""}</p>` : ""}
          <p>${escapeHtml(cv.notes || "")}</p>
          ${cv.hasStoredFile ? `<button class="secondary-action open-cv-file" data-id="${cv.id}" type="button">Open CV</button>` : ""}
          <button class="secondary-action edit-cv" data-id="${cv.id}" type="button">Edit</button>
        </article>
      `;
    }).join("")
    : '<div class="empty-state">Add your first CV version.</div>';
}

function renderContacts() {
  els.contactGrid.innerHTML = state.contacts.length
    ? state.contacts.map((person) => {
      const relatedCount = state.applications.filter((job) => job.contactId === person.id).length;
      return `
        <article class="contact-card">
          <h3>${escapeHtml(person.name)}</h3>
          <p>${escapeHtml([person.role, person.company].filter(Boolean).join(" at ") || "Contact")}</p>
          <div class="tag-row">
            <span class="tag">${relatedCount} linked job${relatedCount === 1 ? "" : "s"}</span>
            ${person.nextDate ? `<span class="tag warn">Follow up ${escapeHtml(person.nextDate)}</span>` : ""}
          </div>
          ${person.link ? `<p><a href="${escapeHtml(person.link)}" target="_blank" rel="noreferrer">Open profile/contact</a></p>` : ""}
          <p>${escapeHtml(person.notes || "")}</p>
          <button class="secondary-action edit-contact" data-id="${person.id}" type="button">Edit</button>
        </article>
      `;
    }).join("")
    : '<div class="empty-state">Add recruiters, referrals, alumni, and hiring managers.</div>';
}

function renderSelects() {
  renderStatusTags(document.querySelector("#status").value || "saved");
  document.querySelector("#cvVersion").innerHTML = `<option value="">No CV selected</option>${state.cvs.map((cv) => `<option value="${cv.id}">${escapeHtml(cv.name)}</option>`).join("")}`;
  document.querySelector("#contactId").innerHTML = `<option value="">No contact</option>${state.contacts.map((person) => `<option value="${person.id}">${escapeHtml(person.name)}</option>`).join("")}`;
}

function render() {
  renderMetrics();
  renderFilters();
  renderBoard();
  renderRows();
  renderCvs();
  renderContacts();
  renderSelects();
}

function fillJobForm(job = {}) {
  document.querySelector("#jobDialogTitle").textContent = job.id ? "Edit application" : "New application";
  document.querySelector("#jobId").value = job.id || "";
  document.querySelector("#role").value = job.role || "";
  document.querySelector("#company").value = job.company || "";
  document.querySelector("#jobLink").value = job.jobLink || "";
  document.querySelector("#openJobLinkButton").disabled = !job.jobLink;
  document.querySelector("#source").value = job.source || "";
  renderStatusTags(job.status || "saved");
  document.querySelector("#location").value = job.location || "";
  document.querySelector("#salary").value = job.salary || "";
  document.querySelector("#appliedDate").value = job.appliedDate || "";
  document.querySelector("#nextAction").value = job.nextAction || "";
  document.querySelector("#nextActionDate").value = job.nextActionDate || "";
  document.querySelector("#tagEntry").value = "";
  setJobTags(job.tags || []);
  document.querySelector("#cvVersion").value = job.cvVersion || "";
  document.querySelector("#contactId").value = job.contactId || "";
  document.querySelector("#description").value = job.description || "";
  document.querySelector("#notes").value = job.notes || "";
  document.querySelector("#deleteJobButton").style.visibility = job.id ? "visible" : "hidden";
}

function fillCvForm(cv = {}) {
  pendingCvFile = null;
  document.querySelector("#cvId").value = cv.id || "";
  document.querySelector("#cvName").value = cv.name || "";
  document.querySelector("#cvFocus").value = cv.focus || "";
  document.querySelector("#cvFile").value = "";
  document.querySelector("#cvFileName").textContent = cv.fileName
    ? `Current file: ${cv.fileName}${cv.fileSize ? ` (${formatFileSize(cv.fileSize)})` : ""}`
    : "No file selected yet.";
  document.querySelector("#cvUpdated").value = cv.updated || today();
  document.querySelector("#cvNotes").value = cv.notes || "";
  document.querySelector("#deleteCvButton").style.visibility = cv.id ? "visible" : "hidden";
}

function fillContactForm(person = {}) {
  document.querySelector("#personId").value = person.id || "";
  document.querySelector("#personName").value = person.name || "";
  document.querySelector("#personCompany").value = person.company || "";
  document.querySelector("#personRole").value = person.role || "";
  document.querySelector("#personLink").value = person.link || "";
  document.querySelector("#lastContact").value = person.lastContact || "";
  document.querySelector("#personNextDate").value = person.nextDate || "";
  document.querySelector("#personNotes").value = person.notes || "";
  document.querySelector("#deleteContactButton").style.visibility = person.id ? "visible" : "hidden";
}

function upsert(collection, item) {
  const index = collection.findIndex((entry) => entry.id === item.id);
  if (index >= 0) collection[index] = item;
  else collection.unshift(item);
}

function exportCsv() {
  const headers = ["role", "company", "status", "tags", "jobLink", "source", "location", "salary", "appliedDate", "nextAction", "nextActionDate", "cvVersion", "contact", "notes"];
  const rows = state.applications.map((job) => [
    job.role,
    job.company,
    STATUS_LABELS[job.status] || job.status,
    tagsText(job.tags),
    job.jobLink,
    job.source,
    job.location,
    job.salary,
    job.appliedDate,
    job.nextAction,
    job.nextActionDate,
    getCvName(job.cvVersion),
    getContactName(job.contactId),
    job.notes
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell || "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `job-search-applications-${today()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function importCsv(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const lines = String(reader.result).split(/\r?\n/).filter(Boolean);
    const imported = lines.slice(1).map((line) => {
      const cells = line.match(/("([^"]|"")*"|[^,]+)/g) || [];
      const clean = cells.map((cell) => cell.replace(/^"|"$/g, "").replaceAll('""', '"'));
      return {
        id: uid("job"),
        role: clean[0] || "",
        company: clean[1] || "",
        status: Object.entries(STATUS_LABELS).find(([, label]) => label === clean[2])?.[0] || "saved",
        tags: parseTags(clean[3] || ""),
        jobLink: clean[4] || "",
        source: clean[5] || "",
        location: clean[6] || "",
        salary: clean[7] || "",
        appliedDate: clean[8] || "",
        nextAction: clean[9] || "",
        nextActionDate: clean[10] || "",
        cvVersion: "",
        contactId: "",
        description: "",
        notes: clean[13] || ""
      };
    });
    state.applications = [...imported, ...state.applications];
    save();
    render();
  };
  reader.readAsText(file);
}

document.querySelectorAll(".nav-tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-tab").forEach((tab) => tab.classList.remove("active"));
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`#${button.dataset.view}View`).classList.add("active");
  });
});

document.querySelector("#addJobButton").addEventListener("click", () => {
  fillJobForm({ nextActionDate: today() });
  els.jobDialog.showModal();
});

document.querySelector("#jobLink").addEventListener("input", (event) => {
  document.querySelector("#openJobLinkButton").disabled = !event.target.value.trim();
});

document.querySelector("#openJobLinkButton").addEventListener("click", () => {
  const value = document.querySelector("#jobLink").value.trim();
  if (!value) return;
  const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.click();
});

document.querySelector("#addCvButton").addEventListener("click", () => {
  fillCvForm();
  els.cvDialog.showModal();
});

document.querySelector("#addContactButton").addEventListener("click", () => {
  fillContactForm();
  els.contactDialog.showModal();
});

document.querySelector("#closeSidebarButton").addEventListener("click", () => {
  setSidebarClosed(true);
});

document.querySelector("#openSidebarButton").addEventListener("click", () => {
  setSidebarClosed(false);
});

document.addEventListener("click", (event) => {
  const cancelButton = event.target.closest(".dialog-cancel");
  if (cancelButton) {
    cancelButton.closest("dialog")?.close();
    return;
  }

  const jobButton = event.target.closest(".edit-job");
  const cvButton = event.target.closest(".edit-cv");
  const contactButton = event.target.closest(".edit-contact");
  const jobCard = event.target.closest(".job-card");
  const interactiveTarget = event.target.closest("button, a, input, select, textarea, label");

  if (jobButton) {
    const job = state.applications.find((item) => item.id === jobButton.dataset.id);
    fillJobForm(job);
    els.jobDialog.showModal();
    return;
  }

  if (jobCard && !interactiveTarget) {
    const job = state.applications.find((item) => item.id === jobCard.dataset.id);
    fillJobForm(job);
    els.jobDialog.showModal();
    return;
  }

  if (cvButton) {
    const cv = state.cvs.find((item) => item.id === cvButton.dataset.id);
    fillCvForm(cv);
    els.cvDialog.showModal();
  }

  if (contactButton) {
    const person = state.contacts.find((item) => item.id === contactButton.dataset.id);
    fillContactForm(person);
    els.contactDialog.showModal();
  }

  const openCvButton = event.target.closest(".open-cv-file");
  if (openCvButton) {
    openStoredCv(openCvButton.dataset.id);
  }
});

els.board.addEventListener("dragstart", (event) => {
  const card = event.target.closest(".job-card");
  if (!card) return;
  draggedJobId = card.dataset.id;
  card.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedJobId);
});

els.board.addEventListener("dragend", () => {
  draggedJobId = null;
  document.querySelectorAll(".job-card.dragging, .column.drag-over").forEach((element) => {
    element.classList.remove("dragging", "drag-over");
  });
});

els.board.addEventListener("dragover", (event) => {
  const column = event.target.closest(".column");
  if (!column || !draggedJobId) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  document.querySelectorAll(".column.drag-over").forEach((element) => {
    if (element !== column) element.classList.remove("drag-over");
  });
  column.classList.add("drag-over");
});

els.board.addEventListener("dragleave", (event) => {
  const column = event.target.closest(".column");
  if (!column || column.contains(event.relatedTarget)) return;
  column.classList.remove("drag-over");
});

els.board.addEventListener("drop", (event) => {
  const column = event.target.closest(".column");
  if (!column) return;
  event.preventDefault();
  const jobId = event.dataTransfer.getData("text/plain") || draggedJobId;
  const job = state.applications.find((item) => item.id === jobId);
  if (!job) return;
  const nextStatus = statusForColumn(column.dataset.status);
  job.status = nextStatus;
  if (nextStatus === "applied" && !job.appliedDate) {
    job.appliedDate = today();
  }
  save();
  render();
});

jobForm.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const item = {
    id: document.querySelector("#jobId").value || uid("job"),
    role: document.querySelector("#role").value,
    company: document.querySelector("#company").value,
    jobLink: document.querySelector("#jobLink").value,
    source: document.querySelector("#source").value,
    status: document.querySelector("#status").value,
    location: document.querySelector("#location").value,
    salary: document.querySelector("#salary").value,
    appliedDate: document.querySelector("#appliedDate").value,
    nextAction: document.querySelector("#nextAction").value,
    nextActionDate: document.querySelector("#nextActionDate").value,
    tags: parseTags(document.querySelector("#jobTags").value),
    cvVersion: document.querySelector("#cvVersion").value,
    contactId: document.querySelector("#contactId").value,
    description: document.querySelector("#description").value,
    notes: document.querySelector("#notes").value
  };
  upsert(state.applications, item);
  save();
  render();
  els.jobDialog.close();
});

cvForm.addEventListener("submit", async (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const id = document.querySelector("#cvId").value || uid("cv");
  const existing = state.cvs.find((cv) => cv.id === id) || {};
  if (pendingCvFile) {
    await storeCvFile(id, pendingCvFile);
  }
  const item = {
    id,
    name: document.querySelector("#cvName").value,
    focus: document.querySelector("#cvFocus").value,
    fileName: pendingCvFile?.name || existing.fileName || "",
    fileType: pendingCvFile?.type || existing.fileType || "",
    fileSize: pendingCvFile?.size || existing.fileSize || 0,
    hasStoredFile: Boolean(pendingCvFile || existing.hasStoredFile),
    updated: document.querySelector("#cvUpdated").value,
    notes: document.querySelector("#cvNotes").value
  };
  upsert(state.cvs, item);
  save();
  render();
  els.cvDialog.close();
});

contactForm.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const item = {
    id: document.querySelector("#personId").value || uid("person"),
    name: document.querySelector("#personName").value,
    company: document.querySelector("#personCompany").value,
    role: document.querySelector("#personRole").value,
    link: document.querySelector("#personLink").value,
    lastContact: document.querySelector("#lastContact").value,
    nextDate: document.querySelector("#personNextDate").value,
    notes: document.querySelector("#personNotes").value
  };
  upsert(state.contacts, item);
  save();
  render();
  els.contactDialog.close();
});

document.querySelector("#deleteJobButton").addEventListener("click", () => {
  const id = document.querySelector("#jobId").value;
  state.applications = state.applications.filter((job) => job.id !== id);
  save();
  render();
  els.jobDialog.close();
});

document.querySelector("#deleteCvButton").addEventListener("click", async () => {
  const id = document.querySelector("#cvId").value;
  await deleteStoredCvFile(id);
  state.cvs = state.cvs.filter((cv) => cv.id !== id);
  state.applications = state.applications.map((job) => job.cvVersion === id ? { ...job, cvVersion: "" } : job);
  save();
  render();
  els.cvDialog.close();
});

document.querySelector("#deleteContactButton").addEventListener("click", () => {
  const id = document.querySelector("#personId").value;
  state.contacts = state.contacts.filter((person) => person.id !== id);
  state.applications = state.applications.map((job) => job.contactId === id ? { ...job, contactId: "" } : job);
  save();
  render();
  els.contactDialog.close();
});

els.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

els.statusFilter.addEventListener("change", (event) => {
  state.statusFilter = event.target.value;
  render();
});

els.sourceFilter.addEventListener("change", (event) => {
  state.sourceFilter = event.target.value;
  render();
});

els.tagFilter.addEventListener("change", (event) => {
  state.tagFilter = event.target.value;
  render();
});

document.querySelector("#exportButton").addEventListener("click", exportCsv);
document.querySelector("#importSophiaButton").addEventListener("click", () => {
  importSophiaPipeline();
});
document.querySelector("#importInput").addEventListener("change", (event) => {
  if (event.target.files[0]) importCsv(event.target.files[0]);
});

document.querySelector("#statusTagRow").addEventListener("click", (event) => {
  const choice = event.target.closest(".status-choice");
  if (!choice) return;
  renderStatusTags(choice.dataset.status);
});

document.querySelector("#addTagButton").addEventListener("click", addJobTag);

document.querySelector("#tagEntry").addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  addJobTag();
});

document.querySelector("#jobTagChips").addEventListener("click", (event) => {
  const chip = event.target.closest(".removable-tag");
  if (!chip) return;
  const nextTags = parseTags(document.querySelector("#jobTags").value)
    .filter((tag) => tag !== chip.dataset.tag);
  setJobTags(nextTags);
});

document.querySelector("#cvFile").addEventListener("change", (event) => {
  pendingCvFile = event.target.files[0] || null;
  document.querySelector("#cvFileName").textContent = pendingCvFile
    ? `Selected: ${pendingCvFile.name} (${formatFileSize(pendingCvFile.size)})`
    : "No file selected yet.";
});

async function openStoredCv(cvId) {
  const cv = state.cvs.find((item) => item.id === cvId);
  const file = await getStoredCvFile(cvId);
  if (!file) return;
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.download = cv?.fileName || "cv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

let sandyMessageIndex = -1;
let sandyBubbleTimer;
let sandyDrag = null;

function moveSandyTo(left, top) {
  const wrap = document.querySelector(".sandy-float-wrap");
  const rect = wrap.getBoundingClientRect();
  const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
  const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
  const nextLeft = Math.min(Math.max(8, left), maxLeft);
  const nextTop = Math.min(Math.max(8, top), maxTop);
  wrap.style.left = `${nextLeft}px`;
  wrap.style.top = `${nextTop}px`;
  wrap.style.right = "auto";
  wrap.style.bottom = "auto";
  localStorage.setItem("jobHuntingWithSandyPosition", JSON.stringify({ left: nextLeft, top: nextTop }));
}

function restoreSandyPosition() {
  const stored = localStorage.getItem("jobHuntingWithSandyPosition");
  if (!stored) return;
  try {
    const position = JSON.parse(stored);
    if (Number.isFinite(position.left) && Number.isFinite(position.top)) {
      moveSandyTo(position.left, position.top);
    }
  } catch {
    localStorage.removeItem("jobHuntingWithSandyPosition");
  }
}

function encourageWithSandy() {
  const bubble = document.querySelector("#sandyBubble");
  sandyMessageIndex = (sandyMessageIndex + 1) % SANDY_MESSAGES.length;
  bubble.textContent = SANDY_MESSAGES[sandyMessageIndex];
  bubble.classList.add("show");
  clearTimeout(sandyBubbleTimer);
  sandyBubbleTimer = setTimeout(() => {
    bubble.classList.remove("show");
  }, 5200);
}

document.querySelector("#sandyFloat").addEventListener("pointerdown", (event) => {
  const wrap = document.querySelector(".sandy-float-wrap");
  const rect = wrap.getBoundingClientRect();
  sandyDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    moved: false
  };
  event.currentTarget.setPointerCapture(event.pointerId);
});

document.querySelector("#sandyFloat").addEventListener("pointermove", (event) => {
  if (!sandyDrag || sandyDrag.pointerId !== event.pointerId) return;
  const distance = Math.hypot(event.clientX - sandyDrag.startX, event.clientY - sandyDrag.startY);
  if (distance > 4) {
    sandyDrag.moved = true;
    document.querySelector(".sandy-float-wrap").classList.add("dragging");
  }
  if (!sandyDrag.moved) return;
  moveSandyTo(event.clientX - sandyDrag.offsetX, event.clientY - sandyDrag.offsetY);
});

document.querySelector("#sandyFloat").addEventListener("pointerup", (event) => {
  if (!sandyDrag || sandyDrag.pointerId !== event.pointerId) return;
  const wasDrag = sandyDrag.moved;
  document.querySelector(".sandy-float-wrap").classList.remove("dragging");
  sandyDrag = null;
  if (!wasDrag) {
    encourageWithSandy();
  }
});

window.addEventListener("resize", restoreSandyPosition);

document.querySelector("#sandyFloat").addEventListener("click", (event) => {
  event.preventDefault();
});

setSidebarClosed(localStorage.getItem("careerWithSandySidebarClosed") === "true");
restoreSandyPosition();
formatClock();
setInterval(formatClock, 1000);
load();
if (localStorage.getItem("careerWithSandySophiaPipelineVersion") !== (window.SOPHIA_PIPELINE_VERSION || "legacy")) {
  importSophiaPipeline({ silent: true });
} else {
  render();
}
