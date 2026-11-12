import { existsSync, readdirSync, realpathSync } from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

import { searchForWorkspaceRoot } from 'vite';
import { stringify as stringifyYAML } from 'yaml';

import { getCmsChecklist } from './l10n-debug-checklist.js';
import { getSampleSite } from './l10n-debug-content.js';
import { APP_LOCALES_DIR, parseYAMLFile } from './locales.js';
import { resolveModuleDir } from './utils.js';

/**
 * @import { Plugin } from 'vite';
 */

/**
 * ID of the virtual module that starts the overlay in the browser.
 */
const VIRTUAL_MODULE_ID = 'virtual:l10n-debug';
/**
 * Module specifier of the localization debugging utilities.
 */
const UTILS_SPECIFIER = '@sveltia/utils/l10n-debug';
/**
 * Path the seed manifest and files of the sample site are served under, which fill the empty test
 * repository with its content. Its configuration file is served at `/admin/config.yml`.
 */
const SAMPLE_SITE_PATH = '/l10n-debug';

/**
 * Get the path of the localization debugging utilities in a local clone of `sveltia-utils`, if the
 * `SVELTIA_UTILS_DIR` environment variable points to one. This lets the utilities be developed
 * alongside the CMS before they’re released.
 * @returns {string | undefined} Absolute path of the entry file.
 */
const getLocalUtilsPath = () => {
  const dir = process.env.SVELTIA_UTILS_DIR;

  return dir ? path.resolve(dir, 'src/lib/l10n-debug/index.js') : undefined;
};

/**
 * Import the localization debugging utilities, from a local clone of `sveltia-utils` if
 * `SVELTIA_UTILS_DIR` points to one, or from the installed package otherwise.
 * @returns {Promise<typeof import('@sveltia/utils/l10n-debug')>} Module.
 * @throws {Error} When the utilities can’t be found, such as with a version of the package that
 * doesn’t have them yet.
 */
export const importL10nDebugUtils = async () => {
  const localUtilsPath = getLocalUtilsPath();

  try {
    return await import(localUtilsPath ? pathToFileURL(localUtilsPath).href : UTILS_SPECIFIER);
  } catch (ex) {
    throw new Error(
      `Couldn’t load ${UTILS_SPECIFIER}. Update @sveltia/utils, or set SVELTIA_UTILS_DIR to the ` +
        'path of a local clone of sveltia-utils.',
      { cause: ex },
    );
  }
};

/**
 * Get the packages whose locale files are marked: Sveltia CMS and Sveltia UI.
 * @returns {{ name: string, repository: string, path: string, color: string, dir: string }[]}
 * Packages, with the absolute path of the directory holding their locale files.
 */
const getSources = () => [
  {
    name: 'Sveltia CMS',
    repository: 'sveltia/sveltia-cms',
    path: 'src/lib/locales/{locale}.yaml',
    color: '#ff8c00',
    dir: realpathSync(path.resolve(APP_LOCALES_DIR)),
  },
  {
    name: 'Sveltia UI',
    repository: 'sveltia/sveltia-ui',
    path: 'src/lib/locales/{locale}.yaml',
    color: '#ff3ea5',
    dir: realpathSync(path.resolve(resolveModuleDir('@sveltia/ui'), 'locales')),
  },
];

/**
 * Read all the locale files in the given directory.
 * @param {string} dir Absolute directory path.
 * @returns {Promise<Record<string, Record<string, any>>>} Parsed files, keyed with the locale code.
 */
const readLocaleFiles = async (dir) =>
  Object.fromEntries(
    await Promise.all(
      readdirSync(dir)
        .filter((name) => name.endsWith('.yaml'))
        .map(async (name) => [
          path.basename(name, '.yaml'),
          await parseYAMLFile(path.join(dir, name)),
        ]),
    ),
  );

/**
 * Outline the localized strings in the development server when the `L10N_DEBUG` environment
 * variable is set, e.g. `L10N_DEBUG=1 pnpm dev`: orange for the Sveltia CMS strings, pink for the
 * Sveltia UI strings and red for the untranslated ones, which fall back to English. Hovering over
 * a string shows its key and the locale file it lives in, and a checklist tracks which parts of the
 * app have been checked. The locale files are marked as they’re loaded, so none of them is changed.
 * The CMS also gets a sample site to work with, built from the end-to-end test fixtures and seeded
 * into the test repository, unless `L10N_DEBUG_CONTENT=0` is set to use the usual configuration.
 * Must come before the `yamlToJS` plugin, which would load the files otherwise.
 * @returns {Promise<Plugin | null>} Vite plugin, or `null` if the variable isn’t set.
 */
