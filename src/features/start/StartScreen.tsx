import { useStartScreen } from "./use-start-screen";

const primary =
  "h-7 rounded-md bg-solid px-4 font-medium text-on-solid disabled:opacity-60";
const secondary =
  "h-7 rounded-md border border-line-strong bg-panel px-4 hover:bg-raise disabled:text-faint";

/** What the app shows while no vault is open. */
export function StartScreen() {
  const start = useStartScreen();

  return (
    <div className="mx-auto flex min-h-full w-full max-w-120 flex-col justify-center gap-6 px-8 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-h2 font-semibold tracking-[-0.01em]">Carbon</h1>
        <p className="text-muted">
          A vault is a folder of Markdown notes. Open one to start.
        </p>
      </header>

      {start.creating ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            start.create();
          }}
        >
          <label htmlFor="new-vault-name" className="font-medium">
            Name of the new vault
          </label>
          <input
            id="new-vault-name"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className="h-7 rounded-md border border-line-strong bg-bg px-2"
            value={start.name}
            onChange={(event) => start.setName(event.target.value)}
          />
          <p className="text-small text-faint">
            Next you choose where to put it. Carbon creates a folder with this
            name there.
          </p>
          <div className="mt-1 flex gap-2">
            <button
              type="submit"
              className={primary}
              disabled={start.busy || !start.canCreate}
            >
              Choose location and create
            </button>
            <button
              type="button"
              className={secondary}
              disabled={start.busy}
              onClick={start.cancelCreating}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={primary}
            disabled={start.busy}
            onClick={start.openFolder}
          >
            Open vault
          </button>
          <button
            type="button"
            className={secondary}
            disabled={start.busy}
            onClick={start.startCreating}
          >
            Create vault
          </button>
        </div>
      )}

      {start.error !== null && (
        <div role="alert" className="flex flex-col items-start gap-1">
          <p className="text-danger">
            {start.error.root === null
              ? start.error.message
              : `Could not open ${start.error.root}: ${start.error.message}`}
          </p>
          {start.error.root !== null && (
            <p className="text-small text-faint">
              If the folder was moved or deleted, remove it from the list below.
              If it is still there, open it again with “Open vault”.
            </p>
          )}
        </div>
      )}

      {start.recentVaults.length > 0 && (
        <section
          aria-labelledby="recent-vaults"
          className="flex flex-col gap-2"
        >
          <h2
            id="recent-vaults"
            className="text-label font-semibold tracking-[0.06em] text-faint uppercase"
          >
            Recent vaults
          </h2>
          <ul className="flex flex-col">
            {start.recentVaults.map(({ path }) => (
              <li
                key={path}
                className="flex items-center gap-1 rounded-md hover:bg-raise"
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 flex-col items-start rounded-md px-2 py-1.5 text-left disabled:text-faint"
                  disabled={start.busy}
                  onClick={() => start.openRecent(path)}
                >
                  <span className="max-w-full truncate font-medium">
                    {nameOf(path)}
                  </span>
                  <span className="max-w-full truncate text-small text-faint">
                    {path}
                  </span>
                </button>
                <button
                  type="button"
                  className="mr-1 shrink-0 rounded-sm px-1.5 py-0.5 text-small text-muted hover:bg-selected hover:text-fg"
                  aria-label={`Remove ${nameOf(path)} from the recent vaults`}
                  onClick={() => start.forgetRecent(path)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** The folder name of a vault: the last part of its path. */
function nameOf(root: string): string {
  return root.slice(root.lastIndexOf("/") + 1);
}
