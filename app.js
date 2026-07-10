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

const SANDY_MESSAGES = [
  "One application at a time. Sandy believes in your quiet consistency.",
  "You do not need to be perfect today. You just need the next tiny step.",
  "That CV version is part of the journey. Keep going.",
  "A no is data, not a verdict. Sandy is still sitting with you.",
  "Follow up gently. Future you will be grateful.",
  "You are building momentum, even when it feels invisible.",
  "Save the link now. Make it beautiful later.",
  "Your next opportunity can start from one calm click."
];

const state = {
  applications: [],
  cvs: [],
  contacts: [],
  query: "",
  statusFilter: "all",
  sourceFilter: "all"
};

const els = {
  board: document.querySelector("#board"),
  applicationRows: document.querySelector("#applicationRows"),
  cvGrid: document.querySelector("#cvGrid"),
  contactGrid: document.querySelector("#contactGrid"),
  remindersPanel: document.querySelector("#remindersPanel"),
  searchInput: document.querySelector("#searchInput"),
  statusFilter: document.querySelector("#statusFilter"),
  sourceFilter: document.querySelector("#sourceFilter"),
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

function save() {
  localStorage.setItem("jobSearchCommandCenter", JSON.stringify(state));
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
      link: "",
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
      STATUS_LABELS[job.status]
    ].join(" ").toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    const matchesStatus = state.statusFilter === "all" || job.status === state.statusFilter;
    const matchesSource = state.sourceFilter === "all" || job.source === state.sourceFilter;
    return matchesQuery && matchesStatus && matchesSource;
  });
}

function getCvName(id) {
  return state.cvs.find((cv) => cv.id === id)?.name || "Not selected";
}

function getContactName(id) {
  return state.contacts.find((person) => person.id === id)?.name || "No contact";
}

function groupForStatus(status) {
  if (["offer", "rejected", "ghosted", "closed"].includes(status)) return "closed";
  return status || "saved";
}

function statusOptions(selected = "saved") {
  return Object.entries(STATUS_LABELS)
    .map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`)
    .join("");
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
  els.statusFilter.innerHTML = `<option value="all">All statuses</option>${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}`;
  els.sourceFilter.innerHTML = `<option value="all">All sources</option>${sources.map((source) => `<option value="${escapeHtml(source)}">${escapeHtml(source)}</option>`).join("")}`;
  els.statusFilter.value = state.statusFilter;
  els.sourceFilter.value = state.sourceFilter;
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
    <article class="job-card">
      <div>
        <h4>${escapeHtml(job.role)}</h4>
        <p>${escapeHtml(job.company)}</p>
      </div>
      <div class="tag-row">
        <span class="tag">${escapeHtml(STATUS_LABELS[job.status] || job.status)}</span>
        ${job.source ? `<span class="tag">${escapeHtml(job.source)}</span>` : ""}
        ${nextTag}
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
        <td>${escapeHtml(job.appliedDate || "Not yet")}</td>
        <td>${escapeHtml(getCvName(job.cvVersion))}</td>
        <td>${escapeHtml(job.nextAction || "")}</td>
      </tr>
    `).join("")
    : '<tr><td colspan="6">No applications match your filters.</td></tr>';
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
          ${cv.link ? `<p><a href="${escapeHtml(cv.link)}" target="_blank" rel="noreferrer">Open file/link</a></p>` : ""}
          <p>${escapeHtml(cv.notes || "")}</p>
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

function renderReminders() {
  const reminders = state.applications
    .filter((job) => {
      if (["offer", "rejected", "closed"].includes(job.status)) return false;
      const nextDue = job.nextActionDate && daysBetween(job.nextActionDate) >= 0;
      const oldApplication = job.appliedDate && daysBetween(job.appliedDate) >= 7 && !["interviewing", "offer"].includes(job.status);
      return nextDue || oldApplication;
    })
    .slice(0, 4);

  els.remindersPanel.innerHTML = reminders.length
    ? reminders.map((job) => `
      <div class="reminder">
        <span><strong>${escapeHtml(job.company)}</strong> - ${escapeHtml(job.nextAction || "Follow up")}</span>
        <button class="secondary-action edit-job" data-id="${job.id}" type="button">Review</button>
      </div>
    `).join("")
    : "";
}

