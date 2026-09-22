import { z } from "zod";

/**
 * Environment variables, validated with Zod.
 *
 * Validation is lazy (a function call, never module evaluation) so that a build
 * can succeed without a configured project, and so that a missing variable
 * surfaces as a readable error at request time instead of a blank page.
 *
 * `NEXT_PUBLIC_*` values are referenced literally below: Next.js inlines them at
 * build time only when it can see the full `process.env.NEXT_PUBLIC_X` expression.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url(
      "NEXT_PUBLIC_SUPABASE_URL doit être une adresse complète, par exemple https://xxx.supabase.co",
    ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY est manquante"),
});

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY est manquante"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `- ${issue.message}`).join("\n");
}

/** Public configuration, safe to reach the browser. */
export function getPublicEnv(): PublicEnv {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      `Configuration Supabase incomplète. Vérifiez votre fichier .env.local :\n${formatIssues(parsed.error)}`,
    );
  }
  return parsed.data;
}

/** Server-only configuration. Never import this from a client component. */
export function getServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      `Configuration serveur incomplète. Vérifiez votre fichier .env.local :\n${formatIssues(parsed.error)}`,
    );
  }
  return parsed.data;
}
