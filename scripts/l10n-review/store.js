import { createHash } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

import { MessageFormat } from 'messageformat';
import { Document, isMap, isScalar, parseDocument, Scalar } from 'yaml';

import { APP_LOCALES_DIR, squashStrings } from '../vite/locales.js';
import { resolveModuleDir } from '../vite/utils.js';

/**
 * @import { YAMLMap } from 'yaml';
 */

/**
 * A package whose strings are reviewed: Sveltia CMS itself, or Sveltia UI, whose strings the CMS
 * merges under the `_sui` key.
 * @typedef {object} StringSource
 * @property {'cms' | 'ui'} id Identifier.
 * @property {string} name Display name.
 * @property {string} prefix Prefix of the message keys in the app, e.g. `_sui.`.
 * @property {string} dir Absolute path of the directory holding the locale files.
 * @property {boolean} writable Whether translations can be saved to the files. The Sveltia UI files
 * are only writable in a checkout of the `sveltia-ui` repository, given with `SVELTIA_UI_DIR`, as
 * the installed package is overwritten by `pnpm install`.
 */

/**
 * A message found in a locale file.
 * @typedef {object} MessageEntry
 * @property {string} raw Value as written in the file, e.g. a multiline MF2 message.
 * @property {string} value Value as the app sees it, with the whitespace squashed.
 * @property {string} [comment] Comment written above the message, if any.
 */

/**
 * A message to review.
 * @typedef {object} ReviewItem
 * @property {string} key Key in the app, e.g. `save` or `_sui.close`.
 * @property {'cms' | 'ui'} source Package the message belongs to.
 * @property {string} file Path of the target locale file, relative to the current directory when
 * possible.
 * @property {boolean} writable Whether the translation can be saved.
 * @property {string} en Source text, squashed.
 * @property {string} enRaw Source text as written.
 * @property {string | undefined} value Translation, squashed, if any.
 * @property {string | undefined} raw Translation as written, if any.
 * @property {string | undefined} comment Comment from the source file.
 * @property {'missing' | 'same' | 'translated'} status Translation status.
 * @property {boolean} reviewed Whether the current pair of source text and translation has been
 * accepted.
 */

/**
 * Locale the other locales are translated from.
 */
export const SOURCE_LOCALE = 'en-US';

/**
 * Directory holding the review state, one JSON file per locale. It’s ignored by Git.
 */
const STATE_DIR = '.l10n-review';
/**
 * Options for serializing a locale file. A zero line width keeps every line as it is written: with
 * it, all the locale files of both packages survive a parse and serialize round trip unchanged.
 */
const TO_STRING_OPTIONS = { lineWidth: 0, minContentWidth: 0 };

/**
 * Serialize a locale file document.
 * @param {Document} doc Document.
 * @returns {string} File content.
 */
export const serializeDocument = (doc) => doc.toString(TO_STRING_OPTIONS);

/**
 * Create the document of a new locale file: an empty map in block style, like the other files.
 * Parsing `{}` would give a flow map, written as `{ key: value }` on one line.
 * @returns {Document} Document.
 */
export const createDocument = () => new Document({});

/**
 * Get the packages whose strings are reviewed.
 * @returns {StringSource[]} Packages.
 */
export const getSources = () => {
  const uiDir = process.env.SVELTIA_UI_DIR;

  return [
    {
      id: 'cms',
      name: 'Sveltia CMS',
      prefix: '',
      dir: path.resolve(APP_LOCALES_DIR),
      writable: true,
    },
    {
      id: 'ui',
      name: 'Sveltia UI',
      prefix: '_sui.',
      dir: uiDir
        ? path.resolve(uiDir, 'src/lib/locales')
        : path.resolve(resolveModuleDir('@sveltia/ui'), 'locales'),
      writable: !!uiDir,
    },
  ];
};

/**
 * Get the path of a locale file.
 * @param {StringSource} source Package.
 * @param {string} locale Locale code.
 * @returns {string} Absolute path.
 */
