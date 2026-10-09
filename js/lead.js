import { supabase } from "./supabase.js";


// ========================================
// GET LEAD ID FROM URL
// ========================================

const params =
    new URLSearchParams(
        window.location.search
    );


const leadId =
    params.get("id");


// ========================================
// AUTHENTICATION
// ========================================

async function checkAuthentication() {

    const {
        data: { session }
    } = await supabase.auth.getSession();


    if (!session) {

        window.location.href =
            "../login.html";

        return null;

    }


    return session;

}


// ========================================
// FORMAT NAIRA
// ========================================

function formatNaira(value) {

    return new Intl.NumberFormat(
        "en-NG",
        {
            style: "currency",
            currency: "NGN",
            maximumFractionDigits: 0
        }
    ).format(
        Number(value || 0)
    );

}


// ========================================
// FORMAT TEXT
// ========================================

function formatText(value) {

    if (!value) return "—";


    return String(value)
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(
            /\b\w/g,
            letter =>
                letter.toUpperCase()
        );

}


// ========================================
// FORMAT STAGE
// ========================================

function formatStage(stage) {

    return formatText(
        stage
    );

}


// ========================================
// FORMAT DATE
// ========================================

function formatDate(value) {

    if (!value) return "—";


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "—";

    }


    return date.toLocaleDateString(
        "en-NG",
        {
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );

}


// ========================================
// FORMAT DATE + TIME
// ========================================

