import { supabase } from "./supabase.js";


// ========================================
// GLOBAL DATA
// ========================================

window.allClients = [];

window.allLeads = [];


// Only these lead stages can be converted
// through this particular workflow.
const ELIGIBLE_LEAD_STAGES = [
    "WON",
    "ONBOARDING",
    "PRODUCTION",
    "LAUNCHED",
    "CLIENT"
];


// ========================================
// AUTHENTICATION
// ========================================

async function checkAuthentication() {

    const {
        data: { session },
        error
    } = await supabase.auth.getSession();


    if (error) {

        console.error(
            "Unable to verify session:",
            error
        );

        window.location.href = "../login.html";

        return null;

    }


    if (!session) {

        window.location.href = "../login.html";

        return null;

    }


    return session;

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
// FORMAT TEXT
// ========================================

function formatText(value) {

    if (!value) {

        return "—";

    }


    return String(value)
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(
            /\b\w/g,
            letter => letter.toUpperCase()
        );

}


// ========================================
// FORMAT DATE
// ========================================

function formatDate(value) {

    if (!value) {

        return "—";

    }


    const date = new Date(value);


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
// CONTACT NAME
// ========================================

function getContactName(lead) {

    return `${lead.first_name || ""} ${
        lead.last_name || ""
    }`.trim();

}


// ========================================
// LEAD LABEL
// ========================================

function getLeadLabel(lead) {

    const business =
        lead.business_name ||
        "Unnamed Business";


    const contact =
        getContactName(lead);


    return contact
        ? `${business} — ${contact}`
        : business;

}


// ========================================
// LOAD CLIENTS
// ========================================

async function loadClients() {

    const tbody =
        document.getElementById(
            "clientsTableBody"
        );


    tbody.innerHTML = `

        <tr>

            <td colspan="7">

                <div class="empty-state">

                    <p>
                        Loading clients...
                    </p>

                </div>

            </td>

        </tr>

    `;


    const {
        data: clients,
        error
    } = await supabase
        .from("clients")
        .select(`
            id,
            lead_id,
            business_name,
            contact_name,
            email,
            phone,
            whatsapp,
            website,
            status,
            notes,
            created_at,
            updated_at
        `)
        .order(
            "created_at",
            {
                ascending: false
            }
        );


    if (error) {

        console.error(
            "Error loading clients:",
            error
        );


        tbody.innerHTML = `

            <tr>

                <td colspan="7">

                    <div class="empty-state">

                        <strong>
                            Unable to load clients
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


        return false;

    }


    window.allClients =
        clients || [];


    renderClients(
        window.allClients
    );


    updateClientSummary(
        window.allClients
    );


    populateStatusFilter(
        window.allClients
    );


    return true;

}


// ========================================
// UPDATE CLIENT SUMMARY
// ========================================

function updateClientSummary(clients) {

    const activeClients =
        clients.filter(
            client =>
                String(
                    client.status || ""
                ).toUpperCase() === "ACTIVE"
        );


    document.getElementById(
        "totalClientCount"
    ).textContent =
        clients.length;


    document.getElementById(
        "activeClientCount"
    ).textContent =
        activeClients.length;


    document.getElementById(
        "otherClientCount"
    ).textContent =
        clients.length - activeClients.length;

}


// ========================================
// POPULATE STATUS FILTER
// ========================================

function populateStatusFilter(clients) {

    const select =
        document.getElementById(
            "clientStatusFilter"
        );


    const previousValue =
        select.value;


    const statuses = [
        ...new Set(
            clients
                .map(
                    client =>
                        client.status
                )
                .filter(Boolean)
        )
    ];


    select.innerHTML = `

        <option value="ALL">
            All Statuses
        </option>

    `;


    statuses.forEach(status => {

        const option =
            document.createElement("option");


        option.value =
            status;


        option.textContent =
            formatText(status);


        select.appendChild(option);

    });


    if (
        statuses.includes(
            previousValue
        )
    ) {

        select.value =
            previousValue;

    } else {

        select.value =
            "ALL";

    }

}


// ========================================
// RENDER CLIENTS
// ========================================

function renderClients(clients) {

    const tbody =
        document.getElementById(
            "clientsTableBody"
        );


    const count =
        document.getElementById(
            "clientCount"
        );


    count.textContent =
        `${clients.length} ${
            clients.length === 1
                ? "client"
                : "clients"
        }`;


    if (!clients.length) {

        tbody.innerHTML = `

            <tr>

                <td colspan="7">

                    <div class="empty-state">

                        <strong>
                            No clients found
                        </strong>

                        <p>
                            Convert an eligible lead into a client
                            to create your first client record.
                        </p>

                    </div>

                </td>

            </tr>

        `;


        return;

    }


    tbody.innerHTML =
        clients.map(client => {

            const status =
                String(
                    client.status || "ACTIVE"
                ).toUpperCase();


            const statusClass =
                status.toLowerCase();


            const leadProfileLink =
                client.lead_id
                    ? `
                        <a
                            href="lead.html?id=${encodeURIComponent(
                                client.lead_id
                            )}"
                            class="client-view-link"
                            title="Open original lead"
                        >
                            View Lead
                        </a>
                      `
                    : "—";


            return `

                <tr class="client-row">

                    <td>

                        <strong>
                            ${escapeHtml(
                                client.business_name ||
                                "Unnamed Business"
                            )}
                        </strong>

                    </td>


                    <td>

                        ${escapeHtml(
                            client.contact_name || "—"
                        )}

                    </td>


                    <td>

                        ${
                            client.email
                                ? `
                                    <a
                                        class="client-contact-link"
                                        href="mailto:${escapeHtml(
                                            client.email
                                        )}"
                                    >
                                        ${escapeHtml(
                                            client.email
                                        )}
                                    </a>
                                  `
                                : "—"
                        }

                    </td>


                    <td>

                        ${
                            client.phone
                                ? `
                                    <a
                                        class="client-contact-link"
                                        href="tel:${escapeHtml(
                                            client.phone
                                        )}"
                                    >
                                        ${escapeHtml(
                                            client.phone
                                        )}
                                    </a>
                                  `
                                : "—"
                        }

                    </td>


                    <td>

                        <span
                            class="
                                client-status-badge
                                client-status-${escapeHtml(
                                    statusClass
                                )}
                            "
                        >
                            ${escapeHtml(
                                formatText(status)
                            )}
                        </span>

                    </td>


                    <td>

                        ${escapeHtml(
                            formatDate(
                                client.created_at
                            )
                        )}

                    </td>


                    <td>

                        ${leadProfileLink}

                    </td>

                </tr>

            `;

        }).join("");

}


// ========================================
// FILTER CLIENTS
// ========================================

function filterClients() {

    const search =
        document.getElementById(
            "clientSearchInput"
        )
        .value
        .toLowerCase()
        .trim();


    const selectedStatus =
        document.getElementById(
            "clientStatusFilter"
        )
        .value;


    const filtered =
        window.allClients.filter(client => {

            const business =
                (
                    client.business_name || ""
                )
                .toLowerCase();


            const contact =
                (
                    client.contact_name || ""
                )
                .toLowerCase();


            const email =
                (
                    client.email || ""
                )
                .toLowerCase();


            const phone =
                (
                    client.phone || ""
                )
                .toLowerCase();


            const whatsapp =
                (
                    client.whatsapp || ""
                )
                .toLowerCase();


            const status =
                String(
                    client.status || ""
                ).toUpperCase();


            const matchesSearch =
                !search ||
                business.includes(search) ||
                contact.includes(search) ||
                email.includes(search) ||
                phone.includes(search) ||
                whatsapp.includes(search);


            const matchesStatus =
                selectedStatus === "ALL" ||
                client.status === selectedStatus;


            return (
                matchesSearch &&
                matchesStatus
            );

        });


    renderClients(filtered);

}


// ========================================
// LOAD ELIGIBLE LEADS
// ========================================

async function loadEligibleLeads() {

    const select =
        document.getElementById(
            "clientLead"
        );


    select.innerHTML = `

        <option value="">
            Loading eligible leads...
        </option>

    `;


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
            business_type,
            email,
            phone,
            whatsapp,
            website,
            stage,
            notes
        `)
        .in(
            "stage",
            ELIGIBLE_LEAD_STAGES
        )
        .order(
            "created_at",
            {
                ascending: false
            }
        );


    if (error) {

        console.error(
            "Error loading eligible leads:",
            error
        );


        select.innerHTML = `

            <option value="">
                Unable to load leads
            </option>

        `;


        throw error;

    }


    // Only show leads without an existing client.
    const existingLeadIds =
        new Set(
            window.allClients
                .map(
                    client =>
                        client.lead_id
                )
                .filter(Boolean)
        );


    window.allLeads =
        (leads || []).filter(
            lead =>
                !existingLeadIds.has(
                    lead.id
                )
        );


    select.innerHTML = `

        <option value="">
            Select an eligible lead
        </option>

    `;


    window.allLeads.forEach(lead => {

        const option =
            document.createElement("option");


        option.value =
            lead.id;


        option.textContent =
            `${getLeadLabel(lead)} — ${formatText(lead.stage)}`;


        select.appendChild(option);

    });


    if (!window.allLeads.length) {

        select.innerHTML = `

            <option value="">
                No eligible leads available
            </option>

        `;

    }

}


