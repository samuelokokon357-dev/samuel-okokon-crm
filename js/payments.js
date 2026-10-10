import { supabase } from "./supabase.js";


// ========================================
// GLOBAL DATA
// ========================================

window.allPayments = [];
window.allProposals = [];


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
// FORMAT TEXT
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
// NORMALIZE PAYMENT STATUS
// ========================================

function normalizePaymentStatus(value) {

    return String(value || "")
        .trim()
        .toUpperCase();

}


// ========================================
// FORMAT MONEY
// ========================================

function formatMoney(value, currency = "NGN") {

    const number = Number(value || 0);

    return new Intl.NumberFormat(
        currency === "USD" ? "en-US" : "en-NG",
        {
            style: "currency",
            currency,
            maximumFractionDigits: 2
        }
    ).format(number);

}


// ========================================
// FORMAT DATE
// ========================================

function formatDate(value) {

    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
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
// FORMAT DATE AND TIME
// ========================================

function formatDateTime(value) {

    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
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
// CURRENCY TOTALS
// ========================================

function createCurrencyTotals() {

    return {
        NGN: 0,
        USD: 0
    };

}


// ========================================
// UPDATE MONEY DISPLAY
// ========================================

function setMoneyDisplay(ngnId, usdId, totals) {

    document.getElementById(ngnId).textContent =
        formatMoney(totals.NGN, "NGN");

    document.getElementById(usdId).textContent =
        formatMoney(totals.USD, "USD");

}


// ========================================
// GET CLIENT LABEL
// ========================================

function getLeadLabel(lead) {

    if (!lead) {
        return "Unknown Client";
    }

    const business =
        lead.business_name || "Unnamed Business";

    const contact =
        `${lead.first_name || ""} ${lead.last_name || ""}`
            .trim();

    return contact
        ? `${business} — ${contact}`
        : business;

}


// ========================================
// LOAD PROPOSALS
// ========================================

async function loadProposals() {

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
            amount,
            currency,
            status,
            valid_until,
            created_at,
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
        .order("created_at", {
            ascending: false
        });

    if (error) {

        console.error(
            "Error loading proposals:",
            error
        );

        throw error;

    }

    window.allProposals = proposals || [];

    populateProposalSelect();

}


// ========================================
// POPULATE PROPOSAL SELECT
// ========================================

function populateProposalSelect() {

    const select =
        document.getElementById("paymentProposal");

    select.innerHTML = `
        <option value="">Select proposal</option>
    `;

    window.allProposals.forEach(proposal => {

        const project = proposal.projects || {};
        const lead = proposal.leads || {};

        const business =
            lead.business_name || "Unnamed Business";

        const label =
            `${proposal.title || "Untitled Proposal"} — ` +
            `${business} — ` +
            `${project.project_name || "No Project"} ` +
            `(${formatText(proposal.status)})`;

        const option = document.createElement("option");

        option.value = proposal.id;
        option.textContent = label;

        select.appendChild(option);

    });

}


// ========================================
// LOAD PAYMENTS
// ========================================

async function loadPayments() {

    const session = await checkAuthentication();

    if (!session) return;

    const {
        data: payments,
        error
    } = await supabase
        .from("crm_payments")
        .select(`
            id,
            lead_id,
            project_id,
            proposal_id,
            amount,
            currency,
            status,
            payment_method,
            reference,
            paid_at,
            notes,
            created_at,
            proposals (
                id,
                title,
                amount,
                currency,
                status
            ),
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
        .order("created_at", {
            ascending: false
        });

    if (error) {

        console.error(
            "Error loading payments:",
            error
        );

        document.getElementById(
            "paymentsTableBody"
        ).innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="empty-state">
                        <strong>Unable to load payments</strong>
                        <p>${escapeHtml(error.message)}</p>
                    </div>
                </td>
            </tr>
        `;

        return;

    }

    window.allPayments = payments || [];

    renderPayments(window.allPayments);

    await updateRevenueSummary();

}


// ========================================
// RENDER PAYMENTS
// ========================================

function renderPayments(payments) {

    const tbody =
        document.getElementById("paymentsTableBody");

    const count =
        document.getElementById("paymentCount");

    count.textContent =
        `${payments.length} ${
            payments.length === 1 ? "payment" : "payments"
        }`;

    if (!payments.length) {

        tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="empty-state">
                        <strong>No payments found</strong>
                        <p>Record your first client payment.</p>
                    </div>
                </td>
            </tr>
        `;

        return;

    }

    tbody.innerHTML = payments.map(payment => {

        const lead = payment.leads || {};
        const project = payment.projects || {};
        const proposal = payment.proposals || {};

        const status =
            normalizePaymentStatus(payment.status);

        const displayDate =
            status === "PAID" || status === "PARTIAL"
                ? payment.paid_at || payment.created_at
                : payment.paid_at || payment.created_at;

        return `
            <tr class="payment-row">

                <td>
                    ${escapeHtml(formatDate(displayDate))}
                </td>

                <td>
                    <strong>
                        ${escapeHtml(getLeadLabel(lead))}
                    </strong>
                </td>

                <td>
                    ${escapeHtml(project.project_name || "—")}
                </td>

                <td>
                    ${escapeHtml(proposal.title || "—")}
                </td>

                <td>
                    <strong>
                        ${escapeHtml(
                            formatMoney(
                                payment.amount,
                                payment.currency || "NGN"
                            )
                        )}
                    </strong>
                </td>

                <td>
                    ${escapeHtml(
                        formatText(payment.payment_method)
                    )}
                </td>

                <td>
                    <span class="
                        payment-status-badge
                        status-${status.toLowerCase()}
                    ">
                        ${escapeHtml(formatText(status))}
                    </span>
                </td>

                <td>
                    ${escapeHtml(payment.reference || "—")}
                </td>

            </tr>
        `;

    }).join("");

}


// ========================================
// UPDATE REVENUE SUMMARY
// ========================================

async function updateRevenueSummary() {

    const totalRevenue = createCurrencyTotals();
    const pending = createCurrencyTotals();
    const monthRevenue = createCurrencyTotals();

    const now = new Date();

    // ====================================
    // CALCULATE ACTUAL REVENUE
    // Only PAID payments count as received.
    // ====================================

    window.allPayments.forEach(payment => {

        const currency = payment.currency || "NGN";
        const amount = Number(payment.amount || 0);
        const status = normalizePaymentStatus(payment.status);

        if (!(currency in totalRevenue)) {
            return;
        }

        if (status === "PAID") {

            totalRevenue[currency] += amount;

            const paidDate = new Date(
                payment.paid_at || payment.created_at
            );

            if (
                !Number.isNaN(paidDate.getTime()) &&
                paidDate.getFullYear() === now.getFullYear() &&
                paidDate.getMonth() === now.getMonth()
            ) {

                monthRevenue[currency] += amount;

            }

        }

        /*
         * PENDING and PARTIAL are not counted
         * as fully received revenue.
         */
        if (
            status === "PENDING" ||
            status === "PARTIAL"
        ) {

            pending[currency] += amount;

        }

        /*
         * FAILED and REFUNDED are excluded
         * from actual revenue.
         */

    });


    // ====================================
    // OUTSTANDING ACCEPTED CONTRACT VALUE
    // ====================================

    const outstanding = createCurrencyTotals();

    const {
        data: acceptedProposals,
        error
    } = await supabase
        .from("proposals")
        .select(`
            id,
            amount,
            currency,
            status
        `)
        .eq("status", "ACCEPTED");

    if (error) {

        console.error(
            "Error loading accepted proposals:",
            error
        );

    } else {

        const paidByProposal = {};

        window.allPayments.forEach(payment => {

            const status =
                normalizePaymentStatus(payment.status);

            if (status !== "PAID") {
                return;
            }

            if (!payment.proposal_id) {
                return;
            }

            if (!paidByProposal[payment.proposal_id]) {
                paidByProposal[payment.proposal_id] = 0;
            }

            paidByProposal[payment.proposal_id] +=
                Number(payment.amount || 0);

        });


        (acceptedProposals || []).forEach(proposal => {

            const currency = proposal.currency || "NGN";

            if (!(currency in outstanding)) {
                return;
            }

            const contractValue =
                Number(proposal.amount || 0);

            const alreadyPaid =
                Number(paidByProposal[proposal.id] || 0);

            const balance =
                Math.max(contractValue - alreadyPaid, 0);

            outstanding[currency] += balance;

        });

    }


    // ====================================
    // DISPLAY TOTALS
    // ====================================

    setMoneyDisplay(
        "totalRevenueNgn",
        "totalRevenueUsd",
        totalRevenue
    );

    setMoneyDisplay(
        "pendingPaymentsNgn",
        "pendingPaymentsUsd",
        pending
    );

    setMoneyDisplay(
        "outstandingValueNgn",
        "outstandingValueUsd",
        outstanding
    );

    setMoneyDisplay(
        "monthRevenueNgn",
        "monthRevenueUsd",
        monthRevenue
    );

}


// ========================================
// UPDATE SELECTED PROPOSAL BALANCE
// ========================================

function updateProposalBalance() {

    const proposalId =
        document.getElementById("paymentProposal").value;

    const contractElement =
        document.getElementById("proposalContractValue");

    const paidElement =
        document.getElementById("proposalPaidValue");

    const outstandingElement =
        document.getElementById("proposalOutstandingValue");

    const proposal =
        window.allProposals.find(
            item => item.id === proposalId
        );

    if (!proposal) {

        contractElement.textContent = "—";
        paidElement.textContent = "—";
        outstandingElement.textContent = "—";

        return;

    }

    const currency = proposal.currency || "NGN";

    const alreadyPaid = window.allPayments
        .filter(payment =>
            payment.proposal_id === proposalId &&
            normalizePaymentStatus(payment.status) === "PAID"
        )
        .reduce(
            (total, payment) =>
                total + Number(payment.amount || 0),
            0
        );

    const contractValue =
        Number(proposal.amount || 0);

    const paymentAmount =
        Number(
            document.getElementById("paymentAmount").value || 0
        );

    const outstandingBefore =
        Math.max(contractValue - alreadyPaid, 0);

    const selectedStatus =
        normalizePaymentStatus(
            document.getElementById("paymentStatus").value
        );

    /*
     * Only a payment marked PAID is treated as
     * reducing the outstanding contract balance.
     */
    const outstandingAfter =
        selectedStatus === "PAID"
            ? Math.max(
                outstandingBefore - paymentAmount,
                0
            )
            : outstandingBefore;

    contractElement.textContent =
        formatMoney(contractValue, currency);

    paidElement.textContent =
        formatMoney(alreadyPaid, currency);

    outstandingElement.textContent =
        formatMoney(outstandingAfter, currency);

}


// ========================================
// SELECT PROPOSAL
// ========================================

document
    .getElementById("paymentProposal")
    .addEventListener("change", () => {

        const proposalId =
            document.getElementById("paymentProposal").value;

        const proposal =
            window.allProposals.find(
                item => item.id === proposalId
            );

        if (!proposal) {

            document.getElementById(
                "paymentProject"
            ).value = "";

            document.getElementById(
                "paymentClient"
            ).value = "";

            updateProposalBalance();

            return;

        }

        const project = proposal.projects || {};
        const lead = proposal.leads || {};

        document.getElementById(
            "paymentProject"
        ).value = project.project_name || "—";

        document.getElementById(
            "paymentClient"
        ).value = getLeadLabel(lead);

        document.getElementById(
            "paymentAmount"
        ).value = "";

        /*
         * Use the proposal's currency by default.
         * Currency consistency is validated before saving.
         */
        document.getElementById(
            "paymentCurrency"
        ).value = proposal.currency || "NGN";

        updateProposalBalance();

    });


// ========================================
// BALANCE INPUT LISTENERS
// ========================================

document
    .getElementById("paymentAmount")
    .addEventListener("input", updateProposalBalance);

document
    .getElementById("paymentStatus")
    .addEventListener("change", updateProposalBalance);


// ========================================
// DEFAULT PAYMENT DATE
// ========================================

function setDefaultPaymentDate() {

    const input =
        document.getElementById("paymentDate");

    const now = new Date();

    const localDate = new Date(
        now.getTime() -
        now.getTimezoneOffset() * 60000
    )
        .toISOString()
        .slice(0, 16);

    input.value = localDate;

}


// ========================================
// PAYMENT MODAL
// ========================================

const paymentModal =
    document.getElementById("paymentModal");


document
    .getElementById("addPaymentButton")
    .addEventListener("click", async () => {

        const button =
            document.getElementById("addPaymentButton");

        button.disabled = true;

        try {

            await loadProposals();

            setDefaultPaymentDate();

            paymentModal.classList.add("show");

            document.getElementById(
                "paymentProposal"
            ).focus();

        } catch (error) {

            console.error(
                "Unable to prepare payment form:",
                error
            );

            alert(
                error.message ||
                "Unable to load proposals."
            );

        } finally {

            button.disabled = false;

        }

    });


function closePaymentModal() {

    paymentModal.classList.remove("show");

    document.getElementById("paymentForm").reset();

    document.getElementById("paymentProject").value = "";
    document.getElementById("paymentClient").value = "";

    document.getElementById("proposalContractValue").textContent = "—";
    document.getElementById("proposalPaidValue").textContent = "—";
    document.getElementById("proposalOutstandingValue").textContent = "—";

    const message =
        document.getElementById("paymentFormMessage");

    message.textContent = "";
    message.className = "form-message";

}


document
    .getElementById("closePaymentModal")
    .addEventListener("click", closePaymentModal);

document
    .getElementById("cancelPaymentButton")
    .addEventListener("click", closePaymentModal);

paymentModal.addEventListener("click", event => {

    if (event.target === paymentModal) {
        closePaymentModal();
    }

});


// ========================================
// SAVE PAYMENT
// ========================================

document
    .getElementById("paymentForm")
    .addEventListener("submit", async event => {

        event.preventDefault();

        const button =
            document.getElementById("savePaymentButton");

        const message =
            document.getElementById("paymentFormMessage");

        const proposalId =
            document.getElementById("paymentProposal").value;

        const amount =
            Number(document.getElementById("paymentAmount").value);

        const currency =
            document.getElementById("paymentCurrency").value;

        /*
         * IMPORTANT:
         * This value is uppercase and matches
         * the crm_payment_status enum.
         */
        const status =
            normalizePaymentStatus(
                document.getElementById("paymentStatus").value
            );

        const paymentMethod =
            document.getElementById("paymentMethod").value || null;

        const paymentDate =
            document.getElementById("paymentDate").value;

        const reference =
            document.getElementById("paymentReference")
                .value
                .trim();

        const notes =
            document.getElementById("paymentNotes")
                .value
                .trim();


        // VALIDATE PROPOSAL

        if (!proposalId) {

            message.textContent =
                "Please select a proposal.";

            message.className =
                "form-message error";

            return;

        }


        // VALIDATE AMOUNT

        if (
            !Number.isFinite(amount) ||
            amount <= 0
        ) {

            message.textContent =
                "Please enter a valid payment amount greater than zero.";

            message.className =
                "form-message error";

            return;

        }


        // VALIDATE STATUS

        const validStatuses = [
            "PENDING",
            "PARTIAL",
            "PAID",
            "FAILED",
            "REFUNDED"
        ];

        if (!validStatuses.includes(status)) {

            message.textContent =
                "Invalid payment status. Please select a valid status.";

            message.className =
                "form-message error";

            return;

        }


        // VALIDATE PROPOSAL CONNECTION

        const proposal =
            window.allProposals.find(
                item => item.id === proposalId
            );

        if (!proposal) {

            message.textContent =
                "Unable to identify the selected proposal.";

            message.className =
                "form-message error";

            return;

        }


        /*
         * Prevent amounts from being recorded in
         * a different currency from the proposal.
         */
        const proposalCurrency =
            proposal.currency || "NGN";

        if (currency !== proposalCurrency) {

            message.textContent =
                `This proposal is in ${proposalCurrency}. ` +
                "The payment currency must match the proposal.";

            message.className =
                "form-message error";

            return;

        }


        button.disabled = true;
        button.textContent = "Saving...";

        message.textContent = "";
        message.className = "form-message";


        try {

            const session =
                await checkAuthentication();

            if (!session) return;


            const payment = {

                lead_id:
                    proposal.lead_id,

                project_id:
                    proposal.project_id,

                proposal_id:
                    proposal.id,

                amount:
                    amount,

                currency:
                    currency,

                status:
                    status,

                payment_method:
                    paymentMethod,

                reference:
                    reference || null,

                paid_at:
                    paymentDate
                        ? new Date(paymentDate).toISOString()
                        : null,

                notes:
                    notes || null

            };


            const {
                error
            } = await supabase
                .from("crm_payments")
                .insert([payment]);


            if (error) {
                throw error;
            }


            message.textContent =
                "Payment recorded successfully.";

            message.className =
                "form-message success";


            /*
             * Reload the actual records and recalculate
             * all revenue figures from Supabase.
             */
            await loadPayments();


            setTimeout(
                closePaymentModal,
                700
            );


        } catch (error) {

            console.error(
                "Error saving payment:",
                error
            );

            message.textContent =
                error.message ||
                "Unable to record payment.";

            message.className =
                "form-message error";

        } finally {

            button.disabled = false;
            button.textContent = "Save Payment";

        }

    });


// ========================================
// SEARCH AND FILTER
// ========================================

function filterPayments() {

    const search =
        document.getElementById("paymentSearchInput")
            .value
            .toLowerCase()
            .trim();

    const selectedStatus =
        document.getElementById("paymentStatusFilter").value;

    const selectedCurrency =
        document.getElementById("paymentCurrencyFilter").value;


    const filtered = window.allPayments.filter(payment => {

        const lead = payment.leads || {};
        const project = payment.projects || {};
        const proposal = payment.proposals || {};

        const client =
            getLeadLabel(lead).toLowerCase();

        const projectName =
            (project.project_name || "").toLowerCase();

        const proposalTitle =
            (proposal.title || "").toLowerCase();

        const reference =
            (payment.reference || "").toLowerCase();

        const status =
            normalizePaymentStatus(payment.status);

        const currency =
            payment.currency || "NGN";


        const matchesSearch =
            !search ||
            client.includes(search) ||
            projectName.includes(search) ||
            proposalTitle.includes(search) ||
            reference.includes(search);

        const matchesStatus =
            selectedStatus === "ALL" ||
            status === selectedStatus;

        const matchesCurrency =
            selectedCurrency === "ALL" ||
            currency === selectedCurrency;


        return (
            matchesSearch &&
            matchesStatus &&
            matchesCurrency
        );

    });


    renderPayments(filtered);

}


document
    .getElementById("paymentSearchInput")
    .addEventListener("input", filterPayments);

document
    .getElementById("paymentStatusFilter")
    .addEventListener("change", filterPayments);

document
    .getElementById("paymentCurrencyFilter")
    .addEventListener("change", filterPayments);


// ========================================
// LOGOUT
// ========================================

document
    .getElementById("logoutButton")
    .addEventListener("click", async () => {

        await supabase.auth.signOut();

        window.location.href = "../login.html";

    });


// ========================================
// START
// ========================================

async function startPaymentsPage() {

    const session =
        await checkAuthentication();

    if (!session) return;

    await loadPayments();

}

startPaymentsPage();