/**
 * Broken versions of the sample site configuration, to show the configuration error messages in
 * context. The CMS lists every problem it finds on its start page, so each one breaks as many
 * things as it can at once. `pnpm l10n:coverage` reports which messages they show.
 */

/**
 * Collections with every problem the parser reports for collections and fields that can be shown
 * together. Their names, labels and paths are made up.
 */
const BROKEN_COLLECTIONS = [
  { label: 'Nameless', folder: 'content/nameless', fields: [{ name: 'title' }] },
  { name: 'bad name', label: 'Bad Name', folder: 'content/bad-name', fields: [{ name: 'title' }] },
  {
    name: 'posts',
    label: 'Posts Again',
    folder: 'content/posts-again',
    fields: [{ name: 'title' }],
  },
  { name: 'no_storage', label: 'No Storage', fields: [{ name: 'title' }] },
  {
    name: 'two_storages',
    label: 'Two Storages',
    folder: 'content/two-storages',
    files: [{ name: 'about', file: 'content/about.md', fields: [{ name: 'title' }] }],
  },
  { name: 'no_fields', label: 'No Fields', folder: 'content/no-fields' },
  {
    name: 'files_problems',
    label: 'File Problems',
    files: [
      { label: 'Nameless File', file: 'content/nameless.md', fields: [{ name: 'title' }] },
      { name: 'bad name', file: 'content/bad.md', fields: [{ name: 'title' }] },
      { name: 'dup', file: 'content/dup-1.md', fields: [{ name: 'title' }] },
      { name: 'dup', file: 'content/dup-2.md', fields: [{ name: 'title' }] },
      { name: 'empty', file: 'content/empty.md' },
    ],
  },
  {
    name: 'broken_fields',
    label: 'Broken Fields',
    folder: 'content/broken-fields',
    identifier_field: 'missing',
    sortable_fields: ['missing'],
    thumbnail: 'title',
    filter: { field: 'missing', value: 'x' },
    table_columns: ['missing'],
    bulk_edit: { fields: ['missing'] },
    view_filters: [{ label: 'No Pattern', field: 'title' }],
    view_groups: [{ label: 'Missing Field', field: 'missing' }],
    fields: [
      { label: 'No Name' },
      { name: 'bad name', label: 'Bad Name' },
      { name: 'title', label: 'Title' },
      { name: 'title', label: 'Title Again' },
      { name: 'choice', label: 'Choice', widget: 'select' },
      { name: 'repeated', label: 'Repeated', widget: 'select', options: ['a', 'a'] },
      { name: 'unknown_default', widget: 'select', options: ['a', 'b'], default: 'c' },
      { name: 'no_options', widget: 'select', options: [] },
      { name: 'empty_object', widget: 'object', fields: [] },
      { name: 'empty_list', widget: 'list', fields: [] },
      { name: 'step', widget: 'number', step: 0 },
      { name: 'language', widget: 'hidden', default: '{{locale}}' },
      {
        name: 'blocks',
        widget: 'list',
        types: [
          { label: 'No Name', fields: [{ name: 'text' }] },
          { name: 'twice', fields: [{ name: 'text' }] },
          { name: 'twice', fields: [{ name: 'text' }] },
        ],
      },
      { name: 'whole', widget: 'number', value_type: 'int', default: 1.5 },
      { name: 'range', widget: 'number', min: 10, max: 1 },
      { name: 'pattern', widget: 'string', pattern: ['[', 'Invalid pattern'] },
      { name: 'old_date', widget: 'date' },
      { name: 'zone', widget: 'datetime', input_timezone: 'Mars/Olympus_Mons' },
      { name: 'computed', widget: 'compute', value: '{{fields.missing' },
      {
        name: 'nowhere',
        widget: 'relation',
        collection: 'missing',
        value_field: 'title',
        search_fields: ['title'],
      },
      {
        name: 'wrong_fields',
        widget: 'relation',
        collection: 'posts',
        value_field: 'missing',
        search_fields: ['missing'],
        display_fields: ['missing'],
      },
      { name: 'snippet', widget: 'code', default: { unknown: 'x' } },
    ],
  },
];

