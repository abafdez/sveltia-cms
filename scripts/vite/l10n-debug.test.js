import { readdirSync } from 'fs';
import path from 'path';

import { MessageFormat } from 'messageformat';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { parse as parseYAML } from 'yaml';

import { importL10nDebugUtils, l10nDebug } from './l10n-debug.js';
import { APP_LOCALES_DIR, parseYAMLFile } from './locales.js';
import { resolveModuleDir } from './utils.js';

/**
 * @import { Plugin } from 'vite';
 */

/**
 * @typedef {object} MockResponse
 * @property {(name: string, value: string) => void} setHeader Set a header.
 * @property {(body: any) => void} end Send the body.
 */

/**
 * @typedef {{ url?: string, headers?: Record<string, string> }} MockRequest
 */

/**
 * @typedef {(req: MockRequest, res: MockResponse, next: () => void) => void} Middleware
 */

/**
 * The localization debugging utilities, or `undefined` if the installed `@sveltia/utils` doesn’t
 * have them yet and `SVELTIA_UTILS_DIR` doesn’t point to a local clone that does.
 */
const utils = await importL10nDebugUtils().catch(() => undefined);
const UI_LOCALES_DIR = path.resolve(resolveModuleDir('@sveltia/ui'), 'locales');

/**
 * List the locale files in the given directory.
 * @param {string} dir Directory.
 * @returns {string[]} Absolute file paths.
 */
const listLocaleFiles = (dir) =>
  readdirSync(dir)
    .filter((name) => name.endsWith('.yaml'))
    .map((name) => path.resolve(dir, name));

/**
 * Flatten a parsed locale file into dot-separated message paths. Values that are neither strings
 * nor objects, like an empty value parsed as `null`, are skipped, as they aren’t messages.
 * @param {Record<string, any>} messages Parsed file.
 * @param {string} [prefix] Path of the object.
 * @returns {[string, string][]} Pairs of a path and a message.
 */
const flatten = (messages, prefix = '') =>
  Object.entries(messages).flatMap(([key, value]) => {
    if (typeof value === 'string') {
      return [/** @type {[string, string]} */ ([prefix + key, value])];
    }

    return value && typeof value === 'object' ? flatten(value, `${prefix}${key}.`) : [];
  });

/**
 * Format a message with every variable it uses set to the given number.
 * @param {string} locale Locale code.
 * @param {string} message Message.
 * @param {number} value Value of the variables.
 * @returns {string} Formatted string.
 */
const format = (locale, message, value) => {
  const names = [...message.matchAll(/\$(\w+)/g)].map(([, name]) => name);

  return new MessageFormat(locale, message).format(
    Object.fromEntries(names.map((name) => [name, value])),
    () => {},
  );
};

/**
 * Call a plugin hook, whichever form it’s defined in.
 * @param {any} hook Hook: a function or an object with a `handler`.
 * @param {...any} args Arguments.
 * @returns {any} Result.
 */
const call = (hook, ...args) => (typeof hook === 'function' ? hook : hook.handler)(...args);

/**
 * Environment variables the plugin reads, saved to be restored after each test.
 */
const savedEnv = {
  L10N_DEBUG: process.env.L10N_DEBUG,
  L10N_DEBUG_CONTENT: process.env.L10N_DEBUG_CONTENT,
};

beforeEach(() => {
  process.env.L10N_DEBUG = '1';
  delete process.env.L10N_DEBUG_CONTENT;
});

afterEach(() => {
  Object.entries(savedEnv).forEach(([name, value]) => {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  });
});

