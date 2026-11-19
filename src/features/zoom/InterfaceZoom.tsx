import { useZoom } from "./use-zoom";

/**
 * Makes the zoom keys and commands work for the whole app; draws nothing.
 * `apply` is the platform's way to scale the interface, `onFirstApplied`
 * is called once the zoom remembered is applied.
 */
export function InterfaceZoom({
  apply,
  onFirstApplied,
}: {
  apply: (scale: number) => Promise<void>;
  onFirstApplied?: () => void;
}) {
  useZoom(apply, onFirstApplied);
  return null;
}
