function emailLayout({
  heading,
  bodyHtml,
  brandName = "EMS Portal",
}: {
  heading: string
  bodyHtml: string
  brandName?: string
}): string {
  return `
  <div style="background-color:#f8fafc;padding:32px 16px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;border-collapse:collapse;">
      <tr>
        <td style="padding-bottom:20px;text-align:center;">
          <span style="display:inline-block;width:36px;height:36px;border-radius:10px;background-color:#4f46e5;color:#ffffff;font-size:16px;font-weight:700;line-height:36px;">E</span>
          <span style="display:inline-block;margin-left:8px;font-size:15px;font-weight:600;color:#334155;vertical-align:middle;">${brandName}</span>
        </td>
      </tr>
      <tr>
        <td style="background-color:#ffffff;border-radius:16px;padding:32px;border:1px solid #e2e8f0;">
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a;">${heading}</h1>
          ${bodyHtml}
        </td>
      </tr>
      <tr>
        <td style="padding-top:20px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">This is an automated message from ${brandName}. Please do not reply.</p>
        </td>
      </tr>
    </table>
  </div>`
}

export function otpEmailHtml({
  otp,
  intro,
  brandName = "EMS Portal",
}: {
  otp: string
  intro?: string
  brandName?: string
}): string {
  return emailLayout({
    heading: "Verify your email",
    brandName,
    bodyHtml: `
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569;">
        ${intro || "Use the verification code below to confirm your email address."}
      </p>
      <div style="text-align:center;margin:0 0 20px;">
        <span style="display:inline-block;padding:14px 28px;border-radius:12px;background-color:#eef2ff;color:#4338ca;font-size:28px;font-weight:700;letter-spacing:6px;">${otp}</span>
      </div>
      <p style="margin:0;font-size:13px;color:#94a3b8;">This code will expire in <strong>10 minutes</strong>. If you didn't request this, you can safely ignore this email.</p>
    `,
  })
}

export function inviteEmailHtml({
  name,
  organizationName,
  inviteLink,
  brandName = "EMS Portal",
}: {
  name?: string
  organizationName: string
  inviteLink: string
  brandName?: string
}): string {
  return emailLayout({
    heading: "You've been invited!",
    brandName,
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569;">
        Hi ${name ? `<strong>${name}</strong>` : "there"},
      </p>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#475569;">
        You've been invited to join <strong style="color:#0f172a;">${organizationName}</strong> on ${brandName}. Click the button below to accept your invite and set up your password.
      </p>
      <div style="text-align:center;margin:0 0 24px;">
        <a href="${inviteLink}" style="display:inline-block;padding:12px 28px;border-radius:10px;background-color:#4f46e5;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">
          Accept invite &amp; set password
        </a>
      </div>
      <p style="margin:0;font-size:13px;color:#94a3b8;">This invite link will expire in <strong>7 days</strong>. If the button doesn't work, copy and paste this URL into your browser:</p>
      <p style="margin:8px 0 0;font-size:12px;word-break:break-all;color:#6366f1;">${inviteLink}</p>
    `,
  })
}
