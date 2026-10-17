import nodemailer from "nodemailer";
import { config } from "./config";

/** Send a verification link. Falls back to logging it when no SMTP is configured. */
export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const base = config.appUrl.replace(/\/+$/, "");
  const link = `${base}/?verify=${encodeURIComponent(token)}`;
  const subject = "Skat Online – E-Mail bestätigen";
  const text = `Hallo,\n\nbitte bestätige deine E-Mail-Adresse für Skat Online, indem du diesen Link öffnest:\n\n${link}\n\nFalls du dich nicht registriert hast, kannst du diese E-Mail ignorieren.`;

  if (config.smtp.host) {
    try {
      const transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: config.smtp.user && config.smtp.pass ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
      });
      await transporter.sendMail({ from: config.smtp.from, to, subject, text });
      console.log(`[email] Bestätigung an ${to} gesendet`);
    } catch (err) {
      console.warn("[email] Versand fehlgeschlagen:", (err as Error).message);
      console.log(`[email] Bestätigungslink für ${to}: ${link}`);
    }
  } else {
    console.log(`[email] (kein SMTP konfiguriert) Bestätigungslink für ${to}: ${link}`);
  }
}
