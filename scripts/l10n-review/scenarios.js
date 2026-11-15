/**
 * Options that need a fresh start of the app: the configuration it loads, whether it signs in and
 * the responses its requests get. Scenarios sharing the same options run one after another in the
 * same app, which is much faster than starting it again.
 * @typedef {object} ScenarioBoot
 * @property {string} [config] Name of a configuration in {@link CONFIGS}. Defaults to `sample`.
 * @property {boolean} [signIn] Whether to sign in with the test repository. Defaults to `true`.
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
 * change in the markup of the app doesn’t break the scenario.
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
 * Sample site configuration shared by the scenarios. It uses the test repository, which keeps its
 * files in the browser, so no Git host is needed.
 */
const SAMPLE_CONFIG = {
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
        { name: 'tags', label: 'Tags', widget: 'list' },
        { name: 'body', label: 'Body', widget: 'markdown' },
      ],
    },
    {
      name: 'notes',
      label: 'Notes',
      label_singular: 'Note',
      folder: 'content/notes',
      create: true,
      limit: 4,
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'body', label: 'Body', widget: 'text' },
      ],
    },
  ],
};

/**
 * Configurations the scenarios can start the app with, keyed with their name.
 * @type {Record<string, Record<string, any>>}
 */
export const CONFIGS = {
  sample: SAMPLE_CONFIG,
  'missing-collection-name': {
    ...SAMPLE_CONFIG,
    collections: [{ ...SAMPLE_CONFIG.collections[0], name: undefined }],
  },
};

/**
 * Files of the sample site, seeded into the test repository before the app starts.
 * @type {Record<string, string>}
 */
export const SAMPLE_FILES = {
  'content/posts/hello-world.md': [
    '---',
    'title: Hello World',
    'date: 2026-01-15T10:00:00Z',
    'draft: false',
    'tags: [news, intro]',
    '---',
    '',
    'Welcome to the **sample site**.',
    '',
  ].join('\n'),
  'content/posts/second-post.md': [
    '---',
    'title: Second Post',
    'date: 2026-02-01T09:30:00Z',
    'draft: true',
    '---',
    '',
    'Another entry.',
    '',
  ].join('\n'),
  'content/notes/one.md': '---\ntitle: One\n---\n',
  'content/notes/two.md': '---\ntitle: Two\n---\n',
  'content/notes/three.md': '---\ntitle: Three\n---\n',
};

/**
 * Screens and states to review.
 * @type {Scenario[]}
 */
export const SCENARIOS = [
  {
    id: 'entrance/sign-in',
    title: 'Sign-in page',
    boot: { signIn: false },
  },
  {
    id: 'config/missing-collection-name',
    title: 'Configuration error › collection without a name',
    boot: { config: 'missing-collection-name', signIn: false },
  },
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
    id: 'contents/quota',
    title: 'Content › Entry list › Collection nearing its limit',
    route: '#/collections/notes',
  },
  {
    id: 'contents/new-entry',
    title: 'Content Editor › New entry',
    route: '#/collections/posts/new',
  },
  {
    id: 'contents/editor-options',
    title: 'Content Editor › Editor options menu',
    route: '#/collections/posts/entries/hello-world',
    steps: [{ click: 'show_editor_options' }],
  },
  {
    id: 'global/account-menu',
    title: 'Account menu',
    route: '#/collections/posts',
    steps: [{ click: 'show_account_menu' }],
  },
];
