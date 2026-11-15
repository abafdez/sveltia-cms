import { readFile, stat } from 'fs/promises';
import path from 'path';

import { stringify as stringifyYAML } from 'yaml';

import { getAppLocales } from '../vite/locales.js';

import { createRepository, handleGitRequest, runGitAction } from './git.js';
import { getDemoDir, hasDemo, listSeedFiles, readBaseConfig, resolveSiteFile } from './site.js';
import {
  acceptMessages,
  getReviewItems,
  getSources,
  readAllLocaleFiles,
  readChangedLocaleFile,
  readCoverage,
  readEntries,
  recordCoverage,
  saveMessage,
  SOURCE_LOCALE,
} from './store.js';

/**
 * @import { IncomingMessage, ServerResponse } from 'http';
 * @import { Plugin, ViteDevServer } from 'vite';
 */

/**
 * Path the review tool is served under.
 */
const BASE_PATH = '/l10n-review';
/**
 * File defining the scenarios, the configurations and the sample site.
 */
const SCENARIOS_FILE = new URL('./scenarios.js', import.meta.url);

/**
 * Load the scenarios, the configurations and the sample site. The file is imported again whenever
 * it changes, rather than with the plugin, so editing a scenario doesn’t restart the server: the
 * next screen opened uses it.
 * @returns {Promise<typeof import('./scenarios.js')>} Module.
 */
const loadScenarios = async () => {
  const { mtimeMs } = await stat(SCENARIOS_FILE);

  return import(`${SCENARIOS_FILE.href}?t=${mtimeMs}`);
};

/**
 * Path the app loads its configuration from, as the local live site: in development, the app adds
 * a link to `<site URL>/admin/config.yml`, so the plugin sets the site URL to this path.
 */
const SITE_PATH = `${BASE_PATH}/site`;

/**
 * Event sent to the browser when a locale file changes, with the new messages.
 */
export const MESSAGES_EVENT = 'l10n-review:messages';

/**
 * Path of the script that drives the app in each frame of the review page.
 */
const FRAME_SCRIPT = '/scripts/l10n-review/client/frame.js';
/**
 * Path of the script of the review page.
 */
const PAGE_SCRIPT = '/scripts/l10n-review/client/page.js';

/**
 * HTML of the review page.
 */
const PAGE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Localization Review</title>
    <link rel="stylesheet" href="/scripts/l10n-review/client/page.css" />
  </head>
  <body>
    <script type="module" src="${PAGE_SCRIPT}"></script>
  </body>