// ========================================
// POPULATE CLIENT FORM FROM LEAD
// ========================================

function populateClientForm(leadId) {

    const lead =
        window.allLeads.find(
            item =>
                item.id === leadId
        );


    if (!lead) {

        return;

    }


    document.getElementById(
        "clientBusinessName"
    ).value =
        lead.business_name || "";


    document.getElementById(
        "clientContactName"
    ).value =
        getContactName(lead);


    document.getElementById(
        "clientEmail"
    ).value =
        lead.email || "";


    document.getElementById(
        "clientPhone"
    ).value =
        lead.phone || "";


    document.getElementById(
        "clientWhatsapp"
    ).value =
        lead.whatsapp || "";


    document.getElementById(
        "clientWebsite"
    ).value =
        lead.website || "";


    document.getElementById(
        "clientNotes"
    ).value =
        lead.notes || "";

}


// ========================================
// OPEN CLIENT MODAL
// ========================================

const clientModal =
    document.getElementById(
        "clientModal"
    );


document
    .getElementById(
        "addClientButton"
    )
    .addEventListener(
        "click",
        async () => {

            const button =
                document.getElementById(
                    "addClientButton"
                );


            button.disabled =
                true;


            try {

                // Refresh existing clients before
                // preparing the conversion form.
                const loaded =
                    await loadClients();


                if (!loaded) {

                    throw new Error(
                        "Unable to verify existing clients."
                    );

                }


                await loadEligibleLeads();


                const message =
                    document.getElementById(
                        "clientFormMessage"
                    );


                message.textContent = "";

                message.className =
                    "form-message";


                clientModal.classList.add(
                    "show"
                );


                document.getElementById(
                    "clientLead"
                ).focus();

            } catch (error) {

                console.error(
                    "Unable to prepare client conversion:",
                    error
                );


                alert(
                    error.message ||
                    "Unable to load eligible leads."
                );

            } finally {

                button.disabled =
                    false;

            }

        }
    );