export const getLocaleFilePath = (source, locale) => path.join(source.dir, `${locale}.yaml`);

/**
 * Get a path to show the user: relative to the current directory when it’s inside it.
 * @param {string} filePath Absolute path.
 * @returns {string} Path.
 */
const toDisplayPath = (filePath) => {
  const relative = path.relative(process.cwd(), filePath);

  return relative.startsWith('..') ? filePath : relative;
};

/**
 * Read a locale file as a YAML document, which keeps the comments and the layout.
 * @param {string} filePath Path.
 * @returns {Promise<Document | undefined>} Document, or `undefined` if the file doesn’t exist.
 */
const readDocument = async (filePath) => {
  if (!existsSync(filePath)) {
    return undefined;
  }

  return parseDocument(await readFile(filePath, 'utf-8'));
};

/**
 * Get the paragraph of a comment written right above a message, leaving out the section headings
 * and notes separated from it by a blank line.
 * @param {string | null | undefined} comment Comment, as the YAML parser gives it: the lines
 * without their `#`, but with the space after it.
 * @returns {string | undefined} Paragraph, if any.
 */
const getLastParagraph = (comment) => {
  const lines = (comment ?? '').split('\n').map((line) => line.trim());
  const start = lines.lastIndexOf('') + 1;
  const paragraph = lines.slice(start).join('\n').trim();

  return paragraph || undefined;
};

/**
 * Collect the messages of a locale file, in the order they’re written.
 * @param {Document | undefined} doc Document.
 * @returns {Map<string, MessageEntry>} Messages keyed with their dot-separated path.
 */
export const collectEntries = (doc) => {
  /** @type {Map<string, MessageEntry>} */
  const entries = new Map();

  /**
   * Walk a map.
   * @param {YAMLMap} map Map.
   * @param {string} prefix Path of the map.
   */
  const walk = (map, prefix) => {
    map.items.forEach((pair, index) => {
      const { key } = /** @type {{ key: Scalar }} */ (pair);
      const keyPath = `${prefix}${String(key.value)}`;
      const comment = key.commentBefore ?? (index === 0 ? map.commentBefore : undefined);

      if (isMap(pair.value)) {
        walk(pair.value, `${keyPath}.`);
      } else if (isScalar(pair.value) && pair.value.value !== null) {
        const raw = String(pair.value.value);

        entries.set(keyPath, {
          raw,
          value: /** @type {string} */ (squashStrings(raw)),
          comment: getLastParagraph(comment),
        });
      }
    });
  };

  if (doc && isMap(doc.contents)) {
    walk(doc.contents, '');
  }

  return entries;
};

/**
 * Read the messages of a package in a locale.
 * @param {StringSource} source Package.
 * @param {string} locale Locale code.
 * @returns {Promise<Map<string, MessageEntry>>} Messages.
 */
export const readEntries = async (source, locale) =>
  collectEntries(await readDocument(getLocaleFilePath(source, locale)));

/**
 * Get a short hash of a source text and its translation, stored once the pair is accepted, so that
 * a change to either brings the message back for review.
 * @param {string} en Source text.
 * @param {string | undefined} value Translation.
 * @returns {string} Hash.
 */
export const getReviewHash = (en, value) =>
  createHash('sha1')
    .update(`${en}\0${value ?? ''}`)
    .digest('base64url')
    .slice(0, 12);

/**
 * Get the path of the review state file of a locale.
 * @param {string} locale Locale code.
 * @returns {string} Path.
 */
const getStatePath = (locale) => path.resolve(STATE_DIR, `${locale}.json`);

/**
 * Read the review state of a locale.
 * @param {string} locale Locale code.
 * @returns {Promise<Record<string, string>>} Hashes of the accepted pairs, keyed with the message
 * key.
 */
