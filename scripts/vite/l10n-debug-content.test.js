import { describe, expect, test } from 'vitest';

import { getSampleSite } from './l10n-debug-content.js';

describe('Test getSampleSite()', () => {
  const { config, files } = getSampleSite();
  const names = config.collections.filter(({ name }) => name).map(({ name }) => name);

  test('keeps one collection and singleton of each name', () => {
    expect(new Set(names).size).toBe(names.length);
    expect(config.singletons.map(({ name }) => name)).toEqual(['settings']);
    expect(names).toEqual(expect.arrayContaining(['posts', 'articles', 'events', 'docs', 'faqs']));
    // The first fixture wins: the monolingual posts, not the media ones
    expect(config.collections.find(({ name }) => name === 'posts').folder).toBe('content/posts');
    expect(config.collections.find(({ name }) => name === 'posts').media_folder).toBeUndefined();
  });

  test('keeps the dividers', () => {
    expect(config.collections.some(({ divider }) => divider)).toBe(true);
  });

  test('uses the test repository and enables i18n', () => {
    expect(config.backend).toEqual({ name: 'test-repo' });
    expect(config.i18n.locales).toEqual(expect.arrayContaining(['en', 'fr', 'ar']));
  });

  test('refers only to collections it has', () => {
    /**
     * Collect the collections the Relation fields refer to.
     * @param {any[]} fields Fields.
     * @returns {string[]} Collection names.
     */
    const getTargets = (fields = []) =>
      fields.flatMap((field) => [
        ...(field.widget === 'relation' ? [field.collection] : []),
        ...getTargets(field.fields),
        ...(field.types ?? []).flatMap((/** @type {any} */ type) => getTargets(type.fields)),
      ]);

    const targets = [
      ...config.collections.flatMap((collection) => [
        ...getTargets(collection.fields),
        ...(collection.files ?? []).flatMap((/** @type {any} */ file) => getTargets(file.fields)),
      ]),
      ...config.singletons.flatMap((singleton) => getTargets(singleton.fields)),
    ];

    expect(targets.length).toBeGreaterThan(0);
    expect(targets.filter((target) => !names.includes(target))).toEqual([]);
  });

  test('adds the options none of the fixtures uses', () => {
    expect(config.collections.find(({ name }) => name === 'venues')).toEqual(
      expect.objectContaining({ bulk_edit: true, table_columns: ['name', 'city'] }),
    );
  });

  test('merges the files, keeping those of the earlier fixtures', () => {
    expect(files['content/posts/2026-01-first-light.md']).toContain('First Light');
    expect(files['content/articles/lyon.fr.md']).toBeDefined();
    expect(files['static/uploads/sunset.png']).toBeInstanceOf(Uint8Array);
    // Both the monolingual and the multilingual fixtures have this file
    expect(files['data/settings.json']).toBeDefined();
  });

  test('has only paths the seeding accepts', () => {
    expect(
      Object.keys(files).filter((path) =>
        path.split('/').some((segment) => !segment || segment === '.' || segment === '..'),
      ),
    ).toEqual([]);
  });
});
