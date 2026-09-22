import "server-only";

import { render } from "@react-email/components";
import { Resend } from "resend";

import { NotificationEmail } from "./emails/notification";

/**
 * Sends one notification by email.
 *
 * Email is a courtesy on top of the in-app bell, never the record. So a missing
 * API key, an unverified domain or a Resend outage logs a warning and returns
 * `false`: the notification is already in the database and will be seen. Failing
 * the whole event over an undelivered email would be the wrong trade.
 */
export async function sendNotificationEmail(options: {
  to: string;
  title: string;
  body: string;
  href?: string | null;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.warn("[notifications] Envoi d'email ignoré : RESEND_API_KEY ou EMAIL_FROM manquant.");
    return false;
  }

  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  const url = options.href && appUrl ? `${appUrl}${options.href}` : undefined;

  try {
    const html = await render(NotificationEmail({ title: options.title, body: options.body, url }));
    const text = await render(
      NotificationEmail({ title: options.title, body: options.body, url }),
      { plainText: true },
    );

    const { error } = await new Resend(apiKey).emails.send({
      from,
      to: options.to,
      subject: options.title,
      html,
      text,
    });

    if (error) {
      console.warn(`[notifications] Resend a refusé l'envoi : ${error.message}`);
      return false;
    }
    return true;
  } catch (cause) {
    console.warn(
      `[notifications] Envoi impossible : ${cause instanceof Error ? cause.message : cause}`,
    );
    return false;
  }
}