export const readReviewState = async (locale) => {
  /** @type {string} */
  let content;

  try {
    content = await readFile(getStatePath(locale), 'utf-8');
  } catch (/** @type {any} */ ex) {
    if (ex.code === 'ENOENT') {
      return {};
    }

    throw ex;
  }

  // A file that can’t be parsed is reported rather than read as empty, which the next accept would
  // write back, losing the progress it holds
  try {
    return JSON.parse(content);
  } catch (/** @type {any} */ ex) {
    throw new Error(`The review state file of ${locale} can’t be read: ${ex.message}`);
  }
};

/**
 * Get every message of both packages to review in a locale, in the order of the source files.
 * @param {string} locale Locale code.
 * @returns {Promise<ReviewItem[]>} Messages.
 */
export const getReviewItems = async (locale) => {
  const state = await readReviewState(locale);

  const lists = await Promise.all(
    getSources().map(async (source) => {
      const [enEntries, entries] = await Promise.all([
        readEntries(source, SOURCE_LOCALE),
        readEntries(source, locale),
      ]);

      const file = toDisplayPath(getLocaleFilePath(source, locale));

      return [...enEntries].map(([path_, en]) => {
        const key = `${source.prefix}${path_}`;
        const entry = entries.get(path_);
        /** @type {ReviewItem['status']} */
        const status = !entry ? 'missing' : entry.value === en.value ? 'same' : 'translated';

        return {
          key,
          source: source.id,
          file,
          writable: source.writable,
          en: en.value,
          enRaw: en.raw,
          value: entry?.value,
          raw: entry?.raw,
          comment: en.comment,
          status,
          reviewed: state[key] === getReviewHash(en.value, entry?.value),
        };
      });
    }),
  );

  return lists.flat();
};

/**
 * Last pending write, so the writes run one after another: two requests reading and writing the
 * same file at once would lose one of the changes.
 * @type {Promise<unknown>}
 */
let writeQueue = Promise.resolve();

/**
 * Run a function that reads and writes files after the writes already queued.
 * @template T
 * @param {() => Promise<T>} fn Function.
 * @returns {Promise<T>} Its result.
 */
const queueWrite = (fn) => {
  const result = writeQueue.then(fn, fn);

  writeQueue = result.catch(() => undefined);

  return result;
};

/**
 * Accept messages: store the hash of their current source text and translation.
 * @param {string} locale Locale code.
 * @param {string[]} keys Message keys.
 * @returns {Promise<number>} Number of messages accepted.
 */
export const acceptMessages = (locale, keys) =>
  queueWrite(async () => {
    const items = new Map((await getReviewItems(locale)).map((item) => [item.key, item]));
    const state = await readReviewState(locale);
    let count = 0;

    keys.forEach((key) => {
      const item = items.get(key);

      if (item) {
        state[key] = getReviewHash(item.en, item.value);
        count += 1;
      }
    });

    await mkdir(STATE_DIR, { recursive: true });
    await writeFile(getStatePath(locale), `${JSON.stringify(state, null, 2)}\n`);

    return count;
  });

/**
 * Check that a message is valid MessageFormat 2 syntax, as the app compiles it.
 * @param {string} locale Locale code.
 * @param {string} raw Message as written.
 * @returns {string | undefined} Error message, or `undefined` if the message is valid.
 */
export const validateMessage = (locale, raw) => {
  try {
    // eslint-disable-next-line no-new
    new MessageFormat(locale, /** @type {string} */ (squashStrings(raw)));

    return undefined;
  } catch (/** @type {any} */ ex) {
    return ex.message;
  }
};

/**
 * Get the keys of a map, in order.
 * @param {YAMLMap | undefined} map Map.
 * @returns {string[]} Keys.
 */
const getMapKeys = (map) =>
  map ? map.items.map((pair) => String(/** @type {Scalar} */ (pair.key).value)) : [];

