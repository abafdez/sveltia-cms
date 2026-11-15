/**
 * The sample site the review tool shows: the Sveltia CMS demo site, from a checkout of
 * `sveltia/sveltia-cms-demo`. Its configuration, its sample content in `seed/` and its JavaScript
 * API examples in `api.js` cover far more of the app than a made-up site could, and extending the
 * demo is the way to bring more strings on screen. Without a checkout, a small configuration with
 * no content stands in, so the tests and a few screens still work.
 */

import { existsSync, statSync } from 'fs';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { parse } from 'yaml';

/**
 * Configuration used when the demo site isn’t found.
 */
export const FALLBACK_CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/images',
  public_folder: '/images',
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      label_singular: 'Post',
      folder: 'content/posts',
      create: true,
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'date', label: 'Date', widget: 'datetime' },
        { name: 'draft', label: 'Draft', widget: 'boolean', default: false },
        { name: 'body', label: 'Body', widget: 'richtext' },
      ],
    },
  ],
};

/**
 * Files of the demo site the review page can load, besides the sample content in `seed/`.
 */
const SITE_FILES = ['api.js', 'logo.svg'];

/**
 * Get the directory of the demo site checkout: `SVELTIA_DEMO_DIR`, or `sveltia-cms-demo` next to
 * this repository.
 * @returns {string} Absolute path.
 */
export const getDemoDir = () =>
  path.resolve(
    process.env.SVELTIA_DEMO_DIR ??
      fileURLToPath(new URL('../../../sveltia-cms-demo', import.meta.url)),
  );

/**
 * Check whether the demo site checkout is there.
 * @returns {boolean} Result.
 */
export const hasDemo = () => existsSync(path.join(getDemoDir(), 'config.yml'));

/**
 * Read the configuration of the sample site: the demo’s, or the fallback one.
 * @param {string} sitePath Path the site files are served at, for the paths starting with `/` in
 * the configuration, like the logo.
 * @returns {Promise<Record<string, any>>} Configuration, a fresh copy each time.
 */
export const readBaseConfig = async (sitePath) => {
  if (!hasDemo()) {
    return structuredClone(FALLBACK_CONFIG);
  }

  const config = parse(await readFile(path.join(getDemoDir(), 'config.yml'), 'utf-8'));

  if (typeof config.logo?.src === 'string' && config.logo.src.startsWith('/')) {
    config.logo.src = `${sitePath}${config.logo.src}`;
  }

  return config;
};

/**
 * List the sample content of the demo site, as the demo’s own manifest does: the paths of the
 * files in `seed/`, except dotfiles.
 * @returns {Promise<string[]>} Paths relative to `seed/`.
 */
export const listSeedFiles = async () => {
  if (!hasDemo()) {
    return [];
  }

  const seedDir = path.join(getDemoDir(), 'seed');

  return (await readdir(seedDir, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
    .map((entry) => path.relative(seedDir, path.join(entry.parentPath, entry.name)))
    .map((filePath) => filePath.split(path.sep).join('/'))
    .filter((filePath) => filePath !== 'manifest.json')
    .sort();
};

/**
 * Find a file of the demo site to serve: a file in `seed/`, or one of {@link SITE_FILES}.
 * @param {string} relativePath Path relative to the demo site, from the request URL.
 * @returns {string | undefined} Absolute path, or `undefined` if the file can’t be served.
 */
export const resolveSiteFile = (relativePath) => {
  const dir = getDemoDir();
  const seedDir = path.join(dir, 'seed');
  const filePath = path.resolve(dir, relativePath);

  const allowed =
    SITE_FILES.some((name) => filePath === path.join(dir, name)) ||
    filePath.startsWith(`${seedDir}${path.sep}`);

  return allowed && existsSync(filePath) && statSync(filePath).isFile() ? filePath : undefined;
};
