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
// GLOBAL DATA
// ========================================

window.allProposals = [];

window.allProjects = [];


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
// FORMAT MONEY
// ========================================

function formatMoney(
    value,
    currency = "NGN"
) {

    return new Intl.NumberFormat(
        currency === "USD"
            ? "en-US"
            : "en-NG",
        {
            style: "currency",
            currency: currency,
            maximumFractionDigits: 0
        }
    ).format(
        Number(value || 0)
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
// LOAD PROJECTS
// ========================================

async function loadProjectsForProposalForm() {

    const select =
        document.getElementById(
            "proposalProject"
        );


    const {
        data: projects,
        error
    } = await supabase
        .from("projects")
        .select(`
            id,
            lead_id,
            project_name,
            status,
            estimated_value,
            leads (
                business_name,
                first_name,
                last_name
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

        return;

    }


    window.allProjects =
        projects || [];


    select.innerHTML = `

        <option value="">
            Select project
        </option>

    `;


    window.allProjects.forEach(
        project => {

            const lead =
                project.leads || {};


            const businessName =
                lead.business_name ||
                "Unnamed Business";


            const label =
                `${project.project_name || "Unnamed Project"} — ${businessName}`;


            select.insertAdjacentHTML(
                "beforeend",
                `
                    <option value="${escapeHtml(
                        project.id
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
// LOAD PROPOSALS
// ========================================

async function loadProposals() {

    const session =
        await checkAuthentication();


    if (!session) return;


    const {
        data: proposals,
        error
    } = await supabase
        .from("proposals")
        .select(`
            id,
            lead_id,
            project_id,
            title,
            description,
            amount,
            currency,
            status,
            valid_until,
            sent_at,
            viewed_at,
            accepted_at,
            rejected_at,
            notes,
            created_at,
            updated_at,
            projects (
                id,
                project_name
            ),
            leads (
                id,
                business_name,
                first_name,
                last_name
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
            "Error loading proposals:",
            error
        );


        const tbody =
            document.getElementById(
                "proposalsTableBody"
            );


        tbody.innerHTML = `

            <tr>

                <td colspan="6">

                    <div class="empty-state">

                        <strong>
                            Unable to load proposals
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


    window.allProposals =
        proposals || [];


    renderProposals(
        window.allProposals
    );


    updateProposalSummary(
        window.allProposals
    );

}


// ========================================
// UPDATE SUMMARY
// ========================================

function updateProposalSummary(
    proposals
) {

    const total =
        proposals.length;


    const sent =
        proposals.filter(
            proposal =>
                proposal.status === "SENT"
        ).length;


    const accepted =
        proposals.filter(
            proposal =>
                proposal.status === "ACCEPTED"
        );


    const acceptedValue =
        accepted.reduce(
            (sum, proposal) =>
                sum +
                Number(
                    proposal.amount || 0
                ),
            0
        );


    document.getElementById(
        "totalProposalCount"
    ).textContent =
        total;


    document.getElementById(
        "sentProposalCount"
    ).textContent =
        sent;


    document.getElementById(
        "acceptedProposalCount"
    ).textContent =
        accepted.length;


    document.getElementById(
        "acceptedProposalValue"
    ).textContent =
        formatMoney(
            acceptedValue,
            "NGN"
        );

}


// ========================================
// RENDER PROPOSALS
// ========================================

function renderProposals(
    proposals
) {

    const tbody =
        document.getElementById(
            "proposalsTableBody"
        );


    const count =
        document.getElementById(
            "proposalCount"
        );


    count.textContent =
        `${proposals.length} ${
            proposals.length === 1
                ? "proposal"
                : "proposals"
        }`;


    if (!proposals.length) {

        tbody.innerHTML = `

            <tr>

                <td colspan="6">

                    <div class="empty-state">

                        <strong>
                            No proposals found
                        </strong>

                        <p>
                            Create your first commercial proposal.
                        </p>

                    </div>

                </td>

            </tr>

        `;

        return;

    }


    tbody.innerHTML =
        proposals.map(
            proposal => {

                const lead =
                    proposal.leads || {};


                const project =
                    proposal.projects || {};


                const businessName =
                    lead.business_name ||
                    "Unnamed Business";


                const contactName =
                    `${lead.first_name || ""} ${
                        lead.last_name || ""
                    }`.trim();


                const clientName =
                    contactName
                        ? `${businessName} — ${contactName}`
                        : businessName;


                return `

                    <tr
                        class="proposal-row"
                        data-id="${escapeHtml(
                            proposal.id
                        )}"
                    >

                        <td>

                            <strong>
                                ${escapeHtml(
                                    proposal.title ||
                                    "Untitled Proposal"
                                )}
                            </strong>

                        </td>


                        <td>

                            <strong>
                                ${escapeHtml(
                                    project.project_name ||
                                    "No Project"
                                )}
                            </strong>

                            <br>

                            <small>
                                ${escapeHtml(
                                    clientName
                                )}
                            </small>

                        </td>


                        <td>
                            ${formatMoney(
                                proposal.amount,
                                proposal.currency
                            )}
                        </td>


                        <td>

                            <span
                                class="
                                    proposal-status-badge
                                    status-${(
                                        proposal.status ||
                                        ""
                                    ).toLowerCase()}
                                "
                            >
                                ${escapeHtml(
                                    formatText(
                                        proposal.status
                                    )
                                )}
                            </span>

                        </td>


                        <td>
                            ${formatDate(
                                proposal.valid_until
                            )}
                        </td>


                        <td>
                            ${formatDate(
                                proposal.created_at
                            )}
                        </td>

                    </tr>

                `;

            }
        ).join("");

}


// ========================================
// FILTER
// ========================================

function filterProposals() {

    const search =
        document
            .getElementById(
                "proposalSearchInput"
            )
            .value
            .toLowerCase()
            .trim();


    const status =
        document
            .getElementById(
                "proposalStatusFilter"
            )
            .value;


    const filtered =
        window.allProposals.filter(
            proposal => {

                const title =
                    (
                        proposal.title ||
                        ""
                    )
                    .toLowerCase();


                const project =
                    proposal.projects ||
                    {};


                const lead =
                    proposal.leads ||
                    {};


                const projectName =
                    (
                        project.project_name ||
                        ""
                    )
                    .toLowerCase();


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
                    title.includes(
                        search
                    ) ||
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
                    proposal.status === status;


                return (
                    matchesSearch &&
                    matchesStatus
                );

            }
        );


    renderProposals(
        filtered
    );

}


// ========================================
// MODAL
// ========================================

const proposalModal =
    document.getElementById(
        "proposalModal"
    );


document
    .getElementById(
        "addProposalButton"
    )
    .addEventListener(
        "click",
        async () => {

            await loadProjectsForProposalForm();


            proposalModal.classList.add(
                "show"
            );


            document
                .getElementById(
                    "proposalProject"
                )
                .focus();

        }
    );


function closeProposalModal() {

    proposalModal.classList.remove(
        "show"
    );


    document
        .getElementById(
            "proposalForm"
        )
        .reset();


    const message =
        document.getElementById(
            "proposalFormMessage"
        );


    message.textContent = "";


    message.className =
        "form-message";

}


document
    .getElementById(
        "closeProposalModal"
    )
    .addEventListener(
        "click",
        closeProposalModal
    );


document
    .getElementById(
        "cancelProposalButton"
    )
    .addEventListener(
        "click",
        closeProposalModal
    );


proposalModal.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            proposalModal
        ) {

            closeProposalModal();

        }

    }
);


// ========================================
// SAVE PROPOSAL
// ========================================

document
    .getElementById(
        "proposalForm"
    )
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const button =
                document.getElementById(
                    "saveProposalButton"
                );


            const message =
                document.getElementById(
                    "proposalFormMessage"
                );


            const projectId =
                document.getElementById(
                    "proposalProject"
                )
                .value;


            const title =
                document.getElementById(
                    "proposalTitle"
                )
                .value
                .trim();


            const amount =
                Number(
                    document.getElementById(
                        "proposalAmount"
                    )
                    .value
                );


            const currency =
                document.getElementById(
                    "proposalCurrency"
                )
                .value;


            const status =
                document.getElementById(
                    "proposalStatus"
                )
                .value;


            const validUntil =
                document.getElementById(
                    "proposalValidUntil"
                )
                .value ||
                null;


            const description =
                document.getElementById(
                    "proposalDescription"
                )
                .value
                .trim();


            const notes =
                document.getElementById(
                    "proposalNotes"
                )
                .value
                .trim();


            if (!projectId) {

                message.textContent =
                    "Please select a project.";


                message.className =
                    "form-message error";


                return;

            }


            if (!title) {

                message.textContent =
                    "Please enter a proposal title.";


                message.className =
                    "form-message error";


                return;

            }


            if (
                !Number.isFinite(
                    amount
                ) ||
                amount < 0
            ) {

                message.textContent =
                    "Please enter a valid proposal amount.";


                message.className =
                    "form-message error";


                return;

            }


            const selectedProject =
                window.allProjects.find(
                    project =>
                        project.id ===
                        projectId
                );


            if (!selectedProject) {

                message.textContent =
                    "Unable to identify the selected project.";


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


                const proposal = {

                    lead_id:
                        selectedProject.lead_id,

                    project_id:
                        projectId,

                    title:
                        title,

                    description:
                        description ||
                        null,

                    amount:
                        amount,

                    currency:
                        currency,

                    status:
                        status,

                    valid_until:
                        validUntil,

                    notes:
                        notes ||
                        null

                };


                const {
                    error
                } = await supabase
                    .from("proposals")
                    .insert([
                        proposal
                    ]);


                if (error) {

                    throw error;

                }


                message.textContent =
                    "Proposal saved successfully.";


                message.className =
                    "form-message success";


                await loadProposals();


                setTimeout(
                    closeProposalModal,
                    700
                );


            } catch (error) {

                console.error(
                    "Error saving proposal:",
                    error
                );


                message.textContent =
                    error.message ||
                    "Unable to save proposal.";


                message.className =
                    "form-message error";

            } finally {

                button.disabled =
                    false;


                button.textContent =
                    "Save Proposal";

            }

        }
    );


// ========================================
// SEARCH
// ========================================

document
    .getElementById(
        "proposalSearchInput"
    )
    .addEventListener(
        "input",
        filterProposals
    );


// ========================================
// STATUS FILTER
// ========================================

document
    .getElementById(
        "proposalStatusFilter"
    )
    .addEventListener(
        "change",
        filterProposals
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

async function startProposalsPage() {

    const session =
        await checkAuthentication();


    if (!session) return;


    await loadProposals();

}


startProposalsPage();