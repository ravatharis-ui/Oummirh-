import "server-only";

import { createAdminSupabaseClient } from "@/core/db/admin";
import type { EventContext, Registry } from "@/core/modules";

import { sendNotificationEmail } from "./email";
import { resolveRecipientEmail } from "./recipient";

/**
 * Builds the `notify` a handler receives.
 *
 * Titles and bodies come from the module manifests, through the registry, so a
 * handler says *what happened and to whom* and never how it is worded. An unknown
 * type is a programming error and is reported as one rather than silently
 * dropping someone's notification.
 */
export function createNotifier(registry: Registry): EventContext["notify"] {
  return async (recipientUserId: string, type: string, payload: unknown = {}) => {
    const definition = registry.notificationTypes.get(type);

    if (!definition) {
      throw new Error(
        `Type de notification inconnu : « ${type} ». Déclarez-le dans le manifeste de son module.`,
      );
    }

    const admin = createAdminSupabaseClient();
    const title = definition.title(payload);
    const body = definition.body(payload);
    const href = definition.href?.(payload) ?? null;

    const { data: id, error } = await admin.rpc("notify_user", {
      p_recipient_user_id: recipientUserId,
      p_type: type,
      p_title: title,
      p_body: body,
      ...(href ? { p_href: href } : {}),
      p_payload: (payload ?? {}) as never,
    });

    if (error) {
      throw new Error(`Notification impossible : ${error.message}`);
    }

    if (!definition.email) return;

    const address = await resolveRecipientEmail(recipientUserId);
    if (!address) return;

    const sent = await sendNotificationEmail({ to: address, title, body, href });
    if (sent && id) {
      await admin.rpc("mark_notification_emailed", { p_id: id });
    }
  };
}
