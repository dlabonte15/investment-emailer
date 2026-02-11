/**
 * Microsoft Graph API email sending utility.
 * Sends emails via POST /me/sendMail using the authenticated user's Outlook mailbox.
 */

import { prisma } from "./prisma";

// ─── Types ───────────────────────────────────────────────────────────

interface Recipient {
  email: string;
  name?: string;
}

interface EmailPayload {
  subject: string;
  body: string;
  toRecipients: Recipient[];
  ccRecipients: Recipient[];
  saveToSentItems?: boolean;
}

interface SendResult {
  success: boolean;
  error?: string;
}

interface BatchSendOptions {
  batchId: number;
  accessToken: string;
  testMode?: boolean;
  testEmail?: string;
  delayMs?: number;
  onProgress?: (sent: number, failed: number, total: number) => void;
}

// ─── Send Single Email via Graph ─────────────────────────────────────

function buildGraphRecipient(r: Recipient) {
  return {
    emailAddress: {
      address: r.email,
      ...(r.name ? { name: r.name } : {}),
    },
  };
}

async function sendEmailViaGraph(
  accessToken: string,
  payload: EmailPayload
): Promise<SendResult> {
  const graphPayload = {
    message: {
      subject: payload.subject,
      body: {
        contentType: "HTML",
        content: payload.body,
      },
      toRecipients: payload.toRecipients.map(buildGraphRecipient),
      ccRecipients: payload.ccRecipients.map(buildGraphRecipient),
    },
    saveToSentItems: payload.saveToSentItems ?? true,
  };

  const response = await fetch(
    "https://graph.microsoft.com/v1.0/me/sendMail",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(graphPayload),
    }
  );

  if (response.status === 202 || response.status === 200) {
    return { success: true };
  }

  // Try to extract error details
  let errorMessage = `Graph API error: ${response.status}`;
  try {
    const errorData = await response.json();
    errorMessage =
      errorData?.error?.message || errorData?.error?.code || errorMessage;
  } catch {
    // Use status code message if body isn't JSON
  }

  return { success: false, error: errorMessage };
}

// ─── Convert plain text body to styled HTML ──────────────────────────

