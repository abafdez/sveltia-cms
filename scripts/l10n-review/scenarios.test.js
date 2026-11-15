import { readFile } from 'fs/promises';
import path from 'path';

import { describe, expect, test } from 'vitest';
import { parse } from 'yaml';

import { APP_LOCALES_DIR, squashStrings } from '../vite/locales.js';
import { resolveModuleDir } from '../vite/utils.js';

import { CONFIGS, SCENARIOS } from './scenarios.js';

/**
 * Read the `en-US` message keys of the app and of Sveltia UI, the latter under `_sui`, as the app
 * merges them.
 * @returns {Promise<Set<string>>} Keys.
 */
const readSourceKeys = async () => {
  const cms = parse(await readFile(path.join(APP_LOCALES_DIR, 'en-US.yaml'), 'utf-8'));

  const ui = parse(
    await readFile(path.join(resolveModuleDir('@sveltia/ui'), 'locales/en-US.yaml'), 'utf-8'),
  );

  /** @type {Set<string>} */
  const keys = new Set();

  /**
   * Add the keys of a map.
   * @param {Record<string, any>} map Map.
   * @param {string} prefix Path of the map.
   */
  const walk = (map, prefix) => {
    Object.entries(map).forEach(([key, value]) => {
      if (value && typeof value === 'object') walk(value, `${prefix}${key}.`);
      else keys.add(`${prefix}${key}`);
    });
  };

  walk(/** @type {Record<string, any>} */ (squashStrings(cms)), '');
  walk(/** @type {Record<string, any>} */ (squashStrings(ui)), '_sui.');

  return keys;
};

describe('SCENARIOS', () => {
  test('have unique IDs', () => {
    const ids = SCENARIOS.map(({ id }) => id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  test('use configurations that exist', () => {
    SCENARIOS.forEach(({ id, boot }) => {
      expect(CONFIGS, id).toHaveProperty(boot?.config ?? 'sample');
    });
  });

  // Steps find their element by message key: a key renamed or removed upstream breaks the step
  test('only use message keys that exist in en-US', async () => {
    const keys = await readSourceKeys();

    SCENARIOS.forEach(({ id, steps = [] }) => {
      steps.forEach((step) => {
        Object.values(step).forEach((key) => {
          if (key !== 'Escape' && key !== 'Enter') {
            expect(keys.has(key), `${id}: ${key}`).toBe(true);
          }
        });
      });
    });
  });
});
