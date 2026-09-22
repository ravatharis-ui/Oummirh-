import { Button, Heading, Text } from "@react-email/components";

import { EmailLayout, emailColors } from "./layout";

export interface NotificationEmailProps {
  title: string;
  body: string;
  /** Absolute link back into the application, when the notification points somewhere. */
  url?: string;
}

/**
 * The one template every notification uses.
 *
 * Modules that need a richer message add their own under
 * `src/modules/<key>/emails/`; this one carries the common case so a new
 * notification type costs nothing to deliver.
 */
export function NotificationEmail({ title, body, url }: NotificationEmailProps) {
  return (
    <EmailLayout preview={title}>
      <Heading style={{ fontSize: "20px", lineHeight: "28px", margin: "0 0 12px" }}>
        {title}
      </Heading>

      <Text style={{ fontSize: "16px", lineHeight: "24px", margin: "0 0 24px" }}>{body}</Text>

      {url ? (
        <Button
          href={url}
          style={{
            backgroundColor: emailColors.accent,
            borderRadius: "12px",
            color: "#ffffff",
            display: "inline-block",
            fontSize: "16px",
            fontWeight: 500,
            padding: "14px 24px",
            textDecoration: "none",
          }}
        >
          Ouvrir Oummi RH
        </Button>
      ) : null}
    </EmailLayout>
  );
}
