"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/core/ui/button";

import { signInAdmin, type SignInState } from "./actions";

const INITIAL: SignInState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending}>
      {pending ? (
        <>
          <LoaderCircle className="size-5 animate-spin" aria-hidden /> Connexion…
        </>
      ) : (
        "Se connecter"
      )}
    </Button>
  );
}

/**
 * Plain form posting to a server action, so it works before JavaScript loads and
 * the password never sits in client state.
 */
export function AdminLoginForm() {
  const [state, action] = useActionState(signInAdmin, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Adresse email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="border-input bg-background focus-visible:ring-ring h-12 rounded-xl border px-3 text-base outline-none focus-visible:ring-2"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="border-input bg-background focus-visible:ring-ring h-12 rounded-xl border px-3 text-base outline-none focus-visible:ring-2"
        />
      </div>

      <p role="status" aria-live="polite" className="text-destructive min-h-6 text-sm">
        {state.error}
      </p>

      <SubmitButton />
    </form>
  );
}
