"use server";

import { randomInt, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/core/auth";
import { createAdminSupabaseClient } from "@/core/db/admin";
import { createServerSupabaseClient } from "@/core/db/server";

import { generatePin } from "../domain/pin";
import { employeeIdSchema, employeeInputSchema, type EmployeeInput } from "../schemas";
import type { ActionResult } from "../types";

/**
 * Technical address of the auth account.
 *
 * `.invalid` is reserved by RFC 2606 and can never resolve, so no message can ever
 * be delivered to it by accident. A collaboratrice's real address, when she has
 * one, lives in `employees.email` and is only used for notifications.
 */
const STAFF_EMAIL_DOMAIN = "staff.oummi.invalid";

const LIST_PATH = "/admin/collaboratrices";

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Données invalides.";
}

/**
 * Creates the auth account, then the collaboratrice.
 *
 * The PIN is drawn here and hashed by the database: this code never sees a hash,
 * and the database never sees a code it did not hash itself. The generated PIN is
 * returned once, for the direction to hand over, and is stored nowhere.
 */
export async function createEmployee(input: EmployeeInput): Promise<ActionResult<{ pin: string }>> {
  await requireAdmin();

  const parsed = employeeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const admin = createAdminSupabaseClient();
  const email = `${randomUUID()}@${STAFF_EMAIL_DOMAIN}`;

  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (userError || !created.user) {
    console.error("[employees] Création du compte impossible", userError?.message);
    return { ok: false, error: "Impossible de créer le compte de connexion. Réessayez." };
  }

  const pin = generatePin((max) => randomInt(max));
  const supabase = await createServerSupabaseClient();
  const value = parsed.data;

  const { error } = await supabase.rpc("admin_create_employee", {
    p_auth_user_id: created.user.id,
    p_last_name: value.lastName,
    p_first_name: value.firstName,
    p_display_name: value.displayName,
    p_boutique_id: value.boutiqueId,
    p_contract_type_id: value.contractTypeId,
    p_pin: pin,
    ...(value.email ? { p_email: value.email } : {}),
    ...(value.phone ? { p_phone: value.phone } : {}),
    ...(value.weeklyContractHours !== null
      ? { p_weekly_contract_hours: value.weeklyContractHours }
      : {}),
    p_default_start: value.defaultStart,
    p_default_end: value.defaultEnd,
    ...(value.defaultBreakStart ? { p_default_break_start: value.defaultBreakStart } : {}),
    ...(value.defaultBreakEnd ? { p_default_break_end: value.defaultBreakEnd } : {}),
    p_work_days: value.workDays,
    ...(value.hireDate ? { p_hire_date: value.hireDate } : {}),
  });

  if (error) {
    // The account exists but the collaboratrice does not: remove it rather than
    // leave an orphan that could later be matched to the wrong person.
    await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
    console.error("[employees] Création impossible", error.message);
    return { ok: false, error: "Impossible d'enregistrer la collaboratrice. Réessayez." };
  }

  revalidatePath(LIST_PATH);
  return { ok: true, data: { pin } };
}

export async function updateEmployee(id: string, input: EmployeeInput): Promise<ActionResult> {
  await requireAdmin();

  const parsedId = employeeIdSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "Collaboratrice inconnue." };

  const parsed = employeeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const value = parsed.data;
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from("employees")
    .update({
      last_name: value.lastName,
      first_name: value.firstName,
      display_name: value.displayName,
      boutique_id: value.boutiqueId,
      contract_type_id: value.contractTypeId,
      email: value.email,
      phone: value.phone,
      weekly_contract_hours: value.weeklyContractHours,
      default_start: value.defaultStart,
      default_end: value.defaultEnd,
      default_break_start: value.defaultBreakStart,
      default_break_end: value.defaultBreakEnd,
      work_days: value.workDays,
      hire_date: value.hireDate,
    })
    .eq("id", parsedId.data);

  if (error) {
    console.error("[employees] Modification impossible", error.message);
    return { ok: false, error: "Impossible d'enregistrer les modifications. Réessayez." };
  }

  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${parsedId.data}`);
  return { ok: true, data: undefined };
}

/** Archives or restores. A collaboratrice is never deleted: her history must survive. */
export async function setEmployeeActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireAdmin();

  const parsedId = employeeIdSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "Collaboratrice inconnue." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("employees")
    .update({
      is_active: isActive,
      end_date: isActive ? null : new Date().toISOString().slice(0, 10),
    })
    .eq("id", parsedId.data);

  if (error) {
    console.error("[employees] Archivage impossible", error.message);
    return { ok: false, error: "Impossible de modifier le statut. Réessayez." };
  }

  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${parsedId.data}`);
  return { ok: true, data: undefined };
}

/**
 * Draws a new PIN and returns it once.
 *
 * It is shown a single time and stored nowhere: only its bcrypt hash reaches the
 * database. If the direction loses it, the answer is another reset, never a lookup.
 */
export async function resetPin(id: string): Promise<ActionResult<{ pin: string }>> {
  await requireAdmin();

  const parsedId = employeeIdSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "Collaboratrice inconnue." };

  const pin = generatePin((max) => randomInt(max));
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("reset_employee_pin", {
    p_employee_id: parsedId.data,
    p_new_pin: pin,
  });

  if (error) {
    console.error("[employees] Réinitialisation impossible", error.message);
    return { ok: false, error: "Impossible de réinitialiser le code. Réessayez." };
  }

  revalidatePath(`${LIST_PATH}/${parsedId.data}`);
  return { ok: true, data: { pin } };
}
