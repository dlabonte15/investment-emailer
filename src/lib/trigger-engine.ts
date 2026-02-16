import { prisma } from "./prisma";
import { getInvestments } from "./data-store";
import { renderTemplate, buildSampleData } from "./template-renderer";
import type { MappedInvestment } from "./excel-parser";

// ─── Types ───────────────────────────────────────────────────────────

interface TriggerCondition {
  field: string;
  operator: string;
  value: string | number | string[];
}

interface TriggerLogic {
  conditions: TriggerCondition[];
  logic: "AND" | "OR";
}

interface RecipientRule {
  source: "excel_column" | "contact_mapping" | "custom";
  field: string;
}

interface RecipientConfig {
  to: RecipientRule[];
  cc: RecipientRule[];
}

interface SubTemplateRule {
  field: string;
  value: string;
  templateId: number;
}

interface ContactMapping {
  primaryIndustry: string;
  selName: string;
  selEmail: string;
  opsManagerName: string;
  opsManagerEmail: string;
  conciergeName: string;
  conciergeEmail: string;
}

export interface GeneratedEmail {
  investmentId: string;
  accountName: string;
  investmentName: string;
  investmentStatus: string;
  toEmail: string;
  toName: string;
  ccEmails: string;
  subject: string;
  body: string;
  warnings: string[];
  isDuplicate: boolean;
}

export interface TriggerResult {
  batchId: number;
  workstreamId: number;
  workstreamName: string;
  emails: GeneratedEmail[];
  totalMatched: number;
  totalEmails: number;
  skippedDedupe: number;
  warnings: string[];
}

// ─── JSON Helpers (SQLite stores JSON as text) ──────────────────────

function parseJsonField<T>(value: unknown): T {
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }
  return value as T;
}

// ─── Condition Evaluation ────────────────────────────────────────────

