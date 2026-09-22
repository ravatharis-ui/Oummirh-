import { Home } from "lucide-react";
import type { Route } from "next";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "./registry";
import type { AppModule } from "./types";

// Synthetic modules point at routes that do not exist in the app; typed routes would
// reject them, so the fixtures cast. Real manifests never do.
const route = (href: string) => href as Route;

const fake = (key: string, overrides: Partial<AppModule> = {}): AppModule => ({
  key,
  name: key,
  enabled: true,
  nav: {
    collab: [{ label: key, href: route(`/${key}`), icon: Home, roles: ["employee"] }],
    admin: [{ label: key, href: route(`/admin/${key}`), icon: Home, roles: ["admin"] }],
  },
  ...overrides,
});

describe("buildRegistry", () => {
  it("derives menus from manifests and filters by role", () => {
    const registry = buildRegistry([fake("a"), fake("b")]);
    expect(registry.nav("collab", "employee").map((n) => n.href)).toEqual(["/a", "/b"]);
    expect(registry.nav("collab", "admin")).toEqual([]);
    expect(registry.nav("admin", "admin").map((n) => n.href)).toEqual(["/admin/a", "/admin/b"]);
  });

  it("drops disabled modules (static flag or settings override)", () => {
    const registry = buildRegistry([fake("a", { enabled: false }), fake("b"), fake("c")], {
      disabledKeys: new Set(["c"]),
    });
    expect(registry.modules.map((m) => m.key)).toEqual(["b"]);
  });

  it("indexes notification types and event handlers", async () => {
    const calls: string[] = [];
    const registry = buildRegistry([
      fake("conges", {
        notificationTypes: [{ type: "conges.approved", title: () => "t", body: () => "b" }],
      }),
      fake("planning", {
        eventHandlers: {
          "conges.approved": async () => {
            calls.push("planning");
          },
        },
      }),
    ]);
    expect(registry.notificationTypes.get("conges.approved")?.title({})).toBe("t");
    const handlers = registry.eventHandlers.get("conges.approved") ?? [];
    expect(handlers.map((h) => h.module)).toEqual(["planning"]);
    await handlers[0]?.handler({
      id: "1",
      type: "conges.approved",
      payload: {},
      actorId: null,
      createdAt: "",
    });
    expect(calls).toEqual(["planning"]);
  });

  it("collects dashboard widgets per space, in module order", () => {
    const CollabA = () => null;
    const AdminA = () => null;
    const CollabB = () => null;

    const registry = buildRegistry([
      fake("a", { dashboardWidgets: { collab: [CollabA], admin: [AdminA] } }),
      fake("b", { dashboardWidgets: { collab: [CollabB] } }),
      fake("c"),
    ]);

    expect(registry.widgets("collab")).toEqual([CollabA, CollabB]);
    expect(registry.widgets("admin")).toEqual([AdminA]);
  });

  it("returns no widgets when no module contributes any", () => {
    expect(buildRegistry([fake("a")]).widgets("admin")).toEqual([]);
  });

  it("rejects duplicate module keys and duplicate notification types", () => {
    expect(() => buildRegistry([fake("a"), fake("a")])).toThrow(/Duplicate module key/);
    const def = { type: "x.y", title: () => "", body: () => "" };
    expect(() =>
      buildRegistry([
        fake("a", { notificationTypes: [def] }),
        fake("b", { notificationTypes: [def] }),
      ]),
    ).toThrow(/declared twice/);
  });
});
