import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);
let allIntakes = [];
let activeIntake = null;
let busy = false;

const STATUS_LABELS = {
  DRAFT: "Draft", NEW: "New", REVIEWED: "Reviewed", QUALIFIED: "Qualified",
  CONVERTED: "Converted", ARCHIVED: "Archived"
};
const VALUE_LABELS = {
  project_type: { school:"School website", business:"Business website", ecommerce:"E-commerce website", landing:"Landing page", redesign:"Website redesign", other:"Other" },
  website_status: { no:"No website yet", "yes-working":"Existing website — working", "yes-outdated":"Existing website — needs improvement", "not-sure":"Not sure" },
  scope: { "one-page":"One-page website", "multi-page":"Multi-page website", comprehensive:"Comprehensive website", unsure:"Help me decide" },
  budget_range: { "below-500":"Below ₦500,000", "500-1m":"₦500,000 – ₦1,000,000", "1m-2m":"₦1,000,000 – ₦2,000,000", "2m-plus":"₦2,000,000+", "not-sure":"Not sure yet" },
  timeline: { asap:"As soon as possible", "2-weeks":"Within two weeks", "30-days":"Within 30 days", "1-3-months":"Within 1–3 months", flexible:"Flexible" }
};

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function label(field, value) {
  if (!value) return "Not provided";
  return VALUE_LABELS[field]?.[value] || String(value).replaceAll("_", " ").replace(/\b\w/g, x => x.toUpperCase());
}
function fmtDate(value, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-NG", withTime
    ? { day:"numeric", month:"short", year:"numeric", hour:"numeric", minute:"2-digit" }
    : { day:"numeric", month:"short", year:"numeric" });
}
function setNotice(message, type = "info") {
  const box = $("intakesNotice");
  box.textContent = message;
  box.className = `intakes-notice ${type}`;
  box.hidden = !message;
}
function statusBadge(status) {
  const key = String(status || "DRAFT").toUpperCase();
  return `<span class="intake-status intake-status-${esc(key.toLowerCase())}">${esc(STATUS_LABELS[key] || key)}</span>`;
}
function getContactName(row) {
  return row.contact_name || (row.contact_consent ? "Contact details provided" : "Not shared yet");
}

async function requireSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) {
    window.location.href = "../login.html";
    return null;
  }
  return data.session;
}

async function loadIntakes() {
  setNotice("");
  $("intakesTableBody").innerHTML = '<tr><td colspan="7"><div class="empty-state">Loading website intakes…</div></td></tr>';
  try {
    const session = await requireSession();
    if (!session) return;
    const { data, error } = await supabase
      .from("project_intakes")
      .select("id, reference_code, project_type, website_status, business_name, industry, location, goals, visitor_actions, scope, features, budget_range, timeline, contact_name, whatsapp, email, preferred_contact, package_interest, additional_notes, contact_consent, payload, current_step, status, submitted_at, created_at, updated_at, converted_lead_id, converted_at")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    allIntakes = data || [];
    renderMetrics();
    renderTable();
  } catch (error) {
    console.error("Website intakes could not load:", error);
    const msg = String(error?.message || "");
    const missingBridge = /column .*converted_lead_id.* does not exist|project_intakes.*does not exist|relation.*project_intakes/i.test(msg);
    setNotice(missingBridge
      ? "The Website Intakes database setup is incomplete. Run the V18 project_intakes.sql migration first, then run supabase/project_intakes_crm_bridge.sql from this CRM upgrade. Refresh this page after both scripts succeed."
      : `Website intakes could not be loaded: ${msg || "Unknown error"}. Check your Supabase session, RLS policy and browser console.`, "error");
    $("intakesTableBody").innerHTML = '<tr><td colspan="7"><div class="empty-state">Website intakes are not available yet.</div></td></tr>';
    ["newIntakeCount","draftIntakeCount","qualifiedIntakeCount","convertedIntakeCount"].forEach(id => $(id).textContent = "—");
    $("intakeResultCount").textContent = "Unavailable";
  }
}

function renderMetrics() {
  const count = status => allIntakes.filter(row => row.status === status).length;
  $("newIntakeCount").textContent = count("NEW");
  $("draftIntakeCount").textContent = count("DRAFT");
  $("qualifiedIntakeCount").textContent = count("QUALIFIED");
  $("convertedIntakeCount").textContent = count("CONVERTED");
}

