/**
 * Script loaded in each app frame of the review page, before the app starts. It gives the frame its
 * own storage and language, tags every message with its key, runs the scenarios the page asks for,
 * reports the messages on the screen, and applies changed messages in place.
 */

import { addMessages, locale as appLocale, dictionary } from '@sveltia/i18n';

import { encodeKey, hasMarker, splitMarkedText } from './markers.js';

/**
 * A message found on the screen.
 * @typedef {object} ScreenString
 * @property {string} key Message key.
 * @property {string} text Text shown, without markers.
 * @property {'text' | 'hidden' | 'attr' | 'title' | 'console'} kind Where it is: visible text, text
 * hidden from sight but read by assistive technology, an attribute such as `aria-label`, the page
 * title, or a message logged to the browser console.
 * @property {string} [attr] Attribute name, for the `attr` kind.
 * @property {string} [level] Console method, e.g. `warn`, for the `console` kind.
 * @property {{ x: number, y: number, width: number, height: number }} [rect] Position on the
 * screen.
 */

/**
 * @typedef {object} FoundNode
 * @property {Element | Text} node Text node showing a message, or element with the attribute.
 * @property {string} [label] What carries a message that can’t be seen: the attribute name, or
 * `screen reader` for visually hidden text.
 */

const params = new URLSearchParams(window.location.search);
const FRAME_ID = params.get('frame') ?? '';
const LOCALE = params.get('locale') ?? 'en-US';
const SOURCE_LOCALE = 'en-US';
/**
 * @type {{ signIn?: boolean, mocks?: { url: string, method?: string, status?: number,
  json?: any }[] }} */
const BOOT = JSON.parse(params.get('boot') ?? '{}');
/**
 * Messages with strings the app logged to the console since the current screen opened, or since
 * the app started for the first screen. Some strings only appear there, like configuration
 * warnings.
 * @type {{ level: string, text: string }[]}
 */
let consoleEntries = [];
/**
 * What the app logged while starting, kept for the first screen, and for that screen again when
 * the page runs it once more in the same frame: the app doesn’t log it twice.
 * @type {{ scenario: string, entries: { level: string, text: string }[] } | undefined}
 */
let startEntries;
/**
 * Console methods the app logs with.
 * @type {('log' | 'info' | 'warn' | 'error' | 'debug')[]}
 */
const CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug'];

// Record the messages with strings, then log them as usual
/* eslint-disable no-console */
CONSOLE_METHODS.forEach((level) => {
  const original = console[level].bind(console);

  /**
   * Log a message, recording it if it has strings.
   * @param {...any} args Arguments of the console method.
   */
  console[level] = (...args) => {
    const text = args
      .map((arg) => (typeof arg === 'string' ? arg : arg instanceof Error ? arg.message : ''))
      .join(' ');

    if (hasMarker(text) && !consoleEntries.some((entry) => entry.text === text)) {
      consoleEntries = [...consoleEntries, { level, text }].slice(-100);
    }

    original(...args);
  };
});
/* eslint-enable no-console */

/**
 * Attributes whose text is announced or shown by the browser.
 */
const TEXT_ATTRIBUTES = [
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-placeholder',
  'aria-valuetext',
  'title',
  'placeholder',
  'alt',
];

/**
 * Elements a click on a message is passed on to, as the message is usually inside one.
 */
const CLICKABLE_SELECTOR = [
  'button',
  'a[href]',
  'summary',
  'label',
  '[role="button"]',
  '[role="menuitem"]',
  '[role="menuitemradio"]',
  '[role="menuitemcheckbox"]',
  '[role="option"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="switch"]',
].join(',');

// --- Storage ---------------------------------------------------------------------------------

/**
 * Create an in-memory replacement for `localStorage`. The two frames share an origin, so they’d
 * share the real storage, including the language preference; this one is per frame, and empty on
 * every start, so each start is the same.
 * @param {Record<string, string>} initial Initial items.
 * @returns {Storage} Storage.
 */