function formatDateTime(value) {

    if (!value) return "—";


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "—";

    }


    return date.toLocaleString(
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


// ========================================
// ESCAPE HTML
// ========================================

function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


// ========================================
// LEAD ID VALIDATION
// ========================================

function hasLeadId() {

    return Boolean(
        leadId
    );

}


// ========================================
// LOAD LEAD
// ========================================

async function loadLead() {

    if (!hasLeadId()) {

        document.getElementById(
            "businessName"
        ).textContent =
            "Lead Not Found";


        document.getElementById(
            "contactName"
        ).textContent =
            "No lead ID was provided.";

        return null;

    }


    const session =
        await checkAuthentication();


    if (!session) return null;


    const {
        data: lead,
        error
    } = await supabase
        .from("leads")
        .select("*")
        .eq(
            "id",
            leadId
        )
        .single();


    if (error) {

        console.error(
            "Error loading lead:",
            error
        );


        document.getElementById(
            "businessName"
        ).textContent =
            "Unable to Load Lead";


        document.getElementById(
            "contactName"
        ).textContent =
            error.message ||
            "An error occurred.";

        return null;

    }


    displayLead(
        lead
    );


    return lead;

}


// ========================================
// DISPLAY LEAD
// ========================================

function displayLead(lead) {

    const contactName =
        `${lead.first_name || ""} ${
            lead.last_name || ""
        }`.trim();


    const businessName =
        lead.business_name ||
        "Unnamed Business";


    // HEADER

    document.getElementById(
        "businessName"
    ).textContent =
        businessName;


    document.getElementById(
        "contactName"
    ).textContent =
        contactName ||
        "No contact name provided";


    // CONTACT

    document.getElementById(
        "detailContactName"
    ).textContent =
        contactName || "—";


    document.getElementById(
        "detailEmail"
    ).textContent =
        lead.email || "—";


    document.getElementById(
        "detailPhone"
    ).textContent =
        lead.phone || "—";


    document.getElementById(
        "detailWhatsapp"
    ).textContent =
        lead.whatsapp || "—";


    document.getElementById(
        "detailWebsite"
    ).textContent =
        lead.website || "—";


    // OPPORTUNITY

    document.getElementById(
        "detailStage"
    ).textContent =
        formatStage(
            lead.stage
        );


    document.getElementById(
        "detailValue"
    ).textContent =
        formatNaira(
            lead.estimated_value
        );


    document.getElementById(
        "detailSource"
    ).textContent =
        formatText(
            lead.source
        );


    document.getElementById(
        "detailSourceDetails"
    ).textContent =
        lead.source_details ||
        "—";


    document.getElementById(
        "detailCreated"
    ).textContent =
        formatDate(
            lead.created_at
        );


    // BUSINESS

    document.getElementById(
        "detailBusinessName"
    ).textContent =
        businessName;


    document.getElementById(
        "detailBusinessType"
    ).textContent =
        formatText(
            lead.business_type
        );


    // NOTES

    document.getElementById(
        "notesContent"
    ).textContent =
        lead.notes ||
        "No notes have been added for this prospect.";


    // STAGE SELECT

    document.getElementById(
        "newStage"
    ).value =
        lead.stage || "NEW_LEAD";

}


// ========================================
// LOAD STAGE HISTORY
// ========================================

async function loadStageHistory() {

    const container =
        document.getElementById(
            "stageHistory"
        );


    if (!hasLeadId()) {

        container.innerHTML = `

            <div class="empty-state">

                <p>
                    No lead selected.
                </p>

            </div>

        `;

        return;

    }


    const {
        data: history,
        error
    } = await supabase
        .from("lead_stage_history")
        .select("*")
        .eq(
            "lead_id",
            leadId
        )
        .order(
            "changed_at",
            {
                ascending: false
            }
        );


    if (error) {

        console.error(
            "Error loading stage history:",
            error
        );


        container.innerHTML = `

            <div class="empty-state">

                <p>
                    Unable to load stage history.
                </p>

            </div>

        `;

        return;

    }


    if (
        !history ||
        !history.length
    ) {

        container.innerHTML = `

            <div class="empty-state">

                <p>
                    No stage history yet.
                </p>

            </div>

        `;

        return;

    }


    container.innerHTML =
        history.map(item => {

            const stage =
                formatStage(
                    item.to_stage
                );


            return `

                <div class="history-item">

                    <div class="history-dot"></div>


                    <div class="history-content">

                        <strong>
                            ${escapeHtml(stage)}
                        </strong>


                        <span>
                            ${escapeHtml(
                                formatDateTime(
                                    item.changed_at
                                )
                            )}
                        </span>


                        ${
                            item.notes
                                ? `
                                    <p>
                                        ${escapeHtml(
                                            item.notes
                                        )}
                                    </p>
                                  `
                                : ""
                        }

                    </div>

                </div>

            `;

        }).join("");

}


// ========================================
// LOAD ACTIVITIES
// ========================================

async function loadActivities() {

    const timeline =
        document.getElementById(
            "activityTimeline"
        );


    if (!hasLeadId()) {

        timeline.innerHTML = `

            <div class="empty-state">

                <p>
                    No lead selected.
                </p>

            </div>

        `;

        return;

    }


    const {
        data: activities,
        error
    } = await supabase
        .from("activities")
        .select(`
            id,
            activity_type,
            direction,
            subject,
            description,
            activity_at,
            created_at
        `)
        .eq(
            "lead_id",
            leadId
        )
        .order(
            "activity_at",
            {
                ascending: false
            }
        );


    if (error) {

        console.error(
            "Error loading activities:",
            error
        );


        timeline.innerHTML = `

            <div class="empty-state">

                <p>
                    Unable to load activities.
                </p>

            </div>

        `;

        return;

    }


    if (
        !activities ||
        !activities.length
    ) {

        timeline.innerHTML = `

            <div class="empty-state">

                <p>
                    No activities recorded yet.
                </p>

                <p>
                    Click "Log Activity" to record your first interaction.
                </p>

            </div>

        `;

        return;

    }


    timeline.innerHTML =
        activities.map(
            activity => {

                const type =
                    formatText(
                        activity.activity_type
                    );


                const direction =
                    formatText(
                        activity.direction
                    );


                const icon =
                    getActivityIcon(
                        activity.activity_type
                    );


                return `

                    <div class="activity-item">

                        <div class="activity-icon">
                            ${icon}
                        </div>


                        <div class="activity-content">

                            <div class="activity-top">

                                <strong>
                                    ${escapeHtml(
                                        activity.subject ||
                                        type
                                    )}
                                </strong>


                                <span>
                                    ${escapeHtml(
                                        formatDateTime(
                                            activity.activity_at
                                        )
                                    )}
                                </span>

                            </div>


                            <div class="activity-meta">

                                <span>
                                    ${escapeHtml(type)}
                                </span>


                                <span>
                                    ${escapeHtml(direction)}
                                </span>

                            </div>


                            ${
                                activity.description
                                    ? `
                                        <p>
                                            ${escapeHtml(
                                                activity.description
                                            )}
                                        </p>
                                      `
                                    : ""
                            }

                        </div>

                    </div>

                `;

            }
        ).join("");

}


// ========================================
// ACTIVITY ICON
// ========================================

function getActivityIcon(type) {

    const icons = {

        CALL: "☎",

        WHATSAPP: "◉",

        EMAIL: "✉",

        MEETING: "◫",

        NOTE: "✎",

        FOLLOW_UP: "↻"

    };


    return (
        icons[type] ||
        "•"
    );

}


// ========================================
// SET DEFAULT ACTIVITY DATE
// ========================================

function setDefaultActivityDate() {

    const input =
        document.getElementById(
            "activityDate"
        );


    const now =
        new Date();


    const localDate =
        new Date(
            now.getTime() -
            now.getTimezoneOffset() *
            60000
        )
        .toISOString()
        .slice(
            0,
            16
        );


    input.value =
        localDate;

}


// ========================================
// ACTIVITY MODAL
// ========================================

const activityModal =
    document.getElementById(
        "activityModal"
    );


document
    .getElementById(
        "addActivityButton"
    )
    .addEventListener(
        "click",
        () => {

            setDefaultActivityDate();


            activityModal.classList.add(
                "show"
            );

        }
    );


function closeActivityModal() {

    activityModal.classList.remove(
        "show"
    );


    document.getElementById(
        "activitySubject"
    ).value = "";


    document.getElementById(
        "activityDescription"
    ).value = "";


    document.getElementById(
        "activityMessage"
    ).textContent = "";


    document.getElementById(
        "activityMessage"
    ).className =
        "form-message";

}


document
    .getElementById(
        "closeActivityModal"
    )
    .addEventListener(
        "click",
        closeActivityModal
    );


document
    .getElementById(
        "cancelActivityButton"
    )
    .addEventListener(
        "click",
        closeActivityModal
    );


activityModal.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            activityModal
        ) {

            closeActivityModal();

        }

    }
);


