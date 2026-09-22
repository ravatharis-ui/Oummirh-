import { describe, expect, it, vi } from "vitest";

import type { DomainEvent, EventContext } from "@/core/modules";

import { demoEventHandlers } from "../server/handlers";

function event(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    type: "demo.hello",
    payload: { source: "test" },
    actorId: "22222222-2222-4222-8222-222222222222",
    createdAt: "2026-09-22T10:00:00Z",
    ...overrides,
  };
}

describe("demo.hello", () => {
  it("notifie la personne à l'origine de l'événement", async () => {
    const notify = vi.fn().mockResolvedValue(undefined);
    const context: EventContext = { notify };

    await demoEventHandlers["demo.hello"]?.(event(), context);

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222", "demo.hello", {
      source: "test",
    });
  });

  it("ne notifie personne quand l'événement n'a pas d'auteur", async () => {
    // Un événement émis par une tâche planifiée n'a pas d'auteur : le gestionnaire
    // doit s'abstenir plutôt que d'échouer et consommer une tentative.
    const notify = vi.fn();
    await demoEventHandlers["demo.hello"]?.(event({ actorId: null }), { notify });
    expect(notify).not.toHaveBeenCalled();
  });

  it("est rejouable sans effet supplémentaire imprévu", async () => {
    // Le distributeur peut rejouer un événement après un incident : deux passages
    // doivent produire deux appels identiques, pas un comportement différent.
    const notify = vi.fn().mockResolvedValue(undefined);
    const context: EventContext = { notify };

    await demoEventHandlers["demo.hello"]?.(event(), context);
    await demoEventHandlers["demo.hello"]?.(event(), context);

    expect(notify.mock.calls[0]).toEqual(notify.mock.calls[1]);
  });
});

describe("demo.fail", () => {
  it("échoue toujours, c'est sa raison d'être", async () => {
    await expect(
      demoEventHandlers["demo.fail"]?.(event({ type: "demo.fail" }), { notify: vi.fn() }),
    ).rejects.toThrow(/Échec volontaire/);
  });
});
