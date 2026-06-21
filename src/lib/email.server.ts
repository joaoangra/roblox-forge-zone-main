import { Resend } from "resend";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "BuxHub <onboarding@resend.dev>";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendTicketNotification(params: {
  toEmail: string;
  ticketId: string;
  ticketSubject: string;
  messageSnippet: string;
  actorName: string;
}) {
  const resend = getResend();
  if (!resend) {
    console.log("[email] No RESEND_API_KEY configured, skipping email to", params.toEmail);
    return;
  }

  const siteUrl = process.env.APP_URL || process.env.PUBLIC_SITE_URL || "https://buxhub.com";
  const ticketUrl = `${siteUrl}/tickets`;

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:24px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:20px;">Nova resposta no seu ticket</h1>
      </div>
      <div style="background:#1a1a2e;padding:24px;border-radius:0 0 12px 12px;color:#e2e8f0;">
        <p><strong>${params.actorName}</strong> respondeu ao seu ticket:</p>
        <div style="background:#16213e;padding:16px;border-radius:8px;margin:16px 0;border-left:3px solid #6366f1;">
          <p style="margin:0;font-size:14px;color:#94a3b8;">${params.ticketSubject}</p>
          <p style="margin:8px 0 0 0;">${params.messageSnippet}</p>
        </div>
        <a href="${ticketUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">
          Ver resposta
        </a>
        <p style="margin-top:24px;font-size:12px;color:#64748b;">
          BuxHub &mdash; Suporte
        </p>
      </div>
    </div>
  `;

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [params.toEmail],
      subject: `Nova resposta no ticket: ${params.ticketSubject}`,
      html,
    });

    if (error) {
      console.error("[email] Failed to send:", error);
    } else {
      console.log("[email] Notification sent to", params.toEmail);
    }
  } catch (error) {
    console.error("[email] Error sending notification:", error);
  }
}