// ========================================
// LEAD SELECTION
// ========================================

document
    .getElementById(
        "clientLead"
    )
    .addEventListener(
        "change",
        event => {

            populateClientForm(
                event.target.value
            );

        }
    );


// ========================================
// CLOSE CLIENT MODAL
// ========================================

function closeClientModal() {

    clientModal.classList.remove(
        "show"
    );


    document.getElementById(
        "clientForm"
    ).reset();


    const message =
        document.getElementById(
            "clientFormMessage"
        );


    message.textContent = "";

    message.className =
        "form-message";

}


document
    .getElementById(
        "closeClientModal"
    )
    .addEventListener(
        "click",
        closeClientModal
    );


document
    .getElementById(
        "cancelClientButton"
    )
    .addEventListener(
        "click",
        closeClientModal
    );


clientModal.addEventListener(
    "click",
    event => {

        if (
            event.target === clientModal
        ) {

            closeClientModal();

        }

    }
);


// ========================================
// CREATE CLIENT
// ========================================

document
    .getElementById(
        "clientForm"
    )
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const button =
                document.getElementById(
                    "saveClientButton"
                );


            const message =
                document.getElementById(
                    "clientFormMessage"
                );


            const leadId =
                document.getElementById(
                    "clientLead"
                ).value;


            const businessName =
                document.getElementById(
                    "clientBusinessName"
                )
                .value
                .trim();


            const contactName =
                document.getElementById(
                    "clientContactName"
                )
                .value
                .trim();


            const email =
                document.getElementById(
                    "clientEmail"
                )
                .value
                .trim();


            const phone =
                document.getElementById(
                    "clientPhone"
                )
                .value
                .trim();


            const whatsapp =
                document.getElementById(
                    "clientWhatsapp"
                )
                .value
                .trim();


            const website =
                document.getElementById(
                    "clientWebsite"
                )
                .value
                .trim();


            const notes =
                document.getElementById(
                    "clientNotes"
                )
                .value
                .trim();


            if (!leadId) {

                message.textContent =
                    "Please select an eligible lead.";


                message.className =
                    "form-message error";


                return;

            }


            if (!businessName) {

                message.textContent =
                    "Business or school name is required.";


                message.className =
                    "form-message error";


                return;

            }


            // Make sure the lead is an eligible
            // conversion candidate.
            const lead =
                window.allLeads.find(
                    item =>
                        item.id === leadId
                );


            if (!lead) {

                message.textContent =
                    "The selected lead is no longer eligible. Refresh the form and try again.";


                message.className =
                    "form-message error";


                return;

            }


            button.disabled =
                true;


            button.textContent =
                "Creating Client...";


            message.textContent = "";

            message.className =
                "form-message";


            try {

                const session =
                    await checkAuthentication();


                if (!session) {

                    return;

                }


                /*
                 * Recheck whether the lead already
                 * has a client record.
                 *
                 * This helps prevent accidental
                 * duplicate conversion.
                 */

                const {
                    data: existingClient,
                    error: lookupError
                } = await supabase
                    .from("clients")
                    .select("id")
                    .eq(
                        "lead_id",
                        leadId
                    )
                    .maybeSingle();


                if (lookupError) {

                    throw lookupError;

                }


                if (existingClient) {

                    throw new Error(
                        "This lead already has a client record."
                    );

                }


                const client = {

                    lead_id:
                        leadId,

                    business_name:
                        businessName,

                    contact_name:
                        contactName || null,

                    email:
                        email || null,

                    phone:
                        phone || null,

                    whatsapp:
                        whatsapp || null,

                    website:
                        website || null,

                    status:
                        "ACTIVE",

                    notes:
                        notes || null

                };


                const {
                    error: insertError
                } = await supabase
                    .from("clients")
                    .insert([
                        client
                    ]);


                if (insertError) {

                    throw insertError;

                }


                message.textContent =
                    "Client created successfully.";


                message.className =
                    "form-message success";


                const loaded =
                    await loadClients();


                if (!loaded) {

                    console.warn(
                        "Client was created, but the list could not be refreshed."
                    );

                }


                // Refresh the form's candidate list
                // so the same lead cannot be selected again.
                await loadEligibleLeads();


                setTimeout(
                    closeClientModal,
                    800
                );


            } catch (error) {

                console.error(
                    "Error creating client:",
                    error
                );


                message.textContent =
                    error.message ||
                    "Unable to create client.";


                message.className =
                    "form-message error";


            } finally {

                button.disabled =
                    false;


                button.textContent =
                    "Create Client";

            }

        }
    );


// ========================================
// SEARCH
// ========================================

document
    .getElementById(
        "clientSearchInput"
    )
    .addEventListener(
        "input",
        filterClients
    );


// ========================================
// STATUS FILTER
// ========================================

document
    .getElementById(
        "clientStatusFilter"
    )
    .addEventListener(
        "change",
        filterClients
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
// START
// ========================================

async function startClientsPage() {

    const session =
        await checkAuthentication();


    if (!session) {

        return;

    }


    await loadClients();

}


startClientsPage();