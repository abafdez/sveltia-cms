# Localization review tool

A development tool for reviewing a translation of Sveltia CMS in context. It shows each screen of the CMS live, in English and in the target locale, lists the strings on the screen and lets the translator accept them, or fix one in place. Saving writes the locale file, and the screens update without reloading.

It runs on the Vite dev server only and adds nothing to the published package.

## Run it

```bash
pnpm l10n                     # opens http://localhost:5173/l10n-review/
L10N_REVIEW=es-CO pnpm l10n   # with a default locale
pnpm l10n:coverage            # runs every screen headless and reports what they cover
```

- The sample site is the [Sveltia CMS demo site](https://github.com/sveltia/sveltia-cms-demo): its configuration, its sample content in `seed/` and its JavaScript API examples in `api.js`. It’s read from a checkout next to this repository, `../sveltia-cms-demo`, or from `SVELTIA_DEMO_DIR`. Without it, a small configuration with no content stands in, and the page says so.
- `?locale=xx` in the address picks another locale. A locale with no file yet works too: its file is created on the first save.
- Sveltia UI strings (the `_sui.` keys) are read-only by default, as the installed package is overwritten by `pnpm install`. Start the server with `SVELTIA_UI_DIR=../sveltia-ui` pointing to a checkout of `sveltia/sveltia-ui` to save them there.
- The review state is kept in `.l10n-review/<locale>.json`, and what each screen shows in `.l10n-review/coverage.json`. Git ignores both.

## Using it

The page has a preview of the current screen (two panes side by side, or one at a time), a panel with the strings that can’t be seen (`aria-label`, `placeholder`, `title`, text for screen readers, the page title, and messages the app logs to the browser console), and the list of strings on the screen, with their key, English text and translation. A console message shows as code, with a `console.warn` style tag: the first screen after the app starts also has what it logged while starting, like configuration warnings.

| Key | Action |
| --- | --- |
| <kbd>←</kbd> <kbd>→</kbd> | Previous or next screen. Leaving a screen accepts its strings. |
| <kbd>↑</kbd> <kbd>↓</kbd> | Select a string. It’s spotlighted in the preview, and the translation pane shows the English text by it. |
| <kbd>Enter</kbd> | Edit the selected string. In the editor, <kbd>Enter</kbd> saves, <kbd>Shift</kbd>+<kbd>Enter</kbd> starts a new line, <kbd>Esc</kbd> cancels. |
| <kbd>V</kbd> | One pane or two. One is the default below 1200 px. |
| <kbd>T</kbd> | With one pane: show the original or the translation. |
| <kbd>H</kbd> | Show or hide the hidden text panel. The list tags those strings anyway. |
| <kbd>Alt</kbd>+click | Select the string clicked in a preview. |

The edges between the panels and between the list columns can be dragged to resize them, and double-clicked to reset them. The view settings and sizes are remembered in the browser.

After the screens come cards for the strings no screen shows, a section of `en-US.yaml` at a time, up to 12 strings per card. With no preview, a card shows each string’s group heading and note from the source file, the English text and the translation. The keys work the same way, and leaving a card accepts it. Only cards with something pending are listed, and they’re rebuilt each time the review moves past the last screen.

A string counts as reviewed when the state file holds the hash of its current English text and translation. A change to either, upstream or in the file, brings it back. A missing translation stays pending until it’s written: there’s nothing to accept.

## Coverage

`pnpm l10n:coverage` starts the dev server, opens the review page in a headless browser in its check mode (`?check`), runs every screen without accepting anything, and prints:

- each screen with the number of strings it shows, and why it didn’t show properly, if it didn’t;
- how many strings the screens show in all;
- the strings no screen shows, counted by section of `en-US.yaml`: the to-do list for scenarios.

It exits with code 1 if a screen needs fixing, and `--json` prints the full result. Run it after pulling upstream changes. A review records what each screen shows too, so the cards follow as screens are added.

## Status

v1:

- Live previews of 8 screens: the sign-in page, a configuration error, the entry list, its sorting menu, a collection nearing its limit, a new entry, the editor options menu and the account menu. Together they show about 90 of the 1,212 strings (CMS and Sveltia UI).
- Every string on a screen found with its key, including attributes and visually hidden text. Strings behind a modal dialog, or covered by something else, are left out.
- Accepting a screen by leaving it, and editing in place. A save is checked as MessageFormat 2, writes a one-line diff that keeps the file’s comments and order, and reaches both previews in about 0.1 s, keeping the screen’s state (an open menu stays open).
- Strings the app formats once at start, like configuration errors, restart the preview that shows them after a save, in about 10 s.
- Unit tests for the markers, the YAML reading and writing (every locale file survives a round trip byte for byte), and the scenarios: they fail if a step uses a key that no longer exists in `en-US.yaml`.

Since v1:

- Every string is reviewable: the strings no screen shows come after the screens, on cards, with their group heading and note. The sections, group headings and notes are read from the comments of `en-US.yaml`.
- `pnpm l10n:coverage` reports the screens to fix and the strings no screen shows, by section. The first run: 88 of 1,215 strings on a screen, in 31 s.
- The demo site is the sample site, and there are 70 screens: the sign-in pages and the demo welcome dialog, the entry list with its sort, filter and group menus, table and grid views, selection and delete confirmation, a nested collection, collection limits, new entries with validation errors, a multilingual entry with its menus, an entry for each of the 19 field types, the YAML, JSON and TOML singletons, the asset library with its list view and asset details, the account and help menus, keyboard shortcuts, each Settings panel, and 14 broken configurations showing 110 of the configuration messages. 367 of 1,215 strings are on a screen (30%), in about 2.5 minutes.
- Strings the app only logs to the console count as shown, with the console as their context. A configuration with warnings only, so the app starts and logs them, shows the configuration warnings. The rich text editor’s text style menu and link dialog have screens of their own. 73 screens, 389 strings on a screen (32%).

Not done yet: see [Work left](#work-left).

## How it works

All the code is in this folder. Outside it, `vite.config.js` registers the plugin, `package.json` has the `l10n` script, `scripts/vite/locales.js` exports two helpers, and `.gitignore` has `/.l10n-review`. Nothing in `src/` changes.

| File | Runs in | What it does |
| --- | --- | --- |
| `plugin.js` | Node, Vite | The Vite plugin. It’s only applied to the dev server when `L10N_REVIEW` is set. It serves the review page, the app page loaded in each frame (with the target locale’s messages inlined), the configurations and sample site, and a small API: `data`, `accept`, `save`, `coverage`. When a locale file changes, it sends the new messages and the changed keys over HMR instead of letting Vite reload. |
| `store.js` | Node | Reads the locale files of both packages, with the section, group heading and note of each string from the comments, keeps the review state and the coverage, and writes translations with `yaml`’s document API. A new key goes after its closest preceding key in `en-US.yaml`. |
| `coverage.js` | Node | `pnpm l10n:coverage`: starts the dev server and drives the review page in check mode with Playwright. |
| `scenarios.js` | Node | The screens to show: start options (configuration, signing in, demo mode, developer mode, fetch mocks), a route and steps, and the configurations they use, as changes to the sample site’s. It’s imported again when it changes, so editing it doesn’t restart the server. |
| `site.js` | Node | Finds the demo site checkout and reads its configuration, its list of sample files and the files the review page loads. |
| `config-errors.js` | Node | Broken versions of the sample configuration, each breaking as many things as it can at once, as the CMS lists every problem on its start page. A change to it needs a server restart. |
| `client/frame.js` | Each frame, before the app | Gives the frame its own in-memory `localStorage` and browser language, and mocks `fetch`. It tags every compiled message in `@sveltia/i18n`’s `dictionary` with an invisible marker spelling its key. It scans the screen for markers, runs scenarios, draws the outlines in a top-layer popover, applies hot updates, and passes the review keys to the page when the app has the focus. |
| `client/markers.js` | Browser | Encodes a key as Unicode tag characters (U+E0020–E007E, between U+E0001 and U+E007F), which render as nothing, and finds them in text. |
| `client/page.js`, `page.css` | Review page | The page. It holds two pairs of frames: one shows the current screen, and the hidden one starts the app the next group of screens needs. After the screens, it shows the cards. |

A scenario finds the element to click by message key, not by CSS selector, so changes to markup or class names don’t break it. Starting the app takes 5–7 s on the dev server (it’s the unbundled module graph), so scenarios with the same start options run in one app, switching screens by route in 0.25–0.9 s, and the hidden pair starts the next group in advance.

## Parts prone to drift

Upstream moves fast. These are the places that can break or go stale, from the most likely:

1. **The demo site.** The routes and steps use its collections, entries and files: a renamed entry or collection there breaks a screen here, which `pnpm l10n:coverage` reports. Changes to the demo should keep the review tool in mind, and the other way round.
2. **Scenario steps and routes** (`scenarios.js`). A key renamed or removed upstream breaks a step: the unit test catches it, and in the tool the screen shows “This scenario needs fixing” and the review carries on. A route or a flow that changes (a button moving into a menu) shows the wrong screen without an error: only looking at it tells.
3. **Coverage.** New strings in `en-US.yaml` show on no screen until a scenario covers them. They aren’t lost, as they come on cards, but they lose their context: `pnpm l10n:coverage` counts them by section. A string a scenario stopped showing moves to the cards the same way.
4. **The sample configurations** (`scenarios.js`). An option renamed or made stricter turns a working screen into a configuration error.
5. **App internals the frame relies on** (`client/frame.js`):
   - `@sveltia/i18n` keeps compiled messages in a reactive `dictionary` and adds them with `addMessages`. A change to how it stores or compiles messages breaks the tagging, and then nothing is found on any screen.
   - The app reads its configuration from the `cms-config-url` link that `app.svelte` adds in development, from `VITE_SITE_URL`, and from the test repository in OPFS. The plugin and the page depend on all three.
   - The language preference stored in `localStorage` and the sign-in button of the test repository (`work_with_test_repo`).
   - Sveltia UI menus and dialogs are modal `<dialog>` elements, and visually hidden text uses a 1 px clipped box. The covered and hidden checks rely on both.
   - Between screens, Escape is pressed only while a menu, a popup or a dialog is open (`[aria-haspopup][aria-expanded="true"]` or `dialog[open]`): in the content editor, Escape closes the editor, which goes back in the history after the next route is set.
6. **Strings formatted once.** Strings the app formats at start and keeps, like configuration errors, are detected after a save and their preview restarts. A new place that keeps formatted text works the same way, but slowly.
7. **The YAML style of the locale files.** Writing relies on `yaml` reproducing the files exactly, which the round trip test checks for every file.
8. **The comment layout of `en-US.yaml`.** The cards take their sections from titles between rules of `=` signs, their group headings from comments after a blank line, and the notes from comments right above a key. A file that stops following that layout gives cards with poorer headings, nothing worse.

## Work left

1. **The end-to-end tests as a source of context.** Upstream’s 168 Playwright test files drive the app through assets, every field type, save errors, the workflow, sign-in and bulk editing. Run once with the strings tagged, they would record where each string appears, with a screenshot of it in context, so a card shows the real spot in the interface. Upstream keeps the tests up to date, so this costs nothing to maintain here.
2. **Mocked backends.** A GitHub configuration shows the other sign-in strings (42 left), and the editorial workflow (80) needs a mocked GitHub API, which the end-to-end tests already have (`e2e/fixtures/github.js`).
3. **Extending the demo site**, where a screen needs content it lacks: small sample files of the common types (images, video, audio, documents, data) would show the 52 file type labels on the asset list view, for example.
4. **More screens and configurations**, in the order `pnpm l10n:coverage` gives: the remaining configuration messages, the content editor, the asset library and field widgets mostly need steps that open dialogs and pickers, or errors like failed uploads. Of the Sveltia UI strings, most left are in the rich text editor (tables, alignment, link editing), which a cursor in a table or on a link would show. Components the CMS doesn’t use in these states, like the calendar, could come from the Sveltia UI showcase site in `sveltia/sveltia-ui` (`src/routes/components/`), which has a page per component.
5. **`pnpm l10n:delta --locale xx`**: write the missing and outdated keys with their English text and comments, for an AI to translate following a checked-in instructions file and per-locale conventions. The result goes in through the same writer and shows in the queue as pending.
6. **A GitHub Action** that keeps a pinned issue with each locale’s status (translated, missing, outdated, assignee) and comments on a locale’s issue when its strings change, so whoever is assigned to it gets notified. It would share the delta code with `l10n:delta`.

## Possible improvements

- **Faster starts.** Give each frame its own origin (`localhost`, `127.0.0.1`) so each app gets its own process: the frames already talk to the page with `postMessage` only. Put several errors in each broken configuration, so one start shows many messages. Start the hidden pair only once the visible one is idle.
- **Plural and select variants on screen.** The editor shows each variant with sample numbers, but a screen shows one count. A scenario could repeat with other sample data.
- **Zoom.** The previews render the app at 1280 px scaled to fit. A zoom control would help on small screens, beyond the one-pane view.
- **Order of screens.** Order the queue so each screen brings the most pending strings, and skip screens with nothing pending.
- **Review state in the repository.** The state is local now. Committed per locale, it would let translators share progress, and the Action could report reviewed strings too.
- **Tests for the browser code.** The scan, the covered and hidden checks, and the outline drawing are only tested by hand.

## Known issues

- **Needless restarts.** After a save, a preview restarts when a changed string looks the same on screen. That’s how strings formatted once are caught, but it also catches an edit to a plural or `select` variant that the screen doesn’t show, which restarts the preview for nothing (about 10 s).
- **A save refreshes the data twice.** The save itself and the hot update both reload the review data. If the hot update’s response arrives last and was read before the accept was written, the string shows as pending again until the next screen. Making the accept part of the save would fix both.
- **A save made on a card doesn’t restart a preview.** A string formatted once at start, like a configuration error, changed while a card is shown keeps its old text in the preview when the review goes back to its screen, until the app restarts.
- **A screen can be scanned mid-transition.** After a route change, the frame waits for the screen to change, then for it to go quiet. A screen passing through another one on the way, like the list shown for a moment while an editor closes, could end the wait early. It hasn’t happened in the coverage runs since the Escape fix.
- **The page seeds the repository itself.** It copies the demo’s sample files to the browser’s storage before any frame starts, instead of the app’s own seeding, which would run in both frames at once. It doesn’t share the app’s path checks or its limit on parallel downloads.
- **Small differences between runs.** A coverage run can find a string or two more or less than the previous one, as some screens are scanned while something still changes, like a menu’s animation.
- **Removed keys linger.** A key deleted from a locale file stays in the preview until the app restarts, as adding messages never removes any.
