# Security

## Supported versions

Only the latest release gets security fixes. Carbon offers updates at start,
so update before you report, if you can.

## Reporting a vulnerability

Please report it privately, not in a public issue: on GitHub, open the
**Security** tab of this repository and choose **Report a vulnerability**.

Say what is affected, how to reproduce it, and which version and system
you saw it on. You will get an answer within a week. Once a fix is out,
the report can be made public, with credit to you if you like.

## What Carbon does

Carbon is a local-first notes app, and it does little outside your
computer:

- The only network access is the update check at start, which a setting
  turns off. There is no telemetry and no account.
- Notes stay plain Markdown files in the folder you open. File access is
  limited to that folder and to the app's own settings and cache.
- Updates are signed, and the app installs only an update with a valid
  signature.
- Images from the web in notes are not loaded: only images in the vault
  are shown.
