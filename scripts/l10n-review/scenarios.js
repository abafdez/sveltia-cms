/**
 * The screens and states of the app to review, and the configurations they start it with. The
 * sample site is the Sveltia CMS demo site (see `site.js`), so the routes below use its
 * collections, entries and files.
 */

import { CONFIG_ERROR_SCENARIOS } from './config-errors.js';

/**
 * Options that need a fresh start of the app: the configuration it loads, whether it signs in and
 * the responses its requests get. Scenarios sharing the same options run one after another in the
 * same app, which is much faster than starting it again.
 * @typedef {object} ScenarioBoot
 * @property {string} [config] Name of a configuration in {@link CONFIGS}. Defaults to `sample`.
 * @property {boolean} [signIn] Whether to sign in with the test repository. Defaults to `true`.
 * @property {boolean} [demo] Whether the app runs as a demo site, as it does with a seed manifest:
 * it then greets the user with a dialog. Defaults to `false`.
 * @property {boolean} [devMode] Whether developer mode is on, which adds the Help menu and other
 * items. Defaults to `false`.
 * @property {FetchMock[]} [mocks] Responses to requests the app makes, e.g. to a Git host.
 */

/**
 * A response returned instead of a request’s.
 * @typedef {object} FetchMock
 * @property {string} url Part of the URL of the requests to answer.
 * @property {string} [method] Method of the requests to answer. Defaults to any.
 * @property {number} [status] Response status. Defaults to 200.
 * @property {any} [json] Response body, sent as JSON.
 */

/**
 * A step in a scenario, run once the app is on the route. Elements are found by the key of a
 * message they show, in their text or an attribute such as `aria-label`, not by CSS selectors, so a
 * change in the markup of the app doesn’t break the scenario. A `wait` step also checks that the
 * screen shows what it’s meant to.
 * @typedef {{ click: string } | { wait: string } | { press: string }} ScenarioStep
 */

/**
 * A screen or state of the app to review.
 * @typedef {object} Scenario
 * @property {string} id Unique ID, e.g. `contents/entry-list`.
 * @property {string} title Where the screen is in the app, e.g. `Content › Entry list`.
 * @property {ScenarioBoot} [boot] Options needing a fresh start of the app.
 * @property {string} [route] Route to open, e.g. `#/collections/posts`.
 * @property {ScenarioStep[]} [steps] Steps to run after opening the route.
 */

/**
 * Where a configuration comes from: a function changing the sample site’s, or, to show the errors
 * of a file that can’t be read, the content or the HTTP status to serve instead.
 * @typedef {object} ConfigSource
 * @property {(base: Record<string, any>) => Record<string, any>} [build] Function returning the
 * configuration from the sample site’s, which it may change.
 * @property {string} [raw] Content to serve.
 * @property {number} [status] HTTP status to serve.
 */

/**
 * Set the maximum number of entries of a collection.
 * @param {Record<string, any>} config Configuration.
 * @param {string} name Collection name.
 * @param {number} limit Maximum number of entries.
 * @returns {Record<string, any>} Configuration.
 */
const withLimit = (config, name, limit) => ({
  ...config,
  collections: config.collections.map((/** @type {Record<string, any>} */ collection) =>
    collection.name === name ? { ...collection, limit } : collection,
  ),
});

/**
 * Configurations the scenarios can start the app with, keyed with their name.
 * @type {Record<string, ConfigSource>}
 */
export const CONFIGS = {
  // eslint-disable-next-line jsdoc/require-jsdoc
  sample: { build: (base) => base },
  // The demo has 6 posts
  // eslint-disable-next-line jsdoc/require-jsdoc
  'quota-nearing': { build: (base) => withLimit(base, 'posts', 7) },
  // eslint-disable-next-line jsdoc/require-jsdoc
  'quota-reached': { build: (base) => withLimit(base, 'posts', 6) },
  ...Object.fromEntries(
    CONFIG_ERROR_SCENARIOS.map(({ name, build, raw, status }) => [
      `error-${name}`,
      { build, raw, status },
    ]),
  ),
};

/**
 * Files of the demo’s Field Types collection, one per built-in field type.
 */
const FIELD_TYPES = [
  'boolean',
  'code',
  'color',
  'compute',
  'datetime',
  'file',
  'hidden',
  'image',
  'keyvalue',
  'list',
  'map',
  'number',
  'object',
  'relation',
  'richtext',
  'select',
  'string',
  'text',
  'uuid',
];

/**
 * Panels of the Settings dialog, by the key of their tab.
 */
const SETTINGS_PANELS = [
  'appearance',
  'language',
  'contents',
  'media',
  'ai',
  'accessibility',
  'data',
  'developer',
];

/**
 * Steps opening the Settings dialog.
 * @type {ScenarioStep[]}
 */
const OPEN_SETTINGS = [{ click: 'show_account_menu' }, { click: 'settings' }];

/**
 * Screens and states to review, in the order a translator goes through them. Scenarios with the
 * same start options are grouped by the review page, so the order here only matters within them.
 * @type {Scenario[]}
 */
