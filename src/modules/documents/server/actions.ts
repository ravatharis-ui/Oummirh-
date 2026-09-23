"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { requireAdmin, requireEmployee } from "@/core/auth";
import { createAdminSupabaseClient } from "@/core/db/admin";
import { createServerSupabaseClient } from "@/core/db/server";

import { documentSchema, type DocumentInput } from "../schemas";
import type { ActionResult } from "../types";

/** Soixante secondes : le temps d'ouvrir un PDF, pas celui de le faire circuler. */
const SIGNED_URL_SECONDS = 60;

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Données invalides.";
}

function toFrenchError(message: string, fallback: string): string {
  return /[éèêàùûîôç]/i.test(message) ? message : fallback;
}

function revalidateAll(): void {
  revalidatePath("/documents");
  revalidatePath("/admin/documents");
}

/**
 * Le chemin où déposer un fichier.
 *
 * Construit côté serveur, jamais côté navigateur : c'est lui qui garantit que le
 * document atterrit dans le dossier de la bonne personne, et la fonction SQL le
 * revérifie ensuite.
 */
export async function prepareDocumentPath(
  employeeId: string,
): Promise<ActionResult<{ path: string }>> {
  await requireAdmin();

  if (!/^[0-9a-f-]{36}$/i.test(employeeId)) {
    return { ok: false, error: "Collaboratrice inconnue." };
  }

  return { ok: true, data: { path: `${employeeId}/${randomUUID()}.pdf` } };
}

export async function recordDocument(input: DocumentInput): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const value = parsed.data;
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("admin_add_document", {
    p_employee_id: value.employeeId,
    p_category: value.category,
    p_title: value.title,
    p_storage_path: value.storagePath,
    p_size_bytes: value.sizeBytes,
    ...(value.periodMonth ? { p_period_month: value.periodMonth } : {}),
  });

  if (error) {
    console.error("[documents] Enregistrement impossible", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "Le document n'a pas pu être enregistré."),
    };
  }

  revalidateAll();
  return { ok: true, data: { id: data } };
}

/**
 * Ouvrir un document.
 *
 * L'URL signée est demandée avec la session de l'appelante : la politique de
 * stockage vérifie que le chemin est bien dans son dossier. Deviner
 * l'identifiant d'un document ne suffit donc pas — la lecture de la ligne
 * échoue d'abord, et le stockage refuserait ensuite.
 */
export async function openDocument(
  documentId: string,
): Promise<ActionResult<{ url: string; title: string }>> {
  await requireEmployee();
  const supabase = await createServerSupabaseClient();

  const { data: document } = await supabase
    .from("documents")
    .select("id, title, storage_path")
    .eq("id", documentId)
    .maybeSingle();

  if (!document) {
    return { ok: false, error: "Ce document n'existe pas, ou il ne t'appartient pas." };
  }

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(document.storage_path, SIGNED_URL_SECONDS);

  if (error || !data) {
    console.error("[documents] URL signée impossible", error?.message);
    return { ok: false, error: "Le document n'a pas pu être ouvert. Réessaie." };
  }

  // Le marquage est fait par la base, qui sait qui appelle : une collaboratrice
  // ne peut ni prétendre n'avoir rien vu, ni marquer ce qu'elle n'a pas ouvert.
  await supabase.rpc("mark_document_viewed", { p_document_id: documentId });

  revalidatePath("/documents");
  revalidatePath("/admin/documents");

  return { ok: true, data: { url: data.signedUrl, title: document.title } };
}

/**
 * Retirer un document.
 *
 * La ligne part par la fonction SQL, qui renvoie le chemin ; le fichier part
 * ensuite par l'API Storage. Si la seconde étape échoue, il reste un fichier
 * que plus rien ne référence — donc inatteignable, puisque la politique de
 * lecture passe par la ligne.
 */
export async function removeDocument(documentId: string): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createServerSupabaseClient();
  const { data: path, error } = await supabase.rpc("admin_remove_document", {
    p_document_id: documentId,
  });

  if (error) {
    console.error("[documents] Retrait impossible", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "Le document n'a pas pu être retiré."),
    };
  }

  if (path) {
    const admin = createAdminSupabaseClient();
    const { error: storageError } = await admin.storage.from("documents").remove([path]);

    if (storageError) {
      console.warn("[documents] Fichier non supprimé du stockage", storageError.message);
    }
  }

  revalidateAll();
  return { ok: true, data: undefined };
}