const createMemoryStorage = (initial) => {
  /** @type {Record<string, string>} */
  const data = Object.assign(Object.create(null), initial);

  const api = {
    /**
     * Get an item.
     * @param {string} key Key.
     * @returns {string | null} Value.
     */
    getItem: (key) => (key in data ? data[key] : null),
    /**
     * Set an item.
     * @param {string} key Key.
     * @param {string} value Value.
     */
    setItem: (key, value) => {
      data[key] = String(value);
    },
    /**
     * Remove an item.
     * @param {string} key Key.
     */
    removeItem: (key) => {
      delete data[key];
    },
    /**
     * Remove every item.
     */
    clear: () => {
      Object.keys(data).forEach((key) => delete data[key]);
    },
    /**
     * Get the key at an index.
     * @param {number} index Index.
     * @returns {string | null} Key.
     */
    key: (index) => Object.keys(data)[index] ?? null,
  };

  // A proxy rather than an object, so `Object.keys(localStorage)` lists the items like the real
  // storage does, which `@sveltia/utils/storage` relies on
  return /** @type {Storage} */ (
    /** @type {unknown} */ (
      new Proxy(data, {
        /**
         * Get an item, a method or the item count.
         * @param {Record<string, string>} target Items.
         * @param {string | symbol} prop Property.
         * @returns {any} Value.
         */
        get: (target, prop) => {
          if (prop === 'length') return Object.keys(target).length;
          if (typeof prop === 'string' && prop in api) return /** @type {any} */ (api)[prop];

          return typeof prop === 'string' ? target[prop] : undefined;
        },
        /**
         * Set an item.
         * @param {Record<string, string>} target Items.
         * @param {string | symbol} prop Key.
         * @param {any} value Value.
         * @returns {boolean} Always `true`.
         */
        set: (target, prop, value) => {
          target[/** @type {string} */ (prop)] = String(value);

          return true;
        },
      })
    )
  );
};

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: createMemoryStorage({
    'sveltia-cms.prefs': JSON.stringify({
      locale: LOCALE,
      ...(BOOT.devMode ? { devModeEnabled: true } : {}),
    }),
  }),
});

// The browser language is the frame’s, so the app doesn’t suggest switching to another one in a
// notice that would shift the screen in one frame only
Object.defineProperty(navigator, 'language', { configurable: true, value: LOCALE });
Object.defineProperty(navigator, 'languages', { configurable: true, value: [LOCALE] });

// --- Requests ----------------------------------------------------------------------------------

const realFetch = window.fetch.bind(window);

/**
 * Answer the requests matching a mock of the scenario with its response.
 * @param {RequestInfo | URL} input Request.
 * @param {RequestInit} [init] Options.
 * @returns {Promise<Response>} Response.
 */
