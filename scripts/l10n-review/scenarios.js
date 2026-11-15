/**
 * The screens and states of the app to review, and the configurations they start it with. The
 * sample site is the Sveltia CMS demo site (see `site.js`), so the routes below use its
 * collections, entries and files.
 */

// cspell:ignore AKIAEXAMPLEKEY samplepublickey sato

import { CONFIG_ERROR_SCENARIOS } from './config-errors.js';
import { GITHUB_BACKEND, WORKFLOW_POSTS } from './git.js';

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
 * @property {string} [git] Name of a state of the GitHub repository in `GIT_SETUPS` of `git.js`,
 * for a configuration with the GitHub backend. The app is signed in to it unless the state leaves
 * the user signed out, so `signIn: false` only means not to wait for the main screen, e.g. to show
 * an error on the sign-in page.
 * @property {FetchMock[]} [mocks] Responses to requests the app makes, e.g. to a Git host.
 * @property {string[]} [env] Browser conditions to fake, by name: `unsupported-browser`,
 * `no-local-backend`, `brave`, `test-repo-unsupported`, `insecure`, `clipboard-denied`,
 * `clipboard-text`, `geolocation-denied`, `no-geolocation`, `touch`, `browser-language` and
 * `installable`. See `ENV_CONDITIONS` in `client/frame.js`.
 * @property {string[]} [services] Online services to fake, with the API keys the app needs:
 * `google-translate`, `google-translate-error` and `unsplash`. See `SERVICE_FAKES` in
 * `client/frame.js`.
 * @property {string} [instance] Name of an app start of its own: scenarios with the same options
 * but another name don’t share the app. For a state a scenario can’t undo, such as a dialog the
 * app shows once as it starts.
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
 * What a step acts on: an element showing a message, by the message key, in its text or an
 * attribute such as `aria-label`; or a field of the entry editor, by its key path, e.g. `{ field:
 * 'title' }`, as field labels come from the configuration, optionally with the key of a message in
 * it, `{ field: 'blocks', key: 'add_x' }`. Not CSS selectors, so a change in the
 * markup of the app doesn’t break the scenario. Or an element by its text, `{ text: 'Amazon S3' }`,
 * for a name that isn’t a message, like a service name. Or the item at an index among the buttons,
 * radios and options in an element showing a message, `{ in: 'switch_locale', index: 1 }`, for
 * items named in the frame’s language, like languages.
 * @typedef {string | { field: string, key?: string } | { text: string } | { in: string, index:
 * number }} StepTarget
 */

/**
 * A file a step drops or uploads, made up on the spot.
 * @typedef {object} SampleFile
 * @property {string} name File name.
 * @property {string} [type] Media type.
 * @property {string} [text] Content. Defaults to the name.
 * @property {number} [size] Size in bytes, for a file too large: the content is then made up.
 */

/**
 * A step in a scenario, run once the app is on the route:
 * - `click`: click an element;
 * - `wait`: wait for a message to show, which also checks that the screen shows what it’s meant to;
 * - `press`: press a key, e.g. `Escape`, on the focused element;
 * - `type`: replace the text of a field: the target, or the field it labels;
 * - `focus`: focus a field;
 * - `rightClick`: open the context menu of an element;
 * - `drop`: drag files onto an element and drop them; `dragOver` only drags them over it;
 * - `upload`: choose files with the file input of a button, as the file picker would;
 * - `git`: change the GitHub repository, e.g. commit as a colleague, with an action of `git.js`;
 * - `route`: open another route;
 * - `showcase`: show the Sveltia UI components the app doesn’t show over it, from
 * `client/showcase.svelte`: `true`, or the showcase’s props, e.g. `{ dialog: true }`.
 * @typedef {{ click: StepTarget } | { wait: string } | { press: string } | { type: StepTarget,
 * text: string } | { focus: StepTarget } | { rightClick: StepTarget } | { drop: StepTarget, files:
 * SampleFile[] } | { dragOver: StepTarget, files?: SampleFile[] } | { upload: StepTarget, files:
 * SampleFile[] } | { git: string } | { route: string } | { showcase: true | Record<string, any> }}
 * ScenarioStep
 */

/**
 * Step types whose value is a {@link StepTarget}, or a message key.
 */
export const STEP_TARGETS = [
  'click',
  'wait',
  'type',
  'focus',
  'rightClick',
  'drop',
  'dragOver',
  'upload',
];

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
 * Use the GitHub repository of `git.js` as the backend.
 * @param {Record<string, any>} config Configuration.
 * @param {Record<string, any>} [options] Options of the backend, and of the site.
 * @param {Record<string, any>} [options.backend] Backend options.
 * @returns {Record<string, any>} Configuration.
 */
const withGitHub = (config, { backend = {}, ...rest } = {}) => ({
  ...config,
  ...rest,
  backend: { ...GITHUB_BACKEND, ...backend },
});

/**
 * A collection whose new entries break every validation rule with their default values, so saving
 * one lists each error.
 */
