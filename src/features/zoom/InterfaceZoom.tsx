import { useZoom } from "./use-zoom";

/**
 * Makes the zoom keys and commands work for the whole app; draws nothing.
 * `apply` is the platform's way to scale the interface.
 */
export function InterfaceZoom({
  apply,
}: {
  apply: (scale: number) => Promise<void>;
}) {
  useZoom(apply);
  return null;
}