function filteredRows() {
  const query = $("intakeSearch").value.trim().toLowerCase();
  const status = $("intakeStatusFilter").value;
  return allIntakes.filter(row => {
    if (status !== "ALL" && row.status !== status) return false;
    const searchable = [row.reference_code,row.business_name,row.contact_name,row.industry,row.email,row.whatsapp,row.project_type].join(" ").toLowerCase();
    return !query || searchable.includes(query);
  });
}

function renderTable() {
  const rows = filteredRows();
  $("intakeResultCount").textContent = `${rows.length} ${rows.length === 1 ? "intake" : "intakes"}`;
  if (!rows.length) {
    $("intakesTableBody").innerHTML = '<tr><td colspan="7"><div class="empty-state">No matching website intakes. New portfolio submissions will appear here.</div></td></tr>';
    return;
  }
  $("intakesTableBody").innerHTML = rows.map(row => `
    <tr class="intake-row" data-intake-id="${esc(row.id)}" tabindex="0" role="button" aria-label="Open intake ${esc(row.reference_code)}">
      <td><strong>${esc(row.reference_code || "—")}</strong><small>${row.status === "DRAFT" ? `Step ${Number(row.current_step || 1)} of 10` : esc(fmtDate(row.submitted_at || row.created_at))}</small></td>
      <td><strong>${esc(row.business_name || "Organisation not provided")}</strong><small>${esc(row.industry || "Industry not provided")}</small></td>
      <td>${esc(getContactName(row))}<small>${esc(row.whatsapp || row.email || "Contact details withheld")}</small></td>
      <td>${esc(label("project_type", row.project_type))}</td>
      <td>${statusBadge(row.status)}</td>
      <td>${esc(fmtDate(row.submitted_at || row.updated_at))}</td>
      <td><button type="button" class="intake-open-button" data-open-intake="${esc(row.id)}">View →</button></td>
    </tr>`).join("");
}

function detailSection(title, pairs) {
  return `<section class="intake-detail-section"><h3>${esc(title)}</h3><div class="intake-detail-grid">${pairs.map(([name,value]) => `
    <div class="intake-detail-item"><small>${esc(name)}</small><div>${esc(Array.isArray(value) ? (value.join(", ") || "Not provided") : (value || "Not provided"))}</div></div>`).join("")}</div></section>`;
}

function openIntake(id) {
  const row = allIntakes.find(item => item.id === id);
  if (!row) return;
  activeIntake = row;
  $("intakeModalTitle").textContent = row.business_name || "Website intake";
  $("intakeModalSubtitle").textContent = `${row.reference_code || "No reference"} · ${STATUS_LABELS[row.status] || row.status} · Updated ${fmtDate(row.updated_at, true)}`;
  const contact = row.contact_consent ? [
    ["Contact name", row.contact_name], ["WhatsApp", row.whatsapp], ["Email", row.email], ["Preferred contact", row.preferred_contact], ["Contact permission", "Granted"]
  ] : [["Contact information", "Not sent to the server — visitor has not granted contact permission."]];
  const project = [
    ["Project type", label("project_type",row.project_type)], ["Current website",label("website_status",row.website_status)],
    ["Organisation",row.business_name], ["Industry",row.industry], ["Location",row.location],
    ["Website scope",label("scope",row.scope)], ["Investment range",label("budget_range",row.budget_range)],
    ["Preferred timeline",label("timeline",row.timeline)], ["Package interest",row.package_interest]
  ];
  const goals = [["Main goals",row.goals], ["Visitor actions",row.visitor_actions], ["Requested features",row.features], ["Additional notes",row.additional_notes]];
  $("intakeDetailContent").innerHTML = [
    `<div class="intake-detail-topline">${statusBadge(row.status)}<span>Received ${esc(fmtDate(row.submitted_at || row.created_at,true))}</span></div>`,
    detailSection("Project overview",project), detailSection("Desired outcomes and features",goals), detailSection("Contact details",contact),
    row.converted_lead_id ? `<div class="intake-linked-lead">This intake is linked to an existing CRM lead. <a href="lead.html?id=${encodeURIComponent(row.converted_lead_id)}">Open CRM lead →</a></div>` : ""
  ].join("");
  const actions = [];
  if (row.status === "NEW") actions.push('<button type="button" class="secondary-button" data-intake-action="REVIEWED">Mark Reviewed</button>');
  if (["NEW","REVIEWED"].includes(row.status)) actions.push('<button type="button" class="secondary-button" data-intake-action="QUALIFIED">Mark Qualified</button>');
  if (["NEW","REVIEWED","QUALIFIED"].includes(row.status) && row.contact_consent && !row.converted_lead_id) actions.push('<button type="button" class="primary-button" data-intake-action="PROMOTE">Promote to Leads</button>');
  if (row.converted_lead_id) actions.push(`<a class="primary-button intake-link-button" href="lead.html?id=${encodeURIComponent(row.converted_lead_id)}">Open CRM Lead</a>`);
  actions.push('<button type="button" class="secondary-button" data-close-intake>Close</button>');
  $("intakeModalActions").innerHTML = actions.join("");
  $("intakeModal").classList.add("show");
  $("intakeModal").setAttribute("aria-hidden","false");
  document.body.classList.add("intake-modal-open");
}

