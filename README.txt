SAMUEL OKOKON CRM — COMMAND CENTER UPDATE

Files in this package:
- index.html           Replace the root CRM index.html.
- js/dashboard.js      Replace the existing dashboard JavaScript.
- css/dashboard.css    Add this new dashboard-only stylesheet.

Preservation notes:
- Keep js/supabase.js unchanged.
- Keep css/crm.css unchanged.
- Keep all other pages and scripts unchanged.
- This dashboard continues to read the existing leads, proposals, crm_payments, tasks, projects and activities tables.
- It does not create or modify any database tables.
- Course revenue table `payments` is not queried; CRM revenue uses `crm_payments` only.

Installation:
1. Back up the current root index.html and js/dashboard.js.
2. Copy this package's index.html to the root of the existing CRM repository.
3. Replace js/dashboard.js with this package's js/dashboard.js.
4. Add css/dashboard.css at the indicated path.
5. Save and refresh the application in your normal local server/browser.
6. Check the browser console and compare the dashboard values with the Leads, Proposals, Payments, Tasks and Projects pages.

Testing performed in this environment:
- JavaScript syntax check passed with Node.js.
- Static HTML audit found no duplicate IDs.
- Static reference audit found no dashboard JavaScript IDs missing from the HTML.
- A mocked data-driven runtime test passed for pipeline values, won count, sent/viewed proposal count, NGN and USD collected totals, outstanding accepted-contract balance, project metrics, task priority display, proposals, activities and recent leads.

Important limitation:
The live Supabase project, authenticated browser session, GitHub repository and Vercel deployment were not accessible from this environment. Therefore these are local/static and mocked-data tests, not a live production integration test. Complete the browser test in your own CRM after installing the files.

Business calculation notes:
- Pipeline value includes leads in NEW_LEAD, QUALIFIED, DISCOVERY, PROPOSAL and FOLLOW_UP stages.
- Won includes leads in WON, ONBOARDING, PRODUCTION, LAUNCHED and CLIENT stages.
- Awaiting response means proposal status SENT or VIEWED; drafts are excluded.
- Collected revenue counts CRM payments whose status is PAID. NGN and USD display separately.
- Outstanding is the remaining value of ACCEPTED proposals less linked PAID CRM payments, calculated separately by currency.
- Projects in ON_HOLD are not counted as active projects.