// ========================================
// SAVE ACTIVITY
// ========================================

document
    .getElementById(
        "saveActivityButton"
    )
    .addEventListener(
        "click",
        async () => {

            const button =
                document.getElementById(
                    "saveActivityButton"
                );


            const message =
                document.getElementById(
                    "activityMessage"
                );


            const type =
                document.getElementById(
                    "activityType"
                ).value;


            const direction =
                document.getElementById(
                    "activityDirection"
                ).value;


            const subject =
                document.getElementById(
                    "activitySubject"
                ).value
                .trim();


            const description =
                document.getElementById(
                    "activityDescription"
                ).value
                .trim();


            const activityDate =
                document.getElementById(
                    "activityDate"
                ).value;


            if (!subject) {

                message.textContent =
                    "Please enter an activity subject.";


                message.className =
                    "form-message error";


                return;

            }


            if (!activityDate) {

                message.textContent =
                    "Please select the activity date.";


                message.className =
                    "form-message error";


                return;

            }


            button.disabled =
                true;


            button.textContent =
                "Saving...";


            message.textContent = "";


            try {

                const session =
                    await checkAuthentication();


                if (!session) return;


                const {
                    error
                } = await supabase
                    .from("activities")
                    .insert([
                        {

                            lead_id:
                                leadId,

                            activity_type:
                                type,

                            direction:
                                direction,

                            subject:
                                subject,

                            description:
                                description ||
                                null,

                            activity_at:
                                new Date(
                                    activityDate
                                ).toISOString(),

                            created_by:
                                session.user.id

                        }
                    ]);


                if (error) {

                    throw error;

                }


                message.textContent =
                    "Activity saved successfully.";


                message.className =
                    "form-message success";


                await loadActivities();


                setTimeout(
                    closeActivityModal,
                    700
                );


            } catch (error) {

                console.error(
                    "Error saving activity:",
                    error
                );


                message.textContent =
                    error.message ||
                    "Unable to save activity.";


                message.className =
                    "form-message error";

            } finally {

                button.disabled =
                    false;


                button.textContent =
                    "Save Activity";

            }

        }
    );