window.fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();

  const mock = BOOT.mocks?.find(
    (m) => url.includes(m.url) && (!m.method || m.method.toUpperCase() === method),
  );

  if (mock) {
    return new Response(JSON.stringify(mock.json ?? {}), {
      status: mock.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return realFetch(input, init);
};

// --- Messages ----------------------------------------------------------------------------------

/**
 * A compiled message that puts the marker of its key before what it formats.
 */
class TaggedMessage {
  /**
   * Wrap a compiled message.
   * @param {string} key Message key.
   * @param {{ format: (values?: any) => string | undefined }} message Compiled message.
   */
  constructor(key, message) {
    this.message = message;
    this.marker = encodeKey(key);
  }

  /**
   * Format the message.
   * @param {any} [values] Values.
   * @returns {string | undefined} Formatted message, with the marker.
   */
  format(values) {
    const result = this.message.format(values);

    return result === undefined ? result : `${this.marker}${result}`;
  }
}

/**
 * Tag the messages of a locale that aren’t tagged yet. The dictionary is reactive, so the app shows
 * the tagged messages right away.
 * @param {string} locale Locale code.
 */
const tagMessages = (locale) => {
  const messages = /** @type {Record<string, any> | undefined} */ (dictionary[locale]);

  if (!messages) return;

  Object.keys(messages).forEach((key) => {
    const message = messages[key];

    if (message && !(message instanceof TaggedMessage)) {
      messages[key] = new TaggedMessage(key, message);
    }
  });
};

/**
 * Add messages to a locale and tag them.
 * @param {string} locale Locale code.
 * @param {Record<string, any>} messages Messages.
 */
const updateMessages = (locale, messages) => {
  addMessages(locale, messages);
  tagMessages(locale);
};

// --- Waiting ---------------------------------------------------------------------------------

/**
 * Wait for a number of milliseconds.
 * @param {number} ms Milliseconds.
 * @returns {Promise<void>}
 */
const sleep = (ms) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

/**
 * Wait until a function returns a truthy value.
 * @template T
 * @param {() => T} fn Function.
 * @param {number} [timeout] Milliseconds to wait at most.
 * @returns {Promise<T>} Value.
 * @throws {Error} If the time runs out.
 */
const waitFor = async (fn, timeout = 5000) => {
  const end = performance.now() + timeout;

  for (;;) {
    const value = fn();

    if (value) return value;
    if (performance.now() > end) throw new Error('Timed out');

    // eslint-disable-next-line no-await-in-loop
    await sleep(25);
  }
};

/**
 * Wait until the page stops changing: no DOM change for a while, then two frames for layout.
 * @param {object} [options] Options.
 * @param {number} [options.quiet] Milliseconds without change.
 * @param {number} [options.timeout] Milliseconds to wait at most.
 * @returns {Promise<void>}
 */
const settle = async ({ quiet = 120, timeout = 3000 } = {}) => {
  await new Promise((resolve) => {
    /** @type {number} */
    let timer;

    /**
     * Stop waiting.
     */
    const done = () => {
      // eslint-disable-next-line no-use-before-define
      observer.disconnect();
      window.clearTimeout(timer);
      // eslint-disable-next-line no-use-before-define
      window.clearTimeout(limit);
      resolve(undefined);
    };

    const observer = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(done, quiet);
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
    timer = window.setTimeout(done, quiet);

    const limit = window.setTimeout(done, timeout);
  });

  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
};

// --- Scanning ----------------------------------------------------------------------------------

/**
 * Check whether an element is rendered: not hidden with `display`, `visibility` or `opacity`.
 * @param {Element} element Element.
 * @returns {boolean} Whether it’s rendered.
 */
const isRendered = (element) =>
  element.checkVisibility({ opacityProperty: true, visibilityProperty: true });

/**
 * Check whether a rectangle is too small to see, as for text hidden with the “visually hidden”
 * technique, which only assistive technology reads.
 * @param {DOMRect} rect Rectangle.
 * @returns {boolean} Whether it can’t be seen.
 */
const isTiny = (rect) => rect.width <= 1 || rect.height <= 1;
/**
 * Convert a rectangle to a plain object.
 * @param {DOMRect} rect Rectangle.
 * @returns {{ x: number, y: number, width: number, height: number }} Rectangle.
 */
const toRect = ({ x, y, width, height }) => ({ x, y, width, height });

/**
 * Check whether an element is hidden with the “visually hidden” technique: a tiny box that clips
 * its overflow, or a clip that leaves nothing. The text inside it keeps its full size, so the text
 * itself doesn’t look hidden. Checks the element and a few ancestors.
 * @param {Element} element Element.
 * @param {number} [depth] How many ancestors to check.
 * @returns {boolean} Whether it’s visually hidden.
 */
const isVisuallyHidden = (element, depth = 3) => {
  /** @type {Element | null} */
  let current = element;

  for (let level = 0; current && current !== document.body && level <= depth; level += 1) {
    const { overflow, clipPath, clip } = getComputedStyle(current);

    if (
      (isTiny(current.getBoundingClientRect()) && overflow !== 'visible') ||
      clipPath.startsWith('inset(50%') ||
      clip === 'rect(0px, 0px, 0px, 0px)'
    ) {
      return true;
    }

    current = current.parentElement;
  }

  return false;
};

/**
 * Find the element to outline for a message that can’t be seen: the element itself if it shows,
 * e.g. a button with an `aria-label`, or else its closest ancestor that shows, e.g. the alert
 * holding a status spelled out for screen readers.
 * @param {Element | null} element Element.
 * @returns {Element | undefined} Element.
 */
const getShowingAncestor = (element) => {
  for (
    let current = element;
    current && current !== document.body;
    current = current.parentElement
  ) {
    if (!isTiny(current.getBoundingClientRect()) && !isVisuallyHidden(current, 0)) {
      return current;
    }
  }

  return undefined;
};

/**
 * Elements or text nodes each key was last found in, to draw the outlines again on scroll.
 * @type {Map<string, FoundNode[]>}
 */
let foundNodes = new Map();

/**
 * Find the topmost modal dialog. While one is open, as with a Sveltia UI menu, whose dialog covers
 * the whole viewport with a transparent backdrop, the rest of the page is inert and belongs to
 * another screen.
 * @returns {HTMLDialogElement | undefined} Dialog.
 */
const getTopModal = () => {
  const modals = /** @type {HTMLDialogElement[]} */ ([
    ...document.querySelectorAll('dialog:modal'),
  ]);

  const hit = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);

  return modals.findLast((modal) => !!hit && modal.contains(hit)) ?? modals.at(-1);
};

/**
 * Check whether a message can’t be seen because it’s behind the topmost modal dialog, or because
 * something else covers it. Text hidden on purpose and text scrolled out of the viewport count as
 * not covered.
 * @param {Element} element Element showing the message.
 * @param {DOMRect} rect Rectangle of the message.
 * @param {HTMLDialogElement | undefined} modal Topmost modal dialog.
 * @param {boolean} hidden Whether it’s hidden on purpose, so only the modal dialog counts.
 * @returns {boolean} Whether it’s covered.
 */
const isCovered = (element, rect, modal, hidden) => {
  if (modal && !modal.contains(element)) {
    return true;
  }

  if (hidden) {
    return false;
  }

  const y = rect.y + rect.height / 2;

  return [0.5, 0.2, 0.8].every((ratio) => {
    const x = rect.x + rect.width * ratio;

    if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) {
      return false;
    }

    const hit = document.elementFromPoint(x, y);

    return (
      !!hit &&
      hit !== element &&
      !element.contains(hit) &&
      // An ancestor is hit when the element ignores pointer events, but the modal dialog is hit
      // only on its backdrop
      !(hit.contains(element) && hit !== modal)
    );
  });
};

/**
 * Find the messages in the page.
 * @param {object} [options] Options.
 * @param {boolean} [options.all] Whether to include the messages that are covered.
 * @returns {{ strings: ScreenString[], nodes: Map<string, FoundNode[]> }} Messages, and where
 * each key was found.
 */
const collect = ({ all = false } = {}) => {
  const modal = all ? undefined : getTopModal();
  /** @type {ScreenString[]} */
  const strings = [];
  /** @type {Map<string, FoundNode[]>} */
  const nodes = new Map();

  /**
   * Remember where a key was found.
   * @param {string} key Key.
   * @param {FoundNode} found Node, with its label if it can’t be seen.
   */
  const remember = (key, found) => {
    nodes.set(key, [...(nodes.get(key) ?? []), found]);
  };

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = /** @type {Text} */ (node);
    const element = text.parentElement;

    if (element && hasMarker(text.data) && isRendered(element)) {
      const range = document.createRange();

      range.selectNodeContents(text);

      const rect = range.getBoundingClientRect();
      const hidden = isTiny(rect) || isVisuallyHidden(element);
      const kind = hidden ? 'hidden' : 'text';

      if (!all && isCovered(element, rect, modal, hidden)) {
        // eslint-disable-next-line no-continue
        continue;
      }

      // A message with formatting, e.g. `<code>`, spans several text nodes: take its text from the
      // element, up to the next marker
      const elementTexts = new Map(
        splitMarkedText(element.textContent ?? '').map(({ key, text: value }) => [key, value]),
      );

      splitMarkedText(text.data).forEach(({ key, text: value }) => {
        strings.push({ key, text: elementTexts.get(key) ?? value, kind, rect: toRect(rect) });
        remember(key, { node: text, label: hidden ? 'screen reader' : undefined });
      });
    }
  }

  document.body.querySelectorAll('*').forEach((element) => {
    TEXT_ATTRIBUTES.forEach((attr) => {
      const value = element.getAttribute(attr);

      if (!hasMarker(value) || !isRendered(element)) {
        return;
      }

      const rect = element.getBoundingClientRect();

      if (!all && isCovered(element, rect, modal, isTiny(rect) || isVisuallyHidden(element))) {
        return;
      }

      splitMarkedText(/** @type {string} */ (value)).forEach(({ key, text }) => {
        strings.push({ key, text, kind: 'attr', attr, rect: toRect(rect) });
        remember(key, { node: element, label: attr });
      });
    });
  });

  splitMarkedText(document.title).forEach(({ key, text }) => {
    strings.push({ key, text, kind: 'title' });
  });

  consoleEntries.forEach(({ level, text: message }) => {
    splitMarkedText(message).forEach(({ key, text }) => {
      strings.push({ key, text, kind: 'console', level });
    });
  });

  return { strings, nodes };
};

/**
 * Find the messages on the screen, leaving out the covered ones.
 * @returns {ScreenString[]} Messages.
 */
const scan = () => {
  const { strings, nodes } = collect();

  foundNodes = nodes;

  return strings;
};

/**
 * Find a rendered element showing a message, in its text or an attribute.
 * @param {string} key Message key.
 * @returns {Element | undefined} Element.
 */
const findElement = (key) =>
  (collect({ all: true }).nodes.get(key) ?? [])
    .map(({ node }) => (node instanceof Text ? node.parentElement : node))
    .find((element) => !!element && isRendered(element)) ?? undefined;

// --- Outlines ----------------------------------------------------------------------------------

/**
 * Layer drawing numbered outlines around the messages to review. It’s a popover, so it can be put
 * in the top layer above the app’s dialogs and menus, and lives outside `<body>`, so scans and
 * waits ignore it.
 */
const outlineLayer = document.createElement('div');

outlineLayer.setAttribute('popover', 'manual');
outlineLayer.style.cssText = [
  'position: fixed',
  'inset: 0',
  'width: auto',
  'height: auto',
  'margin: 0',
  'padding: 0',
  'border: 0',
  'background: none',
  'overflow: visible',
  'pointer-events: none',
].join(';');

/**
 * A key to outline, with its number in the list.
 * @typedef {{ key: string, n: number }} OutlineKey
 */

/**
 * Outlines to draw: keys with their number, the selected key, a caption for it (the original text,
 * in the translation’s frame), and the scale the review page shows the frame at.
 * @type {{ keys: OutlineKey[], selected?: string, caption?: string, scale?: number }}
 */
let outlines = { keys: [] };

/**
 * Draw the outlines again, where the messages are now.
 */
