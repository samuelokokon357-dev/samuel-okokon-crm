import { supabase } from "./supabase.js";


// ========================================
// GLOBAL DATA
// ========================================

let allTasks = [];
let allLeads = [];
let allProjects = [];


// ========================================
// AUTHENTICATION
// ========================================

async function checkAuthentication() {

    const {
        data: { session },
        error
    } = await supabase.auth.getSession();

    if (error) {
        throw error;
    }

    if (!session) {

        window.location.href = "../login.html";

        return null;

    }

    return session;

}


// ========================================
// TEXT FORMATTING
// ========================================

function formatText(value) {

    if (!value) return "—";

    return String(value)
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(
            /\b\w/g,
            letter => letter.toUpperCase()
        );

}


// ========================================
// HTML ESCAPING
// ========================================

function escapeHtml(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


// ========================================
// DATE HELPERS
// ========================================

function isValidDate(value) {

    if (!value) return false;

    return !Number.isNaN(
        new Date(value).getTime()
    );

}


function localDateKey(value = new Date()) {

    const date = new Date(value);

    const year = date.getFullYear();

    const month = String(
        date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;

}


function formatDateTime(value) {

    if (!isValidDate(value)) {
        return "No due date";
    }

    return new Date(value).toLocaleString(
        "en-NG",
        {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        }
    );

}


function formatLocalDateTimeInput(date) {

    const local = new Date(
        date.getTime() -
        date.getTimezoneOffset() * 60000
    );

    return local
        .toISOString()
        .slice(0, 16);

}


// ========================================
// NORMALIZE TASK STATUS
// ========================================

function normalizeStatus(status) {

    return String(status || "")
        .trim()
        .toUpperCase();

}


function isCompleted(task) {

    return normalizeStatus(task.status) === "COMPLETED";

}


function isCancelled(task) {

    const status = normalizeStatus(task.status);

    return (
        status === "CANCELLED" ||
        status === "CANCELED"
    );

}


function isClosed(task) {

    return (
        isCompleted(task) ||
        isCancelled(task)
    );

}


// ========================================
// TASK CLASSIFICATION
// ========================================

function getTaskCategory(task) {

    if (isCompleted(task)) {
        return "COMPLETED";
    }

    if (isCancelled(task)) {
        return "CLOSED";
    }

    if (!isValidDate(task.due_at)) {
        return "OPEN";
    }

    const dueDate = new Date(task.due_at);

    const now = new Date();

    const dueKey = localDateKey(dueDate);

    const todayKey = localDateKey(now);


    // A due date in the past is overdue.
    if (dueDate.getTime() < now.getTime()) {

        return "OVERDUE";

    }


    if (dueKey === todayKey) {

        return "TODAY";

    }


    if (dueDate.getTime() > now.getTime()) {

        return "UPCOMING";

    }


    return "OPEN";

}


// ========================================
// LOOKUP HELPERS
// ========================================

function getLead(leadId) {

    return allLeads.find(
        lead => lead.id === leadId
    ) || null;

}


function getProject(projectId) {

    return allProjects.find(
        project => project.id === projectId
    ) || null;

}


function getContactName(lead) {

    if (!lead) return "";

    return `${lead.first_name || ""} ${
        lead.last_name || ""
    }`.trim();

}


function getLeadLabel(lead) {

    if (!lead) return "Unknown Lead";

    const business =
        lead.business_name || "Unnamed Business";

    const contact =
        getContactName(lead);

    return contact
        ? `${business} — ${contact}`
        : business;

}


// ========================================
// LOAD ALL CRM TASKS
// ========================================

async function loadTasks() {

    const {
        data: tasks,
        error: tasksError
    } = await supabase
        .from("tasks")
        .select(`
            id,
            lead_id,
            project_id,
            title,
            description,
            priority,
            status,
            due_at,
            completed_at,
            created_at
        `)
        .order(
            "due_at",
            {
                ascending: true,
                nullsFirst: false
            }
        );

    if (tasksError) {
        throw tasksError;
    }


    // Load references separately to avoid
    // unnecessary reliance on automatic joins.

    const [
        leadsResult,
        projectsResult
    ] = await Promise.all([

        supabase
            .from("leads")
            .select(`
                id,
                first_name,
                last_name,
                business_name
            `),

        supabase
            .from("projects")
            .select(`
                id,
                lead_id,
                project_name
            `)

    ]);


    if (leadsResult.error) {
        throw leadsResult.error;
    }

    if (projectsResult.error) {
        throw projectsResult.error;
    }


    allLeads =
        leadsResult.data || [];

    allProjects =
        projectsResult.data || [];

    allTasks =
        tasks || [];


    renderSummary();

    renderTasks();

}


// ========================================
// SUMMARY METRICS
// ========================================

function renderSummary() {

    const openTasks =
        allTasks.filter(
            task => !isClosed(task)
        );


    const overdueTasks =
        openTasks.filter(
            task =>
                getTaskCategory(task) === "OVERDUE"
        );


    const todayTasks =
        openTasks.filter(
            task =>
                getTaskCategory(task) === "TODAY"
        );


    const completedTasks =
        allTasks.filter(
            task => isCompleted(task)
        );


    document.getElementById(
        "openTaskCount"
    ).textContent =
        openTasks.length;


    document.getElementById(
        "overdueTaskCount"
    ).textContent =
        overdueTasks.length;


    document.getElementById(
        "todayTaskCount"
    ).textContent =
        todayTasks.length;


    document.getElementById(
        "completedTaskCount"
    ).textContent =
        completedTasks.length;


    const heading =
        document.getElementById(
            "attentionHeading"
        );


    const description =
        document.getElementById(
            "attentionDescription"
        );


    if (overdueTasks.length > 0) {

        heading.textContent =
            `${overdueTasks.length} overdue ${
                overdueTasks.length === 1
                    ? "task needs"
                    : "tasks need"
            } your attention`;


        description.textContent =
            "Start with overdue actions before moving to today's other follow-ups.";

        return;

    }


    if (todayTasks.length > 0) {

        heading.textContent =
            `${todayTasks.length} ${
                todayTasks.length === 1
                    ? "task is"
                    : "tasks are"
            } due today`;


        description.textContent =
            "Your overdue list is clear. Review today's tasks and follow-ups.";

        return;

    }


    if (openTasks.length > 0) {

        heading.textContent =
            "No overdue tasks. Keep moving.";


        description.textContent =
            `${openTasks.length} open ${
                openTasks.length === 1
                    ? "task remains"
                    : "tasks remain"
            }. Review the upcoming schedule.`;

        return;

    }


    heading.textContent =
        "You're all caught up.";


    description.textContent =
        "There are no open tasks. Add your next action whenever you need one.";

}


// ========================================
// RENDER TASK TABLE
// ========================================

function renderTasks() {

    const tbody =
        document.getElementById(
            "tasksTableBody"
        );


    const count =
        document.getElementById(
            "taskCount"
        );


    const search =
        document.getElementById(
            "taskSearchInput"
        )
        .value
        .toLowerCase()
        .trim();


    const view =
        document.getElementById(
            "taskViewFilter"
        ).value;


    const priority =
        document.getElementById(
            "taskPriorityFilter"
        ).value;


    const filteredTasks =
        allTasks.filter(task => {

            const lead =
                getLead(task.lead_id);


            const project =
                getProject(task.project_id);


            const title =
                String(
                    task.title || ""
                ).toLowerCase();


            const description =
                String(
                    task.description || ""
                ).toLowerCase();


            const leadLabel =
                getLeadLabel(
                    lead
                ).toLowerCase();


            const projectName =
                String(
                    project?.project_name || ""
                ).toLowerCase();


            const status =
                normalizeStatus(
                    task.status
                );


            const taskPriority =
                normalizeStatus(
                    task.priority
                );


            const category =
                getTaskCategory(task);


            const matchesSearch =
                !search ||
                title.includes(search) ||
                description.includes(search) ||
                leadLabel.includes(search) ||
                projectName.includes(search);


            let matchesView = true;


            if (view === "OPEN") {

                matchesView =
                    !isClosed(task);

            } else if (view === "OVERDUE") {

                matchesView =
                    category === "OVERDUE";

            } else if (view === "TODAY") {

                matchesView =
                    category === "TODAY";

            } else if (view === "UPCOMING") {

                matchesView =
                    category === "UPCOMING";

            } else if (view === "COMPLETED") {

                matchesView =
                    status === "COMPLETED";

            }


            const matchesPriority =
                priority === "ALL" ||
                taskPriority === priority;


            return (
                matchesSearch &&
                matchesView &&
                matchesPriority
            );

        });


    count.textContent =
        `${filteredTasks.length} ${
            filteredTasks.length === 1
                ? "task"
                : "tasks"
        }`;


    if (!filteredTasks.length) {

        tbody.innerHTML = `

            <tr>

                <td colspan="7">

                    <div class="empty-state">

                        <strong>
                            No matching tasks
                        </strong>

                        <p>
                            Try changing the filters or add a new task.
                        </p>

                    </div>

                </td>

            </tr>

        `;

        return;

    }


    // Keep actionable work near the top.
    filteredTasks.sort((a, b) => {

        const categoryOrder = {
            OVERDUE: 0,
            TODAY: 1,
            UPCOMING: 2,
            OPEN: 3,
            CLOSED: 4,
            COMPLETED: 5
        };


        const categoryA =
            categoryOrder[
                getTaskCategory(a)
            ] ?? 4;


        const categoryB =
            categoryOrder[
                getTaskCategory(b)
            ] ?? 4;


        if (categoryA !== categoryB) {

            return categoryA - categoryB;

        }


        if (!a.due_at && !b.due_at) {
            return 0;
        }

        if (!a.due_at) return 1;

        if (!b.due_at) return -1;


        return new Date(a.due_at) -
            new Date(b.due_at);

    });


    tbody.innerHTML =
        filteredTasks.map(task => {

            const lead =
                getLead(task.lead_id);


            const project =
                getProject(task.project_id);


            const category =
                getTaskCategory(task);


            const taskPriority =
                normalizeStatus(
                    task.priority || "MEDIUM"
                );


            const status =
                normalizeStatus(
                    task.status
                );


            const categoryLabel = {

                OVERDUE: "Overdue",

                TODAY: "Due Today",

                UPCOMING: "Upcoming",

                OPEN: "Open",

                COMPLETED: "Completed",

                CLOSED: "Cancelled"

            }[category] || formatText(status);


            const leadLink =
                task.lead_id
                    ? `
                        <a
                            class="task-lead-link"
                            href="lead.html?id=${encodeURIComponent(
                                task.lead_id
                            )}"
                        >
                            ${escapeHtml(
                                getLeadLabel(lead)
                            )}
                        </a>
                    `
                    : escapeHtml(
                        "No lead linked"
                    );


            const isActionable =
                !isClosed(task);


            const actionButton =
                isActionable
                    ? `
                        <button
                            type="button"
                            class="secondary-button task-complete-button"
                            data-task-id="${escapeHtml(
                                task.id
                            )}"
                        >
                            Complete
                        </button>
                      `
                    : `
                        <span class="task-finished-label">
                            ${escapeHtml(
                                formatText(status)
                            )}
                        </span>
                      `;


            return `

                <tr class="
                    global-task-row
                    ${category === "OVERDUE"
                        ? "global-task-overdue"
                        : ""}
                    ${category === "COMPLETED"
                        ? "global-task-completed"
                        : ""}
                ">

                    <td>

                        <strong class="global-task-title">
                            ${escapeHtml(
                                task.title ||
                                "Untitled Task"
                            )}
                        </strong>

                        ${
                            task.description
                                ? `
                                    <p class="global-task-description">
                                        ${escapeHtml(
                                            task.description
                                        )}
                                    </p>
                                  `
                                : ""
                        }

                    </td>


                    <td>
                        ${leadLink}
                    </td>


                    <td>
                        ${escapeHtml(
                            project?.project_name ||
                            "—"
                        )}
                    </td>


                    <td>

                        <span class="
                            task-priority
                            priority-${taskPriority.toLowerCase()}
                        ">
                            ${escapeHtml(
                                formatText(taskPriority)
                            )}
                        </span>

                    </td>


                    <td class="global-task-due">

                        ${escapeHtml(
                            formatDateTime(
                                task.due_at
                            )
                        )}

                    </td>


                    <td>

                        <span class="
                            global-task-status
                            global-status-${category.toLowerCase()}
                        ">
                            ${escapeHtml(categoryLabel)}
                        </span>

                    </td>


                    <td>
                        ${actionButton}
                    </td>

                </tr>

            `;

        }).join("");


    // Attach complete-task actions after rendering.

    document
        .querySelectorAll(
            ".task-complete-button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    await completeTask(
                        button.dataset.taskId,
                        button
                    );

                }
            );

        });

}


