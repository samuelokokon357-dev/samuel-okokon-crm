import { supabase } from "./supabase.js";


// ========================================
// AUTHENTICATION
// ========================================

async function checkAuthentication() {

    const {
        data: { session }
    } = await supabase.auth.getSession();


    if (!session) {

        window.location.href = "login.html";

        return null;
    }


    return session;

}


// ========================================
// FORMAT NAIRA
// ========================================

function formatNaira(value) {

    const amount = Number(value || 0);

    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 0
    }).format(amount);

}


// ========================================
// LOAD DASHBOARD
// ========================================

async function loadDashboard() {

    const session =
        await checkAuthentication();


    if (!session) return;


    await loadMetrics();

    await loadPipeline();

    await loadRecentLeads();

    await loadPriorityTasks();

}


// ========================================
// METRICS
// ========================================

async function loadMetrics() {

    const {
        data: leads,
        error: leadsError
    } = await supabase
        .from("leads")
        .select("id, stage, estimated_value");


    if (leadsError) {

        console.error(
            "Could not load leads:",
            leadsError
        );

        return;
    }


    const activeLeads =
        leads.filter(
            lead =>
                !["WON", "LOST"].includes(lead.stage)
        );


    const pipelineValue =
        activeLeads.reduce(
            (total, lead) =>
                total + Number(
                    lead.estimated_value || 0
                ),
            0
        );


    const wonLeads =
        leads.filter(
            lead => lead.stage === "WON"
        );


    const conversionRate =
        leads.length > 0
            ? Math.round(
                (wonLeads.length / leads.length) * 100
            )
            : 0;


    document.getElementById(
        "pipelineValue"
    ).textContent =
        formatNaira(pipelineValue);


    document.getElementById(
        "wonCount"
    ).textContent =
        wonLeads.length;


    document.getElementById(
        "conversionRate"
    ).textContent =
        `${conversionRate}%`;


    const {
        count: proposalCount
    } = await supabase
        .from("proposals")
        .select("*", {
            count: "exact",
            head: true
        })
        .in("status", [
            "DRAFT",
            "SENT",
            "VIEWED"
        ]);


    document.getElementById(
        "proposalsSent"
    ).textContent =
        proposalCount || 0;


    const {
        data: payments
    } = await supabase
        .from("crm_payments")
        .select("amount")
        .eq("status", "PAID");


    const collected =
        (payments || []).reduce(
            (total, payment) =>
                total + Number(
                    payment.amount || 0
                ),
            0
        );


    document.getElementById(
        "collectedValue"
    ).textContent =
        formatNaira(collected);

}


// ========================================
// PIPELINE
// ========================================

async function loadPipeline() {

    const {
        data: leads,
        error
    } = await supabase
        .from("leads")
        .select("stage");


    if (error) {

        console.error(
            "Pipeline error:",
            error
        );

        return;
    }


    const stages = {

        NEW_LEAD: "newLeadCount",

        QUALIFIED: "qualifiedCount",

        DISCOVERY: "discoveryCount",

        PROPOSAL: "proposalCount",

        FOLLOW_UP: "followUpCount",

        WON: "pipelineWonCount"

    };


    Object.entries(stages).forEach(
        ([stage, elementId]) => {

            const count =
                leads.filter(
                    lead =>
                        lead.stage === stage
                ).length;


            document.getElementById(
                elementId
            ).textContent = count;

        }
    );

}


// ========================================
// RECENT LEADS
// ========================================

async function loadRecentLeads() {

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
        )
        .limit(8);


    if (error) {

        console.error(
            "Recent leads error:",
            error
        );

        return;
    }


    const tbody =
        document.getElementById(
            "recentLeadsBody"
        );


    if (!leads.length) {

        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="empty-state">
                        <strong>No leads yet.</strong>
                        <p>
                            Your prospects will appear here.
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

                <tr>

                    <td>
                        <strong>
                            ${lead.business_name || "—"}
                        </strong>
                    </td>

                    <td>
                        ${contact || "—"}
                    </td>

                    <td>
                        ${formatStage(lead.stage)}
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

}


// ========================================
// FORMAT STAGE
// ========================================

function formatStage(stage) {

    if (!stage) return "—";


    return stage
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, letter =>
            letter.toUpperCase()
        );

}


// ========================================
// PRIORITY TASKS
// ========================================

async function loadPriorityTasks() {

    const {
        data: tasks,
        error
    } = await supabase
        .from("tasks")
        .select(`
            id,
            title,
            priority,
            due_at,
            status
        `)
        .eq("status", "OPEN")
        .order(
            "due_at",
            {
                ascending: true
            }
        )
        .limit(5);


    if (error) {

        console.error(
            "Tasks error:",
            error
        );

        return;
    }


    const container =
        document.getElementById(
            "priorityTasks"
        );


    if (!tasks.length) {

        container.innerHTML = `

            <div class="empty-state">

                <strong>
                    No urgent tasks
                </strong>

                <p>
                    Your next actions will appear here.
                </p>

            </div>

        `;

        return;
    }


    container.innerHTML =
        tasks.map(task => `

            <div class="pipeline-row">

                <span>
                    ${task.title}
                </span>

                <strong>
                    ${task.priority}
                </strong>

            </div>

        `).join("");

}


// ========================================
// LOGOUT
// ========================================

document
    .getElementById("logoutButton")
    .addEventListener(
        "click",
        async () => {

            await supabase.auth.signOut();

            window.location.href =
                "login.html";

        }
    );


// ========================================
// START
// ========================================

loadDashboard();