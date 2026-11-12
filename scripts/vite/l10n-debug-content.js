import {
  COLLECTION_OPTIONS_CONFIG,
  COLLECTION_OPTIONS_FILES,
} from '../../e2e/fixtures/configs/collection-options.js';
import { FIELD_TYPES_CONFIG, FIELD_TYPES_FILES } from '../../e2e/fixtures/configs/field-types.js';
import { MEDIA_CONFIG, MEDIA_FILES } from '../../e2e/fixtures/configs/media.js';
import { MONOLINGUAL_CONFIG, MONOLINGUAL_FILES } from '../../e2e/fixtures/configs/monolingual.js';
import {
  MULTILINGUAL_CONFIG,
  MULTILINGUAL_FILES,
} from '../../e2e/fixtures/configs/multilingual.js';
import { NESTED_CONFIG, NESTED_FILES } from '../../e2e/fixtures/configs/nested.js';

/**
 * Sample sites of the end-to-end tests, merged into the one the localization debugging overlay
 * serves, in order of precedence. Together they use most field types, every i18n structure, media
 * folders, nested entries and the options that restrict or shape editing, so most of the UI can
 * be reached.
 */
const FIXTURES = [
  { config: MONOLINGUAL_CONFIG, files: MONOLINGUAL_FILES },
  { config: MULTILINGUAL_CONFIG, files: MULTILINGUAL_FILES },
  { config: FIELD_TYPES_CONFIG, files: FIELD_TYPES_FILES },
  { config: MEDIA_CONFIG, files: MEDIA_FILES },
  { config: NESTED_CONFIG, files: NESTED_FILES },
  { config: COLLECTION_OPTIONS_CONFIG, files: COLLECTION_OPTIONS_FILES },
];

/**
 * Options added to collections of the sample site, keyed with the collection name, to reach parts
 * of the UI that none of the fixtures uses.
 *
 * NOTE: Bulk editing and the table view aren’t covered by the end-to-end tests yet. If they come to
 * be, add these options to `FIELD_TYPES_CONFIG` in `e2e/fixtures/configs/field-types.js` instead
 * and remove them from here, so the sample site and the tests share one definition.
 */
const COLLECTION_OVERRIDES = {
  venues: { bulk_edit: true, table_columns: ['name', 'city'] },
};

/**
 * Merge the given lists of collections or singletons, keeping the first of those with the same
 * name. Dividers, which have no name, are all kept.
 * @param {Record<string, any>[][]} lists Lists.
 * @returns {Record<string, any>[]} Merged list.
 */
const mergeByName = (lists) => {
  /** @type {Set<string>} */
  const names = new Set();

  return lists.flat().filter(({ name }) => {
    if (!name) {
      return true;
    }

    if (names.has(name)) {
      return false;
    }

    names.add(name);

    return true;
  });
};

/**
 * Build the sample site: the merged configuration and files of the end-to-end test fixtures. A
 * collection or singleton whose name is already taken by an earlier fixture is left out, and so is
 * a file whose path is taken, so the earlier fixtures stay intact. The top-level options are those
 * of the first fixture, plus the `i18n` option of the multilingual one. A few collections get extra
 * options, see {@link COLLECTION_OVERRIDES}.
 * @returns {{ config: Record<string, any>, files: Record<string, string | Uint8Array> }} Site.
 */
export const getSampleSite = () => {
  const [{ config: first }] = FIXTURES;

  const config = {
    ...first,
    i18n: MULTILINGUAL_CONFIG.i18n,
    collections: mergeByName(FIXTURES.map(({ config: c }) => c.collections ?? [])).map(
      (collection) => ({
        ...collection,
        .../** @type {Record<string, object>} */ (COLLECTION_OVERRIDES)[collection.name],
      }),
    ),
    singletons: mergeByName(FIXTURES.map(({ config: c }) => c.singletons ?? [])),
  };

  /** @type {Record<string, string | Uint8Array>} */
  const files = {};

  FIXTURES.forEach(({ files: fixtureFiles }) => {
    Object.entries(fixtureFiles).forEach(([path, content]) => {
      files[path] ??= content;
    });
  });

  return { config, files };
};
