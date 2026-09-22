import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

/**
 * Shared shell for every email the application sends.
 *
 * Inline styles and tables are not a stylistic choice: most mail clients strip
 * stylesheets, and several still ignore flexbox. The palette mirrors the app's,
 * written out literally because CSS variables do not survive an inbox either.
 */
const colors = {
  background: "#faf8f5",
  card: "#ffffff",
  text: "#2b2724",
  muted: "#6b625c",
  border: "#e8e2db",
  accent: "#b4643f",
};

export interface EmailLayoutProps {
  preview: string;
  children: ReactNode;
}

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: colors.background,
          color: colors.text,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
          margin: 0,
          padding: "24px 0",
        }}
      >
        <Container
          style={{
            backgroundColor: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: "16px",
            margin: "0 auto",
            maxWidth: "520px",
            padding: "32px",
          }}
        >
          <Text
            style={{
              color: colors.muted,
              fontSize: "12px",
              letterSpacing: "3px",
              margin: "0 0 4px",
              textTransform: "uppercase",
            }}
          >
            Oummi Dressing
          </Text>

          {children}

          <Hr style={{ borderColor: colors.border, margin: "28px 0 16px" }} />
          <Section>
            <Text style={{ color: colors.muted, fontSize: "12px", lineHeight: "18px", margin: 0 }}>
              Ce message vous est envoyé par Oummi RH. Inutile d&apos;y répondre : personne ne lit
              cette boîte.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export { colors as emailColors };
