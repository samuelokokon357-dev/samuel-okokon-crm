import { supabase } from './supabase.js';

/* ==========================================================
   SAMUEL OKOKON CRM — CLIENT ONBOARDING
   Additive page. Uses existing supabase.js and existing tables:
   client_onboarding, client_onboarding_items, projects, clients, leads.
   ========================================================== */

(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const byId = (id) => document.getElementById(id);

  const ITEM_STATUSES = [
    { value: 'NOT_REQUESTED', label: 'Not requested' },
    { value: 'REQUESTED', label: 'Requested from client' },
    { value: 'RECEIVED', label: 'Received · needs review' },
    { value: 'APPROVED', label: 'Approved' },
  ];

  const ONBOARDING_STATUSES = [
    { value: 'NOT_STARTED', label: 'Not started' },
    { value: 'IN_PROGRESS', label: 'In progress' },
    { value: 'WAITING_ON_CLIENT', label: 'Waiting on client' },
    { value: 'READY_FOR_PRODUCTION', label: 'Ready for production' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'ON_HOLD', label: 'On hold' },
  ];

  const DEFAULT_CHECKLIST = [
    { item_key: 'kickoff_call', title: 'Kickoff meeting completed', category: 'GENERAL', is_required: true },
    { item_key: 'scope_confirmed', title: 'Project scope and deliverables confirmed', category: 'GENERAL', is_required: true },
    { item_key: 'primary_contact', title: 'Primary contact details confirmed', category: 'CONTACT', is_required: true },
    { item_key: 'school_profile', title: 'School history, mission, vision, and about content received', category: 'CONTENT', is_required: true },
    { item_key: 'academic_programmes', title: 'Classes, academic programmes, and curriculum information received', category: 'CONTENT', is_required: true },
    { item_key: 'admissions', title: 'Admissions process and application instructions confirmed', category: 'CONTENT', is_required: true },
    { item_key: 'brand_assets', title: 'School logo, brand colours, and other brand assets received', category: 'BRANDING', is_required: true },
    { item_key: 'campus_photos', title: 'Campus and facilities photographs received', category: 'CONTENT', is_required: true },
    { item_key: 'contact_details', title: 'School address, phone number, email, and opening hours confirmed', category: 'CONTACT', is_required: true },
    { item_key: 'domain_confirmed', title: 'Domain name and hosting arrangements confirmed', category: 'TECHNICAL', is_required: true },
    { item_key: 'hosting_access', title: 'Secure hosting access arranged where necessary', category: 'TECHNICAL', is_required: true },
    { item_key: 'privacy_policy', title: 'Privacy policy and applicable legal content agreed', category: 'CONTENT', is_required: true },
    { item_key: 'design_approval', title: 'Visual direction and design references approved', category: 'APPROVAL', is_required: true },
    { item_key: 'content_signoff', title: 'Website content approved for publication', category: 'APPROVAL', is_required: true },
    { item_key: 'leadership_profiles', title: 'Leadership and staff profiles received', category: 'CONTENT', is_required: false },
    { item_key: 'student_life_media', title: 'Student-life photographs and media approved for use', category: 'CONTENT', is_required: false },
    { item_key: 'achievements', title: 'School achievements, awards, and accreditations confirmed', category: 'CONTENT', is_required: false },
    { item_key: 'map_socials', title: 'Map location and social media links confirmed', category: 'CONTACT', is_required: false },
  ];

  const state = {
    db: null,
    onboarding: [],
    projects: [],
    clients: [],
    leads: [],
    items: [],
    activeOnboardingId: null,
    projectMap: new Map(),
    clientMap: new Map(),
    clientByLeadId: new Map(),
    leadMap: new Map(),
    saving: false,
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char]));
  }

  function readable(value) {
    return String(value || '—')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function showAlert(message, type = 'info') {
    const alert = byId('pageAlert');
    alert.textContent = message;
    alert.className = `alert${type === 'error' ? ' error' : type === 'success' ? ' success' : ''}`;
    alert.classList.remove('hidden');
  }

  function clearAlert() {
    byId('pageAlert').classList.add('hidden');
  }

  function setLoading(isLoading) {
    byId('loadingPanel').classList.toggle('hidden', !isLoading);
    byId('workspace').classList.toggle('hidden', isLoading);
  }

  function getSupabaseClient() {
    return supabase;
  }

  function formatMoney(amount, currency = 'NGN') {
    if (amount === null || amount === undefined || amount === '') return 'Not set';
    const number = Number(amount);
    if (!Number.isFinite(number)) return 'Not set';
    try {
      return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(number);
    } catch (_) {
      return `${currency} ${number.toLocaleString('en-NG')}`;
    }
  }

  function toLocalDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function fromLocalDateTime(value) {
    return value ? new Date(value).toISOString() : null;
  }

  function setText(id, value) {
    byId(id).textContent = value == null || value === '' ? '—' : value;
  }

  function getDisplayForProject(project) {
    if (!project) return { business: 'Project not found', contact: 'No linked project details' };
    const lead = project.lead_id ? state.leadMap.get(project.lead_id) : null;
    const client = lead?.id ? state.clientByLeadId.get(lead.id) : null;
    const business = client?.business_name || lead?.business_name || project.project_name || 'Unnamed project';
    const contact = client?.contact_name || [lead?.first_name, lead?.last_name].filter(Boolean).join(' ') || '';
    const phone = client?.whatsapp || client?.phone || lead?.whatsapp || lead?.phone || '';
    const email = client?.email || lead?.email || '';
    const contactDetails = [contact, phone, email].filter(Boolean).join(' · ') || 'Contact details not recorded';
    return { business, contact: contactDetails, client, lead };
  }

  function renderOnboardingSelect() {
    const select = byId('onboardingSelect');
    const desiredId = new URLSearchParams(window.location.search).get('id') || state.activeOnboardingId;
    select.innerHTML = state.onboarding.map((row) => {
      const project = state.projectMap.get(row.project_id);
      const display = getDisplayForProject(project);
      const label = `${display.business} — ${project?.project_name || 'Project'} (${readable(row.status)})`;
      return `<option value="${escapeHtml(row.id)}">${escapeHtml(label)}</option>`;
    }).join('');

    if (!state.onboarding.length) {
      select.innerHTML = '<option value="">No onboarding records found</option>';
      state.activeOnboardingId = null;
      return;
    }

    const matching = state.onboarding.some((row) => row.id === desiredId);
    state.activeOnboardingId = matching ? desiredId : state.onboarding[0].id;
    select.value = state.activeOnboardingId;
  }

  function renderAvailableProjects() {
    const select = byId('newProjectSelect');
    const onboarded = new Set(state.onboarding.map((row) => row.project_id));
    const available = state.projects.filter((project) => !onboarded.has(project.id));
    if (!available.length) {
      select.innerHTML = '<option value="">All current projects already have onboarding</option>';
      select.disabled = true;
      byId('createOnboardingButton').disabled = true;
      return;
    }
    select.disabled = false;
    byId('createOnboardingButton').disabled = false;
    select.innerHTML = '<option value="">Select a project…</option>' + available.map((project) => {
      const display = getDisplayForProject(project);
      return `<option value="${escapeHtml(project.id)}">${escapeHtml(display.business)} — ${escapeHtml(project.project_name || 'Project')}</option>`;
    }).join('');
  }

  async function loadReferenceData() {
    const onboardingResult = await state.db
      .from('client_onboarding')
      .select('*')
      .order('created_at', { ascending: false });
    if (onboardingResult.error) throw onboardingResult.error;
    state.onboarding = onboardingResult.data || [];

    // Use columns confirmed in the current CRM project table.
    // Do not request projects.client_id: projects are connected to leads here.
    const projectResult = await state.db
      .from('projects')
      .select('id, project_name, status, lead_id, estimated_value, start_date, expected_launch_date, launched_at, created_at')
      .order('created_at', { ascending: false });
    if (projectResult.error) throw projectResult.error;
    state.projects = projectResult.data || [];
    state.projectMap = new Map(state.projects.map((row) => [row.id, row]));

    const leadIds = [...new Set(state.projects.map((row) => row.lead_id).filter(Boolean))];
    const [clientResult, leadResult] = await Promise.all([
      state.db
        .from('clients')
        .select('id, lead_id, business_name, contact_name, email, phone, whatsapp, website, status'),
      leadIds.length
        ? state.db.from('leads').select('id, first_name, last_name, business_name, email, phone, whatsapp, website, stage').in('id', leadIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (clientResult.error) throw clientResult.error;
    if (leadResult.error) throw leadResult.error;

    state.clients = clientResult.data || [];
    state.leads = leadResult.data || [];
    state.clientMap = new Map(state.clients.map((row) => [row.id, row]));
    state.clientByLeadId = new Map(
      state.clients
        .filter((row) => row.lead_id)
        .map((row) => [row.lead_id, row])
    );
    state.leadMap = new Map(state.leads.map((row) => [row.id, row]));
  }

  async function loadCurrentOnboarding(onboardingId) {
    clearAlert();
    state.activeOnboardingId = onboardingId || null;
    const onboarding = state.onboarding.find((row) => row.id === onboardingId);
    const hasOnboarding = Boolean(onboarding);
    byId('detailsForm').querySelectorAll('input, select, textarea, button').forEach((element) => {
      if (element.id !== 'saveDetailsButton') return;
      element.disabled = !hasOnboarding;
    });
    byId('checklistContainer').innerHTML = '<div class="empty">Loading checklist…</div>';

    if (!onboarding) {
      setText('identityName', 'No onboarding record');
      setText('identityContact', 'Create onboarding for a project below.');
      setText('projectName', '—');
      setText('projectStatus', '—');
      setText('businessName', '—');
      setText('projectValue', '—');
      byId('recordStatusBadge').textContent = 'NO RECORD';
      byId('onboardingStatus').value = 'NOT_STARTED';
      byId('targetDate').value = '';
      byId('kickoffDate').value = '';
      byId('completedAt').value = '';
      byId('onboardingNotes').value = '';
      state.items = [];
      renderChecklist();
      renderMetrics();
      return;
    }

    const project = state.projectMap.get(onboarding.project_id);
    const display = getDisplayForProject(project);
    setText('identityName', display.business);
    setText('identityContact', display.contact);
    setText('projectName', project?.project_name || 'Project not found');
    setText('projectStatus', readable(project?.status));
    setText('businessName', display.business);
    setText('projectValue', formatMoney(project?.estimated_value));
    byId('recordStatusBadge').textContent = readable(onboarding.status);

    const statusSelect = byId('onboardingStatus');
    const currentStatusExists = ONBOARDING_STATUSES.some((status) => status.value === onboarding.status);
    statusSelect.innerHTML = ONBOARDING_STATUSES.map((status) => `<option value="${status.value}">${status.label}</option>`).join('');
    if (!currentStatusExists) {
      statusSelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(onboarding.status)}">${escapeHtml(readable(onboarding.status))} (existing)</option>`);
    }
    statusSelect.value = onboarding.status;
    byId('targetDate').value = onboarding.target_completion_date || '';
    byId('kickoffDate').value = toLocalDateTime(onboarding.kickoff_at);
    byId('completedAt').value = toLocalDateTime(onboarding.completed_at);
    byId('onboardingNotes').value = onboarding.notes || '';

    const itemsResult = await state.db
      .from('client_onboarding_items')
      .select('*')
      .eq('onboarding_id', onboarding.id)
      .order('category', { ascending: true })
      .order('title', { ascending: true });
    if (itemsResult.error) throw itemsResult.error;
    state.items = itemsResult.data || [];
    renderCategoryFilter();
    renderChecklist();
    renderMetrics();
  }

  function renderCategoryFilter() {
    const select = byId('categoryFilter');
    const current = select.value || 'ALL';
    const categories = [...new Set(state.items.map((item) => item.category || 'GENERAL'))].sort();
    select.innerHTML = '<option value="ALL">All categories</option>' + categories.map((category) =>
      `<option value="${escapeHtml(category)}">${escapeHtml(readable(category))}</option>`
    ).join('');
    select.value = categories.includes(current) ? current : 'ALL';
  }

  function renderChecklist() {
    const container = byId('checklistContainer');
    const category = byId('categoryFilter').value || 'ALL';
    const search = byId('itemSearch').value.trim().toLowerCase();
    const filtered = state.items.filter((item) => {
      const categoryMatches = category === 'ALL' || item.category === category;
      const searchMatches = !search || `${item.title} ${item.item_key} ${item.category} ${item.notes || ''}`.toLowerCase().includes(search);
      return categoryMatches && searchMatches;
    });

    if (!state.items.length) {
      container.innerHTML = '<div class="empty">This onboarding record has no checklist items yet. Refresh the page, or contact your CRM administrator if the items were expected to exist.</div>';
      return;
    }
    if (!filtered.length) {
      container.innerHTML = '<div class="empty">No checklist items match this search or category.</div>';
      return;
    }

    const groups = new Map();
    filtered.forEach((item) => {
      const key = item.category || 'GENERAL';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });

    container.innerHTML = [...groups.entries()].map(([groupName, items]) => `
      <section class="checklist-group">
        <div class="category-heading">${escapeHtml(readable(groupName))} <span style="letter-spacing:0;color:#9996b0;font-weight:650">${items.length}</span></div>
        <div class="items-list">${items.map(renderItem).join('')}</div>
      </section>`).join('');
  }

  function renderItem(item) {
    const options = ITEM_STATUSES.slice();
    if (!item.is_required) options.push({ value: 'NOT_APPLICABLE', label: 'Not applicable' });
    if (item.status && !options.some((option) => option.value === item.status)) {
      options.push({ value: item.status, label: `${readable(item.status)} (existing)` });
    }
    const selectedStatus = item.status || 'NOT_REQUESTED';
    return `
      <article class="item-card" data-item-id="${escapeHtml(item.id)}">
        <div>
          <div class="item-title-row">
            <span class="item-title">${escapeHtml(item.title)}</span>
            <span class="${item.is_required ? 'required-tag' : 'optional-tag'}">${item.is_required ? 'Required' : 'Optional'}</span>
          </div>
          <div class="item-key">REF: ${escapeHtml(item.item_key || '—')}</div>
          <textarea class="item-notes" rows="2" data-item-notes="${escapeHtml(item.id)}" aria-label="Notes for ${escapeHtml(item.title)}" placeholder="Add a note or follow-up…">${escapeHtml(item.notes || '')}</textarea>
          <div class="save-state" data-save-state="${escapeHtml(item.id)}" aria-live="polite"></div>
        </div>
        <div class="item-control">
          <label for="status-${escapeHtml(item.id)}">Item status</label>
          <select class="item-status" id="status-${escapeHtml(item.id)}" data-item-status="${escapeHtml(item.id)}">
            ${options.map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === selectedStatus ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
          </select>
          <span class="small-note">${item.approved_at ? `Approved ${escapeHtml(new Date(item.approved_at).toLocaleDateString())}` : item.received_at ? `Received ${escapeHtml(new Date(item.received_at).toLocaleDateString())}` : 'Status saves automatically.'}</span>
        </div>
      </article>`;
  }

  function renderMetrics() {
    const required = state.items.filter((item) => item.is_required);
    const approved = required.filter((item) => item.status === 'APPROVED').length;
    const outstanding = required.filter((item) => item.status !== 'APPROVED').length;
    const percent = required.length ? Math.round((approved / required.length) * 100) : 0;
    byId('requiredCount').textContent = String(required.length);
    byId('approvedCount').textContent = String(approved);
    byId('outstandingCount').textContent = String(outstanding);
    byId('progressPercent').textContent = `${percent}%`;
    byId('progressSummary').textContent = `${approved} of ${required.length} required items approved`;
    byId('progressFill').style.width = `${percent}%`;
  }

  async function saveOnboardingDetails(event) {
    event.preventDefault();
    if (!state.activeOnboardingId || state.saving) return;
    const onboarding = state.onboarding.find((row) => row.id === state.activeOnboardingId);
    if (!onboarding) return;

    const status = byId('onboardingStatus').value;
    const existingCompletedAt = onboarding.completed_at;
    const completedAt = status === 'COMPLETED' ? (existingCompletedAt || new Date().toISOString()) : existingCompletedAt;
    if (status === 'READY_FOR_PRODUCTION' || status === 'COMPLETED') {
      const requiredItems = state.items.filter((item) => item.is_required);
      const outstandingItems = requiredItems.filter((item) => item.status !== 'APPROVED');
      if (outstandingItems.length > 0) {
        showAlert(`Cannot set status to ${readable(status)} yet. ${outstandingItems.length} required checklist item(s) still need approval.`, 'error');
        return;
      }
    }
    const payload = {
      status,
      target_completion_date: byId('targetDate').value || null,
      kickoff_at: fromLocalDateTime(byId('kickoffDate').value),
      completed_at: completedAt,
      notes: byId('onboardingNotes').value.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const button = byId('saveDetailsButton');
    button.disabled = true;
    button.textContent = 'Saving…';
    state.saving = true;
    try {
      const result = await state.db.from('client_onboarding').update(payload).eq('id', onboarding.id).select('*').single();
      if (result.error) throw result.error;
      const index = state.onboarding.findIndex((row) => row.id === onboarding.id);
      state.onboarding[index] = result.data;
      byId('recordStatusBadge').textContent = readable(result.data.status);
      byId('completedAt').value = toLocalDateTime(result.data.completed_at);
      renderOnboardingSelect();
      byId('onboardingSelect').value = state.activeOnboardingId;
      showAlert('Onboarding details saved successfully.', 'success');
    } catch (error) {
      console.error('Saving onboarding details failed:', error);
      showAlert(`Could not save onboarding details: ${error.message || 'Unexpected database error.'}`, 'error');
    } finally {
      state.saving = false;
      button.disabled = false;
      button.textContent = 'Save onboarding details';
    }
  }

  async function updateChecklistItem(itemId, changes) {
    const item = state.items.find((row) => row.id === itemId);
    if (!item) return;
    const stateLabel = document.querySelector(`[data-save-state="${CSS.escape(itemId)}"]`);
    if (stateLabel) stateLabel.textContent = 'Saving…';
    const payload = { ...changes, updated_at: new Date().toISOString() };

    if (changes.status === 'REQUESTED' && !item.requested_at) payload.requested_at = new Date().toISOString();
    if (changes.status === 'RECEIVED' && !item.received_at) payload.received_at = new Date().toISOString();
    if (changes.status === 'APPROVED' && !item.approved_at) payload.approved_at = new Date().toISOString();

    try {
      const result = await state.db
        .from('client_onboarding_items')
        .update(payload)
        .eq('id', itemId)
        .eq('onboarding_id', state.activeOnboardingId)
        .select('*')
        .single();
      if (result.error) throw result.error;
      const index = state.items.findIndex((row) => row.id === itemId);
      state.items[index] = result.data;
      if (stateLabel) stateLabel.textContent = 'Saved ✓';
      renderMetrics();
      // Keep the status-control value in sync without rebuilding the current card.
      const card = document.querySelector(`[data-item-id="${CSS.escape(itemId)}"]`);
      if (card) {
        const noteText = card.querySelector('.item-notes');
        if (noteText && changes.notes !== undefined) noteText.value = changes.notes || '';
      }
      if (changes.status !== undefined) {
        const statusControl = document.querySelector(`[data-item-status="${CSS.escape(itemId)}"]`);
        if (statusControl) statusControl.value = result.data.status;
      }
    } catch (error) {
      console.error('Checklist update failed:', error);
      if (stateLabel) stateLabel.textContent = 'Could not save';
      showAlert(`Checklist update failed: ${error.message || 'Unexpected database error.'}`, 'error');
    }
  }

  async function createOnboarding() {
    const projectId = byId('newProjectSelect').value;
    if (!projectId) {
      showAlert('Select a project first.', 'error');
      return;
    }
    if (state.onboarding.some((row) => row.project_id === projectId)) {
      showAlert('That project already has an onboarding record. Select it from the active onboarding list.', 'error');
      renderAvailableProjects();
      return;
    }

    const button = byId('createOnboardingButton');
    button.disabled = true;
    button.textContent = 'Creating…';
    try {
      const created = await state.db.from('client_onboarding').insert({
        project_id: projectId,
        status: 'NOT_STARTED',
        notes: 'Onboarding record created from the CRM onboarding page. Confirm scope, approvals, and verified payment before production.',
      }).select('*').single();
      if (created.error) throw created.error;

      const checklistRows = DEFAULT_CHECKLIST.map((item) => ({
        onboarding_id: created.data.id,
        ...item,
        status: 'NOT_REQUESTED',
      }));
      const insertedItems = await state.db.from('client_onboarding_items').insert(checklistRows);
      if (insertedItems.error) {
        // Roll back the new parent record if the checklist cannot be created.
        const rollback = await state.db.from('client_onboarding').delete().eq('id', created.data.id);
        if (rollback.error) {
          throw new Error(`Onboarding record was created, but checklist creation failed (${insertedItems.error.message}). Automatic cleanup also failed (${rollback.error.message}). Keep the new record and resolve the checklist issue before retrying.`);
        }
        throw insertedItems.error;
      }

      showAlert('Onboarding record and standard checklist created successfully.', 'success');
      const newId = created.data.id;
      await loadReferenceData();
      renderOnboardingSelect();
      renderAvailableProjects();
      await loadCurrentOnboarding(newId);
      const url = new URL(window.location.href);
      url.searchParams.set('id', newId);
      window.history.replaceState({}, '', url);
      byId('onboardingSelect').value = newId;
    } catch (error) {
      console.error('Creating onboarding failed:', error);
      showAlert(`Could not create onboarding: ${error.message || 'Unexpected database error.'}`, 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Create onboarding';
      renderAvailableProjects();
    }
  }

  async function refreshAll(preferredId = state.activeOnboardingId) {
    setLoading(true);
    clearAlert();
    try {
      state.db = getSupabaseClient();
      if (!state.db) {
        throw new Error('The Supabase client could not be initialized. Check the import at the top of ../js/onboarding.js and confirm ../js/supabase.js exports the authenticated client.');
      }
      const auth = await state.db.auth.getUser();
      if (auth.error) throw auth.error;
      if (!auth.data?.user) {
        throw new Error('You are not signed in to Supabase. Sign in through your existing CRM login page, then open onboarding.html again.');
      }

      await loadReferenceData();
      renderOnboardingSelect();
      renderAvailableProjects();
      const wantedId = preferredId && state.onboarding.some((row) => row.id === preferredId)
        ? preferredId
        : state.activeOnboardingId;
      await loadCurrentOnboarding(wantedId);
      setLoading(false);
    } catch (error) {
      console.error('Onboarding page initialization failed:', error);
      setLoading(false);
      byId('workspace').classList.add('hidden');
      byId('loadingPanel').classList.remove('hidden');
      byId('loadingPanel').innerHTML = `<strong>Onboarding could not load.</strong><p class="small-note">${escapeHtml(error.message || 'Unexpected error.')}</p><button class="button button-secondary" id="tryAgainButton" type="button">Try again</button>`;
      const retryButton = byId('tryAgainButton');
      if (retryButton) retryButton.addEventListener('click', () => { byId('loadingPanel').innerHTML = '<strong>Connecting to your CRM…</strong><p class="small-note">Loading onboarding records and project details from Supabase.</p>'; refreshAll(); });
    }
  }

  function bindEvents() {
    byId('onboardingSelect').addEventListener('change', async (event) => {
      const newId = event.target.value || null;
      state.activeOnboardingId = newId;
      const url = new URL(window.location.href);
      if (newId) url.searchParams.set('id', newId); else url.searchParams.delete('id');
      window.history.replaceState({}, '', url);
      try { await loadCurrentOnboarding(newId); }
      catch (error) { console.error(error); showAlert(`Could not load the selected checklist: ${error.message || 'Unexpected database error.'}`, 'error'); }
    });

    byId('detailsForm').addEventListener('submit', saveOnboardingDetails);
    byId('refreshButton').addEventListener('click', () => refreshAll(state.activeOnboardingId));
    byId('createOnboardingButton').addEventListener('click', createOnboarding);
    byId('categoryFilter').addEventListener('change', renderChecklist);
    byId('itemSearch').addEventListener('input', renderChecklist);

    byId('checklistContainer').addEventListener('change', async (event) => {
      const statusId = event.target.getAttribute('data-item-status');
      if (statusId) {
        await updateChecklistItem(statusId, { status: event.target.value });
        return;
      }
      const notesId = event.target.getAttribute('data-item-notes');
      if (notesId) await updateChecklistItem(notesId, { notes: event.target.value.trim() || null });
    });

    byId('checklistContainer').addEventListener('keydown', (event) => {
      // Ctrl/Cmd + Enter saves a note without needing to leave the textarea.
      const notesId = event.target.getAttribute('data-item-notes');
      if (notesId && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        updateChecklistItem(notesId, { notes: event.target.value.trim() || null });
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    refreshAll(new URLSearchParams(window.location.search).get('id'));
  });
})();