const VALIDATION_COLLECTION = {
  name: 'validation',
  label: 'Validation',
  folder: 'content/validation',
  create: true,
  fields: [
    { name: 'title', default: 'Validation' },
    { name: 'too_short', minlength: 5, default: 'ab' },
    { name: 'too_long', maxlength: 3, default: 'abcdef' },
    { name: 'email', type: 'email', default: 'me@example' },
    { name: 'url', type: 'url', default: 'not a URL' },
    { name: 'number_low', widget: 'number', min: 10, default: 5 },
    { name: 'number_high', widget: 'number', max: 20, default: 25 },
    { name: 'number_missing', widget: 'number' },
    {
      name: 'datetime_low',
      widget: 'datetime',
      min: '2030-01-01T00:00',
      default: '2026-01-01T00:00:00.000Z',
    },
    {
      name: 'datetime_high',
      widget: 'datetime',
      max: '2020-01-01T00:00',
      default: '2026-01-01T00:00:00.000Z',
    },
    {
      name: 'date_low',
      widget: 'datetime',
      time_format: false,
      min: '2030-01-01',
      default: '2026-01-01',
    },
    {
      name: 'date_high',
      widget: 'datetime',
      time_format: false,
      max: '2020-01-01',
      default: '2026-01-01',
    },
    { name: 'time_low', widget: 'datetime', date_format: false, min: '12:00', default: '09:00' },
    { name: 'time_high', widget: 'datetime', date_format: false, max: '08:00', default: '09:00' },
    {
      name: 'select_few',
      widget: 'select',
      multiple: true,
      options: ['a', 'b', 'c'],
      min: 2,
      default: ['a'],
    },
    {
      name: 'select_many',
      widget: 'select',
      multiple: true,
      options: ['a', 'b', 'c'],
      max: 1,
      default: ['a', 'b'],
    },
    { name: 'list_few', widget: 'list', min: 2, default: ['a'] },
    { name: 'list_many', widget: 'list', max: 1, default: ['a', 'b'] },
  ],
};

/**
 * Change the options of a collection.
 * @param {Record<string, any>} config Configuration.
 * @param {string} name Collection name.
 * @param {Record<string, any>} options Options to set.
 * @returns {Record<string, any>} Configuration.
 */
const withCollectionOptions = (config, name, options) => ({
  ...config,
  collections: config.collections.map((/** @type {Record<string, any>} */ collection) =>
    collection.name === name ? { ...collection, ...options } : collection,
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
  // A collection whose new entries break every validation rule
  validation: {
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: (base) => ({ ...base, collections: [...base.collections, VALIDATION_COLLECTION] }),
  },
  // eslint-disable-next-line jsdoc/require-jsdoc
  'readonly-cms': { build: (base) => ({ ...base, readonly: true }) },
  // A read-only collection, and one where new entries can’t be created
  'readonly-collections': {
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: (base) =>
      withCollectionOptions(withCollectionOptions(base, 'posts', { readonly: true }), 'authors', {
        create: false,
      }),
  },
  // Entries can leave out languages other than the default one
  'optional-locales': {
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: (base) =>
      base.i18n ? { ...base, i18n: { ...base.i18n, save_all_locales: false } } : base,
  },
  // The rich text example with the table and horizontal rule components
  'richtext-components': {
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: (base) => ({
      ...base,
      collections: base.collections.map((/** @type {Record<string, any>} */ collection) =>
        collection.name === 'examples'
          ? {
              ...collection,
              files: collection.files.map((/** @type {Record<string, any>} */ file) =>
                file.name === 'richtext'
                  ? {
                      ...file,
                      fields: file.fields.map((/** @type {Record<string, any>} */ field) =>
                        field.name === 'markdown'
                          ? { ...field, editor_components: ['code-block', 'image', 'table', 'hr'] }
                          : field,
                      ),
                    }
                  : file,
              ),
            }
          : collection,
      ),
    }),
  },
  // Cloud storage services as media libraries
  'cloud-storage': {
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: (base) => ({
      ...base,
      media_libraries: {
        aws_s3: { access_key_id: 'AKIAEXAMPLEKEY000000', bucket: 'sample', region: 'eu-west-3' },
        azure_blob_storage: { account_name: 'sample', container: 'media' },
        uploadcare: { config: { publicKey: 'samplepublickey00000' } },
        cloudinary: { config: { cloud_name: 'sample', api_key: '123456789012345' } },
      },
    }),
  },
  // eslint-disable-next-line jsdoc/require-jsdoc
  github: { build: (base) => withGitHub(base) },
  // eslint-disable-next-line jsdoc/require-jsdoc
  'github-missing-branch': { build: (base) => withGitHub(base, { backend: { branch: 'live' } }) },
  'github-deployments': {
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: (base) => withGitHub(base, { backend: { automatic_deployments: true } }),
  },
  // The user is asked for a commit message on each save, as a whole or as an addition
  'github-commit-prompt': {
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: (base) => withGitHub(base, { backend: { prompt_commit_messages: true } }),
  },
  'github-commit-suffix': {
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: (base) => withGitHub(base, { backend: { prompt_commit_messages: 'suffix' } }),
  },
  // The preview workflow, and the Editorial Workflow without the review stage
  'github-preview-mode': {
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: (base) => withGitHub(base, { publish_mode: 'preview' }),
  },
  'github-no-review': {
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: (base) =>
      withGitHub(base, {
        publish_mode: { name: 'editorial_workflow', stages: ['draft', 'pending_publish'] },
      }),
  },
  'github-workflow': {
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: (base) => withGitHub(base, { publish_mode: 'editorial_workflow' }),
  },
  // A CI/CD provider builds a deploy preview of each pull request, where a post is at a path
  'github-deploy-preview': {
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: (base) => ({
      ...withGitHub(base, {
        publish_mode: 'editorial_workflow',
        site_url: 'https://www.example.com',
      }),
      collections: base.collections.map((/** @type {Record<string, any>} */ collection) =>
        collection.name === 'posts'
          ? { ...collection, preview_path: 'posts/{{slug}}' }
          : collection,
      ),
    }),
  },
  'github-open-authoring': {
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: (base) =>
      withGitHub(base, {
        publish_mode: 'editorial_workflow',
        backend: { open_authoring: true, auth_scope: 'public_repo' },
      }),
  },
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
    id: 'fields/richtext-style-menu',
    title: 'Content Editor › Rich text › Text style menu',
    route: '#/collections/examples/entries/richtext',
    steps: [{ click: '_sui.text_editor.show_text_style_options' }],
  },
  {
    id: 'fields/richtext-link-dialog',
    title: 'Content Editor › Rich text › Link dialog',
    route: '#/collections/examples/entries/richtext',
    steps: [{ click: '_sui.text_editor.link' }],
  },
  {
    id: 'fields/richtext-alignment-menu',
    title: 'Content Editor › Rich text › Alignment menu',
    route: '#/collections/examples/entries/richtext',
    steps: [{ click: '_sui.text_editor.show_alignment_options' }],
  },
  {
    id: 'fields/richtext-table-dialog',
    title: 'Content Editor › Rich text › Insert Table dialog',
    boot: { config: 'richtext-components' },
    route: '#/collections/examples/entries/richtext',
    steps: [{ click: '_sui.text_editor.insert_table' }],
  },
  {
    id: 'fields/richtext-table-menu',
    title: 'Content Editor › Rich text › Table options menu',
    boot: { config: 'richtext-components' },
    route: '#/collections/examples/entries/richtext',
    steps: [
      { click: '_sui.text_editor.insert_table' },
      { press: 'Enter' },
      { click: '_sui.text_editor.show_table_options' },
    ],
  },
  {
    id: 'fields/richtext-link-editor',
    title: 'Content Editor › Rich text › Link editor',
    route: '#/collections/examples/entries/richtext',
    steps: [
      { click: '_sui.text_editor.link' },
      { type: '_sui.text_editor.url', text: 'https://example.com/' },
      { press: 'Enter' },
    ],
  },
  {
    id: 'fields/richtext-emoji',
    title: 'Content Editor › Rich text › Emoji suggestions',
    route: '#/collections/examples/entries/richtext',
    steps: [{ type: { field: 'markdown' }, text: ':smi' }],
  },
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
  {
    id: 'settings/ai-api-key',
    title: 'Settings › AI › API key shown',
    route: '#/collections/posts',
    steps: [
      ...OPEN_SETTINGS,
      { click: 'prefs.ai.title' },
      { click: '_sui.secret_input.show_secret' },
    ],
  },
  ...SETTINGS_PANELS.map((key) => ({
    id: `settings/${key}`,
    title: `Settings › ${key}`,
    route: '#/collections/posts',
    steps: [...OPEN_SETTINGS, { click: `prefs.${key}.title` }],
  })),

  // Assets: folders and files
  {
    id: 'assets/new-folder',
    title: 'Assets › New Folder dialog',
    route: '#/assets/static/images',
    steps: [{ click: 'new_folder' }],
  },
  ...[
    ['invalid', 'a/b'],
    ['duplicate', 'bruges.webp'],
    ['reserved', 'admin'],
    ['empty', ' '],
  ].map(([error, text]) => ({
    id: `assets/new-folder-${error}`,
    title: `Assets › New Folder dialog › ${error} name`,
    route: '#/assets/static/images',
    steps: [{ click: 'new_folder' }, { type: 'new_folder_name', text }],
  })),
  {
    id: 'assets/folder-options',
    title: 'Assets › Folder options menu',
    route: '#/assets/static/files',
    steps: [{ click: 'show_folder_options' }],
  },
  {
    id: 'assets/rename-folder',
    title: 'Assets › Rename Folder dialog',
    route: '#/assets/static/files',
    steps: [{ click: 'show_folder_options' }, { click: 'rename_folder' }],
  },
  {
    id: 'assets/delete-folder',
    title: 'Assets › Delete Folder dialog',
    route: '#/assets/static/files',
    steps: [{ click: 'show_folder_options' }, { click: 'delete_folder' }],
  },
  {
    id: 'assets/upload-dialog',
    title: 'Assets › Upload dialog',
    route: '#/assets/static/images',
    steps: [{ click: 'upload_assets' }],
  },
  {
    id: 'assets/drag-over',
    title: 'Assets › Files dragged over the list',
    route: '#/assets/static/images',
    steps: [{ dragOver: 'upload_assets' }],
  },
  {
    id: 'assets/upload-confirm',
    title: 'Assets › Files dropped on the list',
    route: '#/assets/static/images',
    steps: [{ drop: 'upload_assets', files: [{ name: 'notes.txt', type: 'text/plain' }] }],
  },
  {
    id: 'assets/select-all',
    title: 'Assets › Assets selected',
    route: '#/assets/static/images',
    steps: [{ click: 'select_all' }, { click: 'delete' }],
  },
  {
    id: 'assets/edit-options',
    title: 'Assets › Asset details › Edit options menu',
    route: '#/assets/static/images/bruges.webp',
    steps: [{ click: 'show_edit_options' }],
  },
  {
    id: 'assets/copy-options',
    title: 'Assets › Asset details › Copy options menu',
    route: '#/assets/static/images/bruges.webp',
    steps: [{ click: 'copy' }],
  },
  {
    id: 'assets/rename-asset',
    title: 'Assets › Rename Asset dialog',
    route: '#/assets/static/images/bruges.webp',
    steps: [{ click: 'show_edit_options' }, { click: 'rename_asset' }],
  },
  ...[
    ['empty', ' '],
    ['character', 'a:b'],
    ['leading-dot', '.bruges'],
    ['duplicate', 'welcome'],
    ['extension', 'bruges.jpg'],
  ].map(([error, text]) => ({
    id: `assets/rename-asset-${error}`,
    title: `Assets › Rename Asset dialog › ${error}`,
    route: '#/assets/static/images/bruges.webp',
    steps: [
      { click: 'show_edit_options' },
      { click: 'rename_asset' },
      { type: 'enter_new_name_for_asset', text },
    ],
  })),
  {
    id: 'assets/replace-asset',
    title: 'Assets › Replace Asset dialog',
    route: '#/assets/static/images/bruges.webp',
    steps: [{ click: 'show_edit_options' }, { click: 'replace_asset' }],
  },
  {
    id: 'assets/delete-asset',
    title: 'Assets › Asset details › Delete confirmation',
    route: '#/assets/static/images/bruges.webp',
    steps: [{ click: 'delete' }],
  },
  {
    id: 'assets/not-found',
    title: 'Assets › Asset folder not found',
    route: '#/assets/static/nothing',
  },
  {
    id: 'assets/search',
    title: 'Search › Asset results',
    route: '#/assets/static/images',
    steps: [{ type: 'search_placeholder_assets', text: 'bruges' }, { press: 'Enter' }],
  },
  {
    id: 'search/no-results',
    title: 'Search › No results',
    route: '#/collections/posts',
    steps: [{ type: 'search_placeholder_contents', text: 'zzzz' }, { press: 'Enter' }],
  },
  {
    id: 'search/results',
    title: 'Search › Entry results',
    route: '#/collections/posts',
    steps: [{ type: 'search_placeholder_contents', text: 'trail' }, { press: 'Enter' }],
  },

  // Assets: the sample files the review tool adds, one per type
  {
    id: 'assets/samples',
    title: 'Assets › Files of every type, in the list view',
    route: '#/assets/static/files/samples',
    steps: [{ click: 'list_view' }],
  },
  {
    id: 'assets/samples-sort',
    title: 'Assets › Sorting menu',
    route: '#/assets/static/files/samples',
    steps: [{ click: 'sort' }],
  },
  {
    id: 'assets/samples-type',
    title: 'Assets › Type filter menu',
    route: '#/assets/static/files/samples',
    steps: [{ click: 'type' }],
  },
  {
    id: 'assets/sample-details',
    title: 'Assets › Asset details › File with no preview',
    route: '#/assets/static/files/samples/sample.pdf',
  },
  {
    id: 'assets/large-sample-details',
    title: 'Assets › Asset details › Large file',
    route: '#/assets/static/files/samples/large-sample.bin',
  },

  // Content: read-only and validation
  {
    id: 'contents/readonly-cms',
    title: 'Content › The whole CMS read-only',
    boot: { config: 'readonly-cms' },
    route: '#/collections/posts',
  },
  {
    id: 'contents/readonly-collection',
    title: 'Content › Read-only collection',
    boot: { config: 'readonly-collections' },
    route: '#/collections/posts',
  },
  {
    id: 'contents/readonly-entry',
    title: 'Content Editor › Entry of a read-only collection',
    boot: { config: 'readonly-collections' },
    route: '#/collections/posts/entries/welcome-to-the-demo',
  },
  {
    id: 'contents/create-disabled',
    title: 'Content › Collection without new entries',
    boot: { config: 'readonly-collections' },
    route: '#/collections/authors',
  },
  {
    id: 'contents/validation-rules',
    title: 'Content Editor › Every validation error',
    boot: { config: 'validation' },
    route: '#/collections/validation/new',
    steps: [{ click: 'save' }],
  },

  // Content: lists and pages
  {
    id: 'contents/not-found',
    title: 'Content › Collection not found',
    route: '#/collections/nothing',
  },
  {
    id: 'contents/entry-not-found',
    title: 'Content Editor › Entry not found',
    route: '#/collections/posts/entries/nothing',
  },
  {
    id: 'contents/page-not-found',
    title: 'Page not found',
    route: '#/nothing',
  },
  {
    id: 'contents/bulk-edit',
    title: 'Content › Bulk editing',
    route: '#/collections/authors',
    steps: [{ click: 'bulk_edit_entries' }],
  },
  {
    id: 'contents/bulk-edit-changed',
    title: 'Content › Bulk editing › With changes',
    // Not the previous screen’s collection, which stays in bulk editing
    route: '#/collections/posts',
    steps: [
      { click: 'bulk_edit_entries' },
      { type: 'bulk_edit_table', text: 'Edited' },
      { click: 'cancel_bulk_edits' },
    ],
  },

  // Content editor: menus and dialogs
  {
    id: 'contents/field-options',
    title: 'Content Editor › Field options menu',
    route: '#/collections/posts/entries/welcome-to-the-demo',
    steps: [{ click: 'show_field_options' }],
  },
  {
    id: 'contents/disable-locale',
    title: 'Content Editor › Content options › Locale disabled',
    boot: { config: 'optional-locales' },
    route: '#/collections/posts/entries/welcome-to-the-demo',
    // The second language: the default one can’t be disabled
    steps: [
      { click: { in: 'switch_locale', index: 1 } },
      { click: 'show_content_options_x_locale' },
      { click: 'disable_x_locale' },
    ],
  },
  {
    id: 'contents/clear-fields',
    title: 'Content Editor › Content options › Clear the fields',
    route: '#/collections/posts/entries/welcome-to-the-demo',
    steps: [{ click: 'show_content_options_x_locale' }, { click: 'clear_all' }],
  },
  {
    id: 'contents/revert-changes',
    title: 'Content Editor › Revert the changes',
    route: '#/collections/posts/entries/welcome-to-the-demo',
    steps: [
      { type: { field: 'title' }, text: 'Welcome!' },
      { click: 'show_editor_options' },
      { click: 'revert_all_changes' },
    ],
  },
  {
    id: 'contents/duplicate-entry',
    title: 'Content Editor › Entry duplicated',
    route: '#/collections/authors/entries/ava-clarke',
    steps: [{ click: 'show_editor_options' }, { click: 'duplicate_entry' }],
  },
  {
    id: 'contents/delete-entry',
    title: 'Content Editor › Delete confirmation',
    route: '#/collections/authors/entries/ava-clarke',
    steps: [{ click: 'show_editor_options' }, { click: 'delete' }],
  },
  ...['validation', 'slug', 'history', 'backlinks'].map((panel) => ({
    id: `contents/sidebar-${panel}`,
    title: `Content Editor › Sidebar › ${panel}`,
    route: '#/collections/posts/entries/welcome-to-the-demo',
    steps: [{ click: `entry_sidebar.${panel}.title` }],
  })),
  {
    id: 'contents/save-toast',
    title: 'Content Editor › Entry saved',
    route: '#/collections/authors/entries/mina-sato',
    steps: [{ type: { field: 'name' }, text: 'Mina Sato' }, { click: 'save' }],
  },
  {
    id: 'contents/edit-slug',
    title: 'Content Editor › Edit slug',
    route: '#/collections/posts/entries/welcome-to-the-demo',
    steps: [{ click: 'show_editor_options' }, { click: 'edit_slug' }],
  },
  {
    id: 'fields/map-search',
    title: 'Content Editor › Map › Place search',
    route: '#/collections/examples/entries/map',
    steps: [{ type: 'find_place', text: 'Bruges' }, { press: 'Enter' }],
  },
  {
    id: 'contents/draft-backup',
    title: 'Content Editor › Restore the draft backup',
    route: '#/collections/authors/new',
    steps: [
      { type: { field: 'name' }, text: 'Draft author' },
      { route: '#/collections/authors' },
      { route: '#/collections/authors/new' },
    ],
  },

  // Content editor: list fields
  {
    id: 'fields/list-item-menu',
    title: 'Content Editor › List item menu',
    route: '#/collections/examples/entries/list',
    steps: [{ click: 'list_item_options' }],
  },
  {
    id: 'fields/list-paste-nothing',
    title: 'Content Editor › List item › Nothing to paste',
    route: '#/collections/examples/entries/list',
    steps: [{ click: 'list_item_options' }, { click: 'paste_item_above' }],
  },
  {
    id: 'fields/list-copy',
    title: 'Content Editor › List item › Item copied',
    route: '#/collections/examples/entries/list',
    steps: [{ click: 'list_item_options' }, { click: 'copy' }, { click: 'list_item_options' }],
  },
  {
    id: 'fields/list-remove',
    title: 'Content Editor › List item › Item removed',
    route: '#/collections/examples/entries/list',
    steps: [{ click: 'remove' }],
  },
  {
    id: 'fields/list-types',
    title: 'Content Editor › Variable-type list › Type menu',
    route: '#/collections/examples/entries/list',
    steps: [{ click: { field: 'blocks', key: 'add_x' } }],
  },
  {
    id: 'fields/number-range',
    title: 'Content Editor › Number out of range',
    route: '#/collections/examples/entries/number',
    steps: [{ type: { field: 'integer' }, text: '100000' }, { click: 'save' }],
  },
  {
    id: 'fields/file-upload-dialog',
    title: 'Content Editor › Select Assets dialog (file)',
    route: '#/collections/examples/entries/file',
    steps: [{ click: 'replace_file' }],
  },
  {
    id: 'fields/image-upload-dialog',
    title: 'Content Editor › Select Assets dialog (image)',
    route: '#/collections/examples/entries/image',
    steps: [{ click: 'replace_image' }],
  },
  {
    id: 'fields/image-drop-mismatch',
    title: 'Content Editor › Image field › Wrong file type dropped',
    route: '#/collections/examples/entries/image',
    steps: [{ drop: { field: 'single' }, files: [{ name: 'notes.txt', type: 'text/plain' }] }],
  },

  // Sveltia UI components the app doesn’t show, or not in every state
  {
    id: 'ui/showcase',
    title: 'Sveltia UI › Components the app doesn’t show',
    route: '#/collections/posts',
    steps: [{ showcase: true }],
  },
  {
    id: 'ui/showcase-revealed',
    title: 'Sveltia UI › Password and secret shown',
    route: '#/collections/posts',
    steps: [
      { showcase: true },
      { click: '_sui.password_input.show_password' },
      { click: '_sui.secret_input.show_secret' },
    ],
  },
  {
    id: 'ui/combobox-open',
    title: 'Sveltia UI › Combobox open',
    route: '#/collections/posts',
    steps: [{ showcase: true }, { click: '_sui.expand' }],
  },
  {
    id: 'ui/combobox-filtered',
    title: 'Sveltia UI › Combobox with no matching options',
    route: '#/collections/posts',
    steps: [
      { showcase: true },
      { click: '_sui.expand' },
      { type: '_sui.combobox.filter_options', text: 'zzz' },
    ],
  },
  {
    id: 'ui/calendar-years',
    title: 'Sveltia UI › Calendar › Years',
    route: '#/collections/posts',
    steps: [{ showcase: { calendarPopup: true } }],
  },
  {
    id: 'ui/dialog',
    title: 'Sveltia UI › Dialog',
    route: '#/collections/posts',
    steps: [{ showcase: { dialog: true } }],
  },

  // Online services
  {
    id: 'services/translate-menu',
    title: 'Content Editor › Translation options menu',
    boot: { services: ['google-translate'] },
    route: '#/collections/posts/entries/welcome-to-the-demo',
    steps: [{ click: 'translate' }],
  },
  {
    id: 'services/translated',
    title: 'Content Editor › Fields translated',
    boot: { services: ['google-translate'] },
    route: '#/collections/posts/entries/welcome-to-the-demo',
    steps: [{ click: 'translate' }, { click: 'translate_from_x' }],
  },
  {
    id: 'services/translation-failed',
    title: 'Content Editor › Translation failed',
    boot: { services: ['google-translate-error'] },
    route: '#/collections/posts/entries/welcome-to-the-demo',
    steps: [{ click: 'translate' }, { click: 'translate_from_x' }],
  },
  {
    id: 'services/translator-key-dialog',
    title: 'Content Editor › Translation service API key dialog',
    route: '#/collections/posts/entries/welcome-to-the-demo',
    steps: [{ click: 'translate' }, { click: 'translate_from_x' }],
  },
  {
    id: 'services/stock-photos',
    title: 'Content Editor › Select Image dialog › Stock photos',
    boot: { services: ['unsplash'] },
    route: '#/collections/examples/entries/image',
    steps: [{ click: 'replace_image' }, { click: 'asset_location.stock_photos' }],
  },
  {
    id: 'services/settings-media',
    title: 'Settings › Media › With a stock photo service',
    boot: { services: ['unsplash'] },
    route: '#/collections/posts',
    steps: [...OPEN_SETTINGS, { click: 'prefs.media.title' }],
  },
  {
    id: 'services/settings-language',
    title: 'Settings › Language › With a translation service',
    boot: { services: ['google-translate'] },
    route: '#/collections/posts',
    steps: [...OPEN_SETTINGS, { click: 'prefs.language.title' }],
  },

  {
    id: 'services/cloud-locations',
    title: 'Content Editor › Select Image dialog › Cloud storage services',
    boot: { config: 'cloud-storage' },
    route: '#/collections/examples/entries/image',
    steps: [{ click: 'replace_image' }],
  },
  ...['Amazon S3', 'Azure Blob Storage', 'Uploadcare', 'Cloudinary'].map((service) => ({
    id: `services/cloud-${service.toLowerCase().replaceAll(' ', '-')}`,
    title: `Content Editor › Select Image dialog › ${service}`,
    boot: { config: 'cloud-storage' },
    route: '#/collections/examples/entries/image',
    steps: [{ click: 'replace_image' }, { click: { text: service } }],
  })),
  {
    id: 'services/cloud-key-checking',
    title: 'Content Editor › Select Image dialog › Amazon S3 › Key entered',
    boot: { config: 'cloud-storage' },
    route: '#/collections/examples/entries/image',
    steps: [
      { click: 'replace_image' },
      { click: { text: 'Amazon S3' } },
      { type: 'cloud_storage.s3.auth_key_label', text: 'secret' },
      { press: 'Enter' },
    ],
  },

  // Browser conditions
  {
    id: 'browser/unsupported',
    title: 'Browser › Unsupported browser',
    boot: { signIn: false, env: ['unsupported-browser'] },
  },
  {
    id: 'browser/insecure',
    title: 'Browser › Insecure page',
    boot: { signIn: false, env: ['insecure'] },
  },
  {
    id: 'browser/test-repo-unsupported',
    title: 'Browser › Test repository unsupported',
    boot: { signIn: false, env: ['test-repo-unsupported'] },
  },
  {
    id: 'browser/no-local-backend',
    title: 'Browser › No File System Access API',
    boot: { config: 'github', git: 'signed-out', signIn: false, env: ['no-local-backend'] },
  },
  {
    id: 'browser/brave',
    title: 'Browser › Brave, with the File System Access API off',
    boot: { config: 'github', git: 'signed-out', signIn: false, env: ['brave'] },
  },
  {
    id: 'browser/touch',
    title: 'Browser › Touch screen › Upload dialog',
    boot: { env: ['touch'] },
    route: '#/assets/static/images',
    steps: [{ click: 'upload_assets' }],
  },
  {
    id: 'browser/language',
    title: 'Browser › Browser in another language',
    boot: { env: ['browser-language'] },
    route: '#/collections/posts',
  },
  {
    id: 'browser/installable',
    title: 'Browser › Installable app › Account menu',
    boot: { env: ['installable'] },
    route: '#/collections/posts',
    steps: [{ click: 'show_account_menu' }],
  },
  {
    id: 'browser/clipboard-denied',
    title: 'Browser › Clipboard access denied',
    boot: { env: ['clipboard-denied'] },
    route: '#/collections/examples/entries/image',
    steps: [{ click: 'paste_image' }],
  },
  {
    id: 'browser/clipboard-text',
    title: 'Browser › No image in the clipboard',
    boot: { env: ['clipboard-text'] },
    route: '#/collections/examples/entries/image',
    steps: [{ click: 'paste_image' }],
  },
  {
    id: 'browser/geolocation-denied',
    title: 'Browser › Location denied',
    boot: { env: ['geolocation-denied'] },
    route: '#/collections/examples/entries/map',
    steps: [{ click: 'use_your_location' }],
  },
  {
    id: 'browser/no-geolocation',
    title: 'Browser › No geolocation',
    boot: { env: ['no-geolocation'] },
    route: '#/collections/examples/entries/map',
    steps: [{ click: 'use_your_location' }],
  },

  // GitHub: sign-in
  {
    id: 'github/sign-in',
    title: 'GitHub › Sign-in page',
    boot: { config: 'github', git: 'signed-out', signIn: false },
  },
  {
    id: 'github/access-token',
    title: 'GitHub › Sign-in page › Access token dialog',
    boot: { config: 'github', git: 'signed-out', signIn: false },
    steps: [{ click: 'sign_in_using_access_token' }],
  },
  {
    id: 'github/access-token-workflow',
    title: 'GitHub › Sign-in page › Access token dialog, with Editorial Workflow',
    boot: { config: 'github-workflow', git: 'signed-out', signIn: false },
    steps: [{ click: 'sign_in_using_access_token' }],
  },
  ...[
    ['no-write-access', 'No write access to the repository'],
    ['not-found', 'Repository not found'],
    ['rate-limited', 'API rate limit exceeded'],
    ['empty', 'Empty repository'],
  ].map(([git, label]) => ({
    id: `github/${git}`,
    title: `GitHub › Sign-in error › ${label}`,
    boot: { config: 'github', git, signIn: false },
  })),
  {
    id: 'github/missing-branch',
    title: 'GitHub › Sign-in error › Branch not found',
    boot: { config: 'github-missing-branch', git: 'signed-in', signIn: false },
  },

  // GitHub: saving
  {
    id: 'github/commit-prompt',
    title: 'GitHub › Commit message dialog',
    boot: { config: 'github-commit-prompt', git: 'signed-in' },
    route: '#/collections/authors/entries/ava-clarke',
    steps: [{ type: { field: 'name' }, text: 'Ava' }, { click: 'save' }],
  },
  {
    id: 'github/commit-suffix',
    title: 'GitHub › Commit message dialog, for an addition',
    boot: { config: 'github-commit-suffix', git: 'signed-in' },
    route: '#/collections/authors/entries/ava-clarke',
    steps: [{ type: { field: 'name' }, text: 'Ava' }, { click: 'save' }],
  },
  {
    id: 'github/save-conflict',
    title: 'GitHub › Entry changed by someone else',
    boot: { config: 'github', git: 'signed-in', instance: 'conflict' },
    route: '#/collections/posts/entries/welcome-to-the-demo',
    steps: [
      { type: { field: 'title' }, text: 'Hello' },
      { git: 'colleague-edits-post' },
      { click: 'save' },
    ],
  },
  {
    id: 'github/save-conflict-deleted',
    title: 'GitHub › Entry deleted by someone else',
    boot: { config: 'github', git: 'signed-in', instance: 'conflict-deleted' },
    route: '#/collections/posts/entries/welcome-to-the-demo',
    steps: [
      { type: { field: 'title' }, text: 'Hello' },
      { git: 'colleague-deletes-post' },
      { click: 'save' },
    ],
  },
  {
    id: 'github/history',
    title: 'GitHub › Content Editor › History panel',
    boot: { config: 'github', git: 'signed-in' },
    route: '#/collections/posts/entries/welcome-to-the-demo',
    steps: [{ click: 'entry_sidebar.history.title' }],
  },

  // GitHub: signed in
  {
    id: 'github/entry-list',
    title: 'GitHub › Entry list',
    boot: { config: 'github', git: 'signed-in' },
    route: '#/collections/posts',
  },
  {
    id: 'github/account-menu',
    title: 'GitHub › Account menu',
    boot: { config: 'github', git: 'signed-in' },
    route: '#/collections/posts',
    steps: [{ click: 'show_account_menu' }],
  },
  {
    id: 'github/editor',
    title: 'GitHub › Content Editor',
    boot: { config: 'github', git: 'signed-in' },
    route: '#/collections/posts/entries/welcome-to-the-demo',
  },
  {
    id: 'github/editor-options',
    title: 'GitHub › Content Editor › Editor options menu',
    boot: { config: 'github', git: 'signed-in' },
    route: '#/collections/posts/entries/welcome-to-the-demo',
    steps: [{ click: 'show_editor_options' }],
  },
  {
    id: 'github/read-only-branch',
    title: 'GitHub › Protected branch',
    boot: { config: 'github', git: 'read-only-branch' },
    route: '#/collections/posts',
  },
  {
    id: 'github/minor-incident',
    title: 'GitHub › Minor incident on GitHub',
    boot: { config: 'github', git: 'minor-incident' },
    route: '#/collections/posts',
  },
  {
    id: 'github/major-incident',
    title: 'GitHub › Major incident on GitHub',
    boot: { config: 'github', git: 'major-incident' },
    route: '#/collections/posts',
  },
  {
    id: 'github/publish-changes',
    title: 'GitHub › Publish Changes button',
    boot: { config: 'github-deployments', git: 'signed-in' },
    route: '#/collections/posts',
  },
  {
    id: 'github/save-menu',
    title: 'GitHub › Content Editor › Save menu, with automatic deployments',
    boot: { config: 'github-deployments', git: 'signed-in' },
    route: '#/collections/posts/entries/welcome-to-the-demo',
    steps: [{ click: '_sui.split_button.more_options' }],
  },

  // Editorial Workflow
  {
    id: 'workflow/board',
    title: 'Editorial Workflow › Board',
    boot: { config: 'github-workflow', git: 'workflow' },
    route: '#/workflow',
  },
  {
    id: 'workflow/entry-list',
    title: 'Editorial Workflow › Entry list, with unpublished entries',
    boot: { config: 'github-workflow', git: 'workflow' },
    route: '#/collections/posts',
  },
  ...Object.entries(WORKFLOW_POSTS).map(([status, slug]) => ({
    id: `workflow/editor-${status}`,
    title: `Editorial Workflow › Content Editor › ${status}`,
    boot: { config: 'github-workflow', git: 'workflow' },
    route: `#/collections/posts/entries/${slug}`,
  })),
  {
    id: 'workflow/editor-published',
    title: 'Editorial Workflow › Content Editor › published entry',
    boot: { config: 'github-workflow', git: 'workflow' },
    route: '#/collections/posts/entries/welcome-to-the-demo',
  },
  {
    id: 'workflow/status-menu',
    title: 'Editorial Workflow › Content Editor › Status menu',
    boot: { config: 'github-workflow', git: 'workflow' },
    route: `#/collections/posts/entries/${WORKFLOW_POSTS.draft}`,
    steps: [{ click: 'workflow.entry_status_value' }],
  },
  {
    id: 'workflow/send-for-review',
    title: 'Editorial Workflow › Content Editor › Send for review',
    boot: { config: 'github-workflow', git: 'workflow' },
    route: `#/collections/posts/entries/${WORKFLOW_POSTS.draft}`,
    steps: [{ click: 'workflow.entry_status_value' }, { click: 'status.in_review' }],
  },
  {
    id: 'workflow/mark-ready',
    title: 'Editorial Workflow › Content Editor › Mark as ready',
    boot: { config: 'github-workflow', git: 'workflow' },
    route: `#/collections/posts/entries/${WORKFLOW_POSTS.pending_review}`,
    steps: [{ click: 'workflow.entry_status_value' }, { click: 'status.ready' }],
  },
  {
    id: 'workflow/publish-confirm',
    title: 'Editorial Workflow › Content Editor › Publish',
    boot: { config: 'github-workflow', git: 'workflow' },
    route: `#/collections/posts/entries/${WORKFLOW_POSTS.pending_publish}`,
    steps: [{ click: 'workflow.publish_entry' }],
  },
  {
    id: 'workflow/editor-options',
    title: 'Editorial Workflow › Content Editor › Editor options of an unpublished entry',
    boot: { config: 'github-workflow', git: 'workflow' },
    route: `#/collections/posts/entries/${WORKFLOW_POSTS.draft}`,
    steps: [{ click: 'show_editor_options' }],
  },
  {
    id: 'workflow/delete-unpublished',
    title: 'Editorial Workflow › Content Editor › Delete an unpublished entry',
    boot: { config: 'github-workflow', git: 'workflow' },
    route: `#/collections/posts/entries/${WORKFLOW_POSTS.draft}`,
    steps: [{ click: 'show_editor_options' }, { click: 'delete' }],
  },
  {
    id: 'workflow/delete-published',
    title: 'Editorial Workflow › Content Editor › Delete a published entry',
    boot: { config: 'github-workflow', git: 'workflow' },
    route: '#/collections/posts/entries/welcome-to-the-demo',
    steps: [{ click: 'show_editor_options' }, { click: 'delete' }],
  },
  {
    id: 'workflow/refresh',
    title: 'Editorial Workflow › Board › Refreshed',
    boot: { config: 'github-workflow', git: 'workflow' },
    route: '#/workflow',
    steps: [{ click: 'workflow.refresh' }],
  },
  {
    id: 'workflow/empty-board',
    title: 'Editorial Workflow › Board with no entries',
    boot: { config: 'github-workflow', git: 'signed-in' },
    route: '#/workflow',
  },
  {
    id: 'workflow/preview-mode',
    title: 'Preview Workflow › Board',
    boot: { config: 'github-preview-mode', git: 'workflow' },
    route: '#/workflow',
  },
  {
    id: 'workflow/no-review',
    title: 'Editorial Workflow without review › Board',
    boot: { config: 'github-no-review', git: 'workflow' },
    route: '#/workflow',
  },
  {
    id: 'workflow/open-authoring-board',
    title: 'Editorial Workflow › Open Authoring › Board',
    boot: { config: 'github-open-authoring', git: 'open-authoring-forked' },
    route: '#/workflow',
  },
  // The deploy preview of each post is in another state: built, being built, failed
  ...Object.entries(WORKFLOW_POSTS).map(([status, slug]) => ({
    id: `workflow/deploy-preview-${status}`,
    title: `Editorial Workflow › Content Editor › Deploy preview (${status})`,
    // The app checks that the preview page is there
    boot: {
      config: 'github-deploy-preview',
      git: 'deploy-preview',
      mocks: [{ url: '.example.com/', json: {} }],
    },
    route: `#/collections/posts/entries/${slug}`,
  })),
  {
    id: 'workflow/open-authoring',
    title: 'Editorial Workflow › Open Authoring › Fork the repository',
    boot: { config: 'github-open-authoring', git: 'open-authoring', signIn: false },
    steps: [{ wait: 'open_authoring.fork_repository' }],
  },
  {
    id: 'workflow/open-authoring-declined',
    title: 'Editorial Workflow › Open Authoring › Fork declined',
    // Declining the fork can’t be undone, so the previous screen needs an app of its own
    boot: {
      config: 'github-open-authoring',
      git: 'open-authoring',
      signIn: false,
      instance: 'declined',
    },
    steps: [
      { wait: 'open_authoring.fork_repository' },
      { click: '_sui.cancel' },
      { wait: 'open_authoring.fork_declined' },
    ],
  },
  {
    id: 'workflow/open-authoring-forked',
    title: 'Editorial Workflow › Open Authoring › Working on a fork',
    boot: { config: 'github-open-authoring', git: 'open-authoring-forked' },
    route: '#/collections/posts',
  },
  {
    id: 'workflow/open-authoring-editor',
    title: 'Editorial Workflow › Open Authoring › Content Editor',
    boot: { config: 'github-open-authoring', git: 'open-authoring-forked' },
    route: '#/collections/posts/entries/welcome-to-the-demo',
  },
  ...[
    ['open-authoring-no-forking', 'Repository doesn’t allow forks', 'forking_disabled'],
    ['open-authoring-invitation', 'Pending invitation', 'invitation_pending'],
    ['open-authoring-private', 'No access to private repositories', 'private_repo_scope_required'],
  ].map(([git, label, key]) => ({
    id: `workflow/${git}`,
    title: `Editorial Workflow › Open Authoring › ${label}`,
    boot: { config: 'github-open-authoring', git, signIn: false },
    steps: [{ wait: `open_authoring.${key}` }],
  })),

  // Configuration errors
  ...CONFIG_ERROR_SCENARIOS.map(({ name, label, warningsOnly }) =>
    // With warnings only, the app starts, and logs them to the console
    warningsOnly
      ? {
          id: `config/${name}`,
          title: `Configuration warnings › ${label}`,
          boot: { config: `error-${name}` },
          route: '#/collections/posts',
        }
      : {
          id: `config/${name}`,
          title: `Configuration errors › ${label}`,
          boot: { config: `error-${name}`, signIn: false },
        },
  ),
];
