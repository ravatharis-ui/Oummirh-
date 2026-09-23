import { describe, expect, it } from "vitest";

import { buildCsp, cspHeaderName } from "./csp";

const NONCE = "abc123";

function directive(policy: string, name: string): string {
  return policy.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";
}

describe("buildCsp", () => {
  it("pose le nonce sur les scripts et rien d'autre", () => {
    const policy = buildCsp({ nonce: NONCE });
    expect(directive(policy, "script-src")).toContain(`'nonce-${NONCE}'`);
    expect(directive(policy, "style-src")).not.toContain("nonce");
  });

  it("garde unsafe-inline sur les styles, sans nonce", () => {
    // Avec un nonce, les navigateurs ignorent `unsafe-inline` — y compris pour
    // les attributs `style=""` que React pose en permanence. Une feuille de
    // style injectée n'exécute pas de code : le marché serait mauvais.
    expect(directive(buildCsp({ nonce: NONCE }), "style-src")).toBe(
      "style-src 'self' 'unsafe-inline'",
    );
  });

  it("n'autorise eval qu'en développement", () => {
    expect(buildCsp({ nonce: NONCE, isDevelopment: true })).toContain("'unsafe-eval'");
    expect(buildCsp({ nonce: NONCE })).not.toContain("'unsafe-eval'");
  });

  it("ne force HTTPS qu'en production", () => {
    expect(buildCsp({ nonce: NONCE })).toContain("upgrade-insecure-requests");
    expect(buildCsp({ nonce: NONCE, isDevelopment: true })).not.toContain(
      "upgrade-insecure-requests",
    );
  });

  it("ouvre Supabase en https et en websocket", () => {
    // Sans `wss:`, la cloche et le tableau de présence cessent de se mettre à
    // jour — en silence, ce qui est le pire des cas.
    const policy = buildCsp({ nonce: NONCE, supabaseUrl: "https://abc.supabase.co" });
    expect(directive(policy, "connect-src")).toContain("https://abc.supabase.co");
    expect(directive(policy, "connect-src")).toContain("wss://abc.supabase.co");
  });

  it("autorise blob: pour le selfie fabriqué dans le canvas", () => {
    expect(directive(buildCsp({ nonce: NONCE }), "img-src")).toContain("blob:");
  });

  it("survit à une URL Supabase absurde", () => {
    // Une variable mal copiée ne doit pas produire une politique cassée : elle
    // doit produire une politique qui ferme un peu trop, jamais un site mort.
    const policy = buildCsp({ nonce: NONCE, supabaseUrl: "pas une url" });
    expect(directive(policy, "connect-src")).toBe("connect-src 'self'");
    expect(policy).not.toContain("undefined");
  });

  it("interdit les cadres et les objets", () => {
    const policy = buildCsp({ nonce: NONCE });
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
  });
});

describe("cspHeaderName", () => {
  it("bascule en observation sans bloquer", () => {
    expect(cspHeaderName(true)).toBe("Content-Security-Policy-Report-Only");
    expect(cspHeaderName(false)).toBe("Content-Security-Policy");
  });
});
