import { createAdminSupabaseClient } from "@/core/db/admin";
import { scheduledRoute } from "@/core/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 200;

/**
 * Selfie retention.
 *
 * Postgres cannot delete a file from Storage, so the purge is in two steps: the
 * database says what is past its retention, this route deletes the objects
 * through the Storage API, and the database then forgets the paths. If the route
 * dies in between, the next run picks the same paths up again — nothing is lost
 * and nothing is done twice.
 *
 * The pointings themselves are never deleted. Only the photograph is.
 */
const handle = scheduledRoute({
  job: "selfies.purge",
  run: async () => {
    const admin = createAdminSupabaseClient();

    const { data: rows, error } = await admin.rpc("selfies_to_purge", { p_limit: BATCH });
    if (error) throw new Error(error.message);

    const paths = (rows ?? []).map((row) => row.photo_path).filter(Boolean);
    if (paths.length === 0) return { purged: 0 };

    const { error: storageError } = await admin.storage.from("selfies").remove(paths);
    if (storageError) throw new Error(storageError.message);

    const { data: purged, error: markError } = await admin.rpc("mark_selfies_purged", {
      p_paths: paths,
    });
    if (markError) throw new Error(markError.message);

    return { purged: purged ?? 0 };
  },
});

export const GET = handle;
export const POST = handle;
