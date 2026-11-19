import { CarbonLogo } from "../brand/CarbonLogo";
import { useT } from "../i18n/i18n";
import { useStartScreen } from "./use-start-screen";

const primary =
  "h-7 rounded-md bg-solid px-4 font-medium text-on-solid disabled:opacity-60";
const secondary =
  "h-7 rounded-md border border-line-strong bg-panel px-4 hover:bg-raise disabled:text-faint";

/** What the app shows while no vault is open. */
export function StartScreen() {
  const start = useStartScreen();
  const t = useT();
  if (!start.ready) return null;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-120 flex-col justify-center gap-6 px-8 py-10 select-none">
      <header className="flex flex-col gap-3">
        <h1>
          <CarbonLogo animated className="h-12 w-auto" />
        </h1>
        <p className="text-muted">{t("start.intro")}</p>
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
            {t("start.newVaultName")}
          </label>
          <input
            id="new-vault-name"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className="h-7 rounded-md border border-line-strong bg-bg px-2 select-text"
            value={start.name}
            onChange={(event) => start.setName(event.target.value)}
          />
          <p className="text-small text-faint">{t("start.newVaultHint")}</p>
          <div className="mt-1 flex gap-2">
            <button
              type="submit"
              className={primary}
              disabled={start.busy || !start.canCreate}
            >
              {t("start.chooseAndCreate")}
            </button>
            <button
              type="button"
              className={secondary}
              disabled={start.busy}
              onClick={start.cancelCreating}
            >
              {t("common.cancel")}
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
            {t("start.openVault")}
          </button>
          <button
            type="button"
            className={secondary}
            disabled={start.busy}
            onClick={start.startCreating}
          >
            {t("start.createVault")}
          </button>
        </div>
      )}

      {start.error?.missing === true && start.error.root !== null ? (
        <MissingVault
          root={start.error.root}
          onForget={() => {
            if (start.error?.root != null) start.forgetRecent(start.error.root);
          }}
        />
      ) : (
        start.error !== null && (
          <div role="alert" className="flex flex-col items-start gap-1">
            <p className="text-danger">
              {start.error.root === null
                ? start.error.message
                : t("start.couldNotOpen", {
                    root: start.error.root,
                    reason: start.error.message,
                  })}
            </p>
            {start.error.root !== null && (
              <p className="text-small text-faint">
                {t("start.couldNotOpenHint")}
              </p>
            )}
          </div>
        )
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
            {t("start.recentVaults")}
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
                  aria-label={t("start.removeRecentLabel", {
                    name: nameOf(path),
                  })}
                  onClick={() => start.forgetRecent(path)}
                >
                  {t("start.removeRecent")}
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

/**
 * The vault left open or picked from the list is not there any more: its
 * folder was moved or deleted while the app was closed. Says so in words,
 * and offers to take it off the list.
 */
function MissingVault({
  root,
  onForget,
}: {
  root: string;
  onForget: () => void;
}) {
  const t = useT();
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 rounded-md border border-line bg-panel px-3 py-2.5"
    >
      <div className="flex flex-col gap-0.5">
        <p className="font-medium">
          {t("start.missing", { name: nameOf(root) })}
        </p>
        <p className="text-small break-all text-faint">{root}</p>
      </div>
      <p className="text-small text-muted">{t("start.missingHint")}</p>
      <button type="button" className={secondary} onClick={onForget}>
        {t("start.missingForget")}
      </button>
    </div>
  );
}
