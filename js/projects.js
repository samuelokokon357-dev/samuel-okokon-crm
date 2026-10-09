import { supabase } from "./supabase.js";


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
            month: "short",
            year: "numeric"
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
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


// ========================================
// GLOBAL PROJECT DATA
// ========================================

window.allProjects = [];


// ========================================
// LOAD LEADS FOR PROJECT FORM
// ========================================

async function loadLeadsForProjectForm() {

    const select =
        document.getElementById(
            "projectLead"
        );


    const {
        data: leads,
        error
    } = await supabase
        .from("leads")
        .select(`
            id,
            first_name,
            last_name,
            business_name,
            stage
        `)
        .order(
            "created_at",
            {
                ascending: false
            }
        );


    if (error) {

        console.error(
            "Error loading leads:",
            error
        );

        return;

    }


    select.innerHTML = `

        <option value="">
            Select lead
        </option>

    `;


    (leads || []).forEach(
        lead => {

            const contactName =
                `${lead.first_name || ""} ${
                    lead.last_name || ""
                }`.trim();


            const business =
                lead.business_name ||
                "Unnamed Business";


            const label =
                contactName
                    ? `${business} — ${contactName}`
                    : business;


            select.insertAdjacentHTML(
                "beforeend",
                `
                    <option value="${escapeHtml(
                        lead.id
                    )}">

                        ${escapeHtml(
                            label
                        )}

                    </option>
                `
            );

        }
    );

}


// ========================================
// LOAD PROJECTS
// ========================================

async function loadProjects() {

    const session =
        await checkAuthentication();


    if (!session) return;


    const {
        data: projects,
        error
    } = await supabase
        .from("projects")
        .select(`
            id,
            lead_id,
            project_name,
            service_type,
            description,
            status,
            estimated_value,
            start_date,
            expected_launch_date,
            launched_at,
            created_at,
            updated_at,
            leads (
                id,
                first_name,
                last_name,
                business_name
            )
        `)
        .order(
            "created_at",
            {
                ascending: false
            }
        );


    if (error) {

        console.error(
            "Error loading projects:",
            error
        );


        const tbody =
            document.getElementById(
                "projectsTableBody"
            );


        tbody.innerHTML = `

            <tr>

                <td colspan="6">

                    <div class="empty-state">

                        <strong>
                            Unable to load projects
                        </strong>

                        <p>
                            ${escapeHtml(
                                error.message
                            )}
                        </p>

                    </div>

                </td>

            </tr>

        `;

        return;

    }


    window.allProjects =
        projects || [];


    renderProjects(
        window.allProjects
    );

}


// ========================================
// RENDER PROJECTS
// ========================================

function renderProjects(projects) {

    const tbody =
        document.getElementById(
            "projectsTableBody"
        );


    const count =
        document.getElementById(
            "projectCount"
        );


    count.textContent =
        `${projects.length} ${
            projects.length === 1
                ? "project"
                : "projects"
        }`;


    if (!projects.length) {

        tbody.innerHTML = `

            <tr>

                <td colspan="6">

                    <div class="empty-state">

                        <strong>
                            No projects found
                        </strong>

                        <p>
                            Create your first project to begin tracking delivery.
                        </p>

                    </div>

                </td>

            </tr>

        `;

        return;

    }


    tbody.innerHTML =
        projects.map(
            project => {

                const lead =
                    project.leads || {};


                const businessName =
                    lead.business_name ||
                    "Unnamed Business";


                const contactName =
                    `${lead.first_name || ""} ${
                        lead.last_name || ""
                    }`.trim();


                const clientLabel =
                    contactName
                        ? `${businessName} — ${contactName}`
                        : businessName;


                return `

                    <tr
                        class="project-row"
                        data-id="${escapeHtml(
                            project.id
                        )}"
                    >

                        <td>

                            <strong>
                                ${escapeHtml(
                                    project.project_name ||
                                    "Unnamed Project"
                                )}
                            </strong>

                        </td>


                        <td>
                            ${escapeHtml(
                                clientLabel
                            )}
                        </td>


                        <td>
                            ${escapeHtml(
                                formatText(
                                    project.service_type
                                )
                            )}
                        </td>


                        <td>

                            <span class="project-status-badge">
                                ${escapeHtml(
                                    formatText(
                                        project.status
                                    )
                                )}
                            </span>

                        </td>


                        <td>
                            ${formatNaira(
                                project.estimated_value
                            )}
                        </td>


                        <td>
                            ${formatDate(
                                project.expected_launch_date
                            )}
                        </td>

                    </tr>

                `;

            }
        ).join("");


    /*
     * Project profile will be connected
     * in the next project-management step.
     */

}


// ========================================
// FILTER PROJECTS
// ========================================

