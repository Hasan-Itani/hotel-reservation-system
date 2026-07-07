import "server-only";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type SendEmailResult =
  | {
      sent: true;
      provider: "resend";
    }
  | {
      sent: false;
      provider: "none";
      reason: "not_configured";
    };

export async function sendTransactionalEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    return {
      sent: false,
      provider: "none",
      reason: "not_configured",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    throw new Error(
      `Email provider rejected message with status ${response.status}: ${responseText}`,
    );
  }

  return {
    sent: true,
    provider: "resend",
  };
}

export async function sendPasswordResetEmail(input: {
  to: string;
  resetUrl: string;
}): Promise<SendEmailResult> {
  return sendTransactionalEmail({
    to: input.to,
    subject: "Reset your Hotel System password",
    text: [
      "We received a request to reset your Hotel System password.",
      "",
      "Open this secure link to choose a new password:",
      input.resetUrl,
      "",
      "This link expires in 60 minutes. If you did not request this, you can ignore this email.",
    ].join("\n"),
    html: [
      "<p>We received a request to reset your Hotel System password.</p>",
      `<p><a href="${input.resetUrl}">Reset your password</a></p>`,
      "<p>This link expires in 60 minutes. If you did not request this, you can ignore this email.</p>",
    ].join(""),
  });
}