export const SCENARIOS = [
  // Entrance
  {
    id: 'entrance/sign-in',
    title: 'Sign-in page',
    boot: { signIn: false },
  },
  {
    id: 'entrance/demo-sign-in',
    title: 'Demo site › Sign-in page',
    boot: { demo: true, signIn: false },
  },
  {
    id: 'entrance/demo-welcome',
    title: 'Demo site › Welcome dialog',
    boot: { demo: true },
    route: '#/collections/posts',
  },

  // Entry list
  {
    id: 'contents/entry-list',
    title: 'Content › Entry list',
    route: '#/collections/posts',
  },
  {
    id: 'contents/sorting-menu',
    title: 'Content › Entry list › Sorting menu',
    route: '#/collections/posts',
    steps: [{ click: 'sort' }],
  },
  {
    id: 'contents/filtering-menu',
    title: 'Content › Entry list › Filtering menu',
    route: '#/collections/posts',
    steps: [{ click: 'filter' }],
  },
  {
    id: 'contents/grouping-menu',
    title: 'Content › Entry list › Grouping menu',
    route: '#/collections/posts',
    steps: [{ click: 'group' }],
  },
  {
    id: 'contents/table-view',
    title: 'Content › Entry list › Table view',
    route: '#/collections/posts',
    steps: [{ click: 'table_view' }],
  },
  {
    id: 'contents/grid-view',
    title: 'Content › Entry list › Grid view',
    route: '#/collections/authors',
    steps: [{ click: 'grid_view' }],
  },
  {
    id: 'contents/selection',
    title: 'Content › Entry list › Entries selected',
    // Another collection than the next scenario’s: Select All toggles, and the selection is only
    // cleared when the listed entries change, so it would deselect them there
    route: '#/collections/posts',
    steps: [{ click: 'select_all' }],
  },
  {
    id: 'contents/delete-dialog',
    title: 'Content › Entry list › Delete confirmation',
    route: '#/collections/authors',
    steps: [{ click: 'select_all' }, { click: 'delete' }],
  },
  {
    id: 'contents/tree',
    title: 'Content › Nested collection',
    route: '#/collections/pages',
  },
  {
    id: 'contents/quota-nearing',
    title: 'Content › Entry list › Collection nearing its limit',
    boot: { config: 'quota-nearing' },
    route: '#/collections/posts',
    steps: [{ wait: 'creating_entries_nearing_quota' }],
  },
  {
    id: 'contents/quota-reached',
    title: 'Content › Entry list › Collection at its limit',
    boot: { config: 'quota-reached' },
    route: '#/collections/posts',
    steps: [{ wait: 'creating_entries_disabled_by_quota' }],
  },

  // Content editor
  {
    id: 'contents/new-entry',
    title: 'Content Editor › New entry',
    route: '#/collections/posts/new',
  },
  {
    id: 'contents/validation-errors',
    title: 'Content Editor › New entry › Validation errors',
    route: '#/collections/posts/new',
    steps: [{ click: 'save' }],
  },
  {
    id: 'contents/multilingual-entry',
    title: 'Content Editor › Multilingual entry',
    route: '#/collections/posts/entries/welcome-to-the-demo',
  },
  {
    id: 'contents/editor-options',
    title: 'Content Editor › Editor options menu',
    route: '#/collections/posts/entries/welcome-to-the-demo',
    steps: [{ click: 'show_editor_options' }],
  },
  {
    id: 'contents/content-options',
    title: 'Content Editor › Content options menu',
    route: '#/collections/posts/entries/welcome-to-the-demo',
    steps: [{ click: 'show_content_options_x_locale' }],
  },
  ...FIELD_TYPES.map((name) => ({
    id: `fields/${name}`,
    title: `Content Editor › Field types › ${name}`,
    route: `#/collections/examples/entries/${name}`,
  })),
  {
    id: 'contents/singleton-yaml',
    title: 'Content Editor › Singleton (YAML)',
    route: '#/collections/_singletons/entries/site',
  },
  {
    id: 'contents/singleton-json',
    title: 'Content Editor › Singleton (JSON)',
    route: '#/collections/_singletons/entries/navigation',
  },
  {
    id: 'contents/singleton-toml',
    title: 'Content Editor › Singleton (TOML)',
    route: '#/collections/_singletons/entries/theme',
  },

  // Assets
  {
    id: 'assets/images',
    title: 'Assets › Images',
    route: '#/assets/static/images',
  },
  {
    id: 'assets/files',
    title: 'Assets › Files',
    route: '#/assets/static/files',
  },
  {
    id: 'assets/list-view',
    title: 'Assets › List view, with each file’s type',
    route: '#/assets/static/files',
    steps: [{ click: 'list_view' }],
  },
  {
    id: 'assets/details',
    title: 'Assets › Asset details',
    route: '#/assets/static/images/bruges.webp',
  },

  // Global
  {
    id: 'global/account-menu',
    title: 'Account menu',
    route: '#/collections/posts',
    steps: [{ click: 'show_account_menu' }],
  },
  {
    id: 'global/help-menu',
    title: 'Help menu (developer mode)',
    boot: { devMode: true },
    route: '#/collections/posts',
    steps: [{ click: 'show_help_menu' }],
  },
  {
    id: 'global/keyboard-shortcuts',
    title: 'Keyboard shortcuts dialog',
    route: '#/collections/posts',
    steps: [{ click: 'show_account_menu' }, { click: 'keyboard_shortcuts' }],
  },
  ...SETTINGS_PANELS.map((key) => ({
    id: `settings/${key}`,
    title: `Settings › ${key}`,
    route: '#/collections/posts',
    steps: [...OPEN_SETTINGS, { click: `prefs.${key}.title` }],
  })),

  // Configuration errors
  ...CONFIG_ERROR_SCENARIOS.map(({ name, label }) => ({
    id: `config/${name}`,
    title: `Configuration errors › ${label}`,
    boot: { config: `error-${name}`, signIn: false },
  })),
];
