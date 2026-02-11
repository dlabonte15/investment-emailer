import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ── Global Settings ──────────────────────────────────────────────
  await prisma.globalSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      defaultSenderName: "Account Investment Concierge",
      defaultSenderEmail: "",
      globalCcEmails: "",
      sendAsHtml: true,
      timezone: "America/New_York",
      dataSourceType: "upload",
      excelSheetName: "FY26  Account Investments_  (2)",
      dataFreshnessWarningDays: 7,
      enableOpenTracking: false,
      defaultDedupeWindowDays: 7,
      defaultEscalationThreshold: 3,
    },
  });
  console.log("  ✓ GlobalSettings");

  // ── Column Mappings (28) ─────────────────────────────────────────
  const columnMappings = [
    { internalField: "investment_id", excelColumn: "Investment ID" },
    { internalField: "investment_status", excelColumn: "Investment Status" },
    { internalField: "account_name", excelColumn: "Account" },
    { internalField: "investment_name", excelColumn: "Investment Name" },
    { internalField: "investment_description", excelColumn: "Investment Description" },
    { internalField: "requested_amount", excelColumn: "Requested Soft Dollar.amount" },
    { internalField: "requested_date", excelColumn: "Requested Date" },
    { internalField: "primary_industry", excelColumn: "Primary Industry" },
    { internalField: "primary_op", excelColumn: "Primary OP" },
    { internalField: "budget_owner", excelColumn: "Budget Owner" },
    { internalField: "investment_category", excelColumn: "Investment Category" },
    { internalField: "fiscal_year", excelColumn: "Fiscal Year" },
    { internalField: "notes", excelColumn: "Notes" },
    { internalField: "granted_period", excelColumn: "Granted Period" },
    { internalField: "jupiter_id", excelColumn: "Jupiter Id" },
    { internalField: "jupiter_stage", excelColumn: "Jupiter Stage" },
    { internalField: "approved_soft_dollar", excelColumn: "Approved Soft Dollar.amount" },
    { internalField: "approved_amount", excelColumn: "Approved Amount.amount" },
    { internalField: "decision_date", excelColumn: "Decision Date" },
    { internalField: "investment_leader", excelColumn: "Investment Leader" },
    { internalField: "investment_leader_email", excelColumn: "Investment Leader Email" },
    { internalField: "requestor_email", excelColumn: "Requestor Email" },
    { internalField: "follow_on_jupiter_ids", excelColumn: "Follow-on Jupiter IDs" },
    { internalField: "wbs_code", excelColumn: "WBS Code" },
    { internalField: "deal_prioritization", excelColumn: "Deal Prioritization" },
    { internalField: "soft_dollar_allocation", excelColumn: "Soft Dollar Allocation.amount" },
    { internalField: "project_type", excelColumn: "Project Type" },
    { internalField: "funding_spent", excelColumn: "Funding Spent (Soft Dollar).amount" },
  ];

  for (const mapping of columnMappings) {
    await prisma.columnMapping.upsert({
      where: { internalField: mapping.internalField },
      update: { excelColumn: mapping.excelColumn },
      create: mapping,
    });
  }
  console.log("  ✓ ColumnMappings (28)");

  // ── Industry Contacts (14) ──────────────────────────────────────
  const industryContacts = [
    {
      primaryIndustry: "TMT – Technology",
      selName: "Miles Ewing",
      selEmail: "miewing@deloitte.com",
      opsManagerName: "Sandeep Chanda",
      opsManagerEmail: "schanda@deloitte.com",
    },
    {
      primaryIndustry: "TMT – Telecom, Media & Entertainment",
      selName: "Tim Gross",
      selEmail: "timgross@deloitte.com",
      opsManagerName: "Sandeep Chanda",
      opsManagerEmail: "schanda@deloitte.com",
    },
    {
      primaryIndustry: "LSHC – Health Care",
      selName: "Jeff Christoff",
      selEmail: "jchristoff@deloitte.com",
      opsManagerName: "Raghavendra Shetty",
      opsManagerEmail: "ragshetty@deloitte.com",
    },
    {
      primaryIndustry: "LSHC – Life Sciences",
      selName: "Jeff Christoff",
      selEmail: "jchristoff@deloitte.com",
      opsManagerName: "Raghavendra Shetty",
      opsManagerEmail: "ragshetty@deloitte.com",
    },
    {
      primaryIndustry: "FSI – Banking & Capital Markets",
      selName: "Sachin Sondhi",
      selEmail: "sacsondhi@deloitte.com",
      opsManagerName: "Ramya R",
      opsManagerEmail: "ramyar9@deloitte.com",
    },
    {
      primaryIndustry: "FSI – Insurance",
      selName: "Sachin Sondhi",
      selEmail: "sacsondhi@deloitte.com",
      opsManagerName: "Ramya R",
      opsManagerEmail: "ramyar9@deloitte.com",
    },
    {
      primaryIndustry: "FSI – Investment Management & Real Estate",
      selName: "Sachin Sondhi",
      selEmail: "sacsondhi@deloitte.com",
      opsManagerName: "Ramya R",
      opsManagerEmail: "ramyar9@deloitte.com",
    },
    {
      primaryIndustry: "ER&I – Energy & Chemicals",
      selName: "Rahul Chhatwal",
      selEmail: "rchhatwal@deloitte.com",
      opsManagerName: "Swati Patil",
      opsManagerEmail: "swpatil@deloitte.com",
    },
    {
      primaryIndustry: "ER&I – Industrial Products & Construction",
      selName: "Rahul Chhatwal",
      selEmail: "rchhatwal@deloitte.com",
      opsManagerName: "Swati Patil",
      opsManagerEmail: "swpatil@deloitte.com",
    },
    {
      primaryIndustry: "ER&I – Power, Utilities & Renewables",
      selName: "Rahul Chhatwal",
      selEmail: "rchhatwal@deloitte.com",
      opsManagerName: "Swati Patil",
      opsManagerEmail: "swpatil@deloitte.com",
    },
    {
      primaryIndustry: "ER&I – Mining & Metals",
      selName: "Rahul Chhatwal",
      selEmail: "rchhatwal@deloitte.com",
      opsManagerName: "Swati Patil",
      opsManagerEmail: "swpatil@deloitte.com",
    },
    {
      primaryIndustry: "CONS – Automotive",
      selName: "Chris Holland",
      selEmail: "cholland@deloitte.com",
      opsManagerName: "Urvashi Jajoria",
      opsManagerEmail: "ujajoria@deloitte.com",
    },
    {
      primaryIndustry: "CONS – Retails & Consumer Products",
      selName: "Chris Holland",
      selEmail: "cholland@deloitte.com",
      opsManagerName: "Urvashi Jajoria",
      opsManagerEmail: "ujajoria@deloitte.com",
    },
    {
      primaryIndustry: "CONS – Transportation, Hospitality, and Services",
      selName: "Chris Holland",
      selEmail: "cholland@deloitte.com",
      opsManagerName: "Urvashi Jajoria",
      opsManagerEmail: "ujajoria@deloitte.com",
    },
  ];

  for (const contact of industryContacts) {
    await prisma.industryContact.upsert({
      where: { primaryIndustry: contact.primaryIndustry },
      update: contact,
      create: contact,
    });
  }
  console.log("  ✓ IndustryContacts (14)");

  // ── Email Templates (5) ─────────────────────────────────────────
  const templates = [
    {
      name: "Earmarked Investments",
      subject: "Investment Follow-Up: {{account_name}} - {{investment_name}}",
      body: `Hello,

The following investment is currently earmarked for your pursuit. Could you please provide the SEL team with an update on the team's current efforts and our likelihood of closing the deal?

As a reminder, all approved investments are valid for 60 days. If this investment is no longer required, please notify the Account Investment Concierge team so that the funds can be released.

[TABLE]

Regards,

Account Investment Concierge`,
      includeTable: true,
      tableColumns: JSON.stringify([
        { header: "Account", placeholder: "account_name" },
        { header: "Investment Name", placeholder: "investment_name" },
        { header: "Approved Amount", placeholder: "approved_amount" },
        { header: "Follow-on JO-IDs", placeholder: "follow_on_jupiter_ids" },
        { header: "Expected Close Date", placeholder: "expected_close_date" },
      ]),
      signature: "Account Investment Concierge",
      isDefault: true,
    },
    {
      name: "Submitted Investment Pending Approval",
      subject: "Investments Pending Approval",
      body: `Hello,

The following investments are pending your approval.

[TABLE]

Please let us know if these investments are still valid or if any action is needed from the Account Investment Concierge to move this forward.

Regards,

Account Investment Concierge`,
      includeTable: true,
      tableColumns: JSON.stringify([
        { header: "Investment Name", placeholder: "investment_name" },
        { header: "Account Name", placeholder: "account_name" },
        { header: "Investment ID", placeholder: "investment_id" },
        { header: "Submission Date", placeholder: "requested_date" },
        { header: "Jupiter ID", placeholder: "jupiter_id" },
        { header: "Jupiter Status", placeholder: "jupiter_stage" },
      ]),
      signature: "Account Investment Concierge",
      isDefault: true,
    },
    {
      name: "Closed JO Won",
      subject: "Congratulations – {{jupiter_stage}} at {{account_name}}",
      body: `Hello,

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
Investment Concierge Team`,
      includeTable: false,
      signature: "Investment Concierge Team",
      isDefault: true,
    },
    {
      name: "Closed JO Lost",
      subject: "Investment Status Update – {{account_name}} ({{investment_name}})",
      body: `Hello,

There is an approved investment in Zenith for {{account_name}} ({{investment_name}}) with the following status in Jupiter: {{jupiter_stage}}. This approval was given on {{decision_date}}. The current Jupiter Status is showing Closed Lost. Based on this information, we will be closing the investment as Lost in Zenith.

Regards,

{{sender_name}}
Investments Concierge Team`,
      includeTable: false,
      signature: "Investments Concierge Team",
      isDefault: true,
    },
    {
      name: "Closed Abandoned",
      subject: "Investment Status Update – {{account_name}} ({{investment_name}})",
      body: `Hello,

There is an approved investment in Zenith for {{account_name}} ({{investment_name}}) with the following status in Jupiter: {{jupiter_stage}}. This approval was given on {{decision_date}}. The current Jupiter Status is showing Closed Abandoned. Based on this information, we will be closing the investment as Abandoned in Zenith.

Regards,

{{sender_name}}
Investments Concierge Team`,
      includeTable: false,
      signature: "Investments Concierge Team",
      isDefault: true,
    },
  ];

  for (const tpl of templates) {
    await prisma.emailTemplate.upsert({
      where: { name: tpl.name },
      update: {
        subject: tpl.subject,
        body: tpl.body,
        includeTable: tpl.includeTable,
        tableColumns: tpl.tableColumns ?? null,
        signature: tpl.signature,
        isDefault: tpl.isDefault,
      },
      create: tpl,
    });
  }
  console.log("  ✓ EmailTemplates (5)");

  // ── Workstreams (4) ─────────────────────────────────────────────
  // Look up template IDs by name
  const earmarkedTemplate = await prisma.emailTemplate.findUnique({
    where: { name: "Earmarked Investments" },
  });
  const submittedTemplate = await prisma.emailTemplate.findUnique({
    where: { name: "Submitted Investment Pending Approval" },
  });
  const closedWonTemplate = await prisma.emailTemplate.findUnique({
    where: { name: "Closed JO Won" },
  });
  const closedAbandonedTemplate = await prisma.emailTemplate.findUnique({
    where: { name: "Closed Abandoned" },
  });

  const workstreams = [
    {
      name: "Earmarked Investments (Past 60 Days)",
      description: "Follow up on earmarked investments older than 60 days",
      enabled: true,
      cadence: "weekly",
      cronExpression: "0 8 * * 1",
      dedupeWindowDays: 7,
      escalationThreshold: 3,
      autoApprove: false,
      templateId: earmarkedTemplate!.id,
      triggerLogic: JSON.stringify({
        conditions: [
          { field: "investment_status", operator: "equals", value: "Earmarked" },
          { field: "decision_date", operator: "older_than_days", value: 60 },
        ],
        logic: "AND",
      }),
      recipientConfig: JSON.stringify({
        to: { type: "excel_field", field: "investment_leader_email" },
        cc: [
          { type: "contact_mapping", field: "sel_email" },
          { type: "contact_mapping", field: "ops_manager_email" },
          { type: "contact_mapping", field: "concierge_email" },
        ],
      }),
    },
    {
      name: "Submitted Investment Pending Approval",
      description: "Follow up on submitted investments pending approval for over 60 days",
      enabled: true,
      cadence: "weekly",
      cronExpression: "0 8 * * 1",
      dedupeWindowDays: 7,
      escalationThreshold: 3,
      autoApprove: false,
      templateId: submittedTemplate!.id,
      triggerLogic: JSON.stringify({
        conditions: [
          { field: "investment_status", operator: "equals", value: "Submitted" },
          { field: "requested_date", operator: "older_than_days", value: 60 },
        ],
        logic: "AND",
      }),
      recipientConfig: JSON.stringify({
        to: { type: "contact_mapping", field: "sel_email" },
        cc: [{ type: "contact_mapping", field: "ops_manager_email" }],
      }),
    },
    {
      name: "Closed JO Won / Verbal Commit",
      description: "Notify on closed won or verbal commit opportunities",
      enabled: true,
      cadence: "daily",
      cronExpression: "0 8 * * *",
      dedupeWindowDays: 7,
      escalationThreshold: 3,
      autoApprove: false,
      templateId: closedWonTemplate!.id,
      triggerLogic: JSON.stringify({
        conditions: [
          { field: "jupiter_stage", operator: "in", value: ["Closed Won", "Verbal Commit"] },
          { field: "investment_status", operator: "equals", value: "Earmarked" },
        ],
        logic: "AND",
      }),
      recipientConfig: JSON.stringify({
        to: { type: "excel_field", field: "investment_leader_email" },
        cc: [
          { type: "contact_mapping", field: "sel_email" },
          { type: "contact_mapping", field: "ops_manager_email" },
          { type: "contact_mapping", field: "concierge_email" },
        ],
      }),
    },
    {
      name: "Closed JO Lost / Abandoned",
      description: "Notify on closed lost or abandoned opportunities",
      enabled: true,
      cadence: "daily",
      cronExpression: "0 8 * * *",
      dedupeWindowDays: 7,
      escalationThreshold: 3,
      autoApprove: false,
      templateId: closedAbandonedTemplate!.id,
      triggerLogic: JSON.stringify({
        conditions: [
          { field: "jupiter_stage", operator: "in", value: ["Closed Lost", "Closed Abandoned"] },
        ],
        logic: "AND",
      }),
      subTemplateLogic: JSON.stringify({
        field: "jupiter_stage",
        mapping: {
          "Closed Lost": "Closed JO Lost",
          "Closed Abandoned": "Closed Abandoned",
        },
      }),
      recipientConfig: JSON.stringify({
        to: { type: "excel_field", field: "investment_leader_email" },
        cc: [
          { type: "contact_mapping", field: "sel_email" },
          { type: "contact_mapping", field: "ops_manager_email" },
          { type: "contact_mapping", field: "concierge_email" },
        ],
      }),
    },
  ];

  for (const ws of workstreams) {
    await prisma.workstream.upsert({
      where: { name: ws.name },
      update: {
        description: ws.description,
        enabled: ws.enabled,
        cadence: ws.cadence,
        cronExpression: ws.cronExpression,
        triggerLogic: ws.triggerLogic,
        recipientConfig: ws.recipientConfig,
        subTemplateLogic: ws.subTemplateLogic ?? null,
        dedupeWindowDays: ws.dedupeWindowDays,
        escalationThreshold: ws.escalationThreshold,
        autoApprove: ws.autoApprove,
        templateId: ws.templateId,
      },
      create: ws,
    });
  }
  console.log("  ✓ Workstreams (4)");

  console.log("Seeding complete!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