function filterProjects() {

    const search =
        document
            .getElementById(
                "projectSearchInput"
            )
            .value
            .toLowerCase()
            .trim();


    const status =
        document
            .getElementById(
                "projectStatusFilter"
            )
            .value;


    const filtered =
        window.allProjects.filter(
            project => {

                const projectName =
                    (
                        project.project_name ||
                        ""
                    )
                    .toLowerCase();


                const lead =
                    project.leads ||
                    {};


                const businessName =
                    (
                        lead.business_name ||
                        ""
                    )
                    .toLowerCase();


                const contactName =
                    `${lead.first_name || ""} ${
                        lead.last_name || ""
                    }`
                    .toLowerCase();


                const matchesSearch =
                    !search ||
                    projectName.includes(
                        search
                    ) ||
                    businessName.includes(
                        search
                    ) ||
                    contactName.includes(
                        search
                    );


                const matchesStatus =
                    status === "ALL" ||
                    project.status === status;


                return (
                    matchesSearch &&
                    matchesStatus
                );

            }
        );


    renderProjects(
        filtered
    );

}


// ========================================
// MODAL
// ========================================

const projectModal =
    document.getElementById(
        "projectModal"
    );


document
    .getElementById(
        "addProjectButton"
    )
    .addEventListener(
        "click",
        async () => {

            await loadLeadsForProjectForm();


            projectModal.classList.add(
                "show"
            );


            document
                .getElementById(
                    "projectLead"
                )
                .focus();

        }
    );


function closeProjectModal() {

    projectModal.classList.remove(
        "show"
    );


    document
        .getElementById(
            "projectForm"
        )
        .reset();


    const message =
        document.getElementById(
            "projectFormMessage"
        );


    message.textContent = "";


    message.className =
        "form-message";

}


document
    .getElementById(
        "closeProjectModal"
    )
    .addEventListener(
        "click",
        closeProjectModal
    );


document
    .getElementById(
        "cancelProjectButton"
    )
    .addEventListener(
        "click",
        closeProjectModal
    );


projectModal.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            projectModal
        ) {

            closeProjectModal();

        }

    }
);


// ========================================
// SAVE PROJECT
// ========================================

document
    .getElementById(
        "projectForm"
    )
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const button =
                document.getElementById(
                    "saveProjectButton"
                );


            const message =
                document.getElementById(
                    "projectFormMessage"
                );


            const leadId =
                document.getElementById(
                    "projectLead"
                )
                .value;


            const projectName =
                document.getElementById(
                    "projectName"
                )
                .value
                .trim();


            const serviceType =
                document.getElementById(
                    "serviceType"
                )
                .value ||
                null;


            const status =
                document.getElementById(
                    "projectStatus"
                )
                .value;


            const projectValue =
                Number(
                    document.getElementById(
                        "projectValue"
                    )
                    .value
                ) || 0;


            const description =
                document.getElementById(
                    "projectDescription"
                )
                .value
                .trim();


            const startDate =
                document.getElementById(
                    "projectStartDate"
                )
                .value ||
                null;


            const expectedLaunchDate =
                document.getElementById(
                    "projectLaunchDate"
                )
                .value ||
                null;


            if (!leadId) {

                message.textContent =
                    "Please select a lead.";


                message.className =
                    "form-message error";


                return;

            }


            if (!projectName) {

                message.textContent =
                    "Please enter a project name.";


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


                const project = {

                    lead_id:
                        leadId,

                    project_name:
                        projectName,

                    service_type:
                        serviceType,

                    description:
                        description ||
                        null,

                    status:
                        status,

                    estimated_value:
                        projectValue,

                    start_date:
                        startDate,

                    expected_launch_date:
                        expectedLaunchDate

                };


                const {
                    error
                } = await supabase
                    .from("projects")
                    .insert([
                        project
                    ]);


                if (error) {

                    throw error;

                }


                message.textContent =
                    "Project saved successfully.";


                message.className =
                    "form-message success";


                await loadProjects();


                setTimeout(
                    closeProjectModal,
                    700
                );


            } catch (error) {

                console.error(
                    "Error saving project:",
                    error
                );


                message.textContent =
                    error.message ||
                    "Unable to save project.";


                message.className =
                    "form-message error";

            } finally {

                button.disabled =
                    false;


                button.textContent =
                    "Save Project";

            }

        }
    );


// ========================================
// SEARCH
// ========================================

document
    .getElementById(
        "projectSearchInput"
    )
    .addEventListener(
        "input",
        filterProjects
    );


// ========================================
// STATUS FILTER
// ========================================

document
    .getElementById(
        "projectStatusFilter"
    )
    .addEventListener(
        "change",
        filterProjects
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
// START
// ========================================

async function startProjectsPage() {

    const session =
        await checkAuthentication();


    if (!session) return;


    await loadProjects();

}


startProjectsPage();