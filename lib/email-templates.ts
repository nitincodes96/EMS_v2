/**
 * Escape values that originate from user input (names, tasks, leave reasons)
 * before they are interpolated into an email body.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

type DetailRow = { label: string; value: string }

/** Two-column label/value table used by the booking and leave emails. */
function detailTable(rows: DetailRow[]): string {
  const cells = rows
    .map(
      ({ label, value }) => `
      <tr>
        <td style="padding:9px 0;font-size:13px;color:#94a3b8;width:38%;vertical-align:top;border-bottom:1px solid #f1f5f9;">${esc(label)}</td>
        <td style="padding:9px 0;font-size:13px;color:#0f172a;font-weight:600;vertical-align:top;border-bottom:1px solid #f1f5f9;">${value}</td>
      </tr>`
    )
    .join("")

  return `<table role="presentation" width="100%" style="border-collapse:collapse;margin:0 0 20px;">${cells}</table>`
}

function ctaButton(href: string, label: string): string {
  return `
    <div style="text-align:center;margin:0 0 20px;">
      <a href="${href}" style="display:inline-block;padding:12px 28px;border-radius:10px;background-color:#4f46e5;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">
        ${esc(label)}
      </a>
    </div>`
}

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
  departmentName,
  inviteLink,
  brandName = "EMS Portal",
}: {
  name?: string
  departmentName: string
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
        You've been invited to join <strong style="color:#0f172a;">${departmentName}</strong> on ${brandName}. Click the button below to accept your invite and set up your password.
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

export type BookingEmailLocation = {
  name: string
  latitude: number
  longitude: number
  radiusMeters?: number | null
}

/** Google Maps deep link for a coordinate pair. */
export function mapsLink(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
}

/**
 * Renders each department location as its name, exact lat/long and a maps link
 * so the PA knows precisely where to report for the slot.
 */
function locationBlock(locations: BookingEmailLocation[]): string {
  if (locations.length === 0) {
    return `<p style="margin:0 0 20px;font-size:13px;color:#94a3b8;">No location has been pinned for this department yet — check with the faculty who booked you.</p>`
  }

  const cards = locations
    .map((location) => {
      const coords = `${location.latitude}, ${location.longitude}`
      return `
      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin:0 0 10px;background-color:#f8fafc;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#0f172a;">${esc(location.name)}</p>
        <p style="margin:0 0 8px;font-size:12px;color:#64748b;">
          Lat/Long: <span style="color:#0f172a;font-weight:600;">${coords}</span>${
            location.radiusMeters ? ` &middot; ${location.radiusMeters}m radius` : ""
          }
        </p>
        <a href="${mapsLink(location.latitude, location.longitude)}" style="font-size:12px;font-weight:600;color:#4f46e5;text-decoration:none;">View on Google Maps &rarr;</a>
      </div>`
    })
    .join("")

  return `
    <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#94a3b8;">Where to report</p>
    ${cards}`
}

/**
 * Sent to a Project Assistant when a faculty member books them for a slot, and
 * reused (with a different heading/intro) when that booking is rescheduled or
 * cancelled. Carries everything the PA needs without opening the portal:
 * who booked them, the slot, the task, and the department location.
 */
export function bookingEmailHtml({
  heading,
  intro,
  paName,
  facultyName,
  departmentName,
  dateLabel,
  slotLabel,
  task,
  workType,
  locations,
  bookingLink,
  note,
  brandName = "EMS Portal",
}: {
  heading: string
  intro: string
  paName: string
  facultyName: string
  departmentName: string
  dateLabel: string
  slotLabel: string
  task: string
  workType?: string | null
  locations: BookingEmailLocation[]
  bookingLink?: string
  note?: string | null
  brandName?: string
}): string {
  return emailLayout({
    heading,
    brandName,
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569;">Hi <strong>${esc(paName)}</strong>,</p>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#475569;">${esc(intro)}</p>
      ${detailTable([
        { label: "Booked by", value: esc(facultyName) },
        { label: "Department", value: esc(departmentName) },
        { label: "Date", value: esc(dateLabel) },
        { label: "Time slot", value: esc(slotLabel) },
        ...(workType ? [{ label: "Work type", value: esc(workType) }] : []),
        { label: "Task", value: esc(task) },
      ])}
      ${locationBlock(locations)}
      ${note ? `<p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#475569;background-color:#fffbeb;border-left:3px solid #f59e0b;padding:10px 12px;border-radius:6px;">Note: ${esc(note)}</p>` : ""}
      ${bookingLink ? ctaButton(bookingLink, "View booking") : ""}
    `,
  })
}

/**
 * Sent to the approver (Moderator for PA leave, Admin for Faculty leave) as
 * soon as a leave request is submitted.
 */
export function leaveRequestEmailHtml({
  approverName,
  requesterName,
  requesterRoleLabel,
  departmentName,
  dateLabel,
  days,
  reason,
  reviewLink,
  brandName = "EMS Portal",
}: {
  approverName: string
  requesterName: string
  requesterRoleLabel: string
  departmentName: string
  dateLabel: string
  days: number
  reason?: string | null
  reviewLink?: string
  brandName?: string
}): string {
  return emailLayout({
    heading: "New leave request",
    brandName,
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569;">Hi <strong>${esc(approverName)}</strong>,</p>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#475569;">
        <strong>${esc(requesterName)}</strong> has applied for leave and is waiting on your decision.
      </p>
      ${detailTable([
        { label: "Requested by", value: esc(requesterName) },
        { label: "Role", value: esc(requesterRoleLabel) },
        { label: "Department", value: esc(departmentName) },
        { label: "Dates", value: esc(dateLabel) },
        { label: "Duration", value: `${days} ${days === 1 ? "day" : "days"}` },
        { label: "Reason", value: esc(reason?.trim() || "—") },
      ])}
      ${reviewLink ? ctaButton(reviewLink, "Review request") : ""}
      <p style="margin:0;font-size:13px;color:#94a3b8;">The request stays pending until you approve or reject it in the portal.</p>
    `,
  })
}

/** Sent to the requester once their leave has been approved or rejected. */
export function leaveDecisionEmailHtml({
  requesterName,
  status,
  departmentName,
  dateLabel,
  days,
  reason,
  decidedByName,
  remark,
  leaveLink,
  brandName = "EMS Portal",
}: {
  requesterName: string
  status: "APPROVED" | "REJECTED"
  departmentName: string
  dateLabel: string
  days: number
  reason?: string | null
  decidedByName: string
  remark?: string | null
  leaveLink?: string
  brandName?: string
}): string {
  const approved = status === "APPROVED"
  const badgeColor = approved ? "#059669" : "#dc2626"
  const badgeBg = approved ? "#ecfdf5" : "#fef2f2"

  return emailLayout({
    heading: approved ? "Your leave was approved" : "Your leave was rejected",
    brandName,
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569;">Hi <strong>${esc(requesterName)}</strong>,</p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569;">
        Your leave request has been reviewed by <strong>${esc(decidedByName)}</strong>.
      </p>
      <div style="text-align:center;margin:0 0 22px;">
        <span style="display:inline-block;padding:8px 20px;border-radius:999px;background-color:${badgeBg};color:${badgeColor};font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">${status}</span>
      </div>
      ${detailTable([
        { label: "Department", value: esc(departmentName) },
        { label: "Dates", value: esc(dateLabel) },
        { label: "Duration", value: `${days} ${days === 1 ? "day" : "days"}` },
        { label: "Reason", value: esc(reason?.trim() || "—") },
        { label: "Decided by", value: esc(decidedByName) },
        ...(remark?.trim() ? [{ label: "Remark", value: esc(remark.trim()) }] : []),
      ])}
      ${leaveLink ? ctaButton(leaveLink, "Open leave page") : ""}
      <p style="margin:0;font-size:13px;color:#94a3b8;">${
        approved
          ? "Your bookings for these dates are blocked automatically."
          : "Talk to your moderator if you need this reconsidered."
      }</p>
    `,
  })
}
