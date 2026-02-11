# Investment Email Automation Tool — Claude Code Spec

## Overview

Build a full-stack web application that automates follow-up emails to Investment Leaders (Pursuit Leaders), SELs, Ops Managers, and account teams based on investment statuses. The system reads investment data from an Excel file (exported from Zenith/Salesforce, stored on OneDrive), evaluates trigger conditions for configurable workstreams, generates emails from editable templates, and sends them through Microsoft Outlook via the Microsoft Graph API.

The tool includes a full admin frontend for managing every aspect of the system: workstreams, templates, contact mappings, settings, send history, and dashboards. **No code changes should ever be required for day-to-day operations or configuration changes.**

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth | NextAuth.js with Microsoft Entra ID (Azure AD) provider |
| Email Sending | Microsoft Graph API (`/me/sendMail`) — sends as HTML |
| File Reading | SheetJS (`xlsx` package) for parsing .xlsx files |
| Database | PostgreSQL via Prisma |
| Job Scheduler | node-cron (for automated scheduled runs) |
| Deployment | Azure App Service or Vercel |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       Frontend (Next.js)                         │
│  Dashboard │ Workstreams │ Templates │ Contact Mapping           │
│  Send History │ Investment Activity │ Settings │ Reports         │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                      Backend API Routes                          │
│  /api/workstreams │ /api/templates │ /api/contacts               │
│  /api/send │ /api/history │ /api/settings │ /api/data            │
└───────┬────────────────────┬─────────────────────┬───────────────┘
        │                    │                     │
