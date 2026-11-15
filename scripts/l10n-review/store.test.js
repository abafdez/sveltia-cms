// cspell:ignore Guardar Varios Último
import { readdir, readFile } from 'fs/promises';
import path from 'path';

import { describe, expect, test } from 'vitest';
import { parseDocument } from 'yaml';

import { APP_LOCALES_DIR } from '../vite/locales.js';

import {
  collectEntries,
  createDocument,
  getReviewHash,
  parseComment,
  serializeDocument,
  setMessage,
  validateMessage,
} from './store.js';

const SOURCE = `# Read the README
# ======
# Section One
# ======
# What the section is about.

# Group heading
first: First
# Note on the second message
second: Second
group:
  # Note on a nested message
  # on two lines
  one: One
  two: Two

# Other group
last: Last
`;

describe('parseComment()', () => {
  test('reads a section title between rules and leaves out its description', () => {
    expect(parseComment(' ===\n Section\n ===\n About it.\n')).toEqual({ section: 'Section' });
  });

  test('reads a group heading after a blank line, and a note on the next lines', () => {
    expect(parseComment(' Intro\n\n Heading')).toEqual({ group: 'Heading', note: undefined });
    expect(parseComment(' Heading\n {$x} is a name', true)).toEqual({
      group: 'Heading',
      note: '{$x} is a name',
    });
    expect(parseComment(' Heading\n')).toEqual({ group: 'Heading', note: undefined });
  });

  test('reads a note right above a key', () => {
    expect(parseComment(' A note\n on two lines')).toEqual({ note: 'A note\non two lines' });
  });

  test('returns nothing without a comment', () => {
    expect(parseComment(undefined)).toEqual({});
  });
});

describe('collectEntries()', () => {
  test('flattens nested keys, with their section, group and note', () => {
    const entries = collectEntries(parseDocument(SOURCE));

    expect([...entries.keys()]).toEqual(['first', 'second', 'group.one', 'group.two', 'last']);
    expect(entries.get('first')).toMatchObject({ section: 'Section One', group: 'Group heading' });
    expect(entries.get('first')?.comment).toBeUndefined();
    expect(entries.get('second')).toMatchObject({
      group: 'Group heading',
      comment: 'Note on the second message',
    });
    expect(entries.get('group.one')?.comment).toBe('Note on a nested message\non two lines');
    expect(entries.get('group.two')?.comment).toBeUndefined();
    expect(entries.get('last')).toMatchObject({ section: 'Section One', group: 'Other group' });
  });

  test('applies a group heading inside a nested map only inside it', () => {
    const entries = collectEntries(
      parseDocument('first: First\n\n# Outer\nmap:\n  a: A\n\n  # Inner\n  b: B\nnext: Next\n'),
    );

    expect(entries.get('map.b')?.group).toBe('Inner');
    expect(entries.get('next')?.group).toBe('Outer');
  });

  test('squashes the whitespace of multiline values as the app does', () => {
    const entries = collectEntries(parseDocument('key: |\n  One\n  two\n'));

    expect(entries.get('key')?.raw).toBe('One\ntwo\n');
    expect(entries.get('key')?.value).not.toContain('\n');
  });

  test('returns nothing for a missing file', () => {
    expect(collectEntries(undefined).size).toBe(0);
  });
});

describe('getReviewHash()', () => {
  test('is stable and changes with the source text or the translation', () => {
    const hash = getReviewHash('Save', 'Guardar');

    expect(hash).toHaveLength(12);
    expect(getReviewHash('Save', 'Guardar')).toBe(hash);
    expect(getReviewHash('Save!', 'Guardar')).not.toBe(hash);
    expect(getReviewHash('Save', 'Guardar!')).not.toBe(hash);
    expect(getReviewHash('Save', undefined)).toBe(getReviewHash('Save', ''));
  });

  test('doesn’t confuse the source text with the translation', () => {
    expect(getReviewHash('ab', 'c')).not.toBe(getReviewHash('a', 'bc'));
  });
});

describe('validateMessage()', () => {
  test('accepts valid MessageFormat 2 messages', () => {
    expect(validateMessage('es', 'Guardar')).toBeUndefined();
    expect(
      validateMessage('es', '.input {$count :number}\n.match $count\none {{Uno}}\n* {{Varios}}'),
    ).toBeUndefined();
  });

  test('reports invalid syntax', () => {
    expect(validateMessage('es', 'Hola {$name')).toEqual(expect.any(String));
  });
});

describe('setMessage()', () => {
  const sourceDoc = parseDocument(SOURCE);

  /**
   * Set a message in a document and serialize it.
   * @param {string} content Locale file content, empty for a new file.
   * @param {string[]} segments Path of the message.
   * @param {string} raw Message.
   * @returns {string} New content.
   */
  const set = (content, segments, raw) => {
    const doc = content ? parseDocument(content) : createDocument();

    setMessage({ doc, sourceDoc, segments, raw });

    return serializeDocument(doc);
  };

  test('changes an existing message in place, keeping the comments', () => {
    expect(set('# Note\nfirst: Primero\nlast: Último\n', ['first'], 'Uno')).toBe(
      '# Note\nfirst: Uno\nlast: Último\n',
    );
  });

  test('inserts a new message after the closest preceding one of the source file', () => {
    expect(set('first: Primero\nlast: Último\n', ['group', 'two'], 'Dos')).toBe(
      'first: Primero\ngroup:\n  two: Dos\nlast: Último\n',
    );
    expect(set('group:\n  one: Uno\n', ['group', 'two'], 'Dos')).toBe(
      'group:\n  one: Uno\n  two: Dos\n',
    );
  });

  test('inserts a message with no preceding one first', () => {
    expect(set('last: Último\n', ['first'], 'Primero')).toBe('first: Primero\nlast: Último\n');
  });

  test('writes a new file in block style, and a multiline message as a literal block', () => {
    expect(set('', ['first'], 'One\ntwo')).toBe('first: |-\n  One\n  two\n');
    expect(set('', ['group', 'one'], 'Uno')).toBe('group:\n  one: Uno\n');
  });

  test('writes an existing message made multiline as a literal block', () => {
    expect(set('first: Primero\n', ['first'], 'Uno\ndos')).toBe('first: |-\n  Uno\n  dos\n');
  });

  test('adds a message to an existing file with only comments', () => {
    expect(set('# Note\n', ['first'], 'Primero')).toBe('# Note\n\nfirst: Primero\n');
  });

  test('refuses to duplicate a key holding a group where the source has a message', () => {
    expect(() => set('first:\n  x: y\n', ['first'], 'Primero')).toThrow(/isn’t a message/);
    expect(set('first: Primero\n', ['first'], 'Uno')).toBe('first: Uno\n');
  });
});

describe('serializeDocument()', () => {
  test('leaves every locale file of the app unchanged after a round trip', async () => {
    const names = (await readdir(APP_LOCALES_DIR)).filter((name) => name.endsWith('.yaml'));

    expect(names.length).toBeGreaterThan(1);

    await Promise.all(
      names.map(async (name) => {
        const content = await readFile(path.join(APP_LOCALES_DIR, name), 'utf-8');

        expect(serializeDocument(parseDocument(content)), name).toBe(content);
      }),
    );
  });
});
