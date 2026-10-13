import { supabase } from "./supabase.js";

const OPEN_PIPELINE_STAGES = ["NEW_LEAD", "QUALIFIED", "DISCOVERY", "PROPOSAL", "FOLLOW_UP"];
const WON_STAGES = ["WON", "ONBOARDING", "PRODUCTION", "LAUNCHED", "CLIENT"];
const TERMINAL_TASK_STATUSES = ["COMPLETED", "CANCELLED", "CANCELED"];
let dashboardHadErrors = false;

async function checkAuthentication() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session) {
        window.location.href = "login.html";
        return null;
    }
    return session;
}

function normalizeValue(value) {
    return String(value ?? "").trim().toUpperCase();
}

function formatNaira(value) {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatUSD(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatMoney(value, currency = "NGN") {
    return normalizeValue(currency) === "USD" ? formatUSD(value) : formatNaira(value);
}

function formatText(value) {
    if (!value) return "—";
    return String(value).replaceAll("_", " ").toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
}

function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function dateKey(value) {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatShortDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(value) {
    if (!value) return "No date recorded";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "No date recorded";
    return date.toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function updateGreeting() {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 17 ? "Good afternoon" : "Good evening";
    setText("greetingTitle", `${greeting}, Samuel.`);
    setText("dashboardDate", now.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
}

async function fetchRows(query, label) {
    const { data, error } = await query;
    if (error) {
        console.error(`Dashboard could not load ${label}:`, error);
        dashboardHadErrors = true;
        return [];
    }
    return data || [];
}

async function loadDashboard() {
    dashboardHadErrors = false;
    try {
        const session = await checkAuthentication();
        if (!session) return;
        updateGreeting();

        const [leads, proposals, payments, tasks, projects, activities] = await Promise.all([
            fetchRows(supabase.from("leads").select("id, first_name, last_name, business_name, stage, estimated_value, created_at").order("created_at", { ascending: false }), "leads"),
            fetchRows(supabase.from("proposals").select("id, lead_id, project_id, title, amount, currency, status, valid_until, sent_at, created_at").order("created_at", { ascending: false }), "proposals"),
            fetchRows(supabase.from("crm_payments").select("id, lead_id, project_id, proposal_id, amount, currency, status, paid_at, created_at").order("created_at", { ascending: false }), "CRM payments"),
            fetchRows(supabase.from("tasks").select("id, lead_id, project_id, title, description, priority, status, due_at, completed_at, created_at").order("due_at", { ascending: true, nullsFirst: false }), "tasks"),
            fetchRows(supabase.from("projects").select("id, lead_id, project_name, service_type, status, estimated_value, start_date, expected_launch_date, launched_at, created_at").order("created_at", { ascending: false }), "projects"),
            fetchRows(supabase.from("activities").select("id, lead_id, project_id, activity_type, direction, subject, description, activity_at, created_at").order("activity_at", { ascending: false }).limit(10), "activities")
        ]);

        renderMetrics(leads, proposals, payments);
        renderPipeline(leads);
        renderPriorityTasks(tasks, leads);
        renderProposalAttention(proposals, leads);
        renderProjectDelivery(projects, leads);
        renderRecentActivity(activities, leads);
        renderRecentLeads(leads);
        updateDashboardNotice();
    } catch (error) {
        console.error("Dashboard initialization failed:", error);
        dashboardHadErrors = true;
        updateDashboardNotice();
    }
}

function updateDashboardNotice() {
    const notice = document.getElementById("dashboardNotice");
    if (!notice) return;
    if (dashboardHadErrors) {
        notice.textContent = "Some dashboard information could not be loaded. Check the browser console and Supabase access policies. Other successfully loaded sections remain available.";
        notice.classList.remove("hidden");
    } else {
        notice.textContent = "";
        notice.classList.add("hidden");
    }
}

function createCurrencyTotals() {
    return { NGN: 0, USD: 0 };
}

function renderMetrics(leads, proposals, payments) {
    const openLeads = leads.filter(lead => OPEN_PIPELINE_STAGES.includes(normalizeValue(lead.stage)));
    const pipelineValue = openLeads.reduce((sum, lead) => sum + Number(lead.estimated_value || 0), 0);
    const wonLeads = leads.filter(lead => WON_STAGES.includes(normalizeValue(lead.stage)));
    const conversionRate = leads.length ? Math.round(wonLeads.length / leads.length * 100) : 0;
    const sentViewed = proposals.filter(item => ["SENT", "VIEWED"].includes(normalizeValue(item.status)));
    const drafts = proposals.filter(item => normalizeValue(item.status) === "DRAFT");
    const accepted = proposals.filter(item => normalizeValue(item.status) === "ACCEPTED");

    setText("pipelineValue", formatNaira(pipelineValue));
    setText("wonCount", wonLeads.length);
    setText("conversionRate", `${conversionRate}%`);
    setText("proposalsSent", sentViewed.length);
    setText("draftProposalCount", drafts.length);
    setText("awaitingProposalCount", sentViewed.length);
    setText("acceptedProposalCount", accepted.length);

    const collected = createCurrencyTotals();
    payments.forEach(payment => {
        if (normalizeValue(payment.status) !== "PAID") return;
        const currency = normalizeValue(payment.currency || "NGN");
        if (Object.hasOwn(collected, currency)) collected[currency] += Number(payment.amount || 0);
    });
    setText("collectedValue", formatNaira(collected.NGN));
    setText("collectedValueUsd", formatUSD(collected.USD));

    const outstanding = createCurrencyTotals();
    const paidByProposalCurrency = new Map();
    payments.forEach(payment => {
        if (normalizeValue(payment.status) !== "PAID" || !payment.proposal_id) return;
        const currency = normalizeValue(payment.currency || "NGN");
        if (!Object.hasOwn(outstanding, currency)) return;
        const key = `${payment.proposal_id}|${currency}`;
        paidByProposalCurrency.set(key, (paidByProposalCurrency.get(key) || 0) + Number(payment.amount || 0));
    });
    accepted.forEach(proposal => {
        const currency = normalizeValue(proposal.currency || "NGN");
        if (!Object.hasOwn(outstanding, currency)) return;
        const contract = Number(proposal.amount || 0);
        const paid = paidByProposalCurrency.get(`${proposal.id}|${currency}`) || 0;
        outstanding[currency] += Math.max(contract - paid, 0);
    });
    setText("outstandingValue", formatNaira(outstanding.NGN));
    setText("outstandingValueUsd", formatUSD(outstanding.USD));
}

function renderPipeline(leads) {
    const ids = { NEW_LEAD: "newLeadCount", QUALIFIED: "qualifiedCount", DISCOVERY: "discoveryCount", PROPOSAL: "proposalCount", FOLLOW_UP: "followUpCount" };
    Object.entries(ids).forEach(([stage, id]) => setText(id, leads.filter(lead => normalizeValue(lead.stage) === stage).length));
    setText("pipelineWonCount", leads.filter(lead => WON_STAGES.includes(normalizeValue(lead.stage))).length);
}

function isTaskClosed(task) {
    return TERMINAL_TASK_STATUSES.includes(normalizeValue(task.status));
}

function getTaskCategory(task) {
    if (isTaskClosed(task)) return normalizeValue(task.status) === "COMPLETED" ? "COMPLETED" : "CLOSED";
    if (!task.due_at) return "OPEN";
    const due = new Date(task.due_at);
    if (Number.isNaN(due.getTime())) return "OPEN";
    const now = new Date();
    if (due.getTime() < now.getTime()) return "OVERDUE";
    if (dateKey(due) === dateKey(now)) return "TODAY";
    return "UPCOMING";
}

function getLeadById(leads, id) {
    return leads.find(lead => lead.id === id) || null;
}

function getLeadLabel(lead) {
    if (!lead) return "No lead linked";
    const business = lead.business_name || "Unnamed Business";
    const contact = `${lead.first_name || ""} ${lead.last_name || ""}`.trim();
    return contact ? `${business} — ${contact}` : business;
}

function priorityRank(value) {
    return ({ HIGH: 1, MEDIUM: 2, LOW: 3 })[normalizeValue(value)] || 4;
}

function renderPriorityTasks(tasks, leads) {
    const container = document.getElementById("priorityTasks");
    const openTasks = tasks.filter(task => !isTaskClosed(task));
    const dueTasks = openTasks.filter(task => ["OVERDUE", "TODAY"].includes(getTaskCategory(task)));
    dueTasks.sort((a, b) => {
        const order = { OVERDUE: 0, TODAY: 1 };
        const diff = (order[getTaskCategory(a)] ?? 2) - (order[getTaskCategory(b)] ?? 2);
        return diff || priorityRank(a.priority) - priorityRank(b.priority) || new Date(a.due_at || 8640000000000000) - new Date(b.due_at || 8640000000000000);
    });

    const list = (dueTasks.length ? dueTasks : openTasks.slice().sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || (a.due_at ? new Date(a.due_at).getTime() : Infinity) - (b.due_at ? new Date(b.due_at).getTime() : Infinity))).slice(0, 5);
    if (!list.length) {
        container.innerHTML = `<div class="empty-state"><strong>You're all caught up.</strong><p>No open tasks require attention.</p></div>`;
        return;
    }
    if (!dueTasks.length) {
        container.insertAdjacentHTML("beforeend", "");
        container.innerHTML = `<div class="attention-success"><strong>No overdue tasks or tasks due today.</strong><p>Here are your next scheduled actions.</p></div>`;
    } else {
        container.innerHTML = "";
    }
    container.insertAdjacentHTML("beforeend", list.map(task => {
        const lead = getLeadById(leads, task.lead_id);
        const category = getTaskCategory(task);
        const href = task.lead_id ? `pages/lead.html?id=${encodeURIComponent(task.lead_id)}` : "pages/tasks.html";
        const priority = normalizeValue(task.priority || "MEDIUM").toLowerCase();
        const badge = category === "OVERDUE" ? "OVERDUE" : category === "TODAY" ? "DUE TODAY" : formatText(category);
        return `<a class="priority-task-item ${category === "OVERDUE" ? "priority-task-overdue" : ""}" href="${href}"><div class="priority-task-copy"><strong>${escapeHtml(task.title || "Untitled Task")}</strong><span>${escapeHtml(getLeadLabel(lead))}</span><small>${badge} · ${escapeHtml(formatDateTime(task.due_at))}</small></div><span class="task-priority priority-${priority}">${escapeHtml(formatText(task.priority || "MEDIUM"))}</span></a>`;
    }).join(""));
}

function renderProposalAttention(proposals, leads) {
    const container = document.getElementById("proposalAttentionList");
    const awaiting = proposals.filter(item => ["SENT", "VIEWED"].includes(normalizeValue(item.status)));
    awaiting.sort((a, b) => {
        if (!a.valid_until && !b.valid_until) return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        if (!a.valid_until) return 1;
        if (!b.valid_until) return -1;
        return new Date(a.valid_until) - new Date(b.valid_until);
    });
    const list = awaiting.slice(0, 4);
    if (!list.length) {
        container.innerHTML = `<div class="empty-state"><p>No proposals are currently awaiting a response.</p></div>`;
        return;
    }
    container.innerHTML = list.map(proposal => {
        const lead = getLeadById(leads, proposal.lead_id);
        const expiry = proposal.valid_until ? `Valid until ${formatShortDate(proposal.valid_until)}` : "No expiry date";
        return `<div class="dashboard-list-item"><div class="dashboard-list-copy"><strong>${escapeHtml(proposal.title || "Untitled Proposal")}</strong><span>${escapeHtml(getLeadLabel(lead))}</span><small>${escapeHtml(formatText(proposal.status))} · ${escapeHtml(expiry)}</small></div><strong class="dashboard-list-value">${escapeHtml(formatMoney(proposal.amount, proposal.currency || "NGN"))}</strong></div>`;
    }).join("");
}

function renderProjectDelivery(projects, leads) {
    const activeStatuses = ["PLANNING", "IN_PROGRESS", "REVIEW"];
    const active = projects.filter(project => activeStatuses.includes(normalizeValue(project.status)));
    const review = projects.filter(project => normalizeValue(project.status) === "REVIEW");
    const launched = projects.filter(project => ["LAUNCHED", "COMPLETED"].includes(normalizeValue(project.status)));
    setText("activeProjectCount", active.length);
    setText("reviewProjectCount", review.length);
    setText("launchedProjectCount", launched.length);
    const container = document.getElementById("projectDeliveryList");
    const list = projects.slice(0, 4);
    if (!list.length) {
        container.innerHTML = `<div class="empty-state"><p>No projects have been created yet.</p></div>`;
        return;
    }
    container.innerHTML = list.map(project => {
        const lead = getLeadById(leads, project.lead_id);
        return `<a class="dashboard-list-item dashboard-project-item" href="pages/projects.html"><div class="dashboard-list-copy"><strong>${escapeHtml(project.project_name || "Unnamed Project")}</strong><span>${escapeHtml(getLeadLabel(lead))}</span></div><span class="project-status-badge">${escapeHtml(formatText(project.status))}</span></a>`;
    }).join("");
}

function activityIcon(type) {
    const icons = { CALL: "☎", PHONE_CALL: "☎", WHATSAPP: "◉", EMAIL: "✉", MEETING: "◫", NOTE: "✎", FOLLOW_UP: "↻" };
    return icons[normalizeValue(type)] || "•";
}

function renderRecentActivity(activities, leads) {
    const container = document.getElementById("recentActivityList");
    if (!activities.length) {
        container.innerHTML = `<div class="empty-state"><strong>No recorded activity yet.</strong><p>Logged calls, WhatsApp conversations, meetings and notes will appear here.</p></div>`;
        return;
    }
    container.innerHTML = activities.slice(0, 8).map(activity => {
        const lead = getLeadById(leads, activity.lead_id);
        const href = activity.lead_id ? `pages/lead.html?id=${encodeURIComponent(activity.lead_id)}` : "pages/leads.html";
        return `<a class="recent-activity-item" href="${href}"><div class="recent-activity-icon">${activityIcon(activity.activity_type)}</div><div class="recent-activity-copy"><strong>${escapeHtml(activity.subject || formatText(activity.activity_type))}</strong><span>${escapeHtml(getLeadLabel(lead))}</span>${activity.description ? `<small>${escapeHtml(activity.description)}</small>` : ""}</div><time>${escapeHtml(formatDateTime(activity.activity_at || activity.created_at))}</time></a>`;
    }).join("");
}

function renderRecentLeads(leads) {
    const tbody = document.getElementById("recentLeadsBody");
    const list = leads.slice(0, 8);
    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><strong>No leads yet.</strong><p>Add your first prospect to begin.</p></div></td></tr>`;
        return;
    }
    tbody.innerHTML = list.map(lead => {
        const contact = `${lead.first_name || ""} ${lead.last_name || ""}`.trim();
        return `<tr><td><a class="dashboard-lead-link" href="pages/lead.html?id=${encodeURIComponent(lead.id)}"><strong>${escapeHtml(lead.business_name || "Unnamed Business")}</strong></a></td><td>${escapeHtml(contact || "—")}</td><td><span class="stage-badge">${escapeHtml(formatText(lead.stage))}</span></td><td>${escapeHtml(formatNaira(lead.estimated_value))}</td><td>${escapeHtml(formatShortDate(lead.created_at))}</td></tr>`;
    }).join("");
}

document.getElementById("addLeadButton").addEventListener("click", () => {
    window.location.href = "pages/leads.html";
});

document.getElementById("viewLeadsButton").addEventListener("click", () => {
    window.location.href = "pages/leads.html";
});

document.getElementById("logoutButton").addEventListener("click", async () => {
    try {
        await supabase.auth.signOut();
    } catch (error) {
        console.error("Sign-out error:", error);
    }
    window.location.href = "login.html";
});

loadDashboard();
