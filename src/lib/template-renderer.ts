/**
 * Template rendering engine.
 * Replaces {{placeholder}} tokens with values from a data record.
 */

export const AVAILABLE_PLACEHOLDERS = [
  // From Excel data
  { key: "investment_id", source: "Excel", description: "Investment ID (e.g., IV-005183)" },
  { key: "investment_status", source: "Excel", description: "Current Zenith status" },
  { key: "account_name", source: "Excel", description: "Account/client name" },
  { key: "investment_name", source: "Excel", description: "Investment name" },
  { key: "investment_description", source: "Excel", description: "Investment description" },
  { key: "requested_amount", source: "Excel", description: "Requested soft dollar amount" },
  { key: "requested_date", source: "Excel", description: "Date investment was requested" },
  { key: "primary_industry", source: "Excel", description: "Primary industry" },
  { key: "primary_op", source: "Excel", description: "Primary offering portfolio" },
  { key: "budget_owner", source: "Excel", description: "Budget owner" },
  { key: "fiscal_year", source: "Excel", description: "Fiscal year" },
  { key: "notes", source: "Excel", description: "Notes field" },
  { key: "jupiter_id", source: "Excel", description: "Jupiter Opportunity ID" },
  { key: "jupiter_stage", source: "Excel", description: "Jupiter status" },
  { key: "approved_soft_dollar", source: "Excel", description: "Approved soft dollar amount" },
  { key: "approved_amount", source: "Excel", description: "Total approved amount" },
  { key: "decision_date", source: "Excel", description: "Decision/approval date" },
  { key: "investment_leader", source: "Excel", description: "Investment Leader name" },
  { key: "investment_leader_email", source: "Excel", description: "Investment Leader email" },
  { key: "requestor_email", source: "Excel", description: "Requestor email" },
  { key: "follow_on_jupiter_ids", source: "Excel", description: "Related JO IDs" },
  { key: "wbs_code", source: "Excel", description: "WBS code" },
  { key: "deal_prioritization", source: "Excel", description: "Deal priority level" },
  { key: "soft_dollar_allocation", source: "Excel", description: "Allocated soft dollars" },
  { key: "project_type", source: "Excel", description: "Type of project" },
  { key: "funding_spent", source: "Excel", description: "Amount spent" },
  // From Contact Mapping
  { key: "sel_name", source: "Contact", description: "SEL name for this industry" },
  { key: "sel_email", source: "Contact", description: "SEL email for this industry" },
  { key: "ops_manager_name", source: "Contact", description: "Ops Manager name" },
  { key: "ops_manager_email", source: "Contact", description: "Ops Manager email" },
  { key: "concierge_name", source: "Contact", description: "Investment Concierge name" },
  { key: "concierge_email", source: "Contact", description: "Investment Concierge email" },
  // From Settings
  { key: "sender_name", source: "Settings", description: "Sender's name" },
] as const;

export type PlaceholderKey = (typeof AVAILABLE_PLACEHOLDERS)[number]["key"];

/**
 * Replace all {{placeholder}} tokens in a string with values from the data map.
 * Unresolved placeholders are left as-is (e.g. {{unknown_field}}).
 */
export function renderTemplate(
  template: string,
  data: Record<string, string | number | null | undefined>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = data[key];
    if (value === null || value === undefined || value === "") return match;
    return String(value);
  });
}

/**
 * Build a sample data record for preview rendering.
 */
export function buildSampleData(
  investmentRow?: Record<string, string | number | null>,
  contactRow?: {
    selName: string;
    selEmail: string;
    opsManagerName: string;
    opsManagerEmail: string;
    conciergeName: string;
    conciergeEmail: string;
  },
  senderName?: string
): Record<string, string | number | null> {
  const data: Record<string, string | number | null> = {};

  // Fill from investment row
  if (investmentRow) {
    for (const [key, value] of Object.entries(investmentRow)) {
      data[key] = value;
    }
  }

  // Fill from contact mapping
  if (contactRow) {
    data.sel_name = contactRow.selName;
    data.sel_email = contactRow.selEmail;
    data.ops_manager_name = contactRow.opsManagerName;
    data.ops_manager_email = contactRow.opsManagerEmail;
    data.concierge_name = contactRow.conciergeName;
    data.concierge_email = contactRow.conciergeEmail;
  }

  // Sender
  if (senderName) {
    data.sender_name = senderName;
  }

  return data;
}
