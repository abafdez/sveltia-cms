import { readFileSync } from 'fs';

import { describe, expect, test } from 'vitest';
import { parse } from 'yaml';

import { getCmsChecklist, getKeySections } from './l10n-debug-checklist.js';

/**
 * Flatten a parsed locale file into dot-separated message paths.
 * @param {Record<string, any>} messages Parsed file.
 * @param {string} [prefix] Path of the object.
 * @returns {string[]} Paths.
 */
const flattenKeys = (messages, prefix = '') =>
  Object.entries(messages).flatMap(([key, value]) =>
    typeof value === 'string' ? [prefix + key] : flattenKeys(value, `${prefix}${key}.`),
  );

describe('Test getKeySections()', () => {
  test('maps each top-level key to the section banner above it', () => {
    const content = [
      '# Intro comment',
      'before: Before',
      '# ====',
      '# First Section',
      '# ====',
      '# A comment',
      'one: One',
      'group:',
      '  nested: Nested',
      '# ====',
      '# Second Section',
      '# ====',
      'two: Two',
      '# ==== not a banner',
    ].join('\n');

    expect(getKeySections(content)).toEqual(
      new Map([
        ['before', ''],
        ['one', 'First Section'],
        ['group', 'First Section'],
        ['two', 'Second Section'],
      ]),
    );
  });
});

describe('Test getCmsChecklist()', () => {
  const keys = flattenKeys(parse(readFileSync('src/lib/locales/en-US.yaml', 'utf-8'))).sort();
  const checklist = getCmsChecklist([...keys, 'unknown_key'], 'Sveltia CMS');

  test('lists the sections in the order of the file, with every key once', () => {
    const sections = [
      ...new Set(getKeySections(readFileSync('src/lib/locales/en-US.yaml', 'utf-8')).values()),
    ];

    expect(checklist.map(({ label }) => label)).toEqual([...sections, 'Other']);
    expect(checklist.flatMap((item) => item.keys).sort()).toEqual([...keys, 'unknown_key'].sort());
    expect(checklist.at(-1)?.keys).toEqual(['unknown_key']);
  });

  test('has a hint for every section', () => {
    // A section added to `en-US.yaml` needs a hint in `l10n-debug-checklist.js`
    expect(
      checklist.filter(({ label, hint }) => label !== 'Other' && !hint).map(({ label }) => label),
    ).toEqual([]);
  });

  test('identifies the items by package and section', () => {
    expect(checklist[0]).toEqual(
      expect.objectContaining({
        id: 'Sveltia CMS:Common Actions',
        source: 'Sveltia CMS',
        group: 'Sveltia CMS',
      }),
    );
  });
});