/**
 * Set a message in a locale file document. An existing message keeps its place and style; a new one
 * is inserted where it is in the source file, after the closest preceding message the document
 * has, so the files keep the same order.
 * @param {object} args Arguments.
 * @param {Document} args.doc Document of the locale file.
 * @param {Document} args.sourceDoc Document of the source locale file.
 * @param {string[]} args.segments Path of the message.
 * @param {string} args.raw Message as written.
 * @throws {Error} If the file holds a group where the message goes, or isn’t a map.
 */
export const setMessage = ({ doc, sourceDoc, segments, raw }) => {
  const existing = doc.getIn(segments, true);

  if (isScalar(existing)) {
    existing.value = raw;

    // A plain or quoted scalar would fold the new lines into blank lines
    if (raw.includes('\n') && existing.type !== Scalar.BLOCK_FOLDED) {
      existing.type = Scalar.BLOCK_LITERAL;
    }

    return;
  }

  // An empty file, or one with only comments, has no map yet
  if (doc.contents === null) {
    doc.contents = /** @type {any} */ (doc.createNode({}));
  } else if (!isMap(doc.contents)) {
    throw new Error('The locale file isn’t a map of messages.');
  }

  /** @type {YAMLMap} */
  let map = /** @type {YAMLMap} */ (doc.contents);
  /** @type {YAMLMap | undefined} */
  let sourceMap = /** @type {YAMLMap} */ (sourceDoc.contents);

  segments.forEach((segment, index) => {
    const isLeaf = index === segments.length - 1;

    const found = map.items.find(
      (pair) => String(/** @type {Scalar} */ (pair.key).value) === segment,
    );

    const sourceValue = /** @type {any} */ (sourceMap?.get(segment, true));

    if (found && isLeaf) {
      // The key is there with something else than a message, e.g. a group: adding another pair
      // would duplicate the key and break the file
      throw new Error(`${segments.join('.')} isn’t a message in the file.`);
    }

    if (found) {
      if (!isMap(found.value)) {
        throw new Error(`${segments.slice(0, index + 1).join('.')} isn’t a group in the file.`);
      }

      map = found.value;
      sourceMap = isMap(sourceValue) ? sourceValue : undefined;

      return;
    }

    /** @type {any} */
    let value;

    if (isLeaf) {
      value = new Scalar(raw);

      if (raw.includes('\n')) {
        value.type = Scalar.BLOCK_LITERAL;
      }
    } else {
      value = doc.createNode({});
    }

    const sourceKeys = getMapKeys(sourceMap);
    const keys = getMapKeys(map);
    const sourceIndex = sourceKeys.indexOf(segment);

    // Index of the closest preceding key in the source file that the document has
    const previousKey = sourceKeys
      .slice(0, Math.max(sourceIndex, 0))
      .reverse()
      .find((key) => keys.includes(key));

    const insertAt =
      sourceIndex === -1 ? keys.length : previousKey ? keys.indexOf(previousKey) + 1 : 0;

    map.items.splice(insertAt, 0, doc.createPair(segment, value));

    if (!isLeaf) {
      map = value;
      sourceMap = isMap(sourceValue) ? sourceValue : undefined;
    }
  });
};

/**
 * Save a translation to its locale file, keeping the comments, layout and order of the file.
 * @param {object} args Arguments.
 * @param {string} args.locale Locale code.
 * @param {string} args.key Message key in the app, e.g. `save` or `_sui.close`.
 * @param {string} args.raw Message as written.
 * @returns {Promise<{ file: string }>} Path of the file that was written.
 * @throws {Error} If the key is unknown, the file can’t be written, or the message is invalid.
 */