</html>
`;

/**
 * Regular expression matching a locale code like the file names of the locale files: a language,
 * optionally followed by a script and a region, e.g. `ja`, `es-ES` or `zh-Hant-TW`.
 */
const LOCALE_REGEX = /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-(?:[A-Z]{2}|\d{3}))?$/;

/**
 * Get the locale given with the `L10N_REVIEW` environment variable, if it’s a locale code rather
 * than a flag like `1`.
 * @returns {string | undefined} Locale code.
 */
const getDefaultLocale = () => {
  const value = process.env.L10N_REVIEW ?? '';

  return LOCALE_REGEX.test(value) && value !== SOURCE_LOCALE ? value : undefined;
};

/**
 * Read the body of a request as JSON. The JSON content type is required: a page on another site can
 * only send it after a CORS preflight, which the dev server doesn’t grant, so it can’t write to the
 * locale files with a plain form or `text/plain` request.
 * @param {IncomingMessage} req Request.
 * @returns {Promise<any>} Parsed body.
 * @throws {Error} If the request isn’t JSON.
 */
const readJSON = async (req) => {
  if (!req.headers['content-type']?.startsWith('application/json')) {
    throw new Error('The request must be JSON.');
  }

  const chunks = [];

  // eslint-disable-next-line no-restricted-syntax
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}');
};

/**
 * Content types of the files the demo site has, by extension.
 */
const CONTENT_TYPES = {
  '.gpx': 'application/gpx+xml',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.toml': 'text/plain',
  '.txt': 'text/plain',
  '.webp': 'image/webp',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
};

/**
 * Get the content type of a file.
 * @param {string} filePath Path.
 * @returns {string} Content type.
 */
const getContentType = (filePath) =>
  /** @type {Record<string, string>} */ (CONTENT_TYPES)[path.extname(filePath).toLowerCase()] ??
  'application/octet-stream';

/**
 * Send a response.
 * @param {ServerResponse} res Response.
 * @param {number} status Status code.
 * @param {string | Buffer} body Body.
 * @param {string} type Content type.
 */
const send = (res, status, body, type) => {
  res.statusCode = status;
  res.setHeader(
    'Content-Type',
    /^text\/|json|javascript/.test(type) ? `${type}; charset=utf-8` : type,
  );
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
};

/**
 * Send a JSON response.
 * @param {ServerResponse} res Response.
 * @param {any} data Data.
 * @param {number} [status] Status code.
 */
const sendJSON = (res, data, status = 200) => {
  send(res, status, JSON.stringify(data), 'application/json');
};

/**
 * Check that a locale code is valid, so it can’t point anywhere else on the disk. It doesn’t have
 * to be one of the app locales: a new locale gets its file on the first save.
 * @param {unknown} locale Locale code.
 * @returns {string} Locale code.
 * @throws {Error} If it isn’t a valid locale code.
 */
const checkLocale = (locale) => {
  if (typeof locale !== 'string' || !LOCALE_REGEX.test(locale)) {
    throw new Error(`Invalid locale code: ${locale}`);
  }

  return locale;
};

/**
 * Get the messages of a locale from the files on the disk, keyed like the app’s. They’re inlined in
 * the frame page, as the app may not have them: the locale may be new, or the Sveltia UI strings
 * may come from a checkout of the repository rather than the installed package.
 * @param {string} locale Locale code.
 * @returns {Promise<Record<string, string>>} Flat messages.
 */
const getLocaleMessages = async (locale) => {
  const lists = await Promise.all(
    getSources().map(async (source) =>
      [...(await readEntries(source, locale))].map(([key, { value }]) => [
        `${source.prefix}${key}`,
        value,
      ]),
    ),
  );

  return Object.fromEntries(lists.flat());
};

/**
 * Get the HTML of the app page loaded in each frame: the dev server’s page with the script driving
 * the app, which runs before the app starts.
 * @param {ViteDevServer} server Server.
 * @param {URL} url Request URL.
 * @returns {Promise<string>} HTML.
 */
const getFrameHTML = async (server, url) => {
  const locale = checkLocale(url.searchParams.get('locale'));
  // The target locale’s messages, inlined so the script can add and tag them the moment the app
  // has added its own, before the app formats anything with them. `<` is escaped so the JSON can’t
  // close the script element
  const messages = JSON.stringify(locale === SOURCE_LOCALE ? {} : await getLocaleMessages(locale));
  const appHTML = await readFile(path.join(server.config.root, 'index.html'), 'utf-8');

  if (!appHTML.includes('<script type="module"')) {
    throw new Error('The app page has no module script to run the review script before.');
  }

  /** @type {{ demo?: boolean, git?: string }} */
  let boot = {};

  try {
    boot = JSON.parse(url.searchParams.get('boot') ?? '{}');
  } catch {
    // Start options that can’t be read are left out
  }

  // A frame starting with a Git host gets a new repository, and the session to sign in to it
  const { session } = boot.git
    ? await createRepository(String(url.searchParams.get('frame')), boot.git)
    : {};

  // The scripts go right before the app’s, so they run first
  let html = appHTML.replace(
    '<script type="module"',
    [
      `<script>window.l10nReviewMessages = ${messages.replaceAll('<', '\\u003c')};</script>`,
      ...(session
        ? [`<script>window.l10nReviewSession = ${JSON.stringify(session)};</script>`]
        : []),
      `<script type="module" src="${FRAME_SCRIPT}"></script>`,
      '<script type="module"',
    ].join('\n    '),
  );

  if (boot.demo) {
    // A seed manifest makes the app run as a demo site. The page has seeded the repository already
    html = html.replace(
      '</head>',
      `  <link rel="cms-seed-url" href="${SITE_PATH}/seed/manifest.json" />\n  </head>`,
    );
  }

  html = await server.transformIndexHtml(url.pathname + url.search, html);

  // The demo’s JavaScript API examples: custom previews, editor components, a field type and a
  // custom page. A module script runs after the app’s, which defines `CMS`. It’s added after Vite
  // transforms the page, as Vite would try to transform it as one of the app’s modules
  return hasDemo()
    ? html.replace(
        '</body>',
        `  <script type="module" src="${SITE_PATH}/api.js"></script>\n  </body>`,
      )
    : html;
};

/**
 * Get the name of the configuration a frame asks for. The app requests it from a fixed URL, so the
 * name is read from the frame’s URL, which the request gives as the referrer: the app’s
 * `same-origin` referrer policy keeps the query.
 * @param {IncomingMessage} req Request.
 * @returns {string} Configuration name, defaulting to `sample`.
 */
const getConfigName = (req) => {
  try {
    return new URL(req.headers.referer ?? '').searchParams.get('config') || 'sample';
  } catch {
    return 'sample';
  }
};

/**
 * Handle a request to the API of the review tool.
 * @param {string} route Path after the API path, e.g. `data`.
 * @param {URL} url Request URL.
 * @param {IncomingMessage} req Request.
 * @param {ServerResponse} res Response.
 */
const handleAPI = async (route, url, req, res) => {
  if (route === 'data' && req.method === 'GET') {
    const requested = url.searchParams.get('locale') || getDefaultLocale();
    // Without a locale given, the first one the app has
    const locale = checkLocale(requested ?? getAppLocales().find((code) => code !== SOURCE_LOCALE));

    const locales = [...new Set([...getAppLocales(), locale])]
      .filter((code) => code !== SOURCE_LOCALE)
      .sort();

    const { SCENARIOS } = await loadScenarios();

    sendJSON(res, {
      sourceLocale: SOURCE_LOCALE,
      locale,
      locales,
      items: await getReviewItems(locale),
      scenarios: SCENARIOS,
      demo: { found: hasDemo(), dir: getDemoDir() },
      coverage: await readCoverage(),
    });

    return;
  }

  if (route === 'accept' && req.method === 'POST') {
    const { locale, keys } = await readJSON(req);

    sendJSON(res, { count: await acceptMessages(checkLocale(locale), keys ?? []) });

    return;
  }

  if (route === 'coverage' && req.method === 'POST') {
    const { scenario, keys, error } = await readJSON(req);
    const { SCENARIOS } = await loadScenarios();
    const ids = SCENARIOS.map(({ id }) => id);

    if (
      !ids.includes(scenario) ||
      !Array.isArray(keys) ||
      !keys.every((key) => typeof key === 'string') ||
      (error !== undefined && typeof error !== 'string')
    ) {
      throw new Error('A known scenario and the keys it showed are required.');
    }

    await recordCoverage(scenario, { keys, error }, ids);
    sendJSON(res, { ok: true });

    return;
  }

  if (route === 'save' && req.method === 'POST') {
    const { locale, key, raw } = await readJSON(req);

    if (typeof key !== 'string' || typeof raw !== 'string') {
      throw new Error('A key and a message are required.');
    }

    sendJSON(res, await saveMessage({ locale: checkLocale(locale), key, raw }));

    return;
  }

  sendJSON(res, { error: 'Not found' }, 404);
};

/**
 * Create the Vite plugin of the localization review tool. It only applies to the dev server, when
 * the `L10N_REVIEW` environment variable is set, and adds nothing to the builds.
 * @returns {Plugin} Plugin.
 */
export const l10nReview = () => ({
  name: 'l10n-review',
  /**
   * Apply the plugin to the dev server only, when the review tool is enabled.
   * @param {import('vite').UserConfig} _config Config.
   * @param {import('vite').ConfigEnv} env Environment.
   * @returns {boolean} Whether to apply it.
   */
  apply: (_config, { command }) => command === 'serve' && !!process.env.L10N_REVIEW,
  /**
   * Set the site URL of the app before Vite loads the environment variables.
   */
  config() {
    // Point the app at this plugin for its configuration. This applies to the whole dev server,
    // which `pnpm l10n` starts for the review tool only
    process.env.VITE_SITE_URL = SITE_PATH;
  },
  /**
   * Serve the review page, the app frames, the configurations and the API.
   * @param {ViteDevServer} server Server.
   */
  configureServer(server) {
    getSources().forEach(({ dir }) => server.watcher.add(dir));
    readAllLocaleFiles().catch((/** @type {any} */ ex) => {
      server.config.logger.warn(`[l10n-review] Couldn’t read the locale files: ${ex.message}`);
    });

    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const { pathname } = url;

      if (pathname !== BASE_PATH && !pathname.startsWith(`${BASE_PATH}/`)) {
        next();

        return;
      }

      try {
        if (pathname === BASE_PATH || pathname === `${BASE_PATH}/`) {
          send(res, 200, await server.transformIndexHtml(pathname, PAGE_HTML), 'text/html');
        } else if (pathname === `${BASE_PATH}/app/`) {
          send(res, 200, await getFrameHTML(server, url), 'text/html');
        } else if (pathname === `${SITE_PATH}/admin/config.yml`) {
          const { CONFIGS } = await loadScenarios();
          const name = getConfigName(req);
          const source = Object.hasOwn(CONFIGS, name) ? CONFIGS[name] : undefined;

          if (!source) {
            send(res, 404, 'Unknown configuration', 'text/plain');
          } else if (source.status) {
            send(res, source.status, 'Not found', 'text/plain');
          } else if (source.raw !== undefined) {
            send(res, 200, source.raw, 'text/yaml');
          } else {
            const config = source.build?.(await readBaseConfig(SITE_PATH));

            send(res, 200, stringifyYAML(config), 'text/yaml');
          }
        } else if (pathname === `${SITE_PATH}/seed/manifest.json`) {
          sendJSON(res, { files: await listSeedFiles() });
        } else if (pathname.startsWith(`${SITE_PATH}/`)) {
          // A file of the demo site: sample content, the API examples or the logo
          const filePath = resolveSiteFile(
            decodeURIComponent(pathname.slice(SITE_PATH.length + 1)),
          );

          if (filePath) {
            send(res, 200, await readFile(filePath), getContentType(filePath));
          } else {
            send(res, 404, 'Not found', 'text/plain');
          }
        } else if (pathname.startsWith(`${BASE_PATH}/git/`) && pathname.endsWith('/action')) {
          // A scenario step changing the frame’s repository
          const { name } = await readJSON(req);

          runGitAction(
            decodeURIComponent(pathname.slice(`${BASE_PATH}/git/`.length, -'/action'.length)),
            name,
          );
          sendJSON(res, { ok: true });
        } else if (pathname.startsWith(`${BASE_PATH}/git/`)) {
          // A request a frame sends to GitHub
          await handleGitRequest(
            decodeURIComponent(pathname.slice(`${BASE_PATH}/git/`.length)),
            url,
            req,
            res,
            (message) => server.config.logger.warn(message),
          );
        } else if (pathname.startsWith(`${BASE_PATH}/api/`)) {
          await handleAPI(pathname.slice(`${BASE_PATH}/api/`.length), url, req, res);
        } else {
          next();
        }
      } catch (/** @type {any} */ ex) {
        sendJSON(res, { error: ex.message }, 400);
      }
    });
  },
  /**
   * Send the messages of a changed locale file to the browser instead of reloading the app.
   * @param {import('vite').HmrContext} context Context.
   * @returns {Promise<[] | undefined>} No modules to update for a locale file, so Vite doesn’t
   * reload the app.
   */
  async handleHotUpdate({ file, server }) {
    const changed = await readChangedLocaleFile(file);

    if (!changed) {
      return undefined;
    }

    const { source, locale, messages, changedKeys, error } = changed;

    if (error) {
      server.config.logger.warn(`[l10n-review] ${locale}.yaml can’t be parsed: ${error}`);

      return [];
    }

    server.ws.send({
      type: 'custom',
      event: MESSAGES_EVENT,
      data: {
        locale,
        source: source.id,
        messages: source.prefix ? { [source.prefix.slice(0, -1)]: messages } : messages,
        changedKeys,
      },
    });

    // Don’t reload the app: the frames apply the new messages in place, keeping their state
    return [];
  },
});
