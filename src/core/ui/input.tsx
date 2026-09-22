import * as React from "react";

import { cn } from "./utils";

/** Minimum 48 px tall and 16 px text: a smaller field makes iOS zoom on focus. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input bg-background h-12 w-full rounded-xl border px-3 text-base transition-colors outline-none",
        "placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-2",
        "aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
