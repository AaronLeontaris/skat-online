import nodemailer from "nodemailer";
import { config } from "./config";

/** Send a verification link as a styled HTML email. Falls back to logging it when no SMTP is configured. */
export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const base = config.appUrl.replace(/\/+$/, "");
  const link = `${base}/?verify=${encodeURIComponent(token)}`;
  const logoUrl = `${base}/logo.png`;
  const subject = "Skat Online – E-Mail bestätigen";

  const text = `Hallo,\n\nbitte bestätige deine E-Mail-Adresse für Skat Online, indem du diesen Link öffnest:\n\n${link}\n\nFalls du dich nicht registriert hast, kannst du diese E-Mail ignorieren.`;

  const html = `
  <div style="background:#221710;padding:28px 16px;font-family:Georgia,'Times New Roman',serif;">
    <div style="max-width:480px;margin:0 auto;background:#1a130c;border:1px solid #8a6d2f;border-radius:3px;padding:32px 28px;text-align:center;">
      <img src="${logoUrl}" alt="Skat Online" style="width:220px;height:auto;max-width:100%;margin-bottom:18px;" />
      <h1 style="color:#d4af37;font-size:20px;font-weight:bold;margin:0 0 12px;">E-Mail bestätigen</h1>
      <p style="color:#efe4c6;font-size:15px;line-height:1.55;margin:0 0 18px;">
        Hallo,<br/>bitte bestätige deine E-Mail-Adresse, um dein Konto bei Skat Online zu aktivieren.
      </p>
      <a href="${link}" style="display:inline-block;background:#d4af37;color:#171105;padding:12px 26px;text-decoration:none;font-weight:bold;border-radius:2px;font-size:15px;">
        Jetzt bestätigen
      </a>
      <p style="color:#ab9666;font-size:12px;line-height:1.5;margin:20px 0 0;">
        Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br/>
        <a href="${link}" style="color:#d4af37;word-break:break-all;">${link}</a>
      </p>
    </div>
  </div>`;

  if (config.smtp.host) {
    try {
      const transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: config.smtp.user && config.smtp.pass ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
      });
      await transporter.sendMail({ from: config.smtp.from, to, subject, text, html });
      console.log(`[email] Bestätigung an ${to} gesendet`);
    } catch (err) {
      console.warn("[email] Versand fehlgeschlagen:", (err as Error).message);
      console.log(`[email] Bestätigungslink für ${to}: ${link}`);
    }
  } else {
    console.log(`[email] (kein SMTP konfiguriert) Bestätigungslink für ${to}: ${link}`);
  }
}