export const saveMessage = ({ locale, key, raw: input }) =>
  queueWrite(async () => {
    // Trailing new lines would turn a one-line message into a block scalar, and an empty message
    // would blank the string in the app: the app trims its messages anyway
    const raw = input.trim();

    if (!raw) {
      throw new Error('The message is empty.');
    }

    if (locale === SOURCE_LOCALE) {
      throw new Error(`The source locale ${SOURCE_LOCALE} can’t be edited here.`);
    }

    const source = [...getSources()]
      .sort((a, b) => b.prefix.length - a.prefix.length)
      .find(({ prefix }) => key.startsWith(prefix));

    if (!source) {
      throw new Error(`Unknown key: ${key}`);
    }

    if (!source.writable) {
      throw new Error(
        `${source.name} strings can only be saved to a checkout of the repository: ` +
          'start the server with SVELTIA_UI_DIR set to it.',
      );
    }

    const segments = key.slice(source.prefix.length).split('.');
    const sourceDoc = await readDocument(getLocaleFilePath(source, SOURCE_LOCALE));

    if (!sourceDoc || !isScalar(sourceDoc.getIn(segments, true))) {
      throw new Error(`The key ${key} isn’t in the ${SOURCE_LOCALE} file.`);
    }

    const error = validateMessage(locale, raw);

    if (error) {
      throw new Error(`Invalid message: ${error}`);
    }

    const filePath = getLocaleFilePath(source, locale);
    const doc = (await readDocument(filePath)) ?? createDocument();

    setMessage({ doc, sourceDoc, segments, raw });
    await writeFile(filePath, serializeDocument(doc));

    return { file: toDisplayPath(filePath) };
  });

/**
 * Messages of every locale file of both packages as last read, keyed with the file path, then with
 * the message key in the app, to tell which messages a change to a file touches.
 * @type {Map<string, Map<string, string>>}
 */
const lastMessages = new Map();

/**
 * Get the messages of a locale file, keyed like the app’s and squashed.
 * @param {StringSource} source Package.
 * @param {Document | undefined} doc Document of the locale file.
 * @returns {Map<string, string>} Messages.
 */
const getFlatMessages = (source, doc) =>
  new Map([...collectEntries(doc)].map(([key, { value }]) => [`${source.prefix}${key}`, value]));

/**
 * Read every locale file of both packages, so that a later change can be compared with them.
 */
export const readAllLocaleFiles = async () => {
  await Promise.all(
    getSources().map(async (source) => {
      const names = (await readdir(source.dir)).filter((name) => name.endsWith('.yaml'));

      await Promise.all(
        names.map(async (name) => {
          const filePath = path.join(source.dir, name);

          lastMessages.set(filePath, getFlatMessages(source, await readDocument(filePath)));
        }),
      );
    }),
  );
};

/**
 * Read the messages of a locale file as the app gets them: nested and squashed. Sent to the
 * browser when the file changes, so the app updates without a reload, along with the keys of the
 * messages that changed.
 * @param {string} filePath Path of the locale file.
 * @returns {Promise<{ source: StringSource, locale: string, messages?: Record<string, any>,
 * changedKeys?: string[], error?: string } | undefined>} Messages, or an error if the file can’t be
 * parsed, e.g. while it’s being edited, or `undefined` if the file isn’t a locale file of either
 * package.
 */
export const readChangedLocaleFile = async (filePath) => {
  const absolutePath = path.resolve(filePath);
  const source = getSources().find(({ dir }) => path.dirname(absolutePath) === dir);

  if (!source || !filePath.endsWith('.yaml')) {
    return undefined;
  }

  const locale = path.basename(filePath, '.yaml');
  const doc = await readDocument(absolutePath);

  // Keep the messages last read: a parse error would send a partial set of messages
  if (doc?.errors.length) {
    return { source, locale, error: doc.errors[0].message };
  }

  const previous = lastMessages.get(absolutePath) ?? new Map();
  const current = getFlatMessages(source, doc);

  const changedKeys = [...new Set([...previous.keys(), ...current.keys()])].filter(
    (key) => previous.get(key) !== current.get(key),
  );

  lastMessages.set(absolutePath, current);

  return {
    source,
    locale,
    messages: /** @type {Record<string, any>} */ (squashStrings(doc?.toJS() ?? {})),
    changedKeys,
  };
};
