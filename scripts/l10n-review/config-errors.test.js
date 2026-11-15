import { describe, expect, test } from 'vitest';

import { parseCmsConfig } from '$lib/services/config/parser';
import { getConfigSchemas, validateConfigSchema } from '$lib/services/config/schema';
import { normalizeConfigTemplates } from '$lib/services/config/templates';

import { CONFIG_ERROR_SCENARIOS } from './config-errors.js';
import { FALLBACK_CONFIG, hasDemo, readBaseConfig } from './site.js';

/**
 * Validate a configuration the way the CMS does when it loads one.
 * @param {Record<string, any>} config Raw configuration.
 * @returns {{ errors: string[], warnings: string[] }} Error and warning messages.
 */
const validate = (config) => {
  /** @type {any} */
  const collectors = {
    errors: new Set(),
    warnings: new Set(),
    mediaFields: new Set(),
    relationFields: new Set(),
    formatLocales: new Set(),
  };

  const normalized = /** @type {any} */ (normalizeConfigTemplates(structuredClone(config)));

  validateConfigSchema({ config: normalized, schemas: getConfigSchemas(), collectors });
  parseCmsConfig(normalized, collectors);

  return { errors: [...collectors.errors], warnings: [...collectors.warnings] };
};

/**
 * Sample site configurations the scenarios break: the fallback one, and the demo site’s when its
 * checkout is there.
 * @type {[string, Record<string, any>][]}
 */
const BASES = [
  ['fallback', FALLBACK_CONFIG],
  ...(hasDemo()
    ? [/** @type {[string, Record<string, any>]} */ (['demo', await readBaseConfig('/site')])]
    : []),
];

describe.each(BASES)('CONFIG_ERROR_SCENARIOS with the %s configuration', (_name, base) => {
  // The review tool points the site URL to its own server
  const config = { ...base, site_url: 'http://localhost:5173' };

  test('the configuration itself has no errors', () => {
    expect(validate(config).errors).toEqual([]);
  });

  test.each(CONFIG_ERROR_SCENARIOS.filter(({ build }) => build).map((s) => [s.name, s]))(
    'the %s scenario shows errors',
    (_scenarioName, scenario) => {
      const { errors } = validate(/** @type {any} */ (scenario).build(config));

      expect(errors.length).toBeGreaterThan(0);
    },
  );
});

describe('CONFIG_ERROR_SCENARIOS', () => {
  test('have unique names and one source each', () => {
    const names = CONFIG_ERROR_SCENARIOS.map(({ name }) => name);

    expect(new Set(names).size).toBe(names.length);
    CONFIG_ERROR_SCENARIOS.forEach(({ build, raw, status }) => {
      expect([build, raw, status].filter((value) => value !== undefined)).toHaveLength(1);
    });
  });
});
