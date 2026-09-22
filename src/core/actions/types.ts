/**
 * What every server action returns.
 *
 * A server action is a public HTTP endpoint, so it never throws at the browser:
 * it returns a French sentence a salesperson can act on. Technical detail goes to
 * the server log, where it belongs.
 */
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