/**
 * A collection whose fields break the checks of field defaults, List field keys, Compute fields
 * and Relation fields.
 */
const BROKEN_FIELD_OPTIONS = {
  name: 'broken_options',
  label: 'Broken Options',
  folder: 'content/broken-options',
  fields: [
    { name: 'title' },
    { name: 'map_no_fields', widget: 'list', map_key_field: 'key' },
    { name: 'map_missing', widget: 'list', map_key_field: 'key', fields: [{ name: 'a' }] },
    {
      name: 'map_missing_in_type',
      widget: 'list',
      map_key_field: 'key',
      types: [{ name: 'type', fields: [{ name: 'a' }] }],
    },
    {
      name: 'map_number',
      widget: 'list',
      map_key_field: 'key',
      fields: [{ name: 'key', widget: 'number' }],
    },
    {
      name: 'map_multiple',
      widget: 'list',
      map_key_field: 'key',
      fields: [{ name: 'key', widget: 'select', multiple: true, options: ['a', 'b'] }],
    },
    {
      name: 'map_options',
      widget: 'list',
      map_key_field: 'key',
      fields: [{ name: 'key', widget: 'select', options: [1, 2] }],
    },
    {
      name: 'map_optional',
      widget: 'list',
      map_key_field: 'key',
      fields: [{ name: 'key', required: false }],
    },
    {
      name: 'variable_string',
      widget: 'list',
      types: [{ name: 'text', widget: 'string', fields: [{ name: 'a' }] }],
    },
    { name: 'list_default_object', widget: 'list', fields: [{ name: 'a' }], default: 'x' },
    { name: 'list_default_item', widget: 'list', fields: [{ name: 'a' }], default: ['x'] },
    { name: 'list_default_key', widget: 'list', fields: [{ name: 'a' }], default: [{ b: 1 }] },
    {
      name: 'list_default_no_type',
      widget: 'list',
      types: [{ name: 'one', fields: [{ name: 'a' }] }],
      default: [{ a: 'x' }],
    },
    {
      name: 'list_default_bad_type',
      widget: 'list',
      types: [{ name: 'one', fields: [{ name: 'a' }] }],
      default: [{ type: 'other', a: 'x' }],
    },
    { name: 'object_default_key', widget: 'object', fields: [{ name: 'a' }], default: { b: 1 } },
    {
      name: 'object_default_no_type',
      widget: 'object',
      types: [{ name: 'one', fields: [{ name: 'a' }] }],
      default: { a: 'x' },
    },
    {
      name: 'object_default_bad_type',
      widget: 'object',
      types: [{ name: 'one', fields: [{ name: 'a' }] }],
      default: { type: 'other' },
    },
    { name: 'code_default', widget: 'code', default: ['x'] },
    { name: 'number_default', widget: 'number', default: 'abc' },
    { name: 'multiple_default', widget: 'select', multiple: true, options: ['a'], default: 'a' },
    { name: 'single_default', widget: 'select', options: ['a'], default: ['a'] },
    { name: 'old_multiple', widget: 'image', allow_multiple: true },
    { name: 'list_and_fields', widget: 'list', field: { name: 'a' }, fields: [{ name: 'b' }] },
    { name: 'object_field', widget: 'object', field: { name: 'a' } },
    { name: 'id', widget: 'uuid' },
    { name: 'computed_uuid', widget: 'compute', value: '{{fields.id}}' },
    { name: 'computed_bad', widget: 'compute', value: '{{' },
    { name: 'self', widget: 'compute', value: '{{fields.self}}' },
    { name: 'cycle_a', widget: 'compute', value: '{{fields.cycle_b}}' },
    { name: 'cycle_b', widget: 'compute', value: '{{fields.cycle_a}}' },
    {
      name: 'to_files',
      widget: 'relation',
      collection: '_singletons',
      value_field: 'title',
      search_fields: ['title'],
    },
    {
      name: 'filtered',
      widget: 'relation',
      collection: 'posts',
      value_field: 'title',
      search_fields: ['title'],
      filters: [{ field: 'missing', values: ['x'] }],
      sort: { field: 'missing' },
    },
  ],
};

