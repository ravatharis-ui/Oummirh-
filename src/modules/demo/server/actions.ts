"use server";

import type { ActionResult } from "@/core/actions";
import { requireAdmin } from "@/core/auth";
import { createServerSupabaseClient } from "@/core/db/server";
import { emitEvent } from "@/core/events";

export interface DemoEventRow {
  id: string;
  type: string;
  attempts: number;
  processed: boolean;
  lastError: string | null;
  createdAt: string;
}

async function emitDemo(type: string): Promise<ActionResult> {
  const { user } = await requireAdmin();
  const result = await emitEvent(type, { source: "panneau de démonstration" }, user.id);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: undefined };
}

/** Emits an event that ends in a notification for whoever pressed the button. */
export async function sendDemoNotification(): Promise<ActionResult> {
  return emitDemo("demo.hello");
}

/** Emits an event whose handler always fails, to watch the attempts run out. */
export async function triggerDemoFailure(): Promise<ActionResult> {
  return emitDemo("demo.fail");
}

/** The last demo events, so the retry counter is visible as it climbs. */
export async function listDemoEvents(): Promise<DemoEventRow[]> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("domain_events")
    .select("id, type, attempts, processed_at, last_error, created_at")
    .like("type", "demo.%")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("[demo] Lecture des événements impossible", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    attempts: row.attempts,
    processed: row.processed_at !== null,
    lastError: row.last_error,
    createdAt: row.created_at,
  }));
}
