/**
 * The caller's IP as seen behind Vercel's proxy.
 *
 * `x-forwarded-for` is a client-settable header on a bare server, but on Vercel the
 * platform rewrites it, so the first entry is the real client. It is used for
 * throttling and for the audit trail, never for an authorisation decision.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip");
}