// ========================================
// COMPLETE TASK
// ========================================

async function completeTask(taskId, button) {

    if (!taskId) return;


    const confirmed =
        window.confirm(
            "Mark this task as completed?"
        );


    if (!confirmed) return;


    const originalText =
        button.textContent;


    button.disabled = true;

    button.textContent =
        "Saving...";


    try {

        const session =
            await checkAuthentication();


        if (!session) return;


        const {
            error
        } = await supabase
            .from("tasks")
            .update({

                status: "COMPLETED",

                completed_at:
                    new Date().toISOString()

            })
            .eq(
                "id",
                taskId
            );


        if (error) {

            throw error;

        }


        await loadTasks();


    } catch (error) {

        console.error(
            "Error completing task:",
            error
        );


        window.alert(
            error.message ||
            "Unable to complete the task."
        );


        button.disabled = false;

        button.textContent =
            originalText;

    }

}


// ========================================
// LOAD LEADS AND PROJECTS FOR FORM
// ========================================

function populateLeadSelect() {

    const select =
        document.getElementById(
            "globalTaskLead"
        );


    select.innerHTML = `

        <option value="">
            Select a lead
        </option>

    `;


    allLeads.forEach(lead => {

        const option =
            document.createElement(
                "option"
            );


        option.value =
            lead.id;


        option.textContent =
            getLeadLabel(
                lead
            );


        select.appendChild(option);

    });


    if (!allLeads.length) {

        select.innerHTML = `

            <option value="">
                No leads available
            </option>

        `;

    }

}


