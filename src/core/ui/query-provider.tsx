"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * One query client per browser session.
 *
 * Created inside state, not at module scope: on the server a module-level client
 * would be shared between requests, and one visitor's data could be handed to the
 * next. Realtime pushes invalidate what it holds, so a short stale window is
 * enough and refetching on every window focus would just add noise on a phone.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
