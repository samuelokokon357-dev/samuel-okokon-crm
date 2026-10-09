import { supabase } from "./supabase.js";


// ========================================
// AUTHENTICATION
// ========================================

async function checkAuthentication() {

    const {
        data: { session }
    } = await supabase.auth.getSession();


    if (!session) {

        window.location.href = "../login.html";

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
    ).format(Number(value || 0));

}


// ========================================
// FORMAT STAGE
// ========================================

function formatStage(stage) {

    if (!stage) return "—";


    return stage
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(
            /\b\w/g,
            letter => letter.toUpperCase()
        );

}


// ========================================
// ESCAPE HTML
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
// LOAD LEADS
// ========================================

async function loadLeads() {

    const session =
        await checkAuthentication();


    if (!session) return;


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
            stage,
            estimated_value,
            created_at
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


        const tbody =
            document.getElementById(
                "leadsTableBody"
            );


        tbody.innerHTML = `

            <tr>

                <td colspan="5">

                    <div class="empty-state">

                        <strong>
                            Unable to load leads
                        </strong>

                        <p>
                            ${escapeHtml(error.message)}
                        </p>

                    </div>

                </td>

            </tr>

        `;

        return;

    }


    window.allLeads =
        leads || [];


    renderLeads(
        window.allLeads
    );

}


// ========================================
// RENDER LEADS
// ========================================

function renderLeads(leads) {

    const tbody =
        document.getElementById(
            "leadsTableBody"
        );


    const count =
        document.getElementById(
            "leadCount"
        );


    count.textContent =
        `${leads.length} ${
            leads.length === 1
                ? "lead"
                : "leads"
        }`;


    if (!leads.length) {

        tbody.innerHTML = `

            <tr>

                <td colspan="5">

                    <div class="empty-state">

                        <strong>
                            No leads found
                        </strong>

                        <p>
                            Add your first prospect to begin.
                        </p>

                    </div>

                </td>

            </tr>

        `;

        return;

    }


    tbody.innerHTML =
        leads.map(lead => {

            const contact =
                `${lead.first_name || ""} ${
                    lead.last_name || ""
                }`.trim();


            const date =
                new Date(
                    lead.created_at
                ).toLocaleDateString(
                    "en-NG",
                    {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                    }
                );


            return `

                <tr
                    class="lead-row"
                    data-id="${escapeHtml(lead.id)}"
                >

                    <td>

                        <strong>
                            ${escapeHtml(
                                lead.business_name ||
                                "Unnamed Business"
                            )}
                        </strong>

                    </td>


                    <td>
                        ${escapeHtml(
                            contact || "—"
                        )}
                    </td>


                    <td>

                        <span class="stage-badge">
                            ${escapeHtml(
                                formatStage(
                                    lead.stage
                                )
                            )}
                        </span>

                    </td>


                    <td>
                        ${formatNaira(
                            lead.estimated_value
                        )}
                    </td>


                    <td>
                        ${date}
                    </td>

                </tr>

            `;

        }).join("");


    document
        .querySelectorAll(".lead-row")
        .forEach(row => {

            row.addEventListener(
                "click",
                () => {

                    const id =
                        row.dataset.id;


                    if (!id) return;


                    window.location.href =
                        `lead.html?id=${encodeURIComponent(id)}`;

                }
            );

        });

}


// ========================================
// OPEN / CLOSE MODAL
// ========================================

const modal =
    document.getElementById(
        "leadModal"
    );


document
    .getElementById(
        "addLeadButton"
    )
    .addEventListener(
        "click",
        () => {

            modal.classList.add(
                "show"
            );


            document
                .getElementById(
                    "firstName"
                )
                .focus();

        }
    );


function closeModal() {

    modal.classList.remove(
        "show"
    );


    document
        .getElementById(
            "leadForm"
        )
        .reset();


    const message =
        document.getElementById(
            "leadFormMessage"
        );


    message.textContent = "";


    message.className =
        "form-message";

}


document
    .getElementById(
        "closeLeadModal"
    )
    .addEventListener(
        "click",
        closeModal
    );


document
    .getElementById(
        "cancelLeadButton"
    )
    .addEventListener(
        "click",
        closeModal
    );