function wrapBodyAsHtml(body: string): string {
  // If already has HTML tags, return as-is
  if (body.includes("<html") || body.includes("<div") || body.includes("<p")) {
    return body;
  }

  // Convert plain text to HTML with professional styling
  const htmlBody = body
    // Convert [TABLE]...[/TABLE] blocks to HTML tables
    .replace(
      /\[TABLE\]\n?\|(.+?)\|\n?\|(.+?)\|\n?\[\/TABLE\]/gs,
      (_match, headerRow: string, dataRow: string) => {
        const headers = headerRow
          .split("|")
          .map((h: string) => h.trim())
          .filter(Boolean);
        const cells = dataRow
          .split("|")
          .map((c: string) => c.trim())
          .filter(Boolean);
        const thRow = headers
          .map(
            (h: string) =>
              `<th style="padding:8px 12px;text-align:left;border-bottom:2px solid #334155;font-weight:600;color:#e2e8f0">${h}</th>`
          )
          .join("");
        const tdRow = cells
          .map(
            (c: string) =>
              `<td style="padding:8px 12px;border-bottom:1px solid #1e293b;color:#cbd5e1">${c}</td>`
          )
          .join("");
        return `<table style="border-collapse:collapse;width:100%;margin:16px 0;background:#0f172a;border-radius:6px"><thead><tr>${thRow}</tr></thead><tbody><tr>${tdRow}</tr></tbody></table>`;
      }
    )
    // Convert bullet points
    .replace(/^[•\-]\s*(.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul style="margin:8px 0;padding-left:24px">$&</ul>')
    // Convert paragraphs (double newlines)
    .replace(/\n\n/g, "</p><p>")
    // Convert single newlines
    .replace(/\n/g, "<br/>");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:14px;color:#334155;line-height:1.6;margin:0;padding:20px">
<p>${htmlBody}</p>
</body>
</html>`;
}

// ─── Add Test Mode Banner ────────────────────────────────────────────

function addTestBanner(
  htmlBody: string,
  originalTo: string,
  originalCc: string
): string {
  const banner = `<div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:6px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:#92400e">
<strong>THIS IS A TEST EMAIL</strong><br/>
Original recipient: ${originalTo}<br/>
Original CC: ${originalCc || "None"}
</div>`;

  // Insert banner after <body> tag if present
  if (htmlBody.includes("<body")) {
    return htmlBody.replace(/(<body[^>]*>)/, `$1${banner}`);
  }
  return banner + htmlBody;
}

// ─── Add Open Tracking Pixel ─────────────────────────────────────────

function addTrackingPixel(htmlBody: string, emailId: number): string {
  const baseUrl = process.env.TRACKING_BASE_URL || "http://localhost:3000";
  const pixel = `<img src="${baseUrl}/api/track/open/${emailId}" width="1" height="1" style="display:none" alt="" />`;

  if (htmlBody.includes("</body>")) {
    return htmlBody.replace("</body>", `${pixel}</body>`);
  }
  return htmlBody + pixel;
}

// ─── Process & Send a Full Batch ─────────────────────────────────────

export async function sendBatchEmails(
  options: BatchSendOptions
): Promise<{ sentCount: number; failedCount: number }> {
  const { batchId, accessToken, testMode, testEmail, delayMs = 200 } = options;

  // Load the batch and its pending emails
  const batch = await prisma.sendBatch.findUnique({
    where: { id: batchId },
    include: {
      emails: {
        where: { result: "pending" },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!batch) throw new Error("Batch not found");
  if (batch.emails.length === 0) {
    return { sentCount: 0, failedCount: 0 };
  }

  // Check if open tracking is enabled
  const settings = await prisma.globalSettings.findFirst({
    where: { id: 1 },
  });
  const openTrackingEnabled = settings?.enableOpenTracking ?? false;

  // Mark batch as sending
  await prisma.sendBatch.update({
    where: { id: batchId },
    data: { status: "sending" },
  });

  let currentToken = accessToken;
  let sentCount = batch.sentCount;
  let failedCount = batch.failedCount;

  for (let i = 0; i < batch.emails.length; i++) {
    const email = batch.emails[i];

    // Build HTML body
    let htmlBody = wrapBodyAsHtml(email.body);

    // Parse CC emails
    const ccList = email.ccEmails
      ? email.ccEmails
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean)
      : [];

    // Handle test mode
    let toRecipients: Recipient[];
    let ccRecipients: Recipient[];
    let subject = email.subject;

    if (testMode && testEmail) {
      subject = `[TEST] ${subject}`;
      htmlBody = addTestBanner(htmlBody, email.toEmail, email.ccEmails || "");
      toRecipients = [{ email: testEmail }];
      ccRecipients = [];
    } else {
      toRecipients = [{ email: email.toEmail, name: email.toName || undefined }];
      ccRecipients = ccList.map((e) => ({ email: e }));
    }

    // Add tracking pixel if enabled (and not test mode)
    if (openTrackingEnabled && !testMode) {
      htmlBody = addTrackingPixel(htmlBody, email.id);
    }

    // Send via Graph API
    const result = await sendEmailViaGraph(currentToken, {
      subject,
      body: htmlBody,
      toRecipients,
      ccRecipients,
    });

    if (result.success) {
      sentCount++;
      await prisma.sendEmail.update({
        where: { id: email.id },
        data: {
          result: "sent",
          isTest: testMode ?? false,
          sentAt: new Date(),
        },
      });

      // Record dedupe log (skip for test sends)
      if (!testMode) {
        await prisma.dedupeLog.upsert({
          where: {
            workstreamId_investmentId_recipientEmail: {
              workstreamId: batch.workstreamId,
              investmentId: email.investmentId,
              recipientEmail: email.toEmail,
            },
          },
          update: { sentAt: new Date() },
          create: {
            workstreamId: batch.workstreamId,
            investmentId: email.investmentId,
            recipientEmail: email.toEmail,
          },
        });
      }
    } else {
      failedCount++;
      await prisma.sendEmail.update({
        where: { id: email.id },
        data: {
          result: "failed",
          errorMessage: result.error,
          isTest: testMode ?? false,
        },
      });

      // If we get a 401, try refreshing the token
      if (result.error?.includes("401") || result.error?.includes("InvalidAuthenticationToken")) {
        // Try token refresh - this is a best-effort attempt
        // In production the token should be refreshed via NextAuth session
        console.warn("Graph API 401 during batch send. Token may need refresh.");
      }
    }

    // Update batch progress
    await prisma.sendBatch.update({
      where: { id: batchId },
      data: { sentCount, failedCount },
    });

    // Notify progress callback
    options.onProgress?.(sentCount, failedCount, batch.emails.length);

    // Delay between sends to avoid throttling (skip after last email)
    if (i < batch.emails.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Mark batch as completed
  await prisma.sendBatch.update({
    where: { id: batchId },
    data: {
      status: "completed",
      completedAt: new Date(),
      sentCount,
      failedCount,
    },
  });

  return { sentCount, failedCount };
}

// ─── Retry Failed Emails in a Batch ──────────────────────────────────

export async function retryFailedEmails(
  batchId: number,
  accessToken: string
): Promise<{ sentCount: number; failedCount: number }> {
  // Reset failed emails to pending
  await prisma.sendEmail.updateMany({
    where: { batchId, result: "failed" },
    data: { result: "pending", errorMessage: null },
  });

  // Re-count
  const batch = await prisma.sendBatch.findUnique({
    where: { id: batchId },
  });

  if (!batch) throw new Error("Batch not found");

  // Reset batch status
  await prisma.sendBatch.update({
    where: { id: batchId },
    data: {
      status: "approved",
      failedCount: 0,
      completedAt: null,
    },
  });

  return sendBatchEmails({ batchId, accessToken });
}
