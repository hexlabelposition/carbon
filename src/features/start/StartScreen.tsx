import { useVaultSession } from "../vault/vault-session";

/**
 * What the app shows while no vault is open. For now it only opens a
 * folder; creating a vault and the recent vaults come in C-111.
 */
export function StartScreen() {
  const { opening, error, pickAndOpen } = useVaultSession();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <h1 className="text-h2 font-semibold tracking-[-0.01em]">Carbon</h1>
      <p className="max-w-120 text-muted">
        A vault is a folder of Markdown notes. Open one to start.
      </p>
      <button
        type="button"
        className="h-7 rounded-md bg-solid px-4 font-medium text-on-solid disabled:opacity-60"
        disabled={opening}
        onClick={() => void pickAndOpen()}
      >
        {opening ? "Opening…" : "Open vault"}
      </button>
      {error !== null && (
        <p role="alert" className="max-w-120 text-danger">
          Could not open the vault: {error}
        </p>
      )}
    </div>
  );
}
