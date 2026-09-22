import * as React from "react";

import { cn } from "./utils";

/**
 * Native `<select>` on purpose: it opens the platform picker, which is far easier
 * to use with a thumb than any custom dropdown, and works without JavaScript.
 */
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "border-input bg-background h-12 w-full rounded-xl border px-3 text-base transition-colors outline-none",
        "focus-visible:ring-ring focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Select };
