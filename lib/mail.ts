import nodemailer from "nodemailer";
import { sql } from "./db";
import { istDate } from "./time";

const MAX_PER_RECIPIENT_DAY = 40;
const MAX_PER_DAY = 400; // Gmail allows ~500/day; stay under it so reminders never get the account suspended

async function underQuota(to: string): Promise<boolean> {
  const day = istDate(new Date());
  const bump = async (rcpt: string) =>
    (await sql<{ n: number }>`insert into mail_quota (day, rcpt, n) values (${day}, ${rcpt}, 1)
      on conflict (day, rcpt) do update set n = mail_quota.n + 1 returning n`)[0].n;
  return (await bump(to.toLowerCase())) <= MAX_PER_RECIPIENT_DAY && (await bump("*")) <= MAX_PER_DAY;
}

export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

export interface MailButton {
  label: string;
  href: string;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

function render(title: string, lines: string[], buttons: MailButton[]): string {
  const btns = buttons
    .map(
      (b, i) =>
        `<a href="${esc(b.href)}" style="display:inline-block;margin:6px 8px 6px 0;padding:14px 22px;border-radius:12px;font-weight:700;font-size:17px;text-decoration:none;${
          i === 0 ? "background:#e8762c;color:#fff" : "background:#fff;color:#1f2a44;border:2px solid #1f2a44"
        }">${esc(b.label)}</a>`,
    )
    .join("");
  return `<div style="background:#fbf6ee;padding:24px;font-family:Arial,sans-serif;color:#1f2a44">
<div style="max-width:520px;margin:auto;background:#fff;border-radius:16px;padding:24px;border:1px solid #e8dfd0">
<p style="margin:0 0 12px;font-weight:700;color:#e8762c;letter-spacing:.08em">◆ DOR</p>
<h1 style="font-size:22px;margin:0 0 12px">${esc(title)}</h1>
${lines.map((l) => `<p style="font-size:17px;line-height:1.5;margin:0 0 10px">${esc(l)}</p>`).join("")}
<div style="margin-top:16px">${btns}</div>
<p style="font-size:13px;color:#5b6478;margin-top:20px">You're in a care circle on Dor. Every alert has one owner, so nothing falls through.</p>
</div></div>`;
}

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

/** Returns false (and never throws) when mail isn't configured or sending fails, so one bad address can't stop the check. */
export async function sendMail(to: string, subject: string, lines: string[], buttons: MailButton[] = []): Promise<boolean> {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    console.warn(`[mail] SMTP not configured; skipped "${subject}"`);
    return false;
  }
  transport ??= nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  try {
    if (!(await underQuota(to))) {
      console.warn(`[mail] daily limit reached; skipped "${subject}"`);
      return false;
    }
    await transport.sendMail({
      from: `Dor <${user}>`,
      to,
      subject,
      html: render(subject, lines, buttons),
      text: [...lines, ...buttons.map((b) => `${b.label}: ${b.href}`)].join("\n\n"),
    });
    return true;
  } catch (err) {
    console.error(`[mail] failed to send "${subject}"`, err);
    return false;
  }
}
