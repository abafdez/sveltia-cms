import { readFile } from 'fs/promises';
import path from 'path';

import { describe, expect, test } from 'vitest';
import { parse } from 'yaml';

import { APP_LOCALES_DIR, squashStrings } from '../vite/locales.js';
import { resolveModuleDir } from '../vite/utils.js';

import { GIT_ACTIONS, GIT_SETUPS } from './git.js';
import { CONFIGS, FILE_TYPES, SCENARIOS, STEP_TARGETS } from './scenarios.js';

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

  test('use Git setups and actions that exist', () => {
    SCENARIOS.forEach(({ id, boot, steps = [] }) => {
      if (boot?.git) {
        expect(GIT_SETUPS, id).toHaveProperty(boot.git);
      }

      steps.forEach((step) => {
        if ('git' in step) {
          expect(GIT_ACTIONS, id).toHaveProperty(step.git);
        }
      });
    });
  });

  // Steps find their element by message key: a key renamed or removed upstream breaks the step
  test('only use message keys that exist in en-US', async () => {
    const keys = await readSourceKeys();

    SCENARIOS.forEach(({ id, steps = [] }) => {
      steps.forEach((step) => {
        Object.entries(step).forEach(([type, target]) => {
          const key = typeof target === 'string' ? target : (target?.key ?? target?.in);

          if (STEP_TARGETS.includes(type) && typeof key === 'string') {
            expect(keys.has(key), `${id}: ${key}`).toBe(true);
          }
        });
      });
    });
  });
});

describe('FILE_TYPES', () => {
  test('lists every extension with a label in en-US.yaml', async () => {
    const labels = [...(await readSourceKeys())]
      .filter((key) => key.startsWith('file_type_labels.'))
      .map((key) => key.slice('file_type_labels.'.length));

    expect([...FILE_TYPES].sort()).toEqual(labels.sort());
  });
});