modal.addEventListener(
    "click",
    event => {

        if (
            event.target === modal
        ) {

            closeModal();

        }

    }
);


// ========================================
// SAVE LEAD
// ========================================

document
    .getElementById(
        "leadForm"
    )
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const saveButton =
                document.getElementById(
                    "saveLeadButton"
                );


            const message =
                document.getElementById(
                    "leadFormMessage"
                );


            saveButton.disabled =
                true;


            saveButton.textContent =
                "Saving...";


            message.textContent = "";


            message.className =
                "form-message";


            try {

                const {
                    data: {
                        session
                    }
                } =
                    await supabase.auth
                        .getSession();


                if (!session) {

                    window.location.href =
                        "../login.html";

                    return;

                }


                const lead = {

                    first_name:
                        document
                            .getElementById(
                                "firstName"
                            )
                            .value
                            .trim(),

                    last_name:
                        document
                            .getElementById(
                                "lastName"
                            )
                            .value
                            .trim() ||
                        null,

                    business_name:
                        document
                            .getElementById(
                                "businessName"
                            )
                            .value
                            .trim() ||
                        null,

                    business_type:
                        document
                            .getElementById(
                                "businessType"
                            )
                            .value ||
                        null,

                    email:
                        document
                            .getElementById(
                                "email"
                            )
                            .value
                            .trim() ||
                        null,

                    phone:
                        document
                            .getElementById(
                                "phone"
                            )
                            .value
                            .trim() ||
                        null,

                    whatsapp:
                        document
                            .getElementById(
                                "whatsapp"
                            )
                            .value
                            .trim() ||
                        null,

                    website:
                        document
                            .getElementById(
                                "website"
                            )
                            .value
                            .trim() ||
                        null,

                    source:
                        document
                            .getElementById(
                                "source"
                            )
                            .value ||
                        null,

                    source_details:
                        document
                            .getElementById(
                                "sourceDetails"
                            )
                            .value
                            .trim() ||
                        null,

                    stage:
                        document
                            .getElementById(
                                "stage"
                            )
                            .value,

                    estimated_value:
                        Number(
                            document
                                .getElementById(
                                    "estimatedValue"
                                )
                                .value
                        ) || 0,

                    notes:
                        document
                            .getElementById(
                                "notes"
                            )
                            .value
                            .trim() ||
                        null,

                    owner_id:
                        session.user.id

                };


                const {
                    error
                } = await supabase
                    .from("leads")
                    .insert([
                        lead
                    ]);


                if (error) {

                    throw error;

                }


                message.textContent =
                    "Lead saved successfully.";


                message.className =
                    "form-message success";


                await loadLeads();


                setTimeout(
                    closeModal,
                    700
                );


            } catch (error) {

                console.error(
                    "Error saving lead:",
                    error
                );


                message.textContent =
                    error.message ||
                    "Unable to save lead.";


                message.className =
                    "form-message error";


            } finally {

                saveButton.disabled =
                    false;


                saveButton.textContent =
                    "Save Lead";

            }

        }
    );


// ========================================
// SEARCH
// ========================================

document
    .getElementById(
        "searchInput"
    )
    .addEventListener(
        "input",
        filterLeads
    );


// ========================================
// STAGE FILTER
// ========================================

document
    .getElementById(
        "stageFilter"
    )
    .addEventListener(
        "change",
        filterLeads
    );


// ========================================
// FILTER LEADS
// ========================================

function filterLeads() {

    const search =
        document
            .getElementById(
                "searchInput"
            )
            .value
            .toLowerCase()
            .trim();


    const stage =
        document
            .getElementById(
                "stageFilter"
            )
            .value;


    const filtered =
        window.allLeads.filter(
            lead => {

                const name =
                    `${lead.first_name || ""} ${
                        lead.last_name || ""
                    }`
                    .toLowerCase();


                const business =
                    (
                        lead.business_name ||
                        ""
                    )
                    .toLowerCase();


                const matchesSearch =
                    !search ||
                    name.includes(
                        search
                    ) ||
                    business.includes(
                        search
                    );


                const matchesStage =
                    stage === "ALL" ||
                    lead.stage === stage;


                return (
                    matchesSearch &&
                    matchesStage
                );

            }
        );


    renderLeads(
        filtered
    );

}


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

loadLeads();