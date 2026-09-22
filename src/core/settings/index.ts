import "server-only";

import { createServerSupabaseClient } from "@/core/db/server";

import {
  DEFAULT_SETTINGS,
  disabledModuleKeys,
  parseSettingsRows,
  type AppSettings,
} from "./schemas";

export * from "./schemas";

/**
 * Reads every application setting, typed and validated.
 *
 * Settings drive presentation and business defaults, never permissions: those live
 * in Row Level Security. So an unreachable database degrades to the documented
 * defaults with a warning rather than taking the application down, which keeps a
 * missing row from locking the direction out of the settings screen that fixes it.
 */
export async function getSettings(): Promise<AppSettings> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from("settings").select("key, value");

    if (error) {
      console.warn(
        `[settings] Lecture impossible, valeurs par défaut utilisées : ${error.message}`,
      );
      return DEFAULT_SETTINGS;
    }

    const { settings, problems } = parseSettingsRows(data ?? []);
    for (const problem of problems) {
      console.warn(`[settings] ${problem} — valeur par défaut utilisée.`);
    }
    return settings;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.warn(`[settings] Supabase indisponible, valeurs par défaut utilisées : ${message}`);
    return DEFAULT_SETTINGS;
  }
}

/** Module keys switched off by the direction in /admin/parametres. */
export async function getDisabledModuleKeys(): Promise<Set<string>> {
  return disabledModuleKeys(await getSettings());
}
