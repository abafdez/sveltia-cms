import { describe, expect, test } from 'vitest';

import { encodeKey, hasMarker, splitMarkedText, stripMarkers } from './markers.js';

describe('encodeKey()', () => {
  test('spells the key with invisible tag characters', () => {
    const marker = encodeKey('save');

    expect([...marker]).toHaveLength(6);
    expect(marker.codePointAt(0)).toBe(0xe0001);
    expect(marker.codePointAt(marker.length - 2)).toBe(0xe007f);
    expect(stripMarkers(marker)).toBe('');
  });

  test('leaves out characters a tag can’t spell', () => {
    expect(encodeKey('a\nb')).toBe(encodeKey('ab'));
  });
});

describe('hasMarker()', () => {
  test('tells whether a text has a marker', () => {
    expect(hasMarker(`${encodeKey('save')}Save`)).toBe(true);
    expect(hasMarker('Save')).toBe(false);
    expect(hasMarker(null)).toBe(false);
    expect(hasMarker(undefined)).toBe(false);
  });
});

describe('splitMarkedText()', () => {
  test('returns nothing for text without markers', () => {
    expect(splitMarkedText('Save')).toEqual([]);
  });

  test('finds the key and text of one message', () => {
    expect(splitMarkedText(`${encodeKey('save')}Save`)).toEqual([{ key: 'save', text: 'Save' }]);
  });

  test('splits several messages and keeps keys with dots and underscores', () => {
    const text = `Before ${encodeKey('_sui.close')}Close ${encodeKey('x_entries')}3 entries`;

    expect(splitMarkedText(text)).toEqual([
      { key: '_sui.close', text: 'Close' },
      { key: 'x_entries', text: '3 entries' },
    ]);
  });

  test('takes the text of a nested message out of its parent’s', () => {
    const text = `${encodeKey('outer')}Hello ${encodeKey('inner')}world`;

    expect(splitMarkedText(text).map(({ text: value }) => value)).toEqual(['Hello', 'world']);
  });
});

describe('stripMarkers()', () => {
  test('removes every marker and keeps the text', () => {
    expect(stripMarkers(`${encodeKey('a')}One, ${encodeKey('b')}two`)).toBe('One, two');
  });
});