// ========================================
// PROJECT SELECT
// ========================================

function populateProjectSelect(leadId) {

    const select =
        document.getElementById(
            "globalTaskProject"
        );


    select.innerHTML = `

        <option value="">
            No project selected
        </option>

    `;


    const relevantProjects =
        allProjects.filter(
            project =>
                project.lead_id === leadId
        );


    relevantProjects.forEach(project => {

        const option =
            document.createElement(
                "option"
            );


        option.value =
            project.id;


        option.textContent =
            project.project_name ||
            "Unnamed Project";


        select.appendChild(option);

    });

}


// ========================================
// SELECT LEAD
// ========================================

document
    .getElementById(
        "globalTaskLead"
    )
    .addEventListener(
        "change",
        event => {

            populateProjectSelect(
                event.target.value
            );

        }
    );


// ========================================
// DEFAULT TASK DATE
// ========================================

function setDefaultTaskDate() {

    const tomorrow =
        new Date();


    tomorrow.setDate(
        tomorrow.getDate() + 1
    );


    tomorrow.setHours(
        9,
        0,
        0,
        0
    );


    document.getElementById(
        "globalTaskDueAt"
    ).value =
        formatLocalDateTimeInput(
            tomorrow
        );

}


// ========================================
// TASK MODAL
// ========================================