/**
 * A collection whose list views break the checks of filters, groups, sorting and bulk editing.
 */
const BROKEN_VIEWS = {
  name: 'broken_views',
  label: 'Broken Views',
  folder: 'content/broken-views',
  sortable_fields: {
    fields: [
      { field: 'title', default: true },
      { field: 'date', default: true },
    ],
  },
  filter: { field: 'title' },
  bulk_edit: { fields: ['body'] },
  view_filters: {
    default: 'missing',
    filters: [
      { label: 'No Name', field: 'title', pattern: 'a' },
      { name: 'bad name', label: 'Bad Name', field: 'title', pattern: 'a' },
      { name: 'twice', label: 'Twice', field: 'title', pattern: 'a' },
      { name: 'twice', label: 'Twice Again', field: 'title', pattern: 'b' },
      { name: 'missing_field', label: 'Missing Field', field: 'missing', pattern: 'a' },
    ],
  },
  view_groups: {
    default: 'missing',
    groups: [
      { label: 'No Name', field: 'title' },
      { name: 'bad name', label: 'Bad Name', field: 'title' },
      { name: 'twice', label: 'Twice', field: 'title' },
      { name: 'twice', label: 'Twice Again', field: 'date' },
    ],
  },
  fields: [
    { name: 'title' },
    { name: 'date', widget: 'datetime' },
    { name: 'body', widget: 'richtext' },
  ],
};

/**
 * Collections breaking the internationalization checks.
 */
const BROKEN_I18N_COLLECTIONS = [
  {
    name: 'no_i18n_fields',
    label: 'No Localized Fields',
    folder: 'content/no-i18n-fields',
    i18n: true,
    fields: [{ name: 'title', i18n: false }],
  },
  {
    name: 'folder_locale',
    label: 'Folder Locale',
    folder: 'content/{{locale}}/posts',
    i18n: { structure: 'multiple_folders' },
    fields: [{ name: 'title', i18n: true }],
  },
  {
    name: 'i18n_files',
    label: 'Localized Files',
    i18n: true,
    files: [
      {
        name: 'about',
        file: 'content/about.md',
        i18n: true,
        fields: [{ name: 'title', i18n: false }],
      },
    ],
  },
];

/**
 * A collection with options the parser only warns about, so the app still starts, and logs the
 * warnings to the console.
 */
const WARNING_COLLECTION = {
  name: 'warnings',
  label: 'Warnings',
  folder: 'content/warnings',
  unknown_option: true,
  fields: [
    { name: 'title' },
    { name: 'self', widget: 'compute', value: '{{fields.self}}' },
    { name: 'cycle_a', widget: 'compute', value: '{{fields.cycle_b}}' },
    { name: 'cycle_b', widget: 'compute', value: '{{fields.cycle_a}}' },
    { name: 'date', widget: 'datetime', localize_format: true },
  ],
};

/**
 * A way to break the configuration.
 * @typedef {object} ConfigErrorScenario
 * @property {string} name Unique name.
 * @property {string} label What breaks.
 * @property {boolean} [warningsOnly] Whether it only has warnings, so the app starts with it.
 * @property {(config: Record<string, any>) => Record<string, any>} [build] Function returning the
 * broken configuration from the sample one.
 * @property {string} [raw] Content to serve instead of a configuration, for a file that can’t be
 * parsed.
 * @property {number} [status] HTTP status to serve instead of a configuration, for a file that
 * can’t be loaded.
 */

/**
 * Ways to break the configuration.
 * @type {ConfigErrorScenario[]}
 */