// ========================================
// LOAD TASKS
// ========================================

async function loadTasks() {

    const taskList =
        document.getElementById(
            "taskList"
        );


    const nextFollowUp =
        document.getElementById(
            "detailNextFollowUp"
        );


    if (!hasLeadId()) {

        taskList.innerHTML = `

            <div class="empty-state">

                <p>
                    No lead selected.
                </p>

            </div>

        `;


        nextFollowUp.textContent =
            "—";


        return;

    }


    const {
        data: tasks,
        error
    } = await supabase
        .from("tasks")
        .select(`
            id,
            title,
            description,
            priority,
            status,
            due_at,
            completed_at,
            created_at
        `)
        .eq(
            "lead_id",
            leadId
        )
        .order(
            "due_at",
            {
                ascending: true,
                nullsFirst: false
            }
        );


    if (error) {

        console.error(
            "Error loading tasks:",
            error
        );


        taskList.innerHTML = `

            <div class="empty-state">

                <p>
                    Unable to load tasks.
                </p>

            </div>

        `;


        nextFollowUp.textContent =
            "—";


        return;

    }


    const activeTasks =
        (tasks || [])
            .filter(
                task =>
                    task.status !==
                    "COMPLETED"
            )
            .filter(
                task =>
                    task.due_at
            )
            .sort(
                (a, b) =>
                    new Date(a.due_at) -
                    new Date(b.due_at)
            );


    if (activeTasks.length) {

        nextFollowUp.textContent =
            formatTaskDueDate(
                activeTasks[0].due_at
            );

    } else {

        nextFollowUp.textContent =
            "None scheduled";

    }


    if (
        !tasks ||
        !tasks.length
    ) {

        taskList.innerHTML = `

            <div class="empty-state">

                <p>
                    No tasks have been scheduled yet.
                </p>

                <p>
                    Add a follow-up so nothing slips through the cracks.
                </p>

            </div>

        `;

        return;

    }


    taskList.innerHTML =
        tasks.map(
            task => {

                const completed =
                    task.status ===
                    "COMPLETED";


                const overdue =
                    !completed &&
                    task.due_at &&
                    new Date(
                        task.due_at
                    ) <
                    new Date();


                const priority =
                    formatText(
                        task.priority
                    );


                return `

                    <div
                        class="
                            task-item
                            ${completed ? "completed" : ""}
                            ${overdue ? "overdue" : ""}
                        "
                    >

                        <div class="task-main">

                            <div class="task-title-row">

                                <strong>
                                    ${escapeHtml(
                                        task.title
                                    )}
                                </strong>


                                <span
                                    class="
                                        task-priority
                                        priority-${(
                                            task.priority ||
                                            ""
                                        ).toLowerCase()}
                                    "
                                >
                                    ${escapeHtml(
                                        priority
                                    )}
                                </span>

                            </div>


                            <div class="task-due">

                                <span>

                                    ${
                                        overdue
                                            ? "Overdue · "
                                            : ""
                                    }

                                    ${escapeHtml(
                                        formatTaskDueDate(
                                            task.due_at
                                        )
                                    )}

                                </span>

                            </div>


                            ${
                                task.description
                                    ? `
                                        <p>
                                            ${escapeHtml(
                                                task.description
                                            )}
                                        </p>
                                      `
                                    : ""
                            }

                        </div>


                        <div class="task-actions">

                            ${
                                completed

                                    ? `
                                        <span class="task-status completed-status">
                                            Completed
                                        </span>
                                      `

                                    : `
                                        <button
                                            type="button"
                                            class="secondary-button complete-task-button"
                                            data-task-id="${escapeHtml(
                                                task.id
                                            )}"
                                        >
                                            Complete
                                        </button>
                                      `
                            }

                        </div>

                    </div>

                `;

            }
        ).join("");


    document
        .querySelectorAll(
            ".complete-task-button"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        completeTask(
                            button.dataset.taskId
                        );

                    }
                );

            }
        );

}


// ========================================
// FORMAT TASK DATE
// ========================================

function formatTaskDueDate(
    dateValue
) {

    if (!dateValue) {

        return "No due date";

    }


    const date =
        new Date(
            dateValue
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "No due date";

    }


    return date.toLocaleString(
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


// ========================================
// DEFAULT TASK DATE
// ========================================

function setDefaultTaskDate() {

    const input =
        document.getElementById(
            "taskDueAt"
        );


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


    const localDate =
        new Date(
            tomorrow.getTime() -
            tomorrow.getTimezoneOffset() *
            60000
        )
        .toISOString()
        .slice(
            0,
            16
        );


    input.value =
        localDate;

}


// ========================================
// TASK MODAL
// ========================================

const taskModal =
    document.getElementById(
        "taskModal"
    );


document
    .getElementById(
        "addTaskButton"
    )
    .addEventListener(
        "click",
        () => {

            setDefaultTaskDate();


            taskModal.classList.add(
                "show"
            );


            document
                .getElementById(
                    "taskTitle"
                )
                .focus();

        }
    );


function closeTaskModal() {

    taskModal.classList.remove(
        "show"
    );


    document.getElementById(
        "taskTitle"
    ).value = "";


    document.getElementById(
        "taskDescription"
    ).value = "";


    document.getElementById(
        "taskPriority"
    ).value =
        "MEDIUM";


    document.getElementById(
        "taskMessage"
    ).textContent = "";


    document.getElementById(
        "taskMessage"
    ).className =
        "form-message";

}


document
    .getElementById(
        "closeTaskModal"
    )
    .addEventListener(
        "click",
        closeTaskModal
    );


document
    .getElementById(
        "cancelTaskButton"
    )
    .addEventListener(
        "click",
        closeTaskModal
    );


taskModal.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            taskModal
        ) {

            closeTaskModal();

        }

    }
);


// ========================================
// SAVE TASK
// ========================================

document
    .getElementById(
        "saveTaskButton"
    )
    .addEventListener(
        "click",
        async () => {

            const button =
                document.getElementById(
                    "saveTaskButton"
                );


            const message =
                document.getElementById(
                    "taskMessage"
                );


            const title =
                document.getElementById(
                    "taskTitle"
                )
                .value
                .trim();


            const priority =
                document.getElementById(
                    "taskPriority"
                )
                .value;


            const dueAt =
                document.getElementById(
                    "taskDueAt"
                )
                .value;


            const description =
                document.getElementById(
                    "taskDescription"
                )
                .value
                .trim();


            if (!title) {

                message.textContent =
                    "Please enter a task.";


                message.className =
                    "form-message error";


                return;

            }


            if (!dueAt) {

                message.textContent =
                    "Please select a due date.";


                message.className =
                    "form-message error";


                return;

            }


            button.disabled =
                true;


            button.textContent =
                "Saving...";


            message.textContent = "";


            try {

                const session =
                    await checkAuthentication();


                if (!session) return;


                const {
                    error
                } = await supabase
                    .from("tasks")
                    .insert([
                        {

                            lead_id:
                                leadId,

                            title:
                                title,

                            description:
                                description ||
                                null,

                            priority:
                                priority,

                            due_at:
                                new Date(
                                    dueAt
                                ).toISOString(),

                            created_by:
                                session.user.id

                        }
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
                    "Error saving task:",
                    error
                );


                message.textContent =
                    error.message ||
                    "Unable to save task.";


                message.className =
                    "form-message error";

            } finally {

                button.disabled =
                    false;


                button.textContent =
                    "Save Task";

            }

        }
    );


// ========================================
// COMPLETE TASK
// ========================================

async function completeTask(
    taskId
) {

    try {

        const session =
            await checkAuthentication();


        if (!session) return;


        const {
            error
        } = await supabase
            .from("tasks")
            .update({

                status:
                    "COMPLETED",

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


        alert(
            error.message ||
            "Unable to complete task."
        );

    }

}


// ========================================
// CHANGE STAGE MODAL
// ========================================

const stageModal =
    document.getElementById(
        "stageModal"
    );


document
    .getElementById(
        "changeStageButton"
    )
    .addEventListener(
        "click",
        () => {

            stageModal.classList.add(
                "show"
            );

        }
    );


function closeStageModal() {

    stageModal.classList.remove(
        "show"
    );


    document.getElementById(
        "stageNote"
    ).value = "";


    const message =
        document.getElementById(
            "stageMessage"
        );


    message.textContent = "";


    message.className =
        "form-message";

}


document
    .getElementById(
        "closeStageModal"
    )
    .addEventListener(
        "click",
        closeStageModal
    );


document
    .getElementById(
        "cancelStageButton"
    )
    .addEventListener(
        "click",
        closeStageModal
    );


stageModal.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            stageModal
        ) {

            closeStageModal();

        }

    }
);