const taskModal =
    document.getElementById(
        "globalTaskModal"
    );


function openTaskModal() {

    document.getElementById(
        "globalTaskForm"
    ).reset();


    document.getElementById(
        "globalTaskMessage"
    ).textContent = "";


    document.getElementById(
        "globalTaskMessage"
    ).className =
        "form-message";


    populateLeadSelect();

    populateProjectSelect("");


    setDefaultTaskDate();


    taskModal.classList.add(
        "show"
    );


    document.getElementById(
        "globalTaskTitle"
    ).focus();

}


function closeTaskModal() {

    taskModal.classList.remove(
        "show"
    );


    document.getElementById(
        "globalTaskForm"
    ).reset();


    document.getElementById(
        "globalTaskMessage"
    ).textContent = "";

}


document
    .getElementById(
        "addTaskButton"
    )
    .addEventListener(
        "click",
        openTaskModal
    );


document
    .getElementById(
        "closeGlobalTaskModal"
    )
    .addEventListener(
        "click",
        closeTaskModal
    );


document
    .getElementById(
        "cancelGlobalTaskButton"
    )
    .addEventListener(
        "click",
        closeTaskModal
    );


taskModal.addEventListener(
    "click",
    event => {

        if (
            event.target === taskModal
        ) {

            closeTaskModal();

        }

    }
);


// ========================================
// CREATE TASK
// ========================================

document
    .getElementById(
        "globalTaskForm"
    )
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const button =
                document.getElementById(
                    "saveGlobalTaskButton"
                );


            const message =
                document.getElementById(
                    "globalTaskMessage"
                );


            const leadId =
                document.getElementById(
                    "globalTaskLead"
                ).value;


            const projectId =
                document.getElementById(
                    "globalTaskProject"
                ).value || null;


            const title =
                document.getElementById(
                    "globalTaskTitle"
                )
                .value
                .trim();


            const priority =
                document.getElementById(
                    "globalTaskPriority"
                ).value;


            const dueAt =
                document.getElementById(
                    "globalTaskDueAt"
                ).value;


            const description =
                document.getElementById(
                    "globalTaskDescription"
                )
                .value
                .trim();


            if (!leadId) {

                message.textContent =
                    "Please select the related lead.";


                message.className =
                    "form-message error";


                return;

            }


            if (!title) {

                message.textContent =
                    "Please enter a task title.";


                message.className =
                    "form-message error";


                return;

            }


            if (!dueAt) {

                message.textContent =
                    "Please select the due date and time.";


                message.className =
                    "form-message error";


                return;

            }


            const lead =
                getLead(leadId);


            if (!lead) {

                message.textContent =
                    "The selected lead could not be found. Refresh and try again.";


                message.className =
                    "form-message error";


                return;

            }


            if (
                projectId &&
                !allProjects.some(
                    project =>
                        project.id === projectId &&
                        project.lead_id === leadId
                )
            ) {

                message.textContent =
                    "The selected project does not belong to this lead.";


                message.className =
                    "form-message error";


                return;

            }


            button.disabled = true;

            button.textContent =
                "Saving...";


            message.textContent = "";


            try {

                const session =
                    await checkAuthentication();


                if (!session) return;


                const payload = {

                    lead_id: leadId,

                    project_id: projectId,

                    title: title,

                    description:
                        description || null,

                    priority: priority,

                    due_at:
                        new Date(
                            dueAt
                        ).toISOString(),

                    created_by:
                        session.user.id

                };


                const {
                    error
                } = await supabase
                    .from("tasks")
                    .insert([
                        payload
                    ]);


                if (error) {

                    throw error;

                }


                message.textContent =
                    "Task saved successfully.";


                message.className =
                    "form-message success";


                await loadTasks();


                setTimeout(
                    closeTaskModal,
                    700
                );


            } catch (error) {

                console.error(
                    "Error creating task:",
                    error
                );


                message.textContent =
                    error.message ||
                    "Unable to save the task.";


                message.className =
                    "form-message error";


            } finally {

                button.disabled = false;

                button.textContent =
                    "Save Task";

            }

        }
    );


// ========================================
// SEARCH AND FILTER EVENTS
// ========================================

document
    .getElementById(
        "taskSearchInput"
    )
    .addEventListener(
        "input",
        renderTasks
    );


document
    .getElementById(
        "taskViewFilter"
    )
    .addEventListener(
        "change",
        renderTasks
    );


document
    .getElementById(
        "taskPriorityFilter"
    )
    .addEventListener(
        "change",
        renderTasks
    );


// ========================================
// REFRESH
// ========================================

document
    .getElementById(
        "refreshTasksButton"
    )
    .addEventListener(
        "click",
        async () => {

            const button =
                document.getElementById(
                    "refreshTasksButton"
                );


            button.disabled = true;

            button.textContent =
                "Refreshing...";


            try {

                await loadTasks();

            } catch (error) {

                console.error(
                    "Error refreshing tasks:",
                    error
                );


                window.alert(
                    error.message ||
                    "Unable to refresh tasks."
                );

            } finally {

                button.disabled = false;

                button.textContent =
                    "↻ Refresh";

            }

        }
    );


// ========================================
// LOGOUT
// ========================================

document
    .getElementById(
        "logoutButton"
    )
    .addEventListener(
        "click",
        async () => {

            await supabase.auth.signOut();

            window.location.href =
                "../login.html";

        }
    );


// ========================================
// START TASK DASHBOARD
// ========================================

async function startTasksDashboard() {

    try {

        const session =
            await checkAuthentication();


        if (!session) return;


        await loadTasks();


    } catch (error) {

        console.error(
            "Unable to start Tasks Dashboard:",
            error
        );


        document.getElementById(
            "tasksTableBody"
        ).innerHTML = `

            <tr>

                <td colspan="7">

                    <div class="empty-state">

                        <strong>
                            Unable to load the Tasks Dashboard
                        </strong>

                        <p>
                            ${escapeHtml(
                                error.message ||
                                "An unexpected error occurred."
                            )}
                        </p>

                    </div>

                </td>

            </tr>

        `;

    }

}


startTasksDashboard();