export const CONFIG_ERROR_SCENARIOS = [
  {
    name: 'fields',
    label: 'Collection and field errors',
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: (config) => ({ ...config, collections: [...config.collections, ...BROKEN_COLLECTIONS] }),
  },
  {
    name: 'site',
    label: 'Backend, media, publishing, slug and i18n errors',
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: ({ media_folder: _mediaFolder, ...config }) => ({
      ...config,
      backend: { name: 'github' },
      site_url: 'example.com',
      publish_mode: 'invalid',
      public_folder: 'https://example.com/uploads',
      slug: { encoding: 'ascii', sanitize_replacement: '/' },
      i18n: { structure: 'multiple_files', locales: ['en'], default_locale: 'xx' },
    }),
  },
  {
    name: 'field-options',
    label: 'Field defaults, List keys, Compute and Relation fields',
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: (config) => ({ ...config, collections: [...config.collections, BROKEN_FIELD_OPTIONS] }),
  },
  {
    name: 'views',
    label: 'List views: filters, groups, sorting and bulk editing',
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: (config) => ({ ...config, collections: [...config.collections, BROKEN_VIEWS] }),
  },
  {
    name: 'i18n',
    label: 'Internationalization',
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: (config) => ({
      ...config,
      i18n: {
        structure: 'multiple_files',
        locales: ['en', 'fr'],
        default_locale: 'en',
        initial_locales: ['de'],
      },
      collections: [...config.collections, ...BROKEN_I18N_COLLECTIONS],
    }),
  },
  {
    name: 'backend-media',
    label: 'Backend, authentication, media and asset collections',
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: (config) => ({
      ...config,
      backend: {
        name: 'github',
        repo: 'not-a-repository',
        auth_type: 'implicit',
        open_authoring: true,
        root_dir: '../outside',
      },
      public_folder: 'images',
      media_folder: 'static/{{year}}',
      publish_mode: 'simple',
      media_libraries: {
        default: {
          config: {
            transformations: { raster_image: { quality: 200, width: -1 }, bitmap: {} },
          },
        },
      },
      asset_collections: [
        { label: 'Nameless', media_folder: 'static/nameless' },
        { name: 'bad name', label: 'Bad Name', media_folder: 'static/bad' },
        { name: 'twice', label: 'Twice', media_folder: 'static/twice-1' },
        { name: 'twice', label: 'Twice Again', media_folder: 'static/twice-2' },
      ],
    }),
  },
  {
    name: 'no-backend',
    label: 'No backend',
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: ({ backend: _backend, ...config }) => config,
  },
  {
    name: 'deprecated-backend',
    label: 'A backend that’s no longer supported',
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: (config) => ({ ...config, backend: { name: 'git-gateway' } }),
  },
  {
    name: 'warnings',
    label: 'Warnings only: the app starts, and logs them to the console',
    warningsOnly: true,
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: (config) => ({ ...config, collections: [...config.collections, WARNING_COLLECTION] }),
  },
  {
    name: 'unsupported-backend',
    label: 'A backend Sveltia CMS doesn’t support',
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: (config) => ({
      ...config,
      backend: { name: 'bitbucket' },
      i18n: { structure: 'multiple_files', locales: [] },
    }),
  },
  {
    name: 'custom-backend',
    label: 'A custom backend',
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: (config) => ({ ...config, backend: { name: 'my-backend' } }),
  },
  {
    name: 'no-collections',
    label: 'No collections',
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: (config) => ({ ...config, collections: [], singletons: [] }),
  },
  {
    name: 'wrong-types',
    label: 'Options of the wrong type',
    // eslint-disable-next-line jsdoc/require-jsdoc
    build: (config) => ({
      ...config,
      show_preview_links: 'yes',
      collections: [
        ...config.collections,
        {
          name: 'typed',
          label: 'Typed',
          folder: 'content/typed',
          create: 'yes',
          summary: 5,
          fields: [{ name: 'title', required: 'no', i18n: 'maybe' }],
        },
      ],
    }),
  },
  {
    name: 'unparsable',
    label: 'A configuration file that isn’t valid YAML',
    raw: 'collections: [\n  - name: posts\n',
  },
  {
    name: 'missing-file',
    label: 'A configuration file that can’t be found',
    status: 404,
  },
];