// ========================================
// UPDATE STAGE
// ========================================

document
    .getElementById(
        "saveStageButton"
    )
    .addEventListener(
        "click",
        async () => {

            const button =
                document.getElementById(
                    "saveStageButton"
                );


            const message =
                document.getElementById(
                    "stageMessage"
                );


            const newStage =
                document.getElementById(
                    "newStage"
                ).value;


            button.disabled =
                true;


            button.textContent =
                "Updating...";


            message.textContent = "";


            try {

                const session =
                    await checkAuthentication();


                if (!session) return;


                const {
                    data: currentLead,
                    error: currentError
                } = await supabase
                    .from("leads")
                    .select("stage")
                    .eq(
                        "id",
                        leadId
                    )
                    .single();


                if (currentError) {

                    throw currentError;

                }


                if (
                    currentLead.stage ===
                    newStage
                ) {

                    message.textContent =
                        "The lead is already in this stage.";


                    message.className =
                        "form-message error";


                    return;

                }


                const {
                    error: updateError
                } = await supabase
                    .from("leads")
                    .update({
                        stage: newStage
                    })
                    .eq(
                        "id",
                        leadId
                    );


                if (updateError) {

                    throw updateError;

                }


                /*
                 * The database trigger already
                 * records stage changes in
                 * lead_stage_history.
                 *
                 * We intentionally do not
                 * insert another history row,
                 * preventing duplicates.
                 */


                message.textContent =
                    "Stage updated successfully.";


                message.className =
                    "form-message success";


                await loadLead();

                await loadStageHistory();


                setTimeout(
                    closeStageModal,
                    700
                );


            } catch (error) {

                console.error(
                    "Error updating stage:",
                    error
                );


                message.textContent =
                    error.message ||
                    "Unable to update stage.";


                message.className =
                    "form-message error";

            } finally {

                button.disabled =
                    false;


                button.textContent =
                    "Update Stage";

            }

        }
    );


// ========================================
// EDIT LEAD
// ========================================

document
    .getElementById(
        "editLeadButton"
    )
    .addEventListener(
        "click",
        () => {

            alert(
                "Lead editing will be added in the next CRM step."
            );

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

            await supabase.auth
                .signOut();


            window.location.href =
                "../login.html";

        }
    );


// ========================================
// START PROFILE
// ========================================

async function startLeadProfile() {

    const session =
        await checkAuthentication();


    if (!session) return;


    if (!hasLeadId()) {

        document.getElementById(
            "businessName"
        ).textContent =
            "Lead Not Found";


        document.getElementById(
            "contactName"
        ).textContent =
            "No lead ID was provided.";


        return;

    }


    await loadLead();

    await loadStageHistory();

    await loadActivities();

    await loadTasks();

}


startLeadProfile();