┌───────▼──────┐    ┌───────▼──────┐    ┌─────────▼────────┐
│  OneDrive    │    │  PostgreSQL  │    │  Microsoft Graph  │
│  Excel File  │    │  Database    │    │  API (Outlook)    │
└──────────────┘    └──────────────┘    └──────────────────┘
```

---

## Data Source: Excel File

### Source File

The primary data source is an Excel file (`ZenithReport.xlsx`) stored on OneDrive. It is manually refreshed by the user from Zenith (Salesforce). The app reads from the sheet named **`FY26  Account Investments_  (2)`** (or configurable via settings).

### Excel Column Mapping

The app maps these Excel columns to internal field names. This mapping must be editable in the Settings page so column names can be updated without code changes.

| Internal Field | Excel Column | Description |
|---|---|---|
| `investment_id` | Investment ID | e.g., IV-005183 |
| `investment_status` | Investment Status | Earmarked, Submitted, Funded, Abandoned, etc. |
| `account_name` | Account | Client/company name |
| `investment_name` | Investment Name | Name of the investment |
| `investment_description` | Investment Description | Description text |
| `requested_amount` | Requested Soft Dollar.amount | Requested dollar amount |
| `requested_date` | Requested Date | Date investment was requested |
| `primary_industry` | Primary Industry | Used to look up SEL/Ops Manager contacts |
| `primary_op` | Primary OP | Offering portfolio |
| `budget_owner` | Budget Owner | Budget owner name |
| `investment_category` | Investment Category | Category type |
| `fiscal_year` | Fiscal Year | e.g., FY26 |
| `notes` | Notes | Freeform notes |
| `granted_period` | Granted Period | Grant period |
| `jupiter_id` | Jupiter Id | Jupiter Opportunity ID (e.g., JO-9115033) |
| `jupiter_stage` | Jupiter Stage | Jupiter status (Closed Won, Closed Lost, etc.) |
| `approved_soft_dollar` | Approved Soft Dollar.amount | Approved soft dollar amount |
| `approved_amount` | Approved Amount.amount | Total approved amount |
| `decision_date` | Decision Date | Date of approval decision |
| `investment_leader` | Investment Leader | Pursuit Leader name |
| `investment_leader_email` | Investment Leader Email | Pursuit Leader email |
| `requestor_email` | Requestor Email | Requestor's email |
| `follow_on_jupiter_ids` | Follow-on Jupiter IDs | Related JO IDs |
| `wbs_code` | WBS Code | WBS code |
| `deal_prioritization` | Deal Prioritization | Deal priority level |
| `soft_dollar_allocation` | Soft Dollar Allocation.amount | Allocated soft dollars |
| `project_type` | Project Type | Type of project |
| `funding_spent` | Funding Spent (Soft Dollar).amount | Amount spent |

### File Access

**Option A (Recommended):** The app reads the Excel file from OneDrive via the Microsoft Graph API (`/me/drive/items/{item-id}/content`). The user configures the OneDrive file path in Settings. The app fetches the latest version each time a workstream runs.

**Option B (Fallback):** The user uploads the Excel file manually through the app UI. The app stores it and uses the latest upload.

Support both options — the user can choose in Settings.

### Data Freshness Warning

Track when the Excel data was last loaded (either fetched from OneDrive or uploaded). Display a warning banner on the Dashboard if the data is older than a configurable number of days (default: 7 days). Message: *"⚠️ Investment data was last refreshed X days ago. Please refresh your Zenith export to ensure accuracy."*

---

## Industry Contact Mapping

### Purpose

Each investment's `Primary Industry` determines which SEL, Ops Manager, and Investment Concierge receive CC'd emails. This mapping is fully manageable through the frontend.

### Default Contact Mapping Data

Seed the database with the following mappings:

| Primary Industry | SEL Name | SEL Email | Ops Manager Name | Ops Manager Email | Concierge Name | Concierge Email |
|---|---|---|---|---|---|---|
| TMT – Technology | Miles Ewing | miewing@deloitte.com | Sandeep Chanda | schanda@deloitte.com | US Consulting Account Investment Concierge | accountinvestmentcommittee@deloitte.com |
| TMT – Telecom, Media & Entertainment | Tim Gross | timgross@deloitte.com | Sandeep Chanda | schanda@deloitte.com | US Consulting Account Investment Concierge | accountinvestmentcommittee@deloitte.com |
| LSHC – Health Care | Jeff Christoff | jchristoff@deloitte.com | Raghavendra Shetty | ragshetty@deloitte.com | US Consulting Account Investment Concierge | accountinvestmentcommittee@deloitte.com |
| LSHC – Life Sciences | Jeff Christoff | jchristoff@deloitte.com | Raghavendra Shetty | ragshetty@deloitte.com | US Consulting Account Investment Concierge | accountinvestmentcommittee@deloitte.com |
| FSI – Banking & Capital Markets | Sachin Sondhi | sacsondhi@deloitte.com | Ramya R | ramyar9@deloitte.com | US Consulting Account Investment Concierge | accountinvestmentcommittee@deloitte.com |
| FSI – Insurance | Sachin Sondhi | sacsondhi@deloitte.com | Ramya R | ramyar9@deloitte.com | US Consulting Account Investment Concierge | accountinvestmentcommittee@deloitte.com |
| FSI – Investment Management & Real Estate | Sachin Sondhi | sacsondhi@deloitte.com | Ramya R | ramyar9@deloitte.com | US Consulting Account Investment Concierge | accountinvestmentcommittee@deloitte.com |
| ER&I – Energy & Chemicals | Rahul Chhatwal | rchhatwal@deloitte.com | Swati Patil | swpatil@deloitte.com | US Consulting Account Investment Concierge | accountinvestmentcommittee@deloitte.com |
| ER&I – Industrial Products & Construction | Rahul Chhatwal | rchhatwal@deloitte.com | Swati Patil | swpatil@deloitte.com | US Consulting Account Investment Concierge | accountinvestmentcommittee@deloitte.com |
| ER&I – Power, Utilities & Renewables | Rahul Chhatwal | rchhatwal@deloitte.com | Swati Patil | swpatil@deloitte.com | US Consulting Account Investment Concierge | accountinvestmentcommittee@deloitte.com |
| ER&I – Mining & Metals | Rahul Chhatwal | rchhatwal@deloitte.com | Swati Patil | swpatil@deloitte.com | US Consulting Account Investment Concierge | accountinvestmentcommittee@deloitte.com |
| CONS – Automotive | Chris Holland | cholland@deloitte.com | Urvashi Jajoria | ujajoria@deloitte.com | US Consulting Account Investment Concierge | accountinvestmentcommittee@deloitte.com |
| CONS – Retails & Consumer Products | Chris Holland | cholland@deloitte.com | Urvashi Jajoria | ujajoria@deloitte.com | US Consulting Account Investment Concierge | accountinvestmentcommittee@deloitte.com |
| CONS – Transportation, Hospitality, and Services | Chris Holland | cholland@deloitte.com | Urvashi Jajoria | ujajoria@deloitte.com | US Consulting Account Investment Concierge | accountinvestmentcommittee@deloitte.com |

---

## Workstream Engine

### How Workstreams Work

Each workstream is a configurable automation rule stored in the database:

1. **Trigger conditions** filter the Excel data to find matching investments.
2. **Recipient rules** determine who gets emailed (To, CC) using investment fields + contact mapping.
3. **Email template** is populated with investment data and sent via Outlook.
4. **Cadence** determines how often the workstream runs (weekly, daily, or manual).

All of this is editable through the frontend UI.

### Trigger Logic Structure

Trigger conditions are stored as structured JSON so new workstreams can be created entirely from the UI:

```json
{
  "conditions": [
    {
      "field": "investment_status",
      "operator": "equals",
      "value": "Earmarked"
    },
    {
      "field": "decision_date",
      "operator": "older_than_days",
      "value": 60
    }
  ],
  "logic": "AND"
}
```

**Supported operators:** `equals`, `not_equals`, `in`, `not_in`, `older_than_days`, `newer_than_days`, `is_empty`, `is_not_empty`, `greater_than`, `less_than`, `contains`, `not_contains`.

### The 4 Initial Workstreams

**Workstream 1: Earmarked Investments (Past 60 Days)**
- **Cadence:** Weekly (Monday 8:00 AM ET)
- **Trigger:** `investment_status` = "Earmarked" AND `decision_date` older than 60 days
- **To:** Investment Leader (from `investment_leader_email` column)
- **CC:** SEL + Ops Manager (looked up from Contact Mapping by `primary_industry`) + Investment Concierge
- **Template:** Earmarked Investments template

**Workstream 2: Submitted Investment Pending Approval**
- **Cadence:** Weekly (Monday 8:00 AM ET)
- **Trigger:** `investment_status` = "Submitted" AND `requested_date` older than 60 days
- **To:** SEL (looked up from Contact Mapping by `primary_industry`)
- **CC:** Ops Manager (from Contact Mapping)
- **Template:** Submitted Pending Approval template

**Workstream 3: Closed JO Won / Verbal Commit**
- **Cadence:** Daily (8:00 AM ET)
- **Trigger:** `jupiter_stage` IN ["Closed Won", "Verbal Commit"] AND `investment_status` = "Earmarked"
- **To:** Investment Leader (from `investment_leader_email` column)
- **CC:** SEL + Ops Manager (from Contact Mapping) + Investment Concierge
- **Template:** Closed JO Won template

**Workstream 4: Closed JO Lost / Abandoned**
- **Cadence:** Daily (8:00 AM ET)
- **Trigger:** `jupiter_stage` IN ["Closed Lost", "Closed Abandoned"]
- **To:** Investment Leader (from `investment_leader_email` column)
- **CC:** SEL + Ops Manager (from Contact Mapping) + Investment Concierge
- **Template:** Closed Lost template OR Closed Abandoned template (selected based on `jupiter_stage` value — implement as sub-template logic within the workstream)

---

## Email Templates

### Default Templates

All templates are stored in the database and editable through the Template Editor UI. Templates use `{{placeholder}}` syntax for dynamic fields.

**Template 1 — Earmarked Investments:**

Subject: `Investment Follow-Up: {{account_name}} - {{investment_name}}`

```
Hello,

The following investment is currently earmarked for your pursuit. Could you please provide the SEL team with an update on the team's current efforts and our likelihood of closing the deal?

As a reminder, all approved investments are valid for 60 days. If this investment is no longer required, please notify the Account Investment Concierge team so that the funds can be released.

[TABLE]
| Account | Investment Name | Approved Amount | Follow-on JO-IDs | Expected Close Date |
| {{account_name}} | {{investment_name}} | {{approved_amount}} | {{follow_on_jupiter_ids}} | {{expected_close_date}} |
[/TABLE]

Regards,

Account Investment Concierge
```

**Template 2 — Submitted Investment Pending Approval:**

Subject: `Investments Pending Approval`

```
Hello,

The following investments are pending your approval.

[TABLE]
| Investment Name | Account Name | Investment ID | Submission Date | Jupiter ID | Jupiter Status |
| {{investment_name}} | {{account_name}} | {{investment_id}} | {{requested_date}} | {{jupiter_id}} | {{jupiter_stage}} |
[/TABLE]

Please let us know if these investments are still valid or if any action is needed from the Account Investment Concierge to move this forward.

Regards,

Account Investment Concierge
```

**Template 3 — Closed JO Won:**

Subject: `Congratulations – {{jupiter_stage}} at {{account_name}}`

```
Hello,

Congratulations on the recent {{jupiter_stage}} at {{account_name}}. To ensure that your team has the XYZ code in a timely manner, please let us know when you are ready for the XYZ code to be created and we will kick off the code creation process.

Additionally, please review the Zenith entry and ensure that all relevant follow on Jupiter ID's are listed and a pricing model is attached to the entry.

As a reminder, pricing model details are:

• Fixed fee at the approved investment amount
• 45% engagement margin
• Only resource hours (no contingency or expenses)
• Only FY26 resource hours
• Open the Tier 1 XYZ tab via Engagement Metrics > Additional Summary > Consulting Investments XYZ Set-Up > XYZ Default Fields Macro (top right of the tab)
• Ensure all fields are completed (look for green checkmarks)
• Start/End date information filled out

Regards,

{{sender_name}}
Investment Concierge Team
```

**Template 4a — Closed JO Lost:**

Subject: `Investment Status Update – {{account_name}} ({{investment_name}})`

```
Hello,

There is an approved investment in Zenith for {{account_name}} ({{investment_name}}) with the following status in Jupiter: {{jupiter_stage}}. This approval was given on {{decision_date}}. The current Jupiter Status is showing Closed Lost. Based on this information, we will be closing the investment as Lost in Zenith.

Regards,

{{sender_name}}
Investments Concierge Team
```

**Template 4b — Closed Abandoned:**

Subject: `Investment Status Update – {{account_name}} ({{investment_name}})`

```
Hello,

There is an approved investment in Zenith for {{account_name}} ({{investment_name}}) with the following status in Jupiter: {{jupiter_stage}}. This approval was given on {{decision_date}}. The current Jupiter Status is showing Closed Abandoned. Based on this information, we will be closing the investment as Abandoned in Zenith.

Regards,

