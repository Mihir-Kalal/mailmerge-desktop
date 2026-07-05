# MailMerge Desktop

A cross-platform (Windows/macOS/Linux) desktop app for personalized bulk email via **your own SMTP account** — Gmail, Outlook, college webmail, or any standard SMTP server.

Upload a CSV/XLSX → write one template with `{{Placeholders}}` → preview → send.

## Tech Stack

- Electron + React + TypeScript
- Node.js main process, SQLite (`better-sqlite3`) for local storage
- `nodemailer` for SMTP sending, `keytar` for OS-keychain password storage
- `papaparse` / `exceljs` for CSV/XLSX parsing
- `zustand` for renderer state

## Getting Started

Requires Node.js 18+ and a normal internet connection (native modules `better-sqlite3` and `keytar` need to compile/download prebuilt binaries on first install).

```bash
npm install
npm run dev        # starts Vite (renderer) + tsc --watch (main) + electron
```

### Production build

```bash
npm run build       # builds renderer (Vite) + main (tsc)
npm run package      # builds installers via electron-builder → ./release
```

## Building installers for Mac, Windows, and Linux (all at once)

`electron-builder` can only reliably build for the OS it's running on (e.g. a Mac can build a
`.dmg` but not a `.exe`). To get all three installers without owning three computers, this project
includes a GitHub Actions workflow (`.github/workflows/build.yml`) that builds Mac, Windows, and
Linux installers automatically in the cloud.

**One-time setup:**

1. Create a free GitHub account if you don't have one: https://github.com/signup
2. Create a new repository (e.g. `mailmerge-desktop`) at https://github.com/new — keep it Private
   if you don't want the source code public.
3. Push this project to it:
   ```bash
   cd mailmerge-app
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/mailmerge-desktop.git
   git push -u origin main
   ```

**Every time you want installers built:**

```bash
git tag v1.0.0
git push origin v1.0.0
```

Pushing a tag starting with `v` automatically triggers the workflow. Go to your repo's **Actions**
tab on GitHub, open the running workflow, wait a few minutes for all three OS builds to finish,
then scroll down to **Artifacts** at the bottom of that run — you'll find `mailmerge-macos-latest`,
`mailmerge-windows-latest`, and `mailmerge-ubuntu-latest` zip files there, each containing the
installer for that platform. Download and share those with whoever needs them.

You can also trigger a build manually anytime without a new tag: go to **Actions** tab → **Build
Desktop Installers** → **Run workflow**.



```
src/
  main/                   Electron main process
    main.ts               App entry, window creation
    ipc.ts                All IPC handlers (renderer <-> main bridge)
    db/database.ts         SQLite schema + connection
    services/
      smtpService.ts        SMTP config CRUD + nodemailer transport + keytar password storage
      contactService.ts     CSV/XLSX import, dynamic column detection
      templateService.ts    Template CRUD
      campaignService.ts    Campaign CRUD + sending engine (rate limits, retries, pause/resume/cancel)
      aiService.ts          AI writing assistant (calls Anthropic API with user's own key)
  preload/preload.ts       contextBridge-exposed typed API (window.mailmerge)
  shared/
    types.ts               Shared TS types (Contact, Template, Campaign, SmtpConfig, ...)
    placeholderEngine.ts    Pure placeholder detection + rendering logic (used by main + renderer)
  renderer/                React UI (Vite)
    src/pages/              SendWizardPage, TemplatesPage, ContactsPage, SmtpPage, CampaignsPage
    src/store/appStore.ts   Zustand store (theme, active page)
```

Business logic lives entirely in `src/main/services/*` and `src/shared/*`; the renderer only calls
`window.mailmerge.*` (defined in `preload.ts`) and renders UI — this keeps it easy to swap the UI
layer or add a CLI/REST front-end later without touching sending logic.

## How dynamic placeholders work

`contactService.ts` reads whatever columns exist in the uploaded spreadsheet — there are **no
hardcoded field names**. Every column becomes a placeholder automatically. `placeholderEngine.ts`
scans template text for `{{ColumnName}}` tokens (case-insensitive) and substitutes the matching
value from each row at send time. If tomorrow's spreadsheet has totally different columns
(`Project`, `Invoice Number`, `Meeting Date`, ...), no code changes are needed.

## Security

- SMTP passwords and the optional Anthropic API key are stored via `keytar` in the OS-native
  secure credential store (Keychain on macOS, Credential Vault on Windows, libsecret on Linux) —
  never written to disk in plain text or included in SQLite.
- `contextIsolation` is enabled and `nodeIntegration` disabled; the renderer only talks to the
  main process through the explicit, typed `preload.ts` bridge.

## AI Writing Assistant

The assistant calls the Anthropic Messages API directly using **your own API key**, entered under
SMTP Accounts → AI Writing Assistant and stored in the OS keychain. No key ships with the app.
Actions: improve, make professional/friendlier, shorten, expand, fix grammar, generate subject
lines, and draft follow-ups. (Tone-changing and translation are implemented in `aiService.ts` and
easy to wire a UI control for if you want more than the 8 buttons currently shown.)

## Sending engine behavior

- Emails are sent one at a time per recipient with configurable fixed + random delay.
- Per-minute and per-hour caps are enforced with a sliding window.
- Failed sends retry up to `retryCount` times with linear backoff, then are marked `failed` and
  the campaign continues to the next recipient.
- Pause takes effect before the next recipient is dequeued; Resume picks back up from there;
  Cancel stops the loop and marks all remaining recipients untouched (their logs stay `pending`).
- All progress is persisted to SQLite after every recipient, so campaign history/logs survive
  an app restart even mid-send (though a genuinely running send does not auto-resume on relaunch
  — click Resume again after reopening if it was paused).

## Known scope notes / what to extend next

This is a complete, runnable v1 covering every core workflow in the spec (SMTP, dynamic mail
merge, rich editor, live preview, sending engine with pause/resume/cancel/rate-limits/retries,
global + dynamic per-recipient attachments, template manager, campaign manager with logs/export/
search, AI assistant, autosave, light/dark mode). Not yet wired up (left as clean extension points
in `services/` per the "Future Extensibility" list in the spec): Gmail/Outlook OAuth APIs, Google
Sheets/Airtable/HubSpot/Mailchimp/CRM connectors, multi-user/team collaboration, open/click
tracking, WhatsApp/SMS channels, and a plugin architecture. Because business logic is isolated in
`src/main/services/*`, each of these can be added as a new service + IPC handlers without touching
the sending engine or UI.
