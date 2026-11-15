/**
 * Review page: shows each scenario live in the source and target locales side by side, lists the
 * messages on the screen that need review, and lets the translator accept them with Enter or edit
 * one in place. Saving writes the locale file, and the frames update without reloading.
 */

import { MessageFormat } from 'messageformat';

/**
 * @import { ReviewItem } from '../store.js';
 * @import { Scenario } from '../scenarios.js';
 */

/**
 * A message found on a screen, as reported by a frame.
 * @typedef {object} ScreenString
 * @property {string} key Message key.
 * @property {string} text Text shown.
 * @property {'text' | 'hidden' | 'attr' | 'title'} kind Where it is.
 * @property {string} [attr] Attribute name.
 * @property {{ x: number, y: number }} [rect] Position.
 */

/**
 * An app frame.
 * @typedef {object} AppFrame
 * @property {string} id Identifier, e.g. `target-1`.
 * @property {string} locale Locale shown.
 * @property {HTMLIFrameElement} element Frame element.
 * @property {string} [bootKey] Start options the app runs with.
 * @property {string} [pendingKey] Start options the app is starting with.
 * @property {Promise<number>} [pending] Promise resolved once the app has started.
 * @property {ScreenString[]} strings Messages on the screen.
 * @property {number} [scale] Scale the frame is shown at.
 */

/**
 * A pair of app frames, one per locale. There are two pairs: one shows the current screen, and the
 * other, hidden, starts the app the next screen needs while the translator reviews this one, so a
 * screen needing a fresh start shows without waiting for it.
 * @typedef {{ source: AppFrame, target: AppFrame }} FramePair
 */

/**
 * A card listing strings no screen shows, from one section of the source file.
 * @typedef {object} Card
 * @property {string} section Section title.
 * @property {string[]} keys Message keys.
 */

/**
 * Width of the app in the frames, in CSS pixels. The frames are scaled down to fit, so the app has
 * its desktop layout however narrow the panes are.
 */
const APP_WIDTH = 1280;
/**
 * Sample values for the numeric variables of a message, chosen to hit the plural categories of most
 * languages.
 */
const SAMPLE_NUMBERS = [0, 1, 2, 5, 21];
/**
 * Get an element of the page.
 * @param {string} selector Selector.
 * @returns {HTMLElement} Element.
 */
const $ = (selector) => /** @type {HTMLElement} */ (document.querySelector(selector));

document.body.innerHTML = `
  <header>
    <h1>Localization Review</h1>
    <select id="locale" aria-label="Locale"></select>
    <nav>
      <button id="prev" title="Previous screen (←)">←</button>
      <span id="position"></span>
      <button id="next" title="Next screen (→)">→</button>
    </nav>
    <strong id="title"></strong>
    <span id="timing"></span>
    <span id="progress"></span>
    <div class="view">
      <button id="swap" title="Switch between the original and the translation (T)"></button>
      <button id="layout" aria-pressed="false" title="Show one pane at a time (V)">One pane</button>
      <button id="aside-toggle" aria-pressed="true" title="Show the hidden text panel (H)">
        Hidden text
      </button>
    </div>
  </header>
  <main>
    <section class="pane" id="source-pane">
      <h2 id="source-label"></h2>
      <div class="viewport" id="source"></div>
    </section>
    <div class="resizer col" id="split-resizer" title="Drag to resize, double-click to reset"></div>
    <section class="pane" id="target-pane">
      <h2 id="target-label"></h2>
      <div class="viewport" id="target"></div>
    </section>
    <div class="resizer col" id="aside-resizer" title="Drag to resize, double-click to reset"></div>
    <aside>
      <h2>Hidden text</h2>
      <ul id="hidden"></ul>
    </aside>
    <section id="card-view" aria-label="Strings not on a screen"></section>
  </main>
  <div class="resizer row" id="footer-resizer" title="Drag to resize, double-click to reset"></div>
  <footer>
    <div id="status" role="status"></div>
    <div class="list">
      <table id="strings">
        <colgroup>
          <col data-col="n" /><col data-col="key" /><col data-col="en" /><col data-col="value" />
          <col data-col="done" />
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th>Key<span class="col-resizer" data-col="key"></span></th>
            <th>English<span class="col-resizer" data-col="en"></span></th>
            <th>Translation<span class="col-resizer" data-col="value"></span></th>
            <th></th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
    <div id="editor" hidden></div>
    <p class="help">
      <kbd>←</kbd><kbd>→</kbd> screens (leaving one accepts it) ·
      <kbd>↑</kbd><kbd>↓</kbd> select ·
      <kbd>Enter</kbd> edit ·
      <kbd>V</kbd> one pane ·
      <kbd>T</kbd> original or translation ·
      <kbd>H</kbd> hidden text panel ·
      <kbd>Alt</kbd>+click a string in a pane to select it ·
      drag the panel edges to resize
    </p>
  </footer>
`;

const state = {
  /** @type {string} */
  locale: '',
  /** @type {string} */
  sourceLocale: 'en-US',
  /** @type {Map<string, ReviewItem>} */
  items: new Map(),
  /** @type {Scenario[]} */
  scenarios: [],
  index: 0,
  /**
   * Keys on the current screen, in reading order, visible ones first.
   * @type {string[]}
   */
  keys: [],
  /** @type {string | undefined} */
  selected: undefined,
  editing: false,
  /**
   * Keys seen on any screen so far.
   * @type {Set<string>}
   */
  seen: new Set(),
  running: false,
  /**
   * Whether the demo site checkout was found, and where it was looked for.
   * @type {{ found: boolean, dir: string }}
   */
  demo: { found: false, dir: '' },
  /**
   * Keys each scenario showed when it last ran, from any review or `pnpm l10n:coverage`.
   * @type {Record<string, { keys: string[], error?: string }>}
   */
  coverage: {},
  /**
   * Cards for the strings no screen shows, after the screens.
   * @type {Card[]}
   */
  cards: [],
  /**
   * Why the last screen opened didn’t show properly, if it didn’t.
   * @type {string | undefined}
   */
  lastError: undefined,
};

/**
 * Whether the page runs every screen for `pnpm l10n:coverage` instead of a review.
 */
const CHECK_MODE = new URLSearchParams(window.location.search).has('check');
/**
 * Key the view settings are remembered under, in this browser only.
 */
const VIEW_STORAGE_KEY = 'l10n-review:view';
/**
 * Below this width, the page shows one pane at a time, unless the reviewer chose otherwise.
 */
const narrowQuery = window.matchMedia('(max-width: 1199px)');

/**
 * View settings: one pane or two (`undefined` follows the window width), which pane shows when
 * there’s one, and whether the hidden text panel shows.
 * @type {{ single?: boolean, showSource: boolean, aside: boolean }}
 */
const view = (() => {
  try {
    const { single, aside } = JSON.parse(localStorage.getItem(VIEW_STORAGE_KEY) ?? '{}');

    return {
      single: typeof single === 'boolean' ? single : undefined,
      showSource: false,
      aside: aside !== false,
    };
  } catch {
    return { single: undefined, showSource: false, aside: true };
  }
})();

/**
 * Check whether the page shows one pane at a time.
 * @returns {boolean} Result.
 */
const isSingle = () => view.single ?? narrowQuery.matches;

/**
 * Apply the view settings to the page, and remember them.
 */
const applyView = () => {
  const single = isSingle();

  document.body.classList.toggle('single', single);
  document.body.classList.toggle('no-aside', !view.aside);
  $('#source')
    .closest('.pane')
    ?.classList.toggle('off', single && !view.showSource);
  $('#target')
    .closest('.pane')
    ?.classList.toggle('off', single && view.showSource);
  $('#swap').hidden = !single;
  $('#swap').textContent = `Showing ${view.showSource ? state.sourceLocale : state.locale}`;
  $('#layout').setAttribute('aria-pressed', String(single));
  $('#aside-toggle').setAttribute('aria-pressed', String(view.aside));

  try {
    localStorage.setItem(
      VIEW_STORAGE_KEY,
      JSON.stringify({ single: view.single, aside: view.aside }),
    );
  } catch {
    // Storage may be unavailable; the settings then last until the page is reloaded
  }
};

narrowQuery.addEventListener('change', applyView);

/**
 * Key the panel sizes are remembered under, in this browser only.
 */
const SIZES_STORAGE_KEY = 'l10n-review:sizes';

/**
 * Panel sizes set by dragging their edges: the share of the original pane, the width of the
 * hidden text panel and the height of the list, in pixels. Unset ones keep the default.
 * @type {{ sourceShare?: number, asideWidth?: number, footerHeight?: number }}
 */
const sizes = (() => {
  try {
    return JSON.parse(localStorage.getItem(SIZES_STORAGE_KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
})();

/**
 * Apply the panel sizes to the page, as custom properties the grid templates use.
 */
const applySizes = () => {
  const { style } = document.body;
  const { sourceShare, asideWidth, footerHeight } = sizes;

  /**
   * Set or remove a custom property.
   * @param {string} name Property name.
   * @param {string | undefined} value Value.
   */
  const set = (name, value) => {
    if (value === undefined) style.removeProperty(name);
    else style.setProperty(name, value);
  };

  set('--source-share', sourceShare === undefined ? undefined : `${sourceShare}fr`);
  set('--target-share', sourceShare === undefined ? undefined : `${1 - sourceShare}fr`);
  set('--aside-width', asideWidth === undefined ? undefined : `${asideWidth}px`);
  set('--footer-height', footerHeight === undefined ? undefined : `${footerHeight}px`);
};

/**
 * Clamp a number.
 * @param {number} value Number.
 * @param {number} min Minimum.
 * @param {number} max Maximum.
 * @returns {number} Number.
 */
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * Follow a drag from a pointer press on a handle until it’s released.
 * @param {HTMLElement} handle Handle pressed.
 * @param {PointerEvent} event Pointer press.
 * @param {(event: PointerEvent) => void} onMove Called as the pointer moves.
 * @param {() => void} onEnd Called once the pointer is released.
 */
const trackDrag = (handle, event, onMove, onEnd) => {
  event.preventDefault();
  // The frames would take the pointer events when the pointer moves over them
  handle.setPointerCapture(event.pointerId);
  handle.classList.add('active');
  document.body.classList.add('resizing');

  /**
   * Stop following the drag.
   */
  const end = () => {
    handle.removeEventListener('pointermove', onMove);
    handle.classList.remove('active');
    document.body.classList.remove('resizing');
    onEnd();
  };

  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', end, { once: true });
  handle.addEventListener('pointercancel', end, { once: true });
};

/**
 * Let a panel edge be dragged to resize the panels, and double-clicked to reset them.
 * @param {string} selector Selector of the edge.
 * @param {'sourceShare' | 'asideWidth' | 'footerHeight'} size Size it changes.
 * @param {(event: PointerEvent) => number} measure Get the size from the pointer position.
 */
const makeResizable = (selector, size, measure) => {
  const handle = $(selector);

  /**
   * Remember the sizes.
   */
  const save = () => {
    try {
      localStorage.setItem(SIZES_STORAGE_KEY, JSON.stringify(sizes));
    } catch {
      // Storage may be unavailable; the sizes then last until the page is reloaded
    }
  };

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;

    trackDrag(
      handle,
      event,
      (moveEvent) => {
        sizes[size] = measure(moveEvent);
        applySizes();
      },
      save,
    );
  });

  handle.addEventListener('dblclick', () => {
    delete sizes[size];
    applySizes();
    save();
  });
};

makeResizable('#split-resizer', 'sourceShare', ({ clientX }) => {
  const { left } = $('#source-pane').getBoundingClientRect();
  const { right } = $('#target-pane').getBoundingClientRect();

  return clamp((clientX - left) / (right - left), 0.15, 0.85);
});
makeResizable('#aside-resizer', 'asideWidth', ({ clientX }) => {
  const main = $('main').getBoundingClientRect();

  return Math.round(clamp(main.right - 8 - clientX - 4, 160, main.width * 0.6));
});
makeResizable('#footer-resizer', 'footerHeight', ({ clientY }) =>
  Math.round(clamp(window.innerHeight - clientY - 4, 120, window.innerHeight - 200)),
);
applySizes();

/**
 * Key the list column widths are remembered under, in this browser only.
 */
const COLUMNS_STORAGE_KEY = 'l10n-review:columns';
/**
 * Narrowest a text column of the list gets.
 */
const MIN_COLUMN_WIDTH = 60;
/**
 * Text columns of the list, which share the width; the others fit their content.
 */
const TEXT_COLUMNS = ['key', 'en', 'value'];

/**
 * List column widths set by dragging their edges, in pixels.
 * @type {Record<string, number>}
 */
const columnWidths = (() => {
  try {
    return JSON.parse(localStorage.getItem(COLUMNS_STORAGE_KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
})();

/**
 * Size the list columns. Each one is as wide as its longest text on one line, if they all fit.
 * Otherwise the narrow ones keep their width and the wide ones share the rest, wrapping their
 * text. Space left over goes to the translation. A width set by dragging stays as set.
 */
const layoutColumns = () => {
  const table = $('#strings');
  const cols = /** @type {HTMLElement[]} */ ([...table.querySelectorAll('col')]);
  const names = cols.map((col) => /** @type {string} */ (col.dataset.col));

  // Measure the width each column needs to show its text on one line
  cols.forEach((col) => {
    col.style.width = '';
  });
  table.classList.add('measuring');

  const needed = [...table.querySelectorAll('thead th')].map(
    (th) => Math.ceil(th.getBoundingClientRect().width) + 1,
  );

  table.classList.remove('measuring');

  /**
   * Check whether a column shares the width: a text column whose width wasn’t set by dragging.
   * @param {number} index Column index.
   * @returns {boolean} Result.
   */
  const isOpen = (index) =>
    TEXT_COLUMNS.includes(names[index]) && columnWidths[names[index]] === undefined;

  const widths = names.map((name, index) => columnWidths[name] ?? needed[index]);
  const open = names.map((_name, index) => index).filter(isOpen);

  let remaining =
    $('footer .list').clientWidth -
    widths.reduce((sum, width, index) => sum + (isOpen(index) ? 0 : width), 0);

  [...open]
    .sort((a, b) => needed[a] - needed[b])
    .forEach((index, order, sorted) => {
      const share = remaining / (sorted.length - order);

      widths[index] = Math.max(MIN_COLUMN_WIDTH, Math.min(needed[index], share));
      remaining -= widths[index];
    });

  const last = open.includes(names.indexOf('value')) ? names.indexOf('value') : open.at(-1);

  if (remaining > 0 && last !== undefined) {
    widths[last] += remaining;
  }

  cols.forEach((col, index) => {
    col.style.width = `${widths[index]}px`;
  });
  table.style.width = `${widths.reduce((sum, width) => sum + width, 0)}px`;
};

/**
 * Remember the list column widths.
 */
const saveColumnWidths = () => {
  try {
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(columnWidths));
  } catch {
    // Storage may be unavailable; the widths then last until the page is reloaded
  }
};

$('#strings thead').addEventListener('pointerdown', (event) => {
  const handle = /** @type {HTMLElement | null} */ (
    /** @type {HTMLElement} */ (event.target).closest('.col-resizer')
  );

  if (!handle || event.button !== 0) return;

  const name = /** @type {string} */ (handle.dataset.col);
  const startX = event.clientX;

  const startWidth = /** @type {HTMLElement} */ (handle.parentElement).getBoundingClientRect()
    .width;

  trackDrag(
    handle,
    event,
    ({ clientX }) => {
      columnWidths[name] = Math.round(Math.max(MIN_COLUMN_WIDTH, startWidth + clientX - startX));
      layoutColumns();
    },
    saveColumnWidths,
  );
});

$('#strings thead').addEventListener('dblclick', (event) => {
  const handle = /** @type {HTMLElement} */ (event.target).closest('.col-resizer');

  if (handle instanceof HTMLElement && handle.dataset.col) {
    delete columnWidths[handle.dataset.col];
    layoutColumns();
    saveColumnWidths();
  }
});

new ResizeObserver(() => layoutColumns()).observe($('footer .list'));

/**
 * Create a pair of app frames.
 * @param {number} index Index of the pair.
 * @returns {FramePair} Pair.
 */
const createPair = (index) => ({
  source: {
    id: `source-${index}`,
    locale: 'en-US',
    element: document.createElement('iframe'),
    strings: [],
  },
  target: {
    id: `target-${index}`,
    locale: '',
    element: document.createElement('iframe'),
    strings: [],
  },
});

/** @type {FramePair[]} */
const pairs = [createPair(0), createPair(1)];
/**
 * Pair showing the current screen.
 */
let frames = pairs[0];
/**
 * Get every app frame.
 * @returns {AppFrame[]} Frames.
 */
const getAllFrames = () => pairs.flatMap((pair) => [pair.source, pair.target]);

// --- Server ------------------------------------------------------------------------------------

/**
 * Call the API of the review tool.
 * @param {string} route Route.
 * @param {any} [body] Body to post.
 * @returns {Promise<any>} Response data.
 * @throws {Error} If the request fails.
 */
const api = async (route, body) => {
  const response = await fetch(`/l10n-review/api/${route}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) throw new Error(data.error);

  return data;
};

/**
 * Order scenarios so the ones sharing start options follow each other, keeping the written order
 * otherwise. Starting the app takes seconds in development, while moving to another screen of a
 * running app takes a fraction of a second, so this keeps starts to one per group.
 * @param {Scenario[]} scenarios Scenarios.
 * @returns {Scenario[]} Ordered scenarios.
 */
const groupByBoot = (scenarios) => {
  /** @type {Map<string, Scenario[]>} */
  const groups = new Map();

  scenarios.forEach((scenario) => {
    const key = JSON.stringify(scenario.boot ?? {});

    groups.set(key, [...(groups.get(key) ?? []), scenario]);
  });

  return [...groups.values()].flat();
};

/**
 * Load the messages and scenarios.
 */
const loadData = async () => {
  const data = await api(`data?locale=${encodeURIComponent(state.locale)}`);

  state.locale = data.locale;
  state.sourceLocale = data.sourceLocale;
  state.items = new Map(data.items.map((/** @type {ReviewItem} */ item) => [item.key, item]));
  state.scenarios = groupByBoot(data.scenarios);
  state.demo = data.demo;
  state.coverage = data.coverage ?? {};

  const select = /** @type {HTMLSelectElement} */ ($('#locale'));

  if (!select.options.length) {
    select.append(...data.locales.map((/** @type {string} */ code) => new Option(code, code)));
  }

  select.value = state.locale;
};

/**
 * Write the sample site to the test repository, which keeps its files in the origin private file
 * system shared by the frames, replacing what a previous session left there.
 */
const seedRepository = async () => {
  const root = await navigator.storage.getDirectory();

  await root.removeEntry('sveltia-cms-test', { recursive: true }).catch(() => undefined);

  const repo = await root.getDirectoryHandle('sveltia-cms-test', { create: true });
  const manifest = await fetch('/l10n-review/site/seed/manifest.json');

  if (!manifest.ok) {
    throw new Error('The list of sample files couldn’t be loaded.');
  }

  /** @type {{ files: string[] }} */
  const { files } = await manifest.json();

  await Promise.all(
    files.map(async (/** @type {string} */ path) => {
      const response = await fetch(
        `/l10n-review/site/seed/${path.split('/').map(encodeURIComponent).join('/')}`,
      );

      if (!response.ok) {
        throw new Error(`The sample file ${path} couldn’t be loaded.`);
      }

      const segments = path.split('/');
      const name = /** @type {string} */ (segments.pop());

      const dir = await segments.reduce(
        async (parent, segment) => (await parent).getDirectoryHandle(segment, { create: true }),
        Promise.resolve(repo),
      );

      const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();

      await writable.write(await response.blob());
      await writable.close();
    }),
  );
};

// --- Frames ------------------------------------------------------------------------------------

/**
 * Wait for a message from a frame.
 * @param {AppFrame} frame Frame.
 * @param {(data: any) => boolean} match Function telling whether a message is the one.
 * @returns {Promise<any>} Message.
 */
const waitForMessage = (frame, match) =>
  new Promise((resolve) => {
    /**
     * Resolve with the message if it’s the one.
     * @param {MessageEvent} event Event.
     */
    const listener = ({ origin, data }) => {
      if (origin === window.location.origin && data?.frame === frame.id && match(data)) {
        window.removeEventListener('message', listener);
        resolve(data);
      }
    };

    window.addEventListener('message', listener);
  });

/**
 * Get the key identifying the start options of a scenario in a frame.
 * @param {AppFrame} frame Frame.
 * @param {Scenario['boot']} boot Start options.
 * @returns {string} Key.
 */
const getBootKey = (frame, boot = {}) => {
  const { config = 'sample', signIn = true, demo = false, devMode = false, mocks = [] } = boot;

  return JSON.stringify({ config, signIn, demo, devMode, mocks, locale: frame.locale });
};

/**
 * Start the app in a frame with the options of a scenario, unless it already runs with them or is
 * starting with them.
 * @param {AppFrame} frame Frame.
 * @param {Scenario['boot']} boot Start options.
 * @returns {Promise<number | undefined>} Milliseconds waited for the start, if any.
 */
const bootFrame = async (frame, boot = {}) => {
  const bootKey = getBootKey(frame, boot);

  if (frame.bootKey === bootKey) return undefined;

  const start = performance.now();

  if (frame.pendingKey !== bootKey) {
    const { config = 'sample', signIn = true, demo = false, devMode = false, mocks = [] } = boot;

    const params = new URLSearchParams({
      frame: frame.id,
      locale: frame.locale,
      config,
      boot: JSON.stringify({ signIn, demo, devMode, mocks }),
    });

    const ready = waitForMessage(frame, (data) => data.type === 'ready');

    frame.bootKey = undefined;
    frame.pendingKey = bootKey;
    frame.element.src = `/l10n-review/app/?${params}`;
    frame.pending = ready.then(({ error, phases }) => {
      // eslint-disable-next-line no-console
      console.info(`[l10n-review] ${frame.id} started in`, phases);

      // A newer start may have replaced this one
      if (frame.pendingKey === bootKey) {
        frame.bootKey = bootKey;
        frame.pendingKey = undefined;
      }

      if (error) throw new Error(`${frame.locale}: the app didn’t start: ${error}`);

      return performance.now() - start;
    });
  }

  await frame.pending;

  return performance.now() - start;
};

/**
 * Show a pair of frames, hiding the other.
 * @param {FramePair} pair Pair.
 */
const showPair = (pair) => {
  frames = pair;
  pairs.forEach((p) => {
    p.source.element.classList.toggle('spare', p !== pair);
    p.target.element.classList.toggle('spare', p !== pair);
  });
};

/**
 * Stop the hidden pair starting an app. A start the screen waits for shouldn’t compete with one
 * that may no longer be needed: same-origin frames share a main thread, and four starts at once
 * also run out of Chromium’s request slots (`ERR_INSUFFICIENT_RESOURCES`).
 */
const stopSpare = () => {
  pairs
    .filter((pair) => pair !== frames)
    .forEach((pair) => {
      [pair.source, pair.target].forEach((frame) => {
        if (frame.pendingKey) {
          frame.pendingKey = undefined;
          frame.bootKey = undefined;
          frame.element.src = 'about:blank';
        }
      });
    });
};

/**
 * Get the pair to run a scenario in: the current one if it runs with the scenario’s start options,
 * otherwise the other one if it runs or is starting with them, otherwise the current one.
 * @param {Scenario} scenario Scenario.
 * @returns {FramePair} Pair.
 */
const getPairFor = (scenario) => {
  /**
   * Check whether a pair runs or is starting with the scenario’s start options.
   * @param {FramePair} pair Pair.
   * @returns {boolean} Whether it does.
   */
  const matches = (pair) => {
    const key = getBootKey(pair.target, scenario.boot);

    return pair.target.bootKey === key || pair.target.pendingKey === key;
  };

  return matches(frames) ? frames : (pairs.find(matches) ?? frames);
};

/**
 * Start the app the next scenario needing other start options will need, in the hidden pair, so
 * it’s ready by the time the translator gets there.
 * @param {number} index Index of the current scenario.
 */
const preload = (index) => {
  const current = getBootKey(frames.target, state.scenarios[index]?.boot);

  const next = state.scenarios
    .slice(index + 1)
    .find((scenario) => getBootKey(frames.target, scenario.boot) !== current);

  if (!next || getPairFor(next) !== frames) return;

  const spare = /** @type {FramePair} */ (pairs.find((pair) => pair !== frames));

  [spare.source, spare.target].forEach((frame) => {
    bootFrame(frame, next.boot).catch(() => undefined);
  });
};

let runCount = 0;

/**
 * Run a scenario in a frame.
 * @param {AppFrame} frame Frame.
 * @param {Scenario} scenario Scenario.
 * @returns {Promise<{ ms: number, error?: string }>} Result.
 */
const runInFrame = async (frame, scenario) => {
  runCount += 1;

  const id = runCount;
  const result = waitForMessage(frame, (data) => data.type === 'result' && data.id === id);

  frame.element.contentWindow?.postMessage(
    { type: 'run', id, scenario: { route: scenario.route, steps: scenario.steps } },
    window.location.origin,
  );

  const { strings, ms, error } = await result;

  frame.strings = strings;

  return { ms, error };
};

/**
 * Scale the frames to fit their panes.
 */
const fitFrames = () => {
  getAllFrames().forEach((frame) => {
    const { element } = frame;
    const viewport = element.parentElement;

    if (!viewport) return;

    const scale = viewport.clientWidth / APP_WIDTH;

    frame.scale = scale;
    element.style.width = `${APP_WIDTH}px`;
    element.style.height = `${viewport.clientHeight / scale}px`;
    element.style.transform = `scale(${scale})`;
  });
};

// --- Screen ------------------------------------------------------------------------------------

/**
 * Get the keys on the screen, in reading order: visible text first, from top to bottom, then the
 * hidden text. Both frames are merged, as a message may show in only one, e.g. when its
 * translation is empty.
 * @returns {string[]} Keys.
 */
const getScreenKeys = () => {
  const strings = [...frames.target.strings, ...frames.source.strings];
  const visible = strings.filter(({ kind }) => kind === 'text');

  visible.sort(
    (a, b) => (a.rect?.y ?? 0) - (b.rect?.y ?? 0) || (a.rect?.x ?? 0) - (b.rect?.x ?? 0),
  );

  return [
    ...new Set(
      [...visible, ...strings].map(({ key }) => key).filter((key) => state.items.has(key)),
    ),
  ];
};

/**
 * Get the keys on the screen that need review.
 * @returns {string[]} Keys.
 */
const getPendingKeys = () => state.keys.filter((key) => !state.items.get(key)?.reviewed);

/**
 * Get whether a key is shown as visible text in either frame.
 * @param {string} key Key.
 * @returns {boolean} Whether it’s visible.
 */
const isVisible = (key) =>
  [...frames.target.strings, ...frames.source.strings].some(
    (s) => s.key === key && s.kind === 'text',
  );

/**
 * Say what carries a message that can’t be seen on the screen.
 * @param {string} key Message key.
 * @returns {string | undefined} The attribute name, `screen reader` or `page title`, or nothing if
 * the message shows.
 */
const getHiddenLabel = (key) => {
  if (isVisible(key)) return undefined;

  const string = [...frames.target.strings, ...frames.source.strings].find((s) => s.key === key);

  if (!string) return undefined;

  if (string.kind === 'attr') return string.attr;

  return string.kind === 'hidden' ? 'screen reader' : 'page title';
};

/**
 * Render a tag, color-coded by what it stands for.
 * @param {string} label Label, e.g. `aria-label`, `screen reader` or `missing`.
 * @returns {string} HTML.
 */
const renderTag = (label) => {
  const kind = label.startsWith('aria-') ? 'aria' : label.replace(/\W+/g, '-');

  // eslint-disable-next-line no-use-before-define
  return `<span class="kind" data-kind="${escape(kind)}">${escape(label)}</span>`;
};

/**
 * Escape text for HTML.
 * @param {string | undefined} text Text.
 * @returns {string} Escaped text.
 */
const escape = (text = '') =>
  text.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
  );

/**
 * Get the text a frame shows for a key, e.g. the plural variant of a message chosen for its count,
 * rather than the message as written.
 * @param {AppFrame} frame Frame.
 * @param {string} key Key.
 * @returns {string | undefined} Text.
 */
const getShownText = (frame, key) =>
  (
    frame.strings.find((s) => s.key === key && s.kind === 'text') ??
    frame.strings.find((s) => s.key === key)
  )?.text;

/**
 * Draw the numbered outlines in both frames.
 */
const drawOutlines = () => {
  if (document.body.classList.contains('card-mode')) return;

  // The pending strings that can be seen, and the selected one, even if it’s an `aria-label` or
  // visually hidden text, which gets a dashed outline around its element: outlining every one of
  // those would bury the screen
  const keys = [...new Set([...getPendingKeys().filter(isVisible), state.selected])]
    .filter((key) => key !== undefined)
    .map((key) => ({ key, n: state.keys.indexOf(key) + 1 }));

  const item = state.selected ? state.items.get(state.selected) : undefined;

  // The translation’s frame shows the original text by the selected message
  const original = state.selected
    ? (getShownText(frames.source, state.selected) ?? item?.en)
    : undefined;

  [frames.source, frames.target].forEach(({ element, scale }) => {
    element.contentWindow?.postMessage(
      {
        type: 'outline',
        keys,
        selected: state.selected,
        caption: element === frames.target.element ? original : undefined,
        scale,
      },
      window.location.origin,
    );
  });
};

/**
 * Most strings on a card.
 */
const CARD_SIZE = 12;

/**
 * Get the keys a screen shows: those the scenarios showed when they last ran, and those seen in
 * this review.
 * @returns {Set<string>} Keys.
 */
const getCoveredKeys = () =>
  new Set([...state.seen, ...state.scenarios.flatMap(({ id }) => state.coverage[id]?.keys ?? [])]);

/**
 * Build the cards for the strings no screen shows, in the order of the source files, a section at
 * a time. Cards with nothing pending are left out.
 */
const buildCards = () => {
  const covered = getCoveredKeys();
  /** @type {Card[]} */
  const cards = [];
  /** @type {Card | undefined} */
  let card;

  state.items.forEach((item) => {
    if (covered.has(item.key)) return;

    const section = item.source === 'ui' ? 'Sveltia UI' : (item.section ?? 'Other');

    if (!card || card.section !== section || card.keys.length >= CARD_SIZE) {
      card = { section, keys: [] };
      cards.push(card);
    }

    card.keys.push(item.key);
  });

  state.cards = cards.filter(({ keys }) => keys.some((key) => !state.items.get(key)?.reviewed));
};

/**
 * Get the number of screens, cards included.
 * @returns {number} Number.
 */
const getScreenCount = () => state.scenarios.length + state.cards.length;

/**
 * Show the review progress.
 */
const renderProgress = () => {
  const items = [...state.items.values()];
  const reviewed = items.filter((item) => item.reviewed).length;
  const missing = items.filter((item) => item.status === 'missing').length;
  const covered = getCoveredKeys();
  const offScreen = items.filter(({ key }) => !covered.has(key)).length;

  $('#progress').textContent = [
    `${reviewed} / ${items.length} reviewed`,
    `${missing} missing`,
    `${offScreen} not on a screen`,
  ].join(' · ');
};

/**
 * Show the strings of a card in the main area: with no preview, the notes of the source file are
 * the context.
 * @param {Set<string>} pending Keys pending review.
 */
const renderCard = (pending) => {
  const cardView = $('#card-view');
  const card = state.cards[state.index - state.scenarios.length];

  if (!document.body.classList.contains('card-mode') || !card) {
    cardView.innerHTML = '';

    return;
  }

  cardView.innerHTML = `
    <header>
      <h2>Not on any screen yet: check these strings from their notes</h2>
    </header>
    ${state.keys
      .map((key, index) => {
        const item = /** @type {ReviewItem} */ (state.items.get(key));

        const tags = [
          item.status === 'missing' ? renderTag('missing') : '',
          item.status === 'same' ? renderTag('same as English') : '',
          pending.has(key) ? '' : '<span class="done">✓</span>',
        ].join(' ');

        // A group heading once, above its first string
        const previous = state.items.get(state.keys[index - 1]);
        const heading = item.group && item.group !== previous?.group ? item.group : undefined;

        return `${heading ? `<h4>${escape(heading)}</h4>` : ''}
        <article data-key="${escape(key)}" class="${key === state.selected ? 'selected' : ''}">
          <h3><span class="n">${index + 1}</span> <code>${escape(key)}</code> ${tags}</h3>
          ${item.comment ? `<p class="comment">${escape(item.comment)}</p>` : ''}
          <div class="texts">
            <div>${renderTag(state.sourceLocale)}<p>${escape(item.en)}</p></div>
            <div>${renderTag(state.locale)}<p>${escape(item.value ?? '')}</p></div>
          </div>
        </article>`;
      })
      .join('')}
  `;

  cardView.querySelector('article.selected')?.scrollIntoView({ block: 'nearest' });
};

/**
 * Show the messages of the current screen.
 */
const renderList = () => {
  const pending = new Set(getPendingKeys());
  const tbody = /** @type {HTMLElement} */ ($('#strings tbody'));

  tbody.innerHTML = state.keys
    .map((key, index) => {
      const item = /** @type {ReviewItem} */ (state.items.get(key));

      const classes = [
        pending.has(key) ? 'pending' : 'reviewed',
        key === state.selected ? 'selected' : '',
        item.status,
        isVisible(key) ? '' : 'hidden-text',
      ].join(' ');

      const label = getHiddenLabel(key);

      return `<tr class="${classes}" data-key="${escape(key)}">
        <td>${index + 1}</td>
        <td><code>${escape(key)}</code>${label ? ` ${renderTag(label)}` : ''}</td>
        <td>${escape(getShownText(frames.source, key) ?? item.en)}</td>
        <td>${item.status === 'missing' ? `${renderTag('missing')} ` : ''}${
          item.status === 'same' ? `${renderTag('same as English')} ` : ''
        }${escape(getShownText(frames.target, key) ?? item.value)}</td>
        <td>${pending.has(key) ? '' : '✓'}</td>
      </tr>`;
    })
    .join('');

  const hidden = [...frames.target.strings].filter(({ kind }) => kind !== 'text');

  $('#hidden').innerHTML = hidden.length
    ? hidden
        .map(
          ({ key, text, kind, attr }) =>
            `<li data-key="${escape(key)}" class="${key === state.selected ? 'selected' : ''}">
              ${renderTag(kind === 'attr' ? (attr ?? '') : kind === 'hidden' ? 'screen reader' : 'page title')}
              ${escape(text)}
              <small>${escape(getShownText(frames.source, key) ?? state.items.get(key)?.en)}</small>
            </li>`,
        )
        .join('')
    : '<li class="empty">None on this screen</li>';

  layoutColumns();
  tbody.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });

  renderCard(pending);
  renderProgress();
};

/**
 * Show a status message.
 * @param {string} text Message.
 * @param {'info' | 'error'} [type] Type.
 */
const setStatus = (text, type = 'info') => {
  $('#status').textContent = text;
  $('#status').className = type;
};

/**
 * Take the focus back from a frame, where the app may have moved it by focusing a field, so the
 * keys work right away. The frames pass the keys on too, in case the app focuses something later.
 */
const takeFocus = () => {
  if (document.activeElement instanceof HTMLIFrameElement) {
    document.activeElement.blur();
  }
};

/**
 * Open a screen: start the apps if needed, run the scenario in both, and list its messages.
 * @param {number} index Scenario index.
 * @param {object} [options] Options.
 * @param {1 | -1} [options.direction] Direction to skip screens with nothing to review in.
 */
const openScreen = async (index, { direction } = {}) => {
  if (state.running) return;

  if (index >= state.scenarios.length) {
    // eslint-disable-next-line no-use-before-define
    openCard(index);

    return;
  }

  state.running = true;
  state.index = index;
  state.lastError = undefined;
  document.body.classList.remove('card-mode');

  const scenario = state.scenarios[index];

  $('#position').textContent = `${index + 1} / ${getScreenCount()}`;
  $('#title').textContent = scenario.title;
  $('#timing').textContent = '…';
  setStatus('');

  try {
    const start = performance.now();

    showPair(getPairFor(scenario));

    const pair = [frames.source, frames.target];

    if (pair.some((frame) => frame.bootKey !== getBootKey(frame, scenario.boot))) {
      stopSpare();
    }

    const boots = await Promise.all(pair.map((f) => bootFrame(f, scenario.boot)));
    const results = await Promise.all(pair.map((f) => runInFrame(f, scenario)));
    const total = performance.now() - start;
    const bootMs = Math.max(...boots.map((ms) => ms ?? 0));

    $('#timing').textContent = bootMs
      ? `${Math.round(total)} ms (start ${Math.round(bootMs)} ms)`
      : `${Math.round(total)} ms`;

    const error = results.find((r) => r.error)?.error;

    if (error) {
      state.lastError = error;
      setStatus(`This scenario needs fixing: ${error}`, 'error');
    }

    state.keys = getScreenKeys();
    state.keys.forEach((key) => state.seen.add(key));
    state.selected = getPendingKeys()[0] ?? state.keys[0];
  } catch (/** @type {any} */ ex) {
    state.lastError = ex.message;
    setStatus(ex.message, 'error');
    state.keys = [];
  } finally {
    state.running = false;
  }

  // Remember what the screen shows, so the strings no screen shows can be listed. A screen that
  // failed shows nothing, so a stale record of it doesn’t count as coverage
  const coverage = { keys: state.keys, error: state.lastError };

  state.coverage[scenario.id] = coverage;
  await api('coverage', { scenario: scenario.id, ...coverage }).catch(() => {});

  const next = index + (direction ?? 0);

  if (direction && !getPendingKeys().length && next >= 0) {
    // Skipping past the last screen: list the strings no screen has shown so far
    if (index < state.scenarios.length && next >= state.scenarios.length) {
      buildCards();
    }

    if (next < getScreenCount()) {
      await openScreen(next, { direction });

      return;
    }
  }

  renderList();
  drawOutlines();
  takeFocus();
  preload(index);
};

/**
 * Open a card of strings no screen shows. There’s no preview: the card shows the notes of the
 * source file, the English text and the translation instead.
 * @param {number} index Index of the screen, after the scenarios.
 */
const openCard = (index) => {
  const card = state.cards[index - state.scenarios.length];

  if (!card) return;

  state.index = index;
  state.lastError = undefined;
  document.body.classList.add('card-mode');
  $('#position').textContent = `${index + 1} / ${getScreenCount()}`;
  $('#title').textContent = `Not on a screen › ${card.section}`;
  $('#timing').textContent = '';
  setStatus('');
  state.keys = card.keys.filter((key) => state.items.has(key));
  state.selected = getPendingKeys()[0] ?? state.keys[0];
  renderList();
  takeFocus();
};

// --- Editing -----------------------------------------------------------------------------------

/**
 * Get the names of the numeric variables of a message, e.g. `count`.
 * @param {string} raw Message.
 * @returns {string[]} Names.
 */
const getNumericVariables = (raw) =>
  [...raw.matchAll(/\.input\s*\{\s*\$(\w+)\s*:(?:integer|number)/g)].map((m) => m[1]);

/**
 * Format a message with sample values for each numeric variable, to preview its plural variants.
 * @param {string} locale Locale.
 * @param {string} raw Message.
 * @param {string[]} names Variable names.
 * @returns {{ values: string, text: string }[]} Previews.
 */
const previewVariants = (locale, raw, names) => {
  const squashed = raw
    .replace(/\s*\n\s*/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();

  const message = new MessageFormat(locale, squashed);

  const combos = names.reduce(
    (list, name) => list.flatMap((combo) => SAMPLE_NUMBERS.map((n) => ({ ...combo, [name]: n }))),
    /** @type {Record<string, number>[]} */ ([{}]),
  );

  return combos.slice(0, 25).map((values) => ({
    values: Object.entries(values)
      .map(([k, v]) => `${k}=${v}`)
      .join(', '),
    text: message.format(values),
  }));
};

/**
 * Show the plural variants of the message being edited.
 * @param {ReviewItem} item Message.
 * @param {string} raw Translation being edited.
 */
const renderVariants = (item, raw) => {
  const container = /** @type {HTMLElement} */ ($('#variants'));
  const names = getNumericVariables(item.enRaw);

  if (!names.length) {
    container.innerHTML = '';

    return;
  }

  try {
    const en = previewVariants(state.sourceLocale, item.enRaw, names);
    const target = previewVariants(state.locale, raw, names);

    container.innerHTML = `<table><thead><tr><th>Values</th><th>${state.sourceLocale}</th>
      <th>${state.locale}</th></tr></thead><tbody>${en
        .map(
          ({ values, text }, i) =>
            `<tr><td>${escape(values)}</td><td>${escape(text)}</td>` +
            `<td>${escape(target[i].text)}</td></tr>`,
        )
        .join('')}</tbody></table>`;
  } catch (/** @type {any} */ ex) {
    container.innerHTML = `<p class="error">${escape(ex.message)}</p>`;
  }
};

/**
 * Open the editor for the selected message.
 */
const openEditor = () => {
  const item = state.selected ? state.items.get(state.selected) : undefined;

  if (!item) return;

  state.editing = true;

  const editor = $('#editor');

  editor.hidden = false;
  editor.innerHTML = `
    <div class="meta">
      <code>${escape(item.key)}</code> in <code>${escape(item.file)}</code>
      ${item.section || item.group ? `<p class="group">${escape([item.section, item.group].filter(Boolean).join(' › '))}</p>` : ''}
      ${item.comment ? `<pre class="comment">${escape(item.comment)}</pre>` : ''}
    </div>
    <div class="source">${renderTag(state.sourceLocale)}<pre>${escape(item.enRaw)}</pre></div>
    <textarea id="value" rows="${Math.max(2, (item.raw ?? item.enRaw).split('\n').length)}"
      spellcheck="true" lang="${escape(state.locale)}"
      ${item.writable ? '' : 'readonly'}>${escape(item.raw ?? '')}</textarea>
    <div id="variants"></div>
    <p>
      ${
        item.writable
          ? '<button id="save">Save</button> <kbd>Enter</kbd> save · <kbd>Shift</kbd>+<kbd>Enter</kbd> new line ·'
          : '<strong>Read-only:</strong> start the server with <code>SVELTIA_UI_DIR</code> to save Sveltia UI strings ·'
      }
      <kbd>Esc</kbd> cancel
    </p>
  `;

  const textarea = /** @type {HTMLTextAreaElement} */ ($('#value'));

  textarea.placeholder = item.en;
  textarea.focus();
  textarea.addEventListener('input', () => renderVariants(item, textarea.value || item.enRaw));
  renderVariants(item, textarea.value || item.enRaw);
  $('#save')?.addEventListener('click', () => {
    // eslint-disable-next-line no-use-before-define
    saveEdit();
  });
};

/**
 * Close the editor.
 */
const closeEditor = () => {
  state.editing = false;
  $('#editor').hidden = true;
  $('#editor').innerHTML = '';
};

/**
 * Save the message being edited. The server writes the locale file, and the change reaches the
 * frames and this page as a hot update. Saving a translation accepts it.
 */
const saveEdit = async () => {
  const key = /** @type {string} */ (state.selected);
  const raw = /** @type {HTMLTextAreaElement} */ ($('#value')).value;

  try {
    const { file } = await api('save', { locale: state.locale, key, raw });

    await api('accept', { locale: state.locale, keys: [key] });
    closeEditor();
    setStatus(`Saved to ${file}`);
    await loadData();
    renderList();
    drawOutlines();
  } catch (/** @type {any} */ ex) {
    setStatus(ex.message, 'error');
  }
};

// --- Actions -----------------------------------------------------------------------------------

/**
 * Accept the messages of the screen that need review, as leaving a screen means its strings are
 * fine. A missing translation stays pending: there’s nothing to accept until it’s written.
 */
const acceptPending = async () => {
  const keys = getPendingKeys().filter((key) => state.items.get(key)?.status !== 'missing');

  if (!keys.length) return;

  await api('accept', { locale: state.locale, keys });
  keys.forEach((key) => {
    const item = state.items.get(key);

    if (item) item.reviewed = true;
  });
};

/**
 * Leave the screen, accepting it, and open another one.
 * @param {number} index Index of the screen to open.
 * @param {{ direction?: 1 | -1 }} [options] Options for `openScreen`.
 */
const leaveScreen = async (index, options) => {
  if (state.running || state.editing) return;

  try {
    state.running = true;
    await acceptPending();
  } catch (/** @type {any} */ ex) {
    setStatus(ex.message, 'error');

    return;
  } finally {
    state.running = false;
  }

  // Moving past the last screen: list the strings no screen has shown so far
  if (state.index < state.scenarios.length && index >= state.scenarios.length) {
    buildCards();
  }

  if (index >= 0 && index < getScreenCount()) {
    await openScreen(index, options);
  } else {
    renderList();
    drawOutlines();
    setStatus('That was the last screen.');
  }
};

/**
 * Select the previous or next message on the screen.
 * @param {1 | -1} delta Direction.
 */
const moveSelection = (delta) => {
  const index = state.selected ? state.keys.indexOf(state.selected) : -1;
  const next = state.keys[Math.min(Math.max(index + delta, 0), state.keys.length - 1)];

  if (next) {
    state.selected = next;
    renderList();
    drawOutlines();
  }
};

/**
 * Run the command of a key, pressed on the page or in a frame.
 * @param {string} key Key, as in `KeyboardEvent.key`.
 * @returns {boolean} Whether the key has a command.
 */
const runKey = (key) => {
  const name = key.length === 1 ? key.toLowerCase() : key;

  // The view can change while a screen loads
  if (name === 'v') {
    view.single = !isSingle();
    applyView();
  } else if (name === 't') {
    view.showSource = !view.showSource;
    applyView();
  } else if (name === 'h') {
    view.aside = !view.aside;
    applyView();
  } else if (state.running) {
    return ['Enter', 'ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(name);
  } else if (name === 'Enter') {
    openEditor();
  } else if (name === 'ArrowRight') {
    if (state.index < getScreenCount() - 1) leaveScreen(state.index + 1);
  } else if (name === 'ArrowLeft') {
    if (state.index > 0) leaveScreen(state.index - 1);
  } else if (name === 'ArrowDown') {
    moveSelection(1);
  } else if (name === 'ArrowUp') {
    moveSelection(-1);
  } else {
    return false;
  }

  return true;
};

document.addEventListener('keydown', (event) => {
  if (state.editing) {
    if (event.key === 'Escape') closeEditor();

    // Enter saves, Shift+Enter starts a new line, as some messages have several
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();

      if (state.items.get(/** @type {string} */ (state.selected))?.writable) {
        saveEdit();
      }
    }

    return;
  }

  if (event.target instanceof HTMLSelectElement || event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  if (runKey(event.key)) event.preventDefault();
});

$('#strings').addEventListener('click', ({ target }) => {
  const row = /** @type {HTMLElement} */ (target).closest('tr[data-key]');

  if (row) {
    state.selected = /** @type {HTMLElement} */ (row).dataset.key;
    renderList();
    drawOutlines();
  }
});

$('#strings').addEventListener('dblclick', () => openEditor());

$('#card-view').addEventListener('click', ({ target }) => {
  const article = /** @type {HTMLElement} */ (target).closest('article[data-key]');

  if (article) {
    state.selected = /** @type {HTMLElement} */ (article).dataset.key;
    renderList();
  }
});

$('#card-view').addEventListener('dblclick', () => openEditor());

$('#hidden').addEventListener('click', ({ target }) => {
  const li = /** @type {HTMLElement} */ (target).closest('li[data-key]');

  if (li) {
    state.selected = /** @type {HTMLElement} */ (li).dataset.key;
    renderList();
    drawOutlines();
  }
});

$('#prev').addEventListener('click', () => state.index > 0 && leaveScreen(state.index - 1));
$('#next').addEventListener(
  'click',
  () => state.index < getScreenCount() - 1 && leaveScreen(state.index + 1),
);
$('#swap').addEventListener('click', () => runKey('t'));
$('#layout').addEventListener('click', () => runKey('v'));
$('#aside-toggle').addEventListener('click', () => runKey('h'));

$('#locale').addEventListener('change', ({ target }) => {
  const url = new URL(window.location.href);

  url.searchParams.set('locale', /** @type {HTMLSelectElement} */ (target).value);
  window.location.href = url.href;
});

window.addEventListener('message', ({ origin, data }) => {
  if (origin !== window.location.origin) return;

  if (data?.type === 'key' && !state.editing) {
    runKey(data.key);
  }

  if (data?.type === 'select' && state.keys.includes(data.key)) {
    state.selected = data.key;
    renderList();
    drawOutlines();
  }

  if (data?.type === 'updated') {
    const frame = [frames.source, frames.target].find(({ id }) => id === data.frame);

    if (frame) {
      frame.strings = data.strings;

      if (data.stale?.length) {
        // eslint-disable-next-line no-use-before-define
        restartFrame(frame, data.stale);
      } else {
        renderList();
        drawOutlines();
      }
    }

    // The hidden pair would show the old text too once shown: start it again when needed
    pairs
      .filter((pair) => pair !== frames && data.stale?.length)
      .flatMap((pair) => [pair.source, pair.target])
      .filter(({ id }) => id === data.frame)
      .forEach((f) => {
        f.bootKey = undefined;
      });
  }
});

/**
 * Start the app in a frame again and run the current scenario in it, as it shows messages that it
 * formatted when it started and doesn’t update, e.g. configuration errors.
 * @param {AppFrame} frame Frame.
 * @param {string[]} keys Keys of the messages that didn’t update.
 */
const restartFrame = async (frame, keys) => {
  const scenario = state.scenarios[state.index];

  if (!scenario || state.running) return;

  state.running = true;
  setStatus(
    `${keys.join(', ')}: shown as formatted when the app started, so the ${frame.locale} preview ` +
      'is restarting…',
  );

  try {
    frame.bootKey = undefined;
    await bootFrame(frame, scenario.boot);
    await runInFrame(frame, scenario);
    state.keys = getScreenKeys();
    setStatus('');
  } catch (/** @type {any} */ ex) {
    setStatus(ex.message, 'error');
  } finally {
    state.running = false;
  }

  renderList();
  drawOutlines();
  takeFocus();
};

// A locale file changed, by a save here or in an editor: get the new messages and review state
import.meta.hot?.on('l10n-review:messages', async () => {
  await loadData();
  renderList();
});

const resizeObserver = new ResizeObserver(fitFrames);

resizeObserver.observe($('#source'));
resizeObserver.observe($('#target'));

/**
 * Run every screen, without accepting anything, and give the result to `pnpm l10n:coverage`, which
 * waits for it.
 */
const runCheck = async () => {
  /** @type {{ id: string, title: string, keys: number, error?: string }[]} */
  const scenarios = [];

  // eslint-disable-next-line no-restricted-syntax
  for (const [index, { id, title }] of state.scenarios.entries()) {
    // eslint-disable-next-line no-await-in-loop
    await openScreen(index);
    scenarios.push({ id, title, keys: state.keys.length, error: state.lastError });
  }

  const covered = getCoveredKeys();

  const uncovered = [...state.items.values()]
    .filter(({ key }) => !covered.has(key))
    .map(({ key, source, section, group }) => ({ key, source, section, group }));

  /** @type {any} */ (window).l10nCheckResult = {
    scenarios,
    total: state.items.size,
    covered: state.items.size - uncovered.length,
    uncovered,
  };

  setStatus(`Check done: ${uncovered.length} strings aren’t on any screen.`);
};

// --- Start -------------------------------------------------------------------------------------

(async () => {
  state.locale = new URLSearchParams(window.location.search).get('locale') ?? '';
  await loadData();
  pairs.forEach((pair) => {
    pair.target.locale = state.locale;
    $('#source').append(pair.source.element);
    $('#target').append(pair.target.element);
  });
  showPair(pairs[0]);
  $('#source-label').textContent = state.sourceLocale;
  $('#target-label').textContent = state.locale;
  applyView();
  fitFrames();
  setStatus('Starting the app…');
  await seedRepository();

  if (!state.demo.found) {
    setStatus(
      `The demo site wasn’t found at ${state.demo.dir}, so most screens have no content. Clone ` +
        'sveltia/sveltia-cms-demo there, or set SVELTIA_DEMO_DIR to its checkout.',
      'error',
    );
  }

  if (CHECK_MODE) {
    await runCheck();
  } else {
    buildCards();
    await openScreen(0, { direction: 1 });
  }
})().catch((/** @type {any} */ ex) => {
  setStatus(ex.message, 'error');

  // Let `pnpm l10n:coverage` stop now instead of waiting for its timeout
  if (CHECK_MODE) {
    /** @type {any} */ (window).l10nCheckResult = { failure: ex.message };
  }
});