export const l10nDebug = async () => {
  if (!process.env.L10N_DEBUG) {
    return null;
  }

  const localUtilsPath = getLocalUtilsPath();

  const { createL10nDebugRegistry, createChecklistByTopLevelKey, markMessages } =
    await importL10nDebugUtils();

  const sources = getSources();
  const sampleSite = process.env.L10N_DEBUG_CONTENT === '0' ? undefined : getSampleSite();
  const resolvedVirtualModuleId = `\0${VIRTUAL_MODULE_ID}`;
  /** @type {Record<string, any>} */
  let registry;

  /**
   * Build the registry from the current locale files.
   */
  const buildRegistry = async () => {
    registry = createL10nDebugRegistry({
      sources: await Promise.all(
        sources.map(async ({ dir, ...rest }) => ({
          ...rest,
          messages: await readLocaleFiles(dir),
        })),
      ),
    });
  };

  /**
   * Find the package the given file belongs to, if it’s a locale file.
   * @param {string} filePath Absolute file path.
   * @returns {{ name: string, locale: string } | undefined} Package name and locale code.
   */
  const findLocaleFile = (filePath) => {
    if (!filePath.endsWith('.yaml') || !existsSync(filePath)) {
      return undefined;
    }

    const realPath = realpathSync(filePath);
    const source = sources.find(({ dir }) => path.dirname(realPath) === dir);

    return source ? { name: source.name, locale: path.basename(realPath, '.yaml') } : undefined;
  };

  await buildRegistry();

  return {
    name: 'l10n-debug',
    // Only the development server, not a build or Vitest, whose tests would see the markers if
    // `L10N_DEBUG` happened to be set in the shell
    // eslint-disable-next-line jsdoc/require-jsdoc
    apply: (_config, { command, mode }) => command === 'serve' && mode !== 'test',
    enforce: 'pre',
    // eslint-disable-next-line jsdoc/require-jsdoc
    config: () => ({
      ...(sampleSite
        ? {
            // In development, the CMS loads `${VITE_SITE_URL}/admin/config.yml`, see
            // `src/lib/services/config/constants.js`. A relative URL makes it load the sample
            // configuration this server provides
            define: { 'import.meta.env.VITE_SITE_URL': JSON.stringify('.') },
          }
        : {}),
      ...(localUtilsPath
        ? {
            resolve: { alias: [{ find: UTILS_SPECIFIER, replacement: localUtilsPath }] },
            server: {
              fs: {
                allow: [searchForWorkspaceRoot(process.cwd()), path.dirname(localUtilsPath)],
              },
            },
          }
        : {}),
    }),
    // eslint-disable-next-line jsdoc/require-jsdoc
    resolveId: (source) => (source === VIRTUAL_MODULE_ID ? resolvedVirtualModuleId : null),
    // eslint-disable-next-line jsdoc/require-jsdoc
    async load(id) {
      if (id === resolvedVirtualModuleId) {
        const [cms, ui] = registry.sources;

        const checklist = [
          ...getCmsChecklist(cms.keys, cms.name),
          ...createChecklistByTopLevelKey(registry, ui.name),
        ];

        return [
          `import { startL10nDebugOverlay } from '${UTILS_SPECIFIER}';`,
          `const registry = ${JSON.stringify(registry)};`,
          `const checklist = ${JSON.stringify(checklist)};`,
          'startL10nDebugOverlay({ registry, checklist });',
        ].join('\n');
      }

      const [filePath, query] = id.split('?');
      const localeFile = !query ? findLocaleFile(filePath) : undefined;

      if (!localeFile) {
        return null;
      }

      const messages = markMessages(await parseYAMLFile(filePath), {
        registry,
        source: localeFile.name,
        locale: localeFile.locale,
      });

      return `export default ${JSON.stringify(messages)};`;
    },
    // eslint-disable-next-line jsdoc/require-jsdoc
    async handleHotUpdate({ file, server }) {
      if (findLocaleFile(file)) {
        // A key may have been added, so the registry has to know it before the file is marked
        await buildRegistry();

        const module = server.moduleGraph.getModuleById(resolvedVirtualModuleId);

        if (module) {
          server.moduleGraph.invalidateModule(module);
        }
      }
    },
    // eslint-disable-next-line jsdoc/require-jsdoc
    configureServer(server) {
      if (!sampleSite) {
        return;
      }

      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        /** @type {string} */
        let filePath;

        try {
          filePath = decodeURIComponent(url.pathname);
        } catch {
          next();

          return;
        }

        const seedPath = `${SAMPLE_SITE_PATH}/seed/`;

        /**
         * Send the given content.
         * @param {string | Uint8Array} body Content.
         * @param {string} type MIME type.
         */
        const send = (body, type) => {
          res.setHeader('Content-Type', type);
          res.setHeader('Cache-Control', 'no-store');
          res.end(body);
        };

        if (filePath === '/admin/config.yml') {
          // The site URL defaults to `VITE_SITE_URL` in development, which is a relative path here
          // and can’t be used to build links, so point it to this server
          send(
            stringifyYAML({ ...sampleSite.config, site_url: `http://${req.headers?.host}` }),
            'application/yaml',
          );
        } else if (filePath === `${seedPath}manifest.json`) {
          send(JSON.stringify({ files: Object.keys(sampleSite.files) }), 'application/json');
        } else if (
          filePath.startsWith(seedPath) &&
          filePath.slice(seedPath.length) in sampleSite.files
        ) {
          send(sampleSite.files[filePath.slice(seedPath.length)], 'application/octet-stream');
        } else {
          next();
        }
      });
    },
    // eslint-disable-next-line jsdoc/require-jsdoc
    transformIndexHtml: () => [
      ...(sampleSite
        ? [
            {
              tag: 'link',
              attrs: { rel: 'cms-seed-url', href: `${SAMPLE_SITE_PATH}/seed/manifest.json` },
              injectTo: /** @type {const} */ ('head'),
            },
          ]
        : []),
      {
        tag: 'script',
        // Vite serves a virtual module at this URL, with the `\0` prefix of its resolved ID encoded
        attrs: { type: 'module', src: `/@id/__x00__${VIRTUAL_MODULE_ID}` },
        injectTo: 'body',
      },
    ],
  };
};