function evaluateCondition(
  rowValue: string | number | null | undefined,
  operator: string,
  conditionValue: string | number | string[]
): boolean {
  const strValue =
    rowValue === null || rowValue === undefined
      ? ""
      : String(rowValue).trim();

  switch (operator) {
    case "equals":
      return strValue.toLowerCase() === String(conditionValue).toLowerCase();
    case "not_equals":
      return strValue.toLowerCase() !== String(conditionValue).toLowerCase();
    case "in": {
      const list = Array.isArray(conditionValue)
        ? conditionValue
        : String(conditionValue).split(",").map((s) => s.trim());
      return list.some((v) => v.toLowerCase() === strValue.toLowerCase());
    }
    case "not_in": {
      const list = Array.isArray(conditionValue)
        ? conditionValue
        : String(conditionValue).split(",").map((s) => s.trim());
      return !list.some((v) => v.toLowerCase() === strValue.toLowerCase());
    }
    case "contains":
      return strValue
        .toLowerCase()
        .includes(String(conditionValue).toLowerCase());
    case "not_contains":
      return !strValue
        .toLowerCase()
        .includes(String(conditionValue).toLowerCase());
    case "is_empty":
      return strValue === "";
    case "is_not_empty":
      return strValue !== "";
    case "greater_than":
      return parseFloat(strValue) > parseFloat(String(conditionValue));
    case "less_than":
      return parseFloat(strValue) < parseFloat(String(conditionValue));
    case "older_than_days": {
      if (!strValue) return false;
      const date = new Date(strValue);
      if (isNaN(date.getTime())) return false;
      const daysAgo =
        (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo > Number(conditionValue);
    }
    case "newer_than_days": {
      if (!strValue) return false;
      const date = new Date(strValue);
      if (isNaN(date.getTime())) return false;
      const daysAgo =
        (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo < Number(conditionValue);
    }
    default:
      return false;
  }
}

function matchesConditions(
  row: MappedInvestment,
  trigger: TriggerLogic
): boolean {
  if (trigger.conditions.length === 0) return true;

  const results = trigger.conditions.map((c) =>
    evaluateCondition(
      row[c.field] as string | number | null | undefined,
      c.operator,
      c.value
    )
  );

  return trigger.logic === "AND"
    ? results.every(Boolean)
    : results.some(Boolean);
}

// ─── Recipient Resolution ────────────────────────────────────────────

function resolveRecipient(
  rule: RecipientRule,
  row: MappedInvestment,
  contact: ContactMapping | null
): { email: string; name: string } | null {
  switch (rule.source) {
    case "excel_column": {
      const email = row[rule.field];
      if (!email || typeof email !== "string" || !email.includes("@"))
        return null;
      // Try to find a name field (strip _email suffix, look for matching field)
      const nameField = rule.field.replace(/_email$/, "");
      const name =
        nameField !== rule.field
          ? String(row[nameField] || "")
          : "";
      return { email: email.trim(), name };
    }
    case "contact_mapping": {
      if (!contact) return null;
      const fieldMap: Record<string, { email: string; name: string }> = {
        sel_email: { email: contact.selEmail, name: contact.selName },
        ops_manager_email: {
          email: contact.opsManagerEmail,
          name: contact.opsManagerName,
        },
        concierge_email: {
          email: contact.conciergeEmail,
          name: contact.conciergeName,
        },
      };
      const resolved = fieldMap[rule.field];
      if (!resolved || !resolved.email) return null;
      return resolved;
    }
    case "custom":
      return rule.field ? { email: rule.field, name: "" } : null;
    default:
      return null;
  }
}

// ─── Main Trigger Engine ─────────────────────────────────────────────

export async function runWorkstreamTrigger(
  workstreamId: number,
  triggeredBy: string,
  triggerType: "manual" | "scheduled" | "test" = "manual"
): Promise<TriggerResult> {
  // 1. Load workstream + template
  const workstream = await prisma.workstream.findUnique({
    where: { id: workstreamId },
    include: { template: true },
  });

  if (!workstream) throw new Error("Workstream not found");
  if (!workstream.enabled) throw new Error("Workstream is disabled");

  // 2. Load investment data
  const data = await getInvestments();
  if (!data || data.rows.length === 0) {
    throw new Error("No investment data loaded. Upload an Excel file first.");
  }

  // 3. Load all contact mappings (indexed by industry)
  const allContacts = await prisma.industryContact.findMany();
  const contactMap = new Map<string, ContactMapping>();
  for (const c of allContacts) {
    contactMap.set(c.primaryIndustry.toLowerCase().trim(), c);
  }

  // 4. Load settings
  const settings = await prisma.globalSettings.findFirst({
    where: { id: 1 },
  });

  // 5. Load all templates (for sub-template logic)
  let subTemplateLogic: SubTemplateRule[] | null = null;
  if (workstream.subTemplateLogic) {
    const raw = parseJsonField<unknown>(workstream.subTemplateLogic);
    if (Array.isArray(raw)) {
      subTemplateLogic = raw as SubTemplateRule[];
    } else if (raw && typeof raw === "object" && "mapping" in (raw as Record<string, unknown>)) {
      // Legacy format: { field, mapping: { value: templateName } }
      // Convert to SubTemplateRule[] by looking up template names
      const legacy = raw as { field: string; mapping: Record<string, string> };
      const nameToTemplate = new Map<string, number>();
      const allTpls = await prisma.emailTemplate.findMany({ select: { id: true, name: true } });
      for (const t of allTpls) nameToTemplate.set(t.name, t.id);
      subTemplateLogic = Object.entries(legacy.mapping)
        .map(([value, templateName]) => ({
          field: legacy.field,
          value,
          templateId: nameToTemplate.get(templateName) || 0,
        }))
        .filter((r) => r.templateId > 0);
    }
  }
  let allTemplates: Map<number, { subject: string; body: string; signature: string }> | null = null;
  if (subTemplateLogic && subTemplateLogic.length > 0) {
    const templateIds = subTemplateLogic.map((r) => r.templateId);
    const templates = await prisma.emailTemplate.findMany({
      where: { id: { in: templateIds } },
    });
    allTemplates = new Map();
    for (const t of templates) {
      allTemplates.set(t.id, {
        subject: t.subject,
        body: t.body,
        signature: t.signature,
      });
    }
  }

  // 6. Load existing dedupe logs for this workstream
  const dedupeWindow = workstream.dedupeWindowDays;
  const dedupeDate = new Date(
    Date.now() - dedupeWindow * 24 * 60 * 60 * 1000
  );
  const dedupeLogs = await prisma.dedupeLog.findMany({
    where: {
      workstreamId,
      sentAt: { gte: dedupeDate },
    },
  });
  const dedupeSet = new Set(
    dedupeLogs.map((d) => `${d.investmentId}::${d.recipientEmail}`)
  );

  // 7. Filter matching investments
  const trigger = parseJsonField<TriggerLogic>(workstream.triggerLogic);
  const rawRecipientConfig = parseJsonField<Record<string, unknown>>(workstream.recipientConfig);
  // Normalize: ensure to/cc are arrays and fix legacy field names (type→source, excel_field→excel_column)
  function normalizeRule(rule: Record<string, unknown>): RecipientRule {
    const source = (rule.source || rule.type || "excel_column") as string;
    return {
      source: source === "excel_field" ? "excel_column" : source as RecipientRule["source"],
      field: (rule.field || "") as string,
    };
  }
  function normalizeRuleArray(val: unknown): RecipientRule[] {
    if (!val) return [];
    const arr = Array.isArray(val) ? val : [val];
    return arr.filter(Boolean).map((r: Record<string, unknown>) => normalizeRule(r));
  }
  const recipientConfig: RecipientConfig = {
    to: normalizeRuleArray(rawRecipientConfig.to),
    cc: normalizeRuleArray(rawRecipientConfig.cc),
  };
  const matchedRows = data.rows.filter((row) =>
    matchesConditions(row, trigger)
  );

  // 8. Generate emails
  const emails: GeneratedEmail[] = [];
  const warnings: string[] = [];
  let skippedDedupe = 0;

  for (const row of matchedRows) {
    const investmentId = String(row.investment_id || "UNKNOWN");
    const accountName = String(row.account_name || "");
    const investmentName = String(row.investment_name || "");
    const investmentStatus = String(row.investment_status || "");
    const industry = String(row.primary_industry || "").trim();

    // Resolve contact mapping
    const contact = industry
      ? contactMap.get(industry.toLowerCase().trim()) || null
      : null;

    // Build data map for template rendering
    const templateData = buildSampleData(
      row as Record<string, string | number | null>,
      contact || undefined,
      settings?.defaultSenderName
    );

    // Resolve recipients
    const toRecipients: { email: string; name: string }[] = [];
    const ccRecipients: { email: string; name: string }[] = [];
    const emailWarnings: string[] = [];

    for (const rule of recipientConfig.to) {
      const resolved = resolveRecipient(rule, row, contact);
      if (resolved) {
        toRecipients.push(resolved);
      } else {
        emailWarnings.push(
          `Missing To recipient: ${rule.source}/${rule.field}`
        );
      }
    }

    for (const rule of recipientConfig.cc) {
      const resolved = resolveRecipient(rule, row, contact);
      if (resolved) {
        ccRecipients.push(resolved);
      }
    }

    // Add global CC
    if (settings?.globalCcEmails) {
      const globalCc = settings.globalCcEmails
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      for (const email of globalCc) {
        ccRecipients.push({ email, name: "" });
      }
    }

    // Warn if no To recipient
    if (toRecipients.length === 0) {
      emailWarnings.push("No To recipient resolved");
    }

    // Warn if unmapped industry
    if (industry && !contact) {
      emailWarnings.push(`Unmapped industry: ${industry}`);
    }

    // Select template (check sub-template logic first)
    let templateSubject = workstream.template.subject;
    let templateBody = workstream.template.body;
    let templateSignature = workstream.template.signature;

    if (subTemplateLogic && allTemplates) {
      for (const rule of subTemplateLogic) {
        const fieldValue = String(row[rule.field] || "")
          .trim()
          .toLowerCase();
        if (fieldValue === rule.value.trim().toLowerCase()) {
          const alt = allTemplates.get(rule.templateId);
          if (alt) {
            templateSubject = alt.subject;
            templateBody = alt.body;
            templateSignature = alt.signature;
          }
          break;
        }
      }
    }

    // Render template
    const renderedSubject = renderTemplate(templateSubject, templateData);
    const renderedBody =
      renderTemplate(templateBody, templateData) +
      (templateSignature
        ? `\n\n${renderTemplate(templateSignature, templateData)}`
        : "");

    // Check for unresolved placeholders
    const unresolvedSubject = renderedSubject.match(/\{\{\w+\}\}/g);
    const unresolvedBody = renderedBody.match(/\{\{\w+\}\}/g);
    if (unresolvedSubject) {
      emailWarnings.push(
        `Unresolved in subject: ${unresolvedSubject.join(", ")}`
      );
    }
    if (unresolvedBody) {
      emailWarnings.push(
        `Unresolved in body: ${[...new Set(unresolvedBody)].join(", ")}`
      );
    }

    // Dedupe check
    const primaryTo = toRecipients[0]?.email || "";
    const dedupeKey = `${investmentId}::${primaryTo}`;
    const isDuplicate = dedupeSet.has(dedupeKey);
    if (isDuplicate) {
      skippedDedupe++;
      emailWarnings.push(
        "Duplicate: this recipient was already emailed about this investment within the dedupe window"
      );
    }

    const ccEmailStr = ccRecipients.map((r) => r.email).join(", ");

    emails.push({
      investmentId,
      accountName,
      investmentName,
      investmentStatus,
      toEmail: primaryTo,
      toName: toRecipients[0]?.name || "",
      ccEmails: ccEmailStr,
      subject: renderedSubject,
      body: renderedBody,
      warnings: emailWarnings,
      isDuplicate,
    });
  }

  // 9. Create batch and email records
  const pendingEmails = emails.filter((e) => !e.isDuplicate);
  const dedupeEmails = emails.filter((e) => e.isDuplicate);

  const batch = await prisma.sendBatch.create({
    data: {
      workstreamId,
      triggeredBy,
      triggerType,
      status: "pending_approval",
      totalCount: pendingEmails.length,
      skippedCount: dedupeEmails.length,
    },
  });

  // Create email records (pending for normal, skipped_dedupe for duplicates)
  if (emails.length > 0) {
    await prisma.sendEmail.createMany({
      data: emails.map((e) => ({
        batchId: batch.id,
        investmentId: e.investmentId,
        accountName: e.accountName,
        investmentName: e.investmentName,
        investmentStatus: e.investmentStatus,
        toEmail: e.toEmail,
        toName: e.toName,
        ccEmails: e.ccEmails,
        subject: e.subject,
        body: e.body,
        result: e.isDuplicate ? "skipped_dedupe" : "pending",
      })),
    });
  }

  // 10. Update workstream lastRunAt
  await prisma.workstream.update({
    where: { id: workstreamId },
    data: { lastRunAt: new Date() },
  });

  // Collect global warnings
  if (matchedRows.length === 0) {
    warnings.push("No investments matched the trigger conditions");
  }
  if (skippedDedupe > 0) {
    warnings.push(
      `${skippedDedupe} email(s) skipped due to deduplication`
    );
  }

  return {
    batchId: batch.id,
    workstreamId,
    workstreamName: workstream.name,
    emails,
    totalMatched: matchedRows.length,
    totalEmails: emails.length,
    skippedDedupe,
    warnings,
  };
}