{{sender_name}}
Investments Concierge Team
```

### Available Template Placeholders

| Placeholder | Source | Description |
|---|---|---|
| `{{investment_id}}` | Excel | Investment ID (e.g., IV-005183) |
| `{{investment_status}}` | Excel | Current Zenith status |
| `{{account_name}}` | Excel | Account/client name |
| `{{investment_name}}` | Excel | Investment name |
| `{{investment_description}}` | Excel | Investment description |
| `{{requested_amount}}` | Excel | Requested soft dollar amount |
| `{{requested_date}}` | Excel | Date investment was requested |
| `{{primary_industry}}` | Excel | Primary industry |
| `{{primary_op}}` | Excel | Primary offering portfolio |
| `{{budget_owner}}` | Excel | Budget owner |
| `{{fiscal_year}}` | Excel | Fiscal year |
| `{{notes}}` | Excel | Notes field |
| `{{jupiter_id}}` | Excel | Jupiter Opportunity ID |
| `{{jupiter_stage}}` | Excel | Jupiter status |
| `{{approved_soft_dollar}}` | Excel | Approved soft dollar amount |
| `{{approved_amount}}` | Excel | Total approved amount |
| `{{decision_date}}` | Excel | Decision/approval date |
| `{{investment_leader}}` | Excel | Investment Leader name |
| `{{investment_leader_email}}` | Excel | Investment Leader email |
| `{{follow_on_jupiter_ids}}` | Excel | Related JO IDs |
| `{{wbs_code}}` | Excel | WBS code |
| `{{sel_name}}` | Contact Mapping | SEL name for this industry |
| `{{sel_email}}` | Contact Mapping | SEL email for this industry |
| `{{ops_manager_name}}` | Contact Mapping | Ops Manager name |
| `{{ops_manager_email}}` | Contact Mapping | Ops Manager email |
| `{{concierge_name}}` | Contact Mapping | Investment Concierge name |
| `{{concierge_email}}` | Contact Mapping | Investment Concierge email |
| `{{sender_name}}` | App Settings | Sender's name |
| `{{today_date}}` | System | Current date |
| `{{expected_close_date}}` | Excel | Expected close date (if available) |

---

## Frontend Pages

### 1. Dashboard (`/`)

The primary landing page. Shows the current state of everything at a glance.

**Summary Cards (top row):**
- Total investments matching each workstream's trigger RIGHT NOW (e.g., "12 Earmarked past 60 days", "5 Submitted pending", "3 new Closed Won", "2 Closed Lost/Abandoned")
- Total emails sent this week
- Total workstreams active
- Next scheduled run time

**Data Freshness Banner:**
- Shows when Excel data was last loaded/refreshed
- Yellow warning if older than configurable threshold (default 7 days)
- Red warning if older than 14 days
- "Refresh Now" button to re-fetch from OneDrive or upload a new file

**Workstream Cards:**
- One card per workstream showing: name, enabled/disabled toggle, last run time, next scheduled run, number of emails in last batch, sent/failed counts
- **"Run Now"** button on each card → triggers Preview & Approve flow (see below)

**Escalation Alerts:**
- Investments that have been emailed 3+ times with no status change are flagged
- Shows as a red badge count on the dashboard: "4 investments need escalation"
- Click to see the list with details (investment name, how many times emailed, last email date, current status)

**Unmatched Industry Alerts:**
- If any investments have a `Primary Industry` that doesn't exist in the Contact Mapping table, show a warning
- "3 investments have unmapped industries" with a link to fix

**Recent Activity Feed:**
- Last 20 email actions: timestamp, workstream, recipient, company, status (sent/failed)
- Click any row to expand and see full email preview

### 2. Workstream Manager (`/workstreams`)

Full CRUD management of all workstreams.

**List View:**
- All workstreams in a table/card layout
- Columns: Name, Status (enabled/disabled toggle), Cadence, Last Run, Next Run, Template, Actions
- Drag to reorder (display priority)

**Create / Edit Workstream Form:**
- **Name** — text input
- **Description** — text area
- **Enabled** — toggle switch
- **Cadence** — dropdown: Weekly, Daily, Manual Only, Custom Cron
  - If Weekly: day-of-week picker + time picker
  - If Daily: time picker
  - If Custom Cron: cron expression input with human-readable preview
- **Trigger Conditions** — visual condition builder:
  - Each condition row: Field (dropdown of all Excel columns) → Operator (dropdown) → Value (text/number/date input)
  - AND/OR logic toggle between conditions
  - "Add Condition" button
  - "Remove" button per condition
  - Live preview: "This will match X investments" (queries current Excel data)
- **Recipients:**
  - **To:** dropdown — options: Investment Leader Email, SEL Email, Ops Manager Email, Requestor Email, Custom Email
  - **CC:** multi-select — same options + Investment Concierge
  - For each, can choose "From Excel column" or "From Contact Mapping" or "Custom static email"
- **Email Template:** dropdown of all saved templates
- **Sub-template logic** (optional): Conditional template selection based on a field value (e.g., if `jupiter_stage` = "Closed Lost" use Template 4a, if "Closed Abandoned" use Template 4b)
- **Deduplication Window:** number input (days) — default 7
- **Escalation Threshold:** number input — after this many sends with no status change, flag for escalation (default 3)

**Delete Workstream:** confirmation modal with warning about losing history

### 3. Template Editor (`/templates`)

Full CRUD management of all email templates.

**List View:**
- All templates in a card grid
- Each card shows: name, subject line preview, linked workstreams, last edited date

**Create / Edit Template:**
- **Name** — text input
- **Subject Line** — text input with placeholder autocomplete (type `{{` to see dropdown of available placeholders)
- **Body Editor:**
  - Rich text editor (use TipTap or similar) that supports:
    - Bold, italic, underline
    - Bullet points and numbered lists
    - Paragraph spacing
    - Placeholder insertion via toolbar button or `{{` autocomplete
  - **Table Builder:** toggle "Include data table" → define columns by selecting placeholders for each column header
  - **Signature Block:** editable text area
- **Live Preview Panel:**
  - Side-by-side with editor
  - Renders the template with sample data from the first matching investment in the Excel file
  - Updates in real-time as you edit
- **"Duplicate Template"** button — copies the template with "(Copy)" appended to name
- **"Reset to Default"** button — reverts to the original seeded template text

### 4. Contact Mapping Manager (`/contacts`)

Manage the industry → SEL / Ops Manager / Concierge mapping.

**Table View:**
- Editable table showing all industry mappings
- Columns: Primary Industry, SEL Name, SEL Email, Ops Manager Name, Ops Manager Email, Concierge Name, Concierge Email
- Inline editing — click any cell to edit, auto-saves on blur
- **"Add Industry"** button — adds a new row
- **"Delete"** button per row with confirmation
- **Bulk import:** upload an Excel file (same format as the template I provided) to overwrite all mappings
- **Export:** download current mappings as Excel

**Unmatched Industry Panel:**
- Shows industries that appear in the investment data but aren't in the mapping table
- "Quick Add" button next to each — opens a pre-filled form to add the mapping

### 5. Preview & Approve (`/preview`)

This is the critical pre-send review screen. It appears whenever a workstream is triggered (manually or by schedule).

**Email Queue:**
- Full list of every email about to be sent
- Each row shows: Recipient (To), CC list, Subject, Company, Workstream, Status badge
- Click any row to expand and see the fully rendered email body exactly as the recipient will see it

**Validation Warnings:**
- Flag emails with issues:
  - ⚠️ Missing recipient email (Investment Leader Email is blank)
  - ⚠️ Unmapped industry (no SEL/Ops Manager found)
  - ⚠️ Missing data (placeholder in template couldn't be filled — shows `{{field_name}}` in preview)
  - ⚠️ Duplicate (this person was already emailed about this investment within the dedupe window)
  - ⚠️ Jupiter ID is blank (for workstreams that expect it)

**Actions:**
- **Checkbox per email** — select/deselect individual emails
- **"Select All" / "Deselect All"**
- **"Remove Selected"** — exclude selected emails from this batch
- **"Send All Selected"** — sends only checked emails
- **"Send to Me Only" (Test Mode)** — sends ALL emails to the logged-in user's own email address instead of real recipients. CC is also redirected. Subject line prefixed with `[TEST]`.
- **"Approve & Send"** — sends to real recipients

**For automated/scheduled runs:** emails queue up in "Pending Approval" status. The dashboard shows a notification: "15 emails queued from Workstream 1 — Review & Approve". Emails are NOT sent until a human approves. This can be toggled per workstream (some workstreams can be set to auto-send without approval).

### 6. Send History (`/history`)

**Batch List View:**
- All send batches in reverse chronological order
- Columns: Date/Time, Workstream, Triggered By (auto/manual + user name), Total Emails, Sent, Failed
- Filters: date range, workstream, status (sent/failed), triggered by
- Search: by company name, recipient email, investment ID

**Batch Detail View (click into a batch):**
- Summary stats: total, sent, failed
- Individual email list with: recipient, company, subject, status (sent ✓ / failed ✗), error message if failed
- Click any email to see the full rendered body that was sent
- **"Retry Failed"** button — resends only failed emails from this batch

**Export:**
- "Export to CSV" button — downloads the filtered history as a CSV file
- "Export to Excel" — downloads as formatted .xlsx

### 7. Investment Activity Log (`/investments`)

Per-investment email history. Click any investment to see everything that's happened.

**Investment List:**
- Searchable/filterable table of all investments from the Excel data
- Columns: Investment ID, Account, Investment Name, Status, Jupiter Stage, Last Emailed, Total Emails Sent, Escalation Flag
- Filters: status, industry, escalation flagged, date range
- Sort by any column

**Investment Detail View:**
- All investment data fields displayed
- **Email Timeline:** chronological list of every email sent about this investment
  - Date, workstream, recipient, subject, status
  - Click to expand and see full email body
- **Escalation Badge:** if emailed 3+ times (configurable) with no status change, show red "Needs Escalation" badge
- **Notes field:** add manual notes about this investment (e.g., "Spoke to team lead, extending 30 days")

### 8. Settings (`/settings`)

**General Settings:**
- Default sender name (used in `{{sender_name}}` placeholder)
- Default sender email (for "reply-to" if different from Graph API sender)
- Global CC email addresses (applied to ALL emails in addition to workstream-specific CCs)
- Email format: HTML (default) or Plain Text
- App timezone (default: America/New_York)

**Data Source Settings:**
- Source type: OneDrive (Graph API) or Manual Upload
- OneDrive file path / item ID (for automatic fetching)
- Excel sheet name to read (default: "FY26  Account Investments_  (2)")
- Column mapping: table showing Internal Field → Excel Column Name (all editable)
- **"Test Data Load"** button — loads the file and shows row count + sample data
- Data freshness warning threshold (days)

**Deduplication Settings:**
- Default dedupe window (days) — can be overridden per workstream
- "Clear All Dedupe Logs" button (with confirmation)

**Escalation Settings:**
- Default escalation threshold (number of sends before flagging) — default 3
- Escalation check: compare against status changes (if status unchanged after N emails, flag)

**Email Tracking Settings:**
- Enable/disable open tracking (embeds a 1x1 tracking pixel in HTML emails)
- Tracking pixel URL (self-hosted endpoint)

**User Management (Admin only):**
- List of users with roles
- Roles: Admin (full access) and Sender (can trigger sends, view history, but cannot edit templates, workstreams, contacts, or settings)
- Add/remove users
- Change roles

**Audit Log:**
- Read-only log of all configuration changes
- Who changed what, when, old value → new value
- Filterable by: user, change type (template edit, workstream change, contact mapping update, settings change)

### 9. Reports (`/reports`)

**Weekly Summary Report:**
- Emails sent per workstream this week
- Success/failure rates
- Investments flagged for escalation
- New investments matching trigger conditions
- Export as PDF or Excel

**Workstream Performance:**
- Per-workstream stats over time (chart): emails sent per week, failure rate trend
- Average time investments stay in triggered status before resolution

**Email Open Tracking (if enabled):**
- Which emails were opened
- Open rate per workstream
- List of unopened follow-ups (candidates for re-send or escalation)

---

## Email Sending

### Microsoft Graph API

Send emails using the authenticated user's Outlook mailbox via `POST https://graph.microsoft.com/v1.0/me/sendMail`.

**Payload structure per email:**
```json
{
  "message": {
    "subject": "Investment Follow-Up: Acme Corp - Project Phoenix",
    "body": {
      "contentType": "HTML",
      "content": "<html>...</html>"
    },
    "toRecipients": [
      { "emailAddress": { "address": "jdoe@deloitte.com", "name": "John Doe" } }
    ],
    "ccRecipients": [
      { "emailAddress": { "address": "sel@deloitte.com", "name": "SEL Name" } },
      { "emailAddress": { "address": "opsmanager@deloitte.com", "name": "Ops Manager" } }
    ]
  },
  "saveToSentItems": true
}
```

### Sending Rules

- Process emails sequentially with a 200ms delay between sends to avoid throttling.
- Each email is a new message (not threaded).
- All emails are sent as HTML.
- If a send fails, log the error, mark as failed, and continue with the next email.
- If the Graph API token expires mid-batch, refresh and continue.

### Test Mode

When "Send to Me Only" is activated:
- ALL emails in the batch are redirected to the logged-in user's email address
- CC recipients are also replaced with the logged-in user
- Subject line is prefixed with `[TEST]`
- Body has a banner at top: "THIS IS A TEST EMAIL. Original recipient: {real_to_email}, Original CC: {real_cc_emails}"
- Test sends are logged separately and don't count toward deduplication

### Open Tracking

When enabled, append a 1x1 transparent tracking pixel to each HTML email:
```html
<img src="https://yourapp.com/api/track/open/{email_id}" width="1" height="1" style="display:none" />
```

The `/api/track/open/{email_id}` endpoint:
- Records the open event (timestamp, email ID)
- Returns a transparent 1x1 GIF
- Handles multiple opens (record first open time, total open count)

---

## Deduplication

### How It Works

Before sending any email, check:
- Has this exact combination of (workstream + investment_id + recipient_email) been sent within the last N days?
- If yes, skip this email and mark as "Skipped (duplicate)" in the preview screen
- N is configurable per workstream (default 7 days)

### Deduplication Log

```
DedupeLog {
  workstreamId + investmentId + recipientEmail (unique combo)
  sentAt: datetime
}
```

### Manual Override

In the Preview & Approve screen, duplicate-flagged emails show a warning but can be manually re-included by the user checking them back in.

---

## Escalation Engine

### How It Works

For each investment, track how many times it has been emailed per workstream. After each send batch:

1. Count total sends for each investment per workstream
2. Check if the investment's relevant status has changed since the first email
3. If sends >= threshold (default 3) AND status is unchanged → flag as "Needs Escalation"

### Escalation Dashboard Widget

On the main dashboard, show:
- Count of escalated investments
- Click to expand list showing: Investment ID, Account, Investment Name, Status, Times Emailed, First Emailed Date, Last Emailed Date
- Action buttons: "Mark as Reviewed" (clears the flag), "Add Note"

---

## Database Schema (Prisma)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ── WORKSTREAMS ──

model Workstream {
  id                  Int       @id @default(autoincrement())
  name                String
  description         String?
  enabled             Boolean   @default(true)
  cadence             String    // "weekly", "daily", "manual", "custom"
  cronExpression      String?   // e.g., "0 8 * * 1"
  triggerLogic        Json      // structured conditions
  recipientConfig     Json      // { to: { type: "excel_field", field: "investment_leader_email" }, cc: [...] }
  subTemplateLogic    Json?     // conditional template selection rules
  dedupeWindowDays    Int       @default(7)
  escalationThreshold Int       @default(3)
  autoApprove         Boolean   @default(false)  // true = send without preview, false = queue for approval
  templateId          Int
  template            EmailTemplate @relation(fields: [templateId], references: [id])
  lastRunAt           DateTime?
  nextRunAt           DateTime?
  batches             SendBatch[]
  dedupeLogs          DedupeLog[]
  escalations         Escalation[]
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}

// ── TEMPLATES ──

model EmailTemplate {
  id            Int       @id @default(autoincrement())
  name          String
  subject       String
  body          String    @db.Text
  includeTable  Boolean   @default(false)
  tableColumns  Json?     // [{ header: "Account", placeholder: "account_name" }, ...]
  signature     String    @default("Account Investment Concierge")
  isDefault     Boolean   @default(false)  // marks original seeded templates
  workstreams   Workstream[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

// ── CONTACT MAPPING ──

model IndustryContact {
  id                  Int       @id @default(autoincrement())
  primaryIndustry     String    @unique
  selName             String
  selEmail            String
  opsManagerName      String
  opsManagerEmail     String
  conciergeName       String    @default("US Consulting Account Investment Concierge")
  conciergeEmail      String    @default("accountinvestmentcommittee@deloitte.com")
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}

// ── SEND HISTORY ──

model SendBatch {
  id            Int       @id @default(autoincrement())
  workstreamId  Int
  workstream    Workstream @relation(fields: [workstreamId], references: [id])
  triggeredBy   String    // "auto" or user email
  triggerType   String    // "scheduled", "manual", "test"
  status        String    // "pending_approval", "approved", "sending", "completed"
  totalCount    Int
  sentCount     Int       @default(0)
  failedCount   Int       @default(0)
  skippedCount  Int       @default(0)  // dedupe skips
  startedAt     DateTime  @default(now())
  completedAt   DateTime?
  emails        SendEmail[]
}

model SendEmail {
  id              Int       @id @default(autoincrement())
  batchId         Int
  batch           SendBatch @relation(fields: [batchId], references: [id])
  investmentId    String    // from Excel: Investment ID
  accountName     String
  investmentName  String
  investmentStatus String
  toEmail         String
  toName          String?
  ccEmails        String?   // comma-separated
  subject         String
  body            String    @db.Text
  result          String    // "sent", "failed", "skipped", "pending"
  errorMessage    String?
  isTest          Boolean   @default(false)
  openedAt        DateTime? // first open from tracking pixel
  openCount       Int       @default(0)
  sentAt          DateTime  @default(now())
}

// ── DEDUPLICATION ──

model DedupeLog {
  id              Int       @id @default(autoincrement())
  workstreamId    Int
  workstream      Workstream @relation(fields: [workstreamId], references: [id])
  investmentId    String
  recipientEmail  String
  sentAt          DateTime  @default(now())

  @@unique([workstreamId, investmentId, recipientEmail])
}

// ── ESCALATION ──

model Escalation {
  id              Int       @id @default(autoincrement())
  workstreamId    Int
  workstream      Workstream @relation(fields: [workstreamId], references: [id])
  investmentId    String
  accountName     String
  investmentName  String
  currentStatus   String
  sendCount       Int
  firstEmailedAt  DateTime
  lastEmailedAt   DateTime
  resolved        Boolean   @default(false)
  resolvedAt      DateTime?
  resolvedBy      String?
  notes           String?   @db.Text
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([workstreamId, investmentId])
}

// ── SETTINGS ──

model GlobalSettings {
  id                      Int     @id @default(1)
  defaultSenderName       String  @default("Account Investment Concierge")
  defaultSenderEmail      String  @default("")
  globalCcEmails          String  @default("")  // comma-separated
  sendAsHtml              Boolean @default(true)
  timezone                String  @default("America/New_York")
  dataSourceType          String  @default("upload")  // "upload" or "onedrive"
  onedriveFileId          String? // OneDrive item ID
  excelSheetName          String  @default("FY26  Account Investments_  (2)")
  dataFreshnessWarningDays Int    @default(7)
  enableOpenTracking      Boolean @default(false)
  defaultDedupeWindowDays Int     @default(7)
  defaultEscalationThreshold Int  @default(3)
}

model ColumnMapping {
  id            Int     @id @default(autoincrement())
  internalField String  @unique  // e.g., "investment_id"
  excelColumn   String  // e.g., "Investment ID"
}

model DataLoadLog {
  id          Int       @id @default(autoincrement())
  sourceType  String    // "upload" or "onedrive"
  fileName    String?
  rowCount    Int
  loadedAt    DateTime  @default(now())
  loadedBy    String    // user email
}

// ── USERS & AUDIT ──

model User {
  id          Int       @id @default(autoincrement())
  email       String    @unique
  name        String
  role        String    @default("sender")  // "admin" or "sender"
  lastLoginAt DateTime?
  createdAt   DateTime  @default(now())
}

model AuditLog {
  id          Int       @id @default(autoincrement())
  userId      String    // user email
  action      String    // "template_updated", "workstream_created", "contact_updated", "settings_changed", "batch_approved", etc.
  entityType  String    // "template", "workstream", "contact", "settings"
  entityId    String?   // ID of the changed entity
  oldValue    String?   @db.Text  // JSON of old values
  newValue    String?   @db.Text  // JSON of new values
  createdAt   DateTime  @default(now())
}

// ── INVESTMENT NOTES ──

model InvestmentNote {
  id              Int       @id @default(autoincrement())
  investmentId    String    // from Excel
  note            String    @db.Text
  createdBy       String    // user email
  createdAt       DateTime  @default(now())
}
```

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| **Auth** | | |
| `/api/auth/[...nextauth]` | * | Microsoft Entra authentication |
| **Workstreams** | | |
| `/api/workstreams` | GET, POST | List all / create new workstream |
| `/api/workstreams/[id]` | GET, PUT, DELETE | Get / update / delete workstream |
| `/api/workstreams/[id]/run` | POST | Trigger workstream → generates preview batch |
| `/api/workstreams/[id]/preview` | GET | Get count of currently matching investments |
| **Templates** | | |
| `/api/templates` | GET, POST | List all / create new template |
| `/api/templates/[id]` | GET, PUT, DELETE | Get / update / delete template |
| `/api/templates/[id]/preview` | POST | Render template with sample data |
| `/api/templates/[id]/duplicate` | POST | Duplicate a template |
| **Contact Mapping** | | |
| `/api/contacts` | GET, POST | List all / create new mapping |
| `/api/contacts/[id]` | PUT, DELETE | Update / delete mapping |
| `/api/contacts/import` | POST | Bulk import from Excel upload |
| `/api/contacts/export` | GET | Export as Excel |
| `/api/contacts/unmatched` | GET | List industries in data with no mapping |
| **Send & Preview** | | |
| `/api/batches` | GET | List all batches (history) |
| `/api/batches/[id]` | GET | Get batch details with emails |
| `/api/batches/[id]/approve` | POST | Approve a pending batch → sends emails |
| `/api/batches/[id]/cancel` | POST | Cancel a pending batch |
| `/api/batches/[id]/retry` | POST | Retry failed emails in batch |
| `/api/batches/[id]/test-send` | POST | Send batch in test mode (to self) |
| `/api/batches/export` | GET | Export history as CSV/Excel |
| **Data** | | |
| `/api/data/upload` | POST | Upload Excel file |
| `/api/data/refresh` | POST | Fetch latest from OneDrive |
| `/api/data/status` | GET | Get data freshness info |
| `/api/data/preview` | GET | Preview loaded data (first 10 rows) |
| `/api/data/columns` | GET | List available columns in current data |
| **Investments** | | |
| `/api/investments` | GET | List all investments with email history |
| `/api/investments/[id]` | GET | Get investment detail + email timeline |
| `/api/investments/[id]/notes` | GET, POST | Get / add notes |
| **Escalations** | | |
| `/api/escalations` | GET | List all escalated investments |
| `/api/escalations/[id]/resolve` | POST | Mark escalation as resolved |
| **Tracking** | | |
| `/api/track/open/[emailId]` | GET | Tracking pixel endpoint (returns 1x1 GIF) |
| **Settings** | | |
| `/api/settings` | GET, PUT | Get / update global settings |
| `/api/settings/column-mappings` | GET, PUT | Get / update column mappings |
| `/api/settings/users` | GET, POST, DELETE | Manage users and roles |
| `/api/settings/audit-log` | GET | View audit log |
| **Reports** | | |
| `/api/reports/weekly-summary` | GET | Weekly summary data |
| `/api/reports/workstream-performance` | GET | Performance stats over time |
| `/api/reports/open-tracking` | GET | Email open tracking stats |
| `/api/reports/export` | GET | Export report as PDF/Excel |
| **Scheduler** | | |
| `/api/scheduler/status` | GET | Check scheduler health |
| `/api/scheduler/next-runs` | GET | List upcoming scheduled runs |

---

## Environment Variables

```env
# Microsoft Entra (Azure AD)
AZURE_AD_CLIENT_ID=
AZURE_AD_CLIENT_SECRET=
AZURE_AD_TENANT_ID=

# NextAuth
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/investment_emailer"

# Microsoft Graph (for OneDrive + Email)
# Uses same Azure AD app — ensure these scopes are granted:
# User.Read, Mail.Send, Files.Read.All (for OneDrive)

# App Settings
APP_TIMEZONE=America/New_York
TRACKING_BASE_URL=https://yourapp.com  # for open tracking pixel
```

---

## Azure App Registration Setup

1. Go to Azure Portal → Microsoft Entra ID → App registrations → New registration.
2. Set redirect URI to `http://localhost:3000/api/auth/callback/azure-ad` (and production URL later).
3. Under API Permissions, add Microsoft Graph delegated permissions:
   - `User.Read` (sign-in)
   - `Mail.Send` (send emails)
   - `Files.Read.All` (read OneDrive files — only needed if using OneDrive data source)
4. Under Certificates & Secrets, create a client secret.
5. Copy Client ID, Tenant ID, and Client Secret into `.env`.

---

## UI/UX Requirements

- **Dark theme** with professional financial-services aesthetic.
- **Navigation:** Left sidebar with icons for: Dashboard, Workstreams, Templates, Contacts, History, Investments, Reports, Settings.
- **Status colors:** Earmarked (#f59e0b amber), Submitted (#3b82f6 blue), Funded (#22c55e green), Closed Won (#10b981 emerald), Closed Lost (#ef4444 red), Closed Abandoned (#64748b gray), Needs Escalation (#dc2626 bright red).
- **All tables** should be sortable, searchable, and paginated.
- **Toast notifications** for all actions (saved, sent, errors).
- **Loading states** and skeleton screens during data loads.
- **Confirmation modals** before destructive actions (delete, send batch, clear logs).
- **Keyboard shortcuts:**
  - `Ctrl+Enter` — approve and send from preview
  - `Ctrl+T` — test send from preview
  - `Escape` — close modals
- **Responsive** but optimized for desktop (back-office tool).

---

## Security

- All credentials stored as environment variables, never in the database.
- Microsoft Graph tokens refreshed automatically via NextAuth.
- **Role-based access:**
  - Admin: full access to everything
  - Sender: can view dashboard, trigger workstreams, preview/approve/send, view history, view investments. Cannot edit templates, workstreams, contacts, or settings.
- **Audit log** tracks all configuration changes with user attribution.
- Rate limiting on send endpoints.
- Test mode emails clearly marked and logged separately.

---

## Implementation Order

Build in this order:

1. **Project scaffold** — Next.js + Tailwind + Prisma + NextAuth setup
2. **Database** — Schema, migrations, seed defaults (templates, workstreams, contact mappings, column mappings, settings)
3. **Data loading** — Excel file upload + parser using SheetJS + column mapping engine
4. **Settings pages** — Global settings, column mapping, user management
5. **Contact Mapping page** — CRUD + bulk import/export + unmatched detection
6. **Template Editor** — CRUD + rich editor + placeholder system + live preview + duplicate
7. **Workstream Manager** — CRUD + visual trigger condition builder + recipient config
8. **Trigger Engine** — Reads Excel data, evaluates conditions, generates email queue
9. **Preview & Approve** — Preview screen with validation warnings, test mode, approve flow
10. **Email Sending** — Microsoft Graph integration + sequential sending + error handling
11. **Send History** — Logging + history page + drill-down + retry + export
12. **Investment Activity Log** — Per-investment timeline + notes
13. **Deduplication** — Dedupe check before send, manual override in preview
14. **Escalation Engine** — Track repeated sends, flag unresolved investments
15. **Dashboard** — Summary cards, workstream cards, alerts, activity feed
16. **OneDrive integration** — Graph API file fetch (alternative to manual upload)
17. **Open Tracking** — Tracking pixel endpoint + open event recording
18. **Reports** — Weekly summary, workstream performance, open tracking stats, export
19. **Audit Log** — Track all config changes
20. **Polish** — Keyboard shortcuts, loading states, error handling, edge cases