describe('Test l10nDebug()', () => {
  test('does nothing unless `L10N_DEBUG` is set', async () => {
    delete process.env.L10N_DEBUG;
    await expect(l10nDebug()).resolves.toBeNull();
  });

  test('rejects a value of `L10N_DEBUG` that isn’t a locale of the CMS', async () => {
    process.env.L10N_DEBUG = 'es-XX';
    await expect(l10nDebug()).rejects.toThrow(/L10N_DEBUG=es-XX isn’t a locale of the CMS.+en-US/);
  });

  describe.skipIf(!utils)('with the utilities', () => {
    /** @type {Plugin} */
    let plugin;

    beforeEach(async () => {
      plugin = /** @type {Plugin} */ (await l10nDebug());
    });

    test('points the CMS to the sample configuration', () => {
      const { apply } = /** @type {{ apply: (config: object, env: object) => boolean }} */ (
        /** @type {unknown} */ (plugin)
      );

      expect(apply({}, { command: 'serve', mode: 'development' })).toBe(true);
      expect(apply({}, { command: 'serve', mode: 'test' })).toBe(false);
      expect(apply({}, { command: 'build', mode: 'production' })).toBe(false);
      expect(plugin.enforce).toBe('pre');
      expect(call(plugin.config).define).toEqual({ 'import.meta.env.VITE_SITE_URL': '"."' });
    });

    test('leaves the configuration alone with `L10N_DEBUG_CONTENT=0`', async () => {
      process.env.L10N_DEBUG_CONTENT = '0';
      plugin = /** @type {Plugin} */ (await l10nDebug());

      const use = vi.fn();

      expect(call(plugin.config).define).toBeUndefined();
      call(plugin.configureServer, { middlewares: { use } });
      expect(use).not.toHaveBeenCalled();
      expect(call(plugin.transformIndexHtml)).toHaveLength(1);
    });

    test('provides the overlay with the registry and the checklist', async () => {
      const id = call(plugin.resolveId, 'virtual:l10n-debug');
      const code = await call(plugin.load, id);

      expect(id).toBe('\0virtual:l10n-debug');
      expect(call(plugin.resolveId, 'other')).toBeNull();
      expect(code).toContain("import { startL10nDebugOverlay } from '@sveltia/utils/l10n-debug';");
      expect(code).toContain('"name":"Sveltia CMS"');
      expect(code).toContain('"name":"Sveltia UI"');
      expect(code).toContain('"label":"Settings Dialog"');
      expect(code).toContain('startL10nDebugOverlay({ registry, checklist });');
    });

    test('leaves other files to the other plugins', async () => {
      expect(await call(plugin.load, path.resolve('package.json'))).toBeNull();
      expect(await call(plugin.load, path.resolve('missing.yaml'))).toBeNull();
      expect(await call(plugin.load, path.resolve('.github/dependabot.yaml'))).toBeNull();
      expect(
        await call(plugin.load, `${path.resolve(APP_LOCALES_DIR, 'en-US.yaml')}?raw`),
      ).toBeNull();
    });

    test('serves the sample site', () => {
      /** @type {Middleware | undefined} */
      let middleware;

      /**
       * Register the middleware.
       * @param {Middleware} fn Middleware.
       */
      const use = (fn) => {
        middleware = fn;
      };

      call(plugin.configureServer, { middlewares: { use } });

      /**
       * Request a path from the middleware.
       * @param {string} url Path.
       * @returns {{ body?: any, type?: string, next: boolean }} Response.
       */
      const request = (url) => {
        /** @type {Record<string, string>} */
        const headers = {};
        /** @type {{ body?: any, type?: string, next: boolean }} */
        const result = { next: false };

        /**
         * Set a response header.
         * @param {string} name Header name.
         * @param {string} value Header value.
         */
        const setHeader = (name, value) => {
          headers[name] = value;
        };

        /**
         * Send the response body.
         * @param {any} body Body.
         */
        const end = (body) => {
          result.body = body;
          result.type = headers['Content-Type'];
        };

        /**
         * Pass the request on to the next middleware.
         */
        const next = () => {
          result.next = true;
        };

        /** @type {Middleware} */ (middleware)(
          { url, headers: { host: 'localhost:5173' } },
          { setHeader, end },
          next,
        );

        return result;
      };

      const config = request('/admin/config.yml');
      const manifest = request('/l10n-debug/seed/manifest.json');

      expect(config.type).toBe('application/yaml');
      expect(parseYAML(config.body).backend.name).toBe('test-repo');
      expect(parseYAML(config.body).site_url).toBe('http://localhost:5173');
      expect(JSON.parse(manifest.body).files).toContain('content/posts/2026-01-first-light.md');
      expect(request('/l10n-debug/seed/content/posts/2026-01-first-light.md').body).toContain(
        'title: First Light',
      );
      expect(request('/l10n-debug/seed/static/uploads/sunset.png').body).toBeInstanceOf(Uint8Array);
      expect(request('/l10n-debug/seed/missing.md').next).toBe(true);
      expect(request('/index.html').next).toBe(true);
      expect(request('/%E0%A4%A').next).toBe(true);
      expect(request(/** @type {any} */ (undefined)).next).toBe(true);
    });

    test('adds the seed link and the overlay to the page', () => {
      expect(call(plugin.transformIndexHtml)).toEqual([
        expect.objectContaining({
          tag: 'link',
          attrs: { rel: 'cms-seed-url', href: '/l10n-debug/seed/manifest.json' },
        }),
        expect.objectContaining({
          tag: 'script',
          attrs: { type: 'module', src: '/@id/__x00__virtual:l10n-debug' },
        }),
      ]);
    });

    test('opens the CMS in the locale `L10N_DEBUG` is set to', async () => {
      process.env.L10N_DEBUG = 'TRUE';
      plugin = /** @type {Plugin} */ (await l10nDebug());
      expect(call(plugin.transformIndexHtml)).toHaveLength(2);

      process.env.L10N_DEBUG = 'en-US';
      plugin = /** @type {Plugin} */ (await l10nDebug());

      const [tag, ...rest] = call(plugin.transformIndexHtml);
      /** @type {Map<string, string>} */
      const storage = new Map([['sveltia-cms.prefs', '{"theme":"dark","locale":"ja"}']]);

      const localStorage = {
        /**
         * Get a stored value.
         * @param {string} key Key.
         * @returns {string | null} Value.
         */
        getItem: (key) => storage.get(key) ?? null,
        /**
         * Store a value.
         * @param {string} key Key.
         * @param {string} value Value.
         */
        setItem: (key, value) => {
          storage.set(key, value);
        },
      };

      expect(tag).toEqual(expect.objectContaining({ tag: 'script', injectTo: 'head-prepend' }));
      expect(rest).toHaveLength(2);

      // eslint-disable-next-line no-new-func
      const run = new Function('localStorage', tag.children);

      run(localStorage);
      expect(JSON.parse(/** @type {string} */ (storage.get('sveltia-cms.prefs')))).toEqual({
        theme: 'dark',
        locale: 'en-US',
      });

      storage.clear();
      run(localStorage);
      expect(storage.get('sveltia-cms.prefs')).toBe('{"locale":"en-US"}');

      // An unavailable local storage is ignored
      expect(() => run(undefined)).not.toThrow();
    });

    test('rebuilds the registry when a locale file changes', async () => {
      const module = {};
      const invalidateModule = vi.fn();

      const server = {
        moduleGraph: {
          getModuleById: vi.fn(() => module),
          invalidateModule,
        },
      };

      await call(plugin.handleHotUpdate, { file: path.resolve('package.json'), server });
      expect(invalidateModule).not.toHaveBeenCalled();

      await call(plugin.handleHotUpdate, {
        file: path.resolve(APP_LOCALES_DIR, 'en-US.yaml'),
        server,
      });
      expect(invalidateModule).toHaveBeenCalledWith(module);

      server.moduleGraph.getModuleById.mockReturnValue(/** @type {any} */ (undefined));
      invalidateModule.mockClear();
      await call(plugin.handleHotUpdate, {
        file: path.resolve(APP_LOCALES_DIR, 'en-US.yaml'),
        server,
      });
      expect(invalidateModule).not.toHaveBeenCalled();
    });

    // Every message of every locale of both packages must stay valid and format to the same
    // string once the markers are removed, or the overlay would break the app it’s debugging
    describe.each([
      ['Sveltia CMS', path.resolve(APP_LOCALES_DIR)],
      ['Sveltia UI', UI_LOCALES_DIR],
    ])('marks the %s strings without changing them', (source, dir) => {
      test.each(listLocaleFiles(dir).map((file) => [path.basename(file), file]))(
        '%s',
        async (_name, file) => {
          const { decodeMarkers, stripMarkers } = /** @type {NonNullable<typeof utils>} */ (utils);
          const locale = path.basename(file, '.yaml');
          const code = await call(plugin.load, file);
          const marked = new Map(flatten(JSON.parse(code.replace(/^export default |;$/g, ''))));
          const original = flatten(await parseYAMLFile(file));

          const registry = JSON.parse(
            (await call(plugin.load, '\0virtual:l10n-debug')).match(/const registry = (.+);/)[1],
          );

          expect(marked.size).toBe(original.length);

          original.forEach(([key, message]) => {
            const markedMessage = /** @type {string} */ (marked.get(key));

            [1, 2].forEach((value) => {
              const result = format(locale, markedMessage, value);

              expect(stripMarkers(result), `${source} ${locale} ${key}`).toBe(
                format(locale, message, value),
              );
              expect(decodeMarkers(result, registry)[0], `${source} ${locale} ${key}`).toEqual(
                expect.objectContaining({
                  key,
                  locale,
                  source: expect.objectContaining({ name: source }),
                }),
              );
            });
          });
        },
      );
    });
  });
});