const drawOutlines = () => {
  if (!outlineLayer.isConnected) {
    document.documentElement.append(outlineLayer);
  }

  const { keys, selected: selectedKey, caption: original, scale = 1 } = outlines;
  // The review page shrinks the frame: draw lines and text larger, so they stay readable
  const factor = Math.min(Math.max(1 / scale, 1), 4);

  // The selected key last, so its spotlight dims the other outlines too
  const ordered = [
    ...keys.filter(({ key }) => key !== selectedKey),
    ...keys.filter(({ key }) => key === selectedKey),
  ];

  outlineLayer.replaceChildren(
    ...ordered.flatMap(({ key, n }) => {
      const selected = key === selectedKey;
      const color = selected ? '#f59e0b' : '#3b82f6';

      return (foundNodes.get(key) ?? []).flatMap(({ node, label }, index) => {
        // A message that can’t be seen, such as an `aria-label` or visually hidden text, gets a
        // dashed outline around the element that carries it
        const rect = label
          ? getShowingAncestor(
              node instanceof Text ? node.parentElement : node,
            )?.getBoundingClientRect()
          : (() => {
              const range = document.createRange();

              range.selectNodeContents(node);

              return range.getBoundingClientRect();
            })();

        if (!rect || isTiny(rect)) return [];

        const box = document.createElement('div');
        const lineWidth = (selected ? 3 : 2) * factor;

        box.style.cssText = [
          'position: fixed',
          `left: ${rect.x - 2}px`,
          `top: ${rect.y - 2}px`,
          `width: ${rect.width + 4}px`,
          `height: ${rect.height + 4}px`,
          `outline: ${lineWidth}px ${label ? 'dashed' : 'solid'} ${color}`,
          'border-radius: 3px',
          // A spotlight: everything else is dimmed
          selected && index === 0 ? 'box-shadow: 0 0 0 100vmax rgb(15 23 42 / 0.45)' : '',
        ].join(';');

        const captionText = [label, original].filter(Boolean).join(' · ');

        if (selected && index === 0 && captionText) {
          const caption = document.createElement('span');
          const below = rect.bottom + 48 * factor < window.innerHeight;

          caption.textContent = captionText;
          caption.style.cssText = [
            'position: absolute',
            // In the right half, the caption grows leftwards, so it stays in the viewport
            rect.x > window.innerWidth / 2 ? 'right: 0' : 'left: 0',
            below ? 'top: 100%' : 'bottom: 100%',
            `margin: ${(lineWidth + 2).toFixed(1)}px 0`,
            `max-width: min(70vw, ${480 * factor}px)`,
            'width: max-content',
            `padding: ${2 * factor}px ${6 * factor}px`,
            `border-radius: ${3 * factor}px`,
            `background: ${color}`,
            'color: #111',
            `font: 600 ${12 * factor}px/1.3 system-ui, sans-serif`,
          ].join(';');
          box.append(caption);
        }

        if (index === 0) {
          const badge = document.createElement('span');
          const size = 16 * factor;

          badge.textContent = String(n);
          badge.style.cssText = [
            'position: absolute',
            `left: ${-size / 2 - 2}px`,
            `top: ${-size / 2 - 2}px`,
            `min-width: ${size}px`,
            `height: ${size}px`,
            `padding: 0 ${3 * factor}px`,
            `border-radius: ${size / 2}px`,
            `background: ${color}`,
            'color: #fff',
            `font: bold ${11 * factor}px/${size}px system-ui, sans-serif`,
            'text-align: center',
          ].join(';');
          box.append(badge);
        }

        return [box];
      });
    }),
  );

  // Show it again, so it’s above any dialog or menu opened since
  if (outlineLayer.matches(':popover-open')) {
    outlineLayer.hidePopover();
  }

  outlineLayer.showPopover();
};

let drawPending = false;

window.addEventListener(
  'scroll',
  () => {
    if (!drawPending) {
      drawPending = true;
      requestAnimationFrame(() => {
        drawPending = false;
        drawOutlines();
      });
    }
  },
  { capture: true, passive: true },
);

// --- Messaging ---------------------------------------------------------------------------------

/**
 * Send a message to the review page.
 * @param {Record<string, any>} message Message.
 */
const post = (message) => {
  window.parent.postMessage({ ...message, frame: FRAME_ID }, window.location.origin);
};

/**
 * Click an element showing a message.
 * @param {string} key Message key.
 */
const clickMessage = async (key) => {
  const element = await waitFor(() => findElement(key), 4000).catch(() => {
    throw new Error(`Nothing shows the message “${key}”`);
  });

  /** @type {HTMLElement} */ (element.closest(CLICKABLE_SELECTOR) ?? element).click();
};

/**
 * Press a key on the focused element.
 * @param {string} key Key, e.g. `Escape`.
 */
const press = (key) => {
  const target = document.activeElement ?? document.body;

  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
};

/**
 * Check whether a menu, a popup or a dialog is open. Only popup anchors count: an expanded object
 * field, list or tree item also has `aria-expanded="true"`, and Escape would close the editor.
 * @returns {boolean} Result.
 */
const hasOpenPopup = () =>
  !!document.querySelector('dialog[open], [aria-haspopup][aria-expanded="true"]');

/**
 * Get what the screen shows, to tell when it changes: its text, which includes the markers of the
 * message keys. It’s read every few milliseconds, so it doesn’t walk the page or measure layout.
 * @returns {string} Text.
 */
const getScreenSignature = () => document.body.textContent ?? '';

/**
 * Run a scenario: reset what the previous one opened, open the route, run the steps.
 * @param {{ route?: string, steps?: Record<string, string>[] }} scenario Scenario.
 */