function closeIntake() {
  $("intakeModal").classList.remove("show");
  $("intakeModal").setAttribute("aria-hidden","true");
  document.body.classList.remove("intake-modal-open");
  activeIntake = null;
}

async function updateIntakeStatus(status) {
  if (!activeIntake || busy) return;
  busy = true;
  setNotice("Updating intake status…");
  try {
    const { data, error } = await supabase.from("project_intakes").update({ status }).eq("id",activeIntake.id).select("id,status").single();
    if (error) throw error;
    activeIntake.status = data.status;
    setNotice(`Intake marked ${STATUS_LABELS[data.status] || data.status}.`,"success");
    await loadIntakes();
    openIntake(activeIntake.id);
  } catch (error) {
    console.error("Intake status update failed:",error);
    setNotice(error.message || "Could not update intake status.","error");
  } finally { busy = false; }
}

async function promoteIntake() {
  if (!activeIntake || busy) return;
  const confirmed = window.confirm(`Promote ${activeIntake.reference_code || "this intake"} into your CRM Leads pipeline?\n\nThe system will first look for an existing lead with the same email or phone number. If it finds one, it will link the intake to that record instead of creating a duplicate.`);
  if (!confirmed) return;
  busy = true;
  setNotice("Promoting intake to your Leads pipeline…");
  try {
    const { data, error } = await supabase.rpc("promote_project_intake", { p_intake_id: activeIntake.id });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.lead_id) throw new Error("The database did not return a CRM lead reference. Review the promotion function and try again.");
    setNotice(result.created ? "A new CRM lead was created successfully." : "This intake was linked to an existing CRM lead. No duplicate was created.","success");
    await loadIntakes();
    openIntake(activeIntake.id);
  } catch (error) {
    console.error("Intake promotion failed:",error);
    setNotice(error.message || "Could not promote this intake. Check that the CRM bridge SQL migration has been run.","error");
  } finally { busy = false; }
}

$("intakeSearch").addEventListener("input",renderTable);
$("intakeStatusFilter").addEventListener("change",renderTable);
$("refreshIntakesButton").addEventListener("click",loadIntakes);
$("closeIntakeModal").addEventListener("click",closeIntake);
$("intakesTableBody").addEventListener("click",event => {
  const button = event.target.closest("[data-open-intake]");
  const row = event.target.closest("[data-intake-id]");
  const id = button?.dataset.openIntake || row?.dataset.intakeId;
  if (id) openIntake(id);
});
$("intakesTableBody").addEventListener("keydown",event => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-intake-id]")) {
    event.preventDefault(); openIntake(event.target.dataset.intakeId);
  }
});
$("intakeModal").addEventListener("click",event => {
  if (event.target.matches("[data-close-intake]")) { closeIntake(); return; }
  const action = event.target.closest("[data-intake-action]")?.dataset.intakeAction;
  if (!action) return;
  if (action === "PROMOTE") promoteIntake(); else updateIntakeStatus(action);
});
document.addEventListener("keydown",event => { if (event.key === "Escape" && $("intakeModal").classList.contains("show")) closeIntake(); });

loadIntakes();
