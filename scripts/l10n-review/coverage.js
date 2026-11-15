/**
 * `pnpm l10n:coverage`: runs every screen of the localization review tool in a headless browser,
 * then reports the screens that need fixing and the strings no screen shows. It drives the review
 * page itself, in its check mode, so it shows exactly what a review would. What each screen shows
 * is saved to `.l10n-review/coverage.json`, which the review page reads to list the other strings
 * on cards. With `--json`, the full result is printed as JSON.
 */

/* eslint-disable no-console */

import { chromium } from 'playwright';
import { createLogger, createServer } from 'vite';

/**
 * @typedef {object} CheckResult
 * @property {{ id: string, title: string, keys: number, error?: string }[]} scenarios Screens, with
 * the number of strings each one shows and why it didn’t show properly, if it didn’t.
 * @property {number} total Number of strings.
 * @property {number} covered Number of strings a screen shows.
 * @property {{ key: string, source: string, section?: string, group?: string }[]} uncovered
 * Strings no screen shows.
 * @property {string} [failure] Why the review page couldn’t run the check, if it couldn’t.
 */

/**
 * Longest a run may take: each group of screens starts the app, which takes up to 20 s.
 */
const TIMEOUT = 45 * 60 * 1000;

/**
 * Print the result for a person to read.
 * @param {CheckResult} result Result.
 */
const report = ({ scenarios, total, covered, uncovered }) => {
  const broken = scenarios.filter(({ error }) => error);

  console.info(`Screens: ${scenarios.length}, ${broken.length} to fix`);

  scenarios.forEach(({ id, keys, error }) => {
    const count = `${keys} ${keys === 1 ? 'string' : 'strings'}`;

    console.info(`  ${error ? '✗' : '✓'} ${id}: ${count}${error ? `. ${error}` : ''}`);
  });

  console.info(
    `\nStrings on a screen: ${covered} of ${total} (${Math.round((covered / total) * 100)}%)`,
  );

  /** @type {Map<string, number>} */
  const sections = new Map();

  uncovered.forEach(({ source, section }) => {
    const name = source === 'ui' ? 'Sveltia UI' : (section ?? 'Other');

    sections.set(name, (sections.get(name) ?? 0) + 1);
  });

  console.info(`Not on any screen: ${uncovered.length}, by section:`);

  [...sections]
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => {
      console.info(`  ${String(count).padStart(4)}  ${name}`);
    });

  console.info('\nRun with --json for the full list.');
};

process.env.L10N_REVIEW ||= '1';

/**
 * Logger leaving out what the frames log, which Vite passes on: the configuration error screens log
 * their errors on purpose.
 */
const logger = createLogger('error');
const { error: logError } = logger;

/**
 * Log an error, unless a frame logged it.
 * @param {string} message Message.
 * @param {import('vite').LogErrorOptions} [options] Options.
 */
logger.error = (message, options) => {
  if (!message.includes('[console.')) {
    logError(message, options);
  }
};

const server = await createServer({
  customLogger: logger,
  server: { port: 5190, open: false },
});

/** @type {import('playwright').Browser | undefined} */
let browser;

try {
  await server.listen();

  const [baseURL] = server.resolvedUrls?.local ?? [];

  browser = await chromium.launch();

  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  // `--only github/,workflow/` runs the screens whose ID starts with `github/` or `workflow/` only
  const onlyIndex = process.argv.indexOf('--only');
  const only = onlyIndex === -1 ? '' : (process.argv[onlyIndex + 1] ?? '');

  await page.goto(new URL(`l10n-review/?check=${encodeURIComponent(only)}`, baseURL).href);

  const handle = await page.waitForFunction(
    () => /** @type {any} */ (window).l10nCheckResult,
    undefined,
    { timeout: TIMEOUT, polling: 1000 },
  );

  /** @type {CheckResult} */
  const result = await handle.jsonValue();

  if (result.failure) {
    throw new Error(result.failure);
  }

  if (process.argv.includes('--json')) {
    console.info(JSON.stringify(result, null, 2));
  } else {
    report(result);
  }

  process.exitCode = result.scenarios.some(({ error }) => error) ? 1 : 0;
} catch (/** @type {any} */ ex) {
  console.error(`The check didn’t finish: ${ex.message}`);
  process.exitCode = 2;
} finally {
  await browser?.close();
  await server.close();
}