const runScenario = async ({ route, steps = [] }) => {
  // The first screen keeps what the app logged while starting, also when it runs again
  const scenarioKey = JSON.stringify({ route, steps });

  startEntries ??= { scenario: scenarioKey, entries: consoleEntries };
  consoleEntries = startEntries.scenario === scenarioKey ? startEntries.entries : [];
  outlines = { keys: [] };
  drawOutlines();

  // Close the menus and dialogs a previous scenario may have opened. Escape is only pressed when
  // one is open: in the content editor it closes the editor, which goes back in the history once
  // its transition ends, after the route below is set, so the app would end up on the previous
  // screen
  for (let attempt = 0; attempt < 2 && hasOpenPopup(); attempt += 1) {
    press('Escape');
    // eslint-disable-next-line no-await-in-loop
    await settle({ quiet: 50, timeout: 1000 });
  }

  document.querySelectorAll('dialog[open]').forEach((dialog) => {
    /** @type {HTMLDialogElement} */ (dialog).close();
  });

  if (route && window.location.hash !== route) {
    const before = getScreenSignature();

    window.location.hash = route;
    // The app takes a moment to show the new route, with a transition when an editor closes: wait
    // for the screen to change, or the scan would find the previous screen
    await waitFor(() => getScreenSignature() !== before, 3000).catch(() => undefined);
  }

  await settle();

  // eslint-disable-next-line no-restricted-syntax
  for (const step of steps) {
    if ('click' in step) {
      // eslint-disable-next-line no-await-in-loop
      await clickMessage(step.click);
    } else if ('wait' in step) {
      // eslint-disable-next-line no-await-in-loop
      await waitFor(() => findElement(step.wait), 4000);
    } else if ('press' in step) {
      press(step.press);
    }

    // eslint-disable-next-line no-await-in-loop
    await settle();
  }
};

window.addEventListener('message', async ({ origin, data }) => {
  if (origin !== window.location.origin || !data?.type) return;

  if (data.type === 'run') {
    const start = performance.now();

    try {
      await runScenario(data.scenario);
      post({ type: 'result', id: data.id, strings: scan(), ms: performance.now() - start });
    } catch (/** @type {any} */ ex) {
      post({ type: 'result', id: data.id, strings: scan(), error: ex.message });
    }
  }

  if (data.type === 'outline') {
    const changed = data.selected !== outlines.selected;

    outlines = {
      keys: data.keys,
      selected: data.selected,
      caption: data.caption,
      scale: data.scale,
    };
    scan();

    // Bring a newly selected message into view, if the app scrolled it away
    const found = changed ? foundNodes.get(data.selected)?.[0] : undefined;
    const element = found?.node instanceof Text ? found.node.parentElement : found?.node;
    const rect = element?.getBoundingClientRect();

    if (element && rect && (rect.bottom < 0 || rect.top > window.innerHeight)) {
      element.scrollIntoView({ block: 'center' });
    }

    drawOutlines();
  }
});

/**
 * Keys of the review page. The app focuses a field or a button now and then, which moves the focus
 * into the frame, so the frame passes them on.
 */
const PAGE_KEYS = ['Enter', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'h', 't', 'v'];

window.addEventListener(
  'keydown',
  (event) => {
    const { key, target, isTrusted, altKey, ctrlKey, metaKey } = event;

    // Keys a scenario step presses aren’t trusted, and a key typed in a field stays there
    if (
      !isTrusted ||
      altKey ||
      ctrlKey ||
      metaKey ||
      !PAGE_KEYS.includes(key.length === 1 ? key.toLowerCase() : key) ||
      (target instanceof HTMLElement &&
        (target.isContentEditable || target.matches('input, textarea, select')))
    ) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    post({ type: 'key', key });
  },
  { capture: true },
);

// Alt+click on a message selects it on the review page instead of clicking it
document.addEventListener(
  'click',
  (event) => {
    if (!event.altKey) return;

    event.preventDefault();
    event.stopPropagation();

    for (
      let element = /** @type {Element | null} */ (event.target);
      element;
      element = element.parentElement
    ) {
      const texts = [
        ...[...element.childNodes].filter((n) => n instanceof Text).map((n) => n.data),
        ...TEXT_ATTRIBUTES.map((attr) => element?.getAttribute(attr) ?? ''),
      ];

      const found = texts.flatMap((text) => splitMarkedText(text))[0];

      if (found) {
        post({ type: 'select', key: found.key });

        return;
      }
    }
  },
  { capture: true },
);

