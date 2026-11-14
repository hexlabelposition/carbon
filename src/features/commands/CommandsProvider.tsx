import { useState, type ReactNode } from "react";
import { CommandRegistry, CommandsContext } from "./commands";

/** Holds the commands of everything mounted below it. */
export function CommandsProvider({ children }: { children: ReactNode }) {
  const [registry] = useState(() => new CommandRegistry());
  return (
    <CommandsContext.Provider value={registry}>
      {children}
    </CommandsContext.Provider>
  );
}
