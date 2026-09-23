"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/core/auth";
import { createServerSupabaseClient } from "@/core/db/server";
import type { ActionResult } from "@/core/actions";

import { fromFormFields, findDefinition } from "./registry";
import { getSettings } from "./index";
import type { SettingsKey } from "./schemas";

/**
 * Les écritures du paramétrage.
 *
 * Toutes passent par une fonction `security definer` qui revérifie le rôle et
 * journalise l'avant et l'après. Depuis la migration `core_settings_admin`, le
 * navigateur n'a plus le droit d'écrire dans ces tables : même en contournant
 * cette action, il n'y arriverait pas.
 */

function toFrenchError(message: string, fallback: string): string {
  return /[éèêàùûîôç]/i.test(message) ? message : fallback;
}

/** Tout ce qui dépend d'un réglage : autant tout rafraîchir. */
function revalidateEverything(): void {
  revalidatePath("/", "layout");
}

export async function updateSetting(
  key: string,
  fields: Record<string, string>,
): Promise<ActionResult> {
  await requireAdmin();

  const definition = findDefinition(key);
  if (!definition) return { ok: false, error: "Réglage inconnu." };

  const current = await getSettings();
  const parsed = fromFormFields(definition.key as SettingsKey, fields, current);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("admin_set_setting", {
    p_key: definition.key,
    p_value: parsed.value as never,
  });

  if (error) {
    console.error("[settings] Enregistrement impossible", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "Le réglage n'a pas pu être enregistré. Réessayez."),
    };
  }

  revalidateEverything();
  return { ok: true, data: undefined };
}

/**
 * Activer ou désactiver un module.
 *
 * Un module désactivé disparaît des menus et cesse de traiter ses événements ;
 * ses données restent en place et reviennent intactes s'il est réactivé. C'est
 * ce qui permet au gérant d'essayer une fonctionnalité sans s'engager.
 */
export async function setModuleEnabled(moduleKey: string, enabled: boolean): Promise<ActionResult> {
  await requireAdmin();

  const current = await getSettings();
  const next = { ...current.modules_enabled, [moduleKey]: enabled };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("admin_set_setting", {
    p_key: "modules_enabled",
    p_value: next as never,
  });

  if (error) {
    console.error("[settings] Module non modifié", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "Le module n'a pas pu être modifié. Réessayez."),
    };
  }

  revalidateEverything();
  return { ok: true, data: undefined };
}

export async function saveBoutique(input: {
  id?: string | null;
  code: string;
  name: string;
  kind: string;
  address?: string | null;
}): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("admin_upsert_boutique", {
    p_code: input.code.trim().toUpperCase(),
    p_name: input.name,
    p_kind: input.kind,
    ...(input.address ? { p_address: input.address } : {}),
    ...(input.id ? { p_id: input.id } : {}),
  });

  if (error) {
    console.error("[settings] Point de vente non enregistré", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "Le point de vente n'a pas pu être enregistré."),
    };
  }

  revalidateEverything();
  return { ok: true, data: undefined };
}

/** On ferme un point de vente, on ne le supprime jamais : son historique reste. */
export async function setBoutiqueActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("admin_set_boutique_active", {
    p_id: id,
    p_active: active,
  });

  if (error) {
    console.error("[settings] Point de vente non modifié", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "Le point de vente n'a pas pu être modifié."),
    };
  }

  revalidateEverything();
  return { ok: true, data: undefined };
}

export async function saveContractType(input: {
  id?: string | null;
  code: string;
  label: string;
  isApprenticeship: boolean;
}): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("admin_upsert_contract_type", {
    p_code: input.code.trim().toUpperCase(),
    p_label: input.label,
    p_is_apprenticeship: input.isApprenticeship,
    ...(input.id ? { p_id: input.id } : {}),
  });

  if (error) {
    console.error("[settings] Type de contrat non enregistré", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "Le type de contrat n'a pas pu être enregistré."),
    };
  }

  revalidateEverything();
  return { ok: true, data: undefined };
}

export async function saveHoliday(date: string, label: string): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("admin_set_public_holiday", {
    p_date: date,
    p_label: label,
  });

  if (error) {
    console.error("[settings] Jour férié non enregistré", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "Le jour férié n'a pas pu être enregistré."),
    };
  }

  revalidateEverything();
  return { ok: true, data: undefined };
}

export async function removeHoliday(date: string): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("admin_remove_public_holiday", { p_date: date });

  if (error) {
    console.error("[settings] Jour férié non retiré", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "Le jour férié n'a pas pu être retiré."),
    };
  }

  revalidateEverything();
  return { ok: true, data: undefined };
}