function renderSelects() {
  document.querySelector("#status").innerHTML = statusOptions(document.querySelector("#status").value || "saved");
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
  renderReminders();
  renderSelects();
}

function fillJobForm(job = {}) {
  document.querySelector("#jobDialogTitle").textContent = job.id ? "Edit application" : "New application";
  document.querySelector("#jobId").value = job.id || "";
  document.querySelector("#role").value = job.role || "";
  document.querySelector("#company").value = job.company || "";
  document.querySelector("#jobLink").value = job.jobLink || "";
  document.querySelector("#source").value = job.source || "";
  document.querySelector("#status").innerHTML = statusOptions(job.status || "saved");
  document.querySelector("#location").value = job.location || "";
  document.querySelector("#salary").value = job.salary || "";
  document.querySelector("#appliedDate").value = job.appliedDate || "";
  document.querySelector("#nextAction").value = job.nextAction || "";
  document.querySelector("#nextActionDate").value = job.nextActionDate || "";
  document.querySelector("#cvVersion").value = job.cvVersion || "";
  document.querySelector("#contactId").value = job.contactId || "";
  document.querySelector("#description").value = job.description || "";
  document.querySelector("#notes").value = job.notes || "";
  document.querySelector("#deleteJobButton").style.visibility = job.id ? "visible" : "hidden";
}

function fillCvForm(cv = {}) {
  document.querySelector("#cvId").value = cv.id || "";
  document.querySelector("#cvName").value = cv.name || "";
  document.querySelector("#cvFocus").value = cv.focus || "";
  document.querySelector("#cvLink").value = cv.link || "";
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
  const headers = ["role", "company", "status", "jobLink", "source", "location", "salary", "appliedDate", "nextAction", "nextActionDate", "cvVersion", "contact", "notes"];
  const rows = state.applications.map((job) => [
    job.role,
    job.company,
    STATUS_LABELS[job.status] || job.status,
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
        jobLink: clean[3] || "",
        source: clean[4] || "",
        location: clean[5] || "",
        salary: clean[6] || "",
        appliedDate: clean[7] || "",
        nextAction: clean[8] || "",
        nextActionDate: clean[9] || "",
        cvVersion: "",
        contactId: "",
        description: "",
        notes: clean[12] || ""
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

document.querySelector("#addCvButton").addEventListener("click", () => {
  fillCvForm();
  els.cvDialog.showModal();
});

document.querySelector("#addContactButton").addEventListener("click", () => {
  fillContactForm();
  els.contactDialog.showModal();
});

document.addEventListener("click", (event) => {
  const jobButton = event.target.closest(".edit-job");
  const cvButton = event.target.closest(".edit-cv");
  const contactButton = event.target.closest(".edit-contact");

  if (jobButton) {
    const job = state.applications.find((item) => item.id === jobButton.dataset.id);
    fillJobForm(job);
    els.jobDialog.showModal();
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

cvForm.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const item = {
    id: document.querySelector("#cvId").value || uid("cv"),
    name: document.querySelector("#cvName").value,
    focus: document.querySelector("#cvFocus").value,
    link: document.querySelector("#cvLink").value,
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

document.querySelector("#deleteCvButton").addEventListener("click", () => {
  const id = document.querySelector("#cvId").value;
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

document.querySelector("#exportButton").addEventListener("click", exportCsv);
document.querySelector("#importInput").addEventListener("change", (event) => {
  if (event.target.files[0]) importCsv(event.target.files[0]);
});

let sandyMessageIndex = -1;
let sandyBubbleTimer;

document.querySelector("#sandyFloat").addEventListener("click", () => {
  const bubble = document.querySelector("#sandyBubble");
  sandyMessageIndex = (sandyMessageIndex + 1) % SANDY_MESSAGES.length;
  bubble.textContent = SANDY_MESSAGES[sandyMessageIndex];
  bubble.classList.add("show");
  clearTimeout(sandyBubbleTimer);
  sandyBubbleTimer = setTimeout(() => {
    bubble.classList.remove("show");
  }, 5200);
});

load();
render();