/**
 * Get the texts shown for some keys.
 * @param {string[]} keys Keys.
 * @returns {Map<string, string>} Texts, joined when a key shows more than once, keyed with the key.
 */
const getShownTexts = (keys) => {
  /** @type {Map<string, string[]>} */
  const texts = new Map();

  scan()
    .filter(({ key }) => keys.includes(key))
    .forEach(({ key, text }) => texts.set(key, [...(texts.get(key) ?? []), text]));

  return new Map([...texts].map(([key, list]) => [key, list.join('\n')]));
};

// Apply changed messages in place, keeping the state of the app, e.g. an open dialog. A message
// the app formatted once and kept, e.g. a configuration error, which is formatted when the
// configuration is parsed, still shows the old text: report those, so the page restarts the app
import.meta.hot?.on('l10n-review:messages', async ({ locale, messages, changedKeys = [] }) => {
  if (locale !== LOCALE && locale !== SOURCE_LOCALE) return;

  // A source text change only shows in the translation’s frame where it has no translation: the
  // other keys would look stale and restart the app for nothing
  const ownMessages = /** @type {Record<string, any>} */ (dictionary[LOCALE] ?? {});

  const keys =
    locale === LOCALE
      ? changedKeys
      : changedKeys.filter((/** @type {string} */ key) => !ownMessages[key]);

  const before = getShownTexts(keys);

  updateMessages(locale, messages);
  await settle({ quiet: 50, timeout: 1000 });

  const after = getShownTexts(keys);
  const stale = [...before.keys()].filter((key) => before.get(key) === after.get(key));

  drawOutlines();
  post({ type: 'updated', strings: scan(), stale });
});

// --- Start -------------------------------------------------------------------------------------

/**
 * Wait for the next task, which comes sooner than a timer: the app adds its messages and formats
 * the first ones within a few tasks, so the messages have to be tagged without delay.
 * @returns {Promise<void>}
 */
const nextTask = () =>
  new Promise((resolve) => {
    const channel = new MessageChannel();

    channel.port1.addEventListener('message', () => resolve(undefined));
    channel.port1.start();
    channel.port2.postMessage(undefined);
  });

(async () => {
  const start = performance.now();
  /** @type {Record<string, number>} */
  const phases = {};

  /**
   * Record how long the start took so far.
   * @param {string} name Phase name.
   */
  const mark = (name) => {
    phases[name] = Math.round(performance.now() - start);
  };

  try {
    // The app adds its messages as it starts, right after this script. Then add the target
    // locale’s from the files on the disk, which the app may not have: the locale may be new, or
    // the Sveltia UI strings may come from a checkout of the repository
    while (!dictionary[SOURCE_LOCALE]) {
      // eslint-disable-next-line no-await-in-loop
      await nextTask();
    }

    tagMessages(SOURCE_LOCALE);

    if (LOCALE !== SOURCE_LOCALE) {
      updateMessages(LOCALE, /** @type {any} */ (window).l10nReviewMessages ?? {});
    }

    mark('messages');
    await waitFor(() => appLocale.current === LOCALE, 10000);
    mark('locale');

    if (BOOT.signIn !== false) {
      // A demo site has its own button on the sign-in page
      await clickMessage(BOOT.demo ? 'start_demo' : 'work_with_test_repo');
      // The main screen has the account menu, as the end-to-end tests also expect
      await waitFor(() => findElement('show_account_menu'), 15000).catch(() => {
        throw new Error('Signing in with the test repository didn’t finish');
      });
      mark('signIn');
    }

    await settle();
    mark('settle');
    post({ type: 'ready', ms: performance.now() - start, phases });
  } catch (/** @type {any} */ ex) {
    post({ type: 'ready', ms: performance.now() - start, phases, error: ex.message });
  }
})();
