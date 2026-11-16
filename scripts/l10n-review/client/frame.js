/**
 * Script loaded in each app frame of the review page, before the app starts. It gives the frame its
 * own storage and language, tags every message with its key, runs the scenarios the page asks for,
 * reports the messages on the screen, and applies changed messages in place.
 */

import { addMessages, locale as appLocale, dictionary } from '@sveltia/i18n';
import { mount, unmount } from 'svelte';

import { encodeKey, hasMarker, splitMarkedText } from './markers.js';
import Showcase from './showcase.svelte';

/**
 * A message found on the screen.
 * @typedef {object} ScreenString
 * @property {string} key Message key.
 * @property {string} text Text shown, without markers.
 * @property {'text' | 'hidden' | 'attr' | 'title' | 'console' | 'gone'} kind Where it is: visible
 * text, text hidden from sight but read by assistive technology, an attribute such as `aria-label`,
 * the page title, a message logged to the browser console, or a notification or announcement that
 * showed on the screen and has gone since.
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
 * @type {{ signIn?: boolean, demo?: boolean, devMode?: boolean, git?: string, env?: string[],
 * services?: string[], mocks?: { url: string, method?: string, status?: number, json?: any }[] }}
 */
const BOOT = JSON.parse(params.get('boot') ?? '{}');
/**
 * Session of the user signed in to the frame’s Git repository, which the server gives a frame
 * starting with one.
 * @type {Record<string, any> | undefined}
 */
const SESSION = /** @type {any} */ (window).l10nReviewSession;

/**
 * Hosts of the requests the frame’s Git repository answers. Keep in sync with `GIT_HOSTS` in
 * `git.js`.
 */
const GIT_HOSTS = [
  'https://api.github.com/',
  'https://www.githubstatus.com/',
  'https://avatars.githubusercontent.com/',
];

/**
 * Messages with strings the app logged to the console since the current screen opened, or since
 * the app started for the first screen. Some strings only appear there, like configuration
 * warnings.
 * @type {{ level: string, text: string }[]}
 */
let consoleEntries = [];
/**
 * What the app logged while starting, and the messages that showed briefly meanwhile, kept for
 * the first screen, and for that screen again when the page runs it once more in the same frame:
 * the app doesn’t show them twice.
 * @type {{ scenario: string, entries: { level: string, text: string }[], brief: Map<string,
 * string> } | undefined}
 */
let startEntries;
/**
 * Whether a scenario has run since the app started. The first one has nothing to reset, and
 * mustn’t close a dialog the app opened as it started, like the welcome dialog of a demo site.
 */
let hasRun = false;
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

// --- Online services ---------------------------------------------------------------------------

/**
 * A sample photo of a stock photo service, from the demo’s images.
 * @param {number} index Index.
 * @returns {Record<string, any>} Photo, as Unsplash lists it.
 */
const createStockPhoto = (index) => {
  const url = `${window.location.origin}/l10n-review/site/seed/static/images/bruges.webp`;

  return {
    id: `photo-${index}`,
    description: 'Canal in Bruges',
    alt_description: null,
    urls: { regular: url, thumb: url },
    user: { username: 'sample', name: 'Sample Photographer' },
    links: {},
  };
};

/**
 * Online services the app can work with, faked in the frame: each answers its requests, and has
 * the API key the app needs to use it. Keep in sync with `SERVICES` in `scenarios.js`.
 * @type {Record<string, { serviceId: string, apiKey: string, test: (url: string) => boolean,
 * respond: (request: Request) => Promise<Response> }>}
 */
const SERVICE_FAKES = {
  'google-translate': {
    serviceId: 'google',
    apiKey: `AIza${'A'.repeat(35)}`,
    // eslint-disable-next-line jsdoc/require-jsdoc
    test: (url) => url.startsWith('https://translation.googleapis.com/'),
    // eslint-disable-next-line jsdoc/require-jsdoc
    respond: async (request) => {
      const { q = [], target = '' } = await request.json();

      return Response.json({
        data: {
          translations: q.map((/** @type {string} */ text) => ({
            translatedText: `[${target}] ${text}`,
          })),
        },
      });
    },
  },
  'google-translate-error': {
    serviceId: 'google',
    apiKey: `AIza${'A'.repeat(35)}`,
    // eslint-disable-next-line jsdoc/require-jsdoc
    test: (url) => url.startsWith('https://translation.googleapis.com/'),
    // eslint-disable-next-line jsdoc/require-jsdoc
    respond: async () => Response.json({ error: { message: 'Quota exceeded' } }, { status: 429 }),
  },
  unsplash: {
    serviceId: 'unsplash',
    apiKey: 'a'.repeat(43),
    // eslint-disable-next-line jsdoc/require-jsdoc
    test: (url) => url.startsWith('https://api.unsplash.com/'),
    // eslint-disable-next-line jsdoc/require-jsdoc
    respond: async (request) => {
      const photos = [0, 1, 2].map(createStockPhoto);

      return Response.json(
        new URL(request.url).pathname.startsWith('/search/')
          ? { results: photos, total: photos.length, total_pages: 1 }
          : photos,
      );
    },
  },
};

/**
 * Fakes of the services the scenario uses.
 */
const services = (BOOT.services ?? [])
  .filter((name) => Object.hasOwn(SERVICE_FAKES, name))
  .map((name) => SERVICE_FAKES[name]);

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
      // The API keys of the faked online services, which the app needs to use them
      ...(services.length
        ? {
            apiKeys: Object.fromEntries(
              services.map(({ serviceId, apiKey }) => [serviceId, apiKey]),
            ),
          }
        : {}),
    }),
    // The app signs in on its own with a stored session
    ...(SESSION ? { 'sveltia-cms.user': JSON.stringify(SESSION) } : {}),
  }),
});

// The browser language is the frame’s, so the app doesn’t suggest switching to another one in a
// notice that would shift the screen in one frame only. A scenario can set another one below
Object.defineProperty(navigator, 'language', { configurable: true, value: LOCALE });
Object.defineProperty(navigator, 'languages', { configurable: true, value: [LOCALE] });

// --- Browser ---------------------------------------------------------------------------------

/**
 * Browser conditions a scenario starts the app in, faked before the app starts. Keep in sync with
 * `ENV_CONDITIONS` in `scenarios.js`.
 * @type {Record<string, () => void>}
 */
const ENV_CONDITIONS = {
  /**
   * A browser missing a feature the app needs.
   */
  'unsupported-browser': () => {
    // @ts-ignore
    delete Uint8Array.fromBase64;
  },
  /**
   * A browser without the File System Access API, so no local repository.
   */
  'no-local-backend': () => {
    // @ts-ignore
    delete Window.prototype.showDirectoryPicker;
    // @ts-ignore
    delete window.showDirectoryPicker;
  },
  /**
   * Brave, which turns the File System Access API off by default.
   */
  brave: () => {
    ENV_CONDITIONS['no-local-backend']();
    Object.defineProperty(navigator, 'userAgentData', {
      configurable: true,
      value: { brands: [{ brand: 'Brave', version: '1' }], platform: 'Linux', mobile: false },
    });
  },
  /**
   * A browser that can’t write to the origin private file system, like Safari before 26.
   */
  'test-repo-unsupported': () => {
    // @ts-ignore
    delete FileSystemFileHandle.prototype.createWritable;
  },
  /**
   * A page served over HTTP from another host than localhost.
   */
  insecure: () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
  },
  /**
   * A browser that won’t let the page read the clipboard.
   */
  'clipboard-denied': () => {
    // eslint-disable-next-line jsdoc/require-jsdoc
    navigator.clipboard.read = async () => {
      throw new DOMException('Read permission denied.', 'NotAllowedError');
    };
  },
  /**
   * A clipboard holding text, not an image.
   */
  'clipboard-text': () => {
    // eslint-disable-next-line jsdoc/require-jsdoc
    navigator.clipboard.read = async () => [new ClipboardItem({ 'text/plain': 'Hello' })];
  },
  /**
   * A user who doesn’t let the page know where they are.
   */
  'geolocation-denied': () => {
    // eslint-disable-next-line jsdoc/require-jsdoc
    navigator.geolocation.getCurrentPosition = (_success, error) => {
      error?.(
        /** @type {GeolocationPositionError} */ ({
          code: 1,
          message: 'User denied Geolocation',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        }),
      );
    };
  },
  /**
   * A browser without geolocation.
   */
  'no-geolocation': () => {
    // @ts-ignore
    delete Navigator.prototype.geolocation;
  },
  /**
   * A device with a touch screen and no mouse.
   */
  touch: () => {
    const { matchMedia } = window;

    // eslint-disable-next-line jsdoc/require-jsdoc
    window.matchMedia = (query) => {
      const result = matchMedia.call(window, query);
      const fine = /\(\s*(?:any-)?pointer\s*:\s*fine\s*\)/.test(query);
      const coarse = /\(\s*(?:any-)?pointer\s*:\s*coarse\s*\)/.test(query);

      if (!fine && !coarse) {
        return result;
      }

      // The list never changes, so its listeners are never called
      return /** @type {MediaQueryList} */ (
        /** @type {unknown} */ ({
          matches: coarse,
          media: query,
          onchange: null,
          /**
           * Add a listener, never called.
           * @returns {undefined} Nothing.
           */
          addEventListener: () => undefined,
          /**
           * Remove a listener.
           * @returns {undefined} Nothing.
           */
          removeEventListener: () => undefined,
          /**
           * Add a listener, never called.
           * @returns {undefined} Nothing.
           */
          addListener: () => undefined,
          /**
           * Remove a listener.
           * @returns {undefined} Nothing.
           */
          removeListener: () => undefined,
          /**
           * Dispatch an event, which does nothing.
           * @returns {boolean} `false`.
           */
          dispatchEvent: () => false,
        })
      );
    };
  },
  /**
   * A browser in another language the app is available in, which it suggests switching to.
   */
  'browser-language': () => {
    const language = LOCALE.startsWith('ja') ? 'fr' : 'ja';

    Object.defineProperty(navigator, 'language', { configurable: true, value: language });
    Object.defineProperty(navigator, 'languages', { configurable: true, value: [language] });
  },
};

(BOOT.env ?? []).forEach((name) => {
  ENV_CONDITIONS[name]?.();
});

/**
 * Let the app offer to be installed, as the browser does for an installable site, once the app
 * listens for it.
 */
const offerInstall = () => {
  const event = new Event('beforeinstallprompt', { cancelable: true });

  window.dispatchEvent(
    Object.assign(event, {
      platforms: ['web'],
      userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
      // eslint-disable-next-line jsdoc/require-jsdoc
      prompt: async () => ({ outcome: 'dismissed' }),
    }),
  );
};

// --- Leaving ---------------------------------------------------------------------------------

// The app asks before the page is left with unsaved changes, which a screen typing in a field
// leaves. The review page loads another page in the frame for the next start, and the question
// would stop it, or in a headless run keep the old page for good: let the frame go without asking
{
  const { addEventListener } = window;

  window.addEventListener = /** @type {typeof window.addEventListener} */ (
    /**
     * Add an event listener, unless it’s for `beforeunload`.
     * @param {string} type Event type.
     * @param {...any} rest Other arguments.
     */
    function addListener(type, ...rest) {
      if (type !== 'beforeunload') {
        addEventListener.call(this, type, ...rest);
      }
    }
  );

  Object.defineProperty(window, 'onbeforeunload', {
    configurable: true,
    // eslint-disable-next-line jsdoc/require-jsdoc
    get: () => null,
    /**
     * Ignore a handler.
     */
    set: () => {},
  });
}

// --- Requests ----------------------------------------------------------------------------------

const realFetch = window.fetch.bind(window);

/**
 * Answer the requests matching a mock of the scenario with its response, and pass the requests to
 * GitHub to the frame’s Git repository on the server.
 * @param {RequestInfo | URL} input Request.
 * @param {RequestInit} [init] Options.
 * @returns {Promise<Response>} Response.
 */
window.fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const service = services.find(({ test }) => test(url));

  if (service) {
    return service.respond(new Request(input, init));
  }

  if (BOOT.git && GIT_HOSTS.some((host) => url.startsWith(host))) {
    const request = new Request(input, init);

    return realFetch(
      `/l10n-review/git/${encodeURIComponent(FRAME_ID)}?url=${encodeURIComponent(url)}`,
      {
        method: request.method,
        headers: request.headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
        signal: request.signal,
      },
    );
  }

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

// --- Brief messages ----------------------------------------------------------------------------

/**
 * Elements whose messages may only show for a moment: notifications and screen reader
 * announcements, which are live regions.
 */
const LIVE_SELECTOR = '[role="status"], [role="alert"], [role="log"], [aria-live]';
/**
 * Messages that showed in a live region since the current screen opened, keyed with their key, so
 * a toast that hid itself, or an announcement cleared after it was read, is still listed.
 * @type {Map<string, string>}
 */
let shownBriefly = new Map();

/**
 * Record the messages of a text node in a live region.
 * @param {Node} node Node.
 */
const recordBrief = (node) => {
  // Most of what the app adds is outside live regions: skip it without looking at its text
  if (
    node instanceof Element &&
    !node.closest(LIVE_SELECTOR) &&
    !node.querySelector(LIVE_SELECTOR)
  ) {
    return;
  }

  const nodes =
    node instanceof Text
      ? [node]
      : node instanceof Element
        ? [...node.querySelectorAll('*')].flatMap((el) =>
            [...el.childNodes].filter((child) => child instanceof Text),
          )
        : [];

  if (node instanceof Element) {
    nodes.push(...[...node.childNodes].filter((child) => child instanceof Text));
  }

  nodes.forEach((text) => {
    if (hasMarker(text.data) && text.parentElement?.closest(LIVE_SELECTOR)) {
      const texts = new Map(
        splitMarkedText(text.parentElement.textContent ?? '').map((m) => [m.key, m.text]),
      );

      splitMarkedText(text.data).forEach(({ key, text: value }) => {
        shownBriefly.set(key, texts.get(key) ?? value);
      });
    }
  });
};

new MutationObserver((records) => {
  records.forEach(({ type, target, addedNodes }) => {
    if (type === 'characterData') {
      recordBrief(target);
    } else {
      addedNodes.forEach(recordBrief);
    }
  });
}).observe(document.documentElement, { subtree: true, childList: true, characterData: true });

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

  // Notifications and announcements that have gone since they showed
  shownBriefly.forEach((text, key) => {
    if (!nodes.has(key)) {
      strings.push({ key, text, kind: 'gone' });
    }
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
 * What a step acts on: an element showing a message, by its key; a field of the entry editor, by
 * its key path, e.g. `{ field: 'title' }`, as field labels come from the configuration, not from
 * messages, optionally with the key of a message in it, e.g. `{ field: 'blocks', key: 'add_x' }`;
 * an element by its text, for a name that isn’t a message, like a service name; or the item at an
 * index among the buttons, radios, options and the like in an element showing a message, e.g. `{
 * in: 'switch_locale', index: 1 }`, for items named in the frame’s language, like languages.
 * @typedef {string | { field: string, key?: string } | { text: string } | { in: string, index:
 * number }} StepTarget
 */

/**
 * Find a rendered element whose own text is the given text, the innermost one.
 * @param {string} text Text.
 * @returns {Element | undefined} Element.
 */
const findByText = (text) =>
  [...document.body.querySelectorAll('*')]
    .filter(
      (el) =>
        [...el.childNodes].some(
          (node) =>
            node instanceof Text &&
            node.data.trim() === text &&
            splitMarkedText(node.data).length === 0,
        ) && isRendered(el),
    )
    .at(-1);

/**
 * A file a step drops or uploads, made up on the spot.
 * @typedef {object} SampleFile
 * @property {string} name File name.
 * @property {string} [type] Media type.
 * @property {string} [text] Content. Defaults to the name.
 * @property {number} [size] Size in bytes, for a file too large to upload: the content is then that
 * many spaces.
 */

/**
 * Find an element carrying a message in its text or an attribute, even if it isn’t rendered: some
 * buttons only show on hover, like the field options, but a script can click them anyway.
 * @param {string} key Message key.
 * @param {Element} [root] Element to look in.
 * @returns {Element | undefined} Element.
 */
const findAnyElement = (key, root = document.body) => {
  const marker = encodeKey(key);

  return [...root.querySelectorAll('*')].find(
    (el) =>
      [...el.attributes].some(({ value }) => value.includes(marker)) ||
      [...el.childNodes].some((node) => node instanceof Text && node.data.includes(marker)),
  );
};

/**
 * Find what a step acts on, waiting for it to show.
 * @param {StepTarget} target Target.
 * @returns {Promise<HTMLElement>} Element.
 * @throws {Error} If nothing shows it.
 */
const findTarget = async (target) => {
  const element = await waitFor(
    () =>
      typeof target === 'string'
        ? (findElement(target) ?? findAnyElement(target))
        : 'in' in target
          ? (findElement(target.in) ?? findAnyElement(target.in))?.querySelectorAll(
              CLICKABLE_SELECTOR,
            )[target.index]
          : 'text' in target
            ? findByText(target.text)
            : (() => {
                // The editor comes before the preview, which shows the same key paths
                const field = [
                  ...document.querySelectorAll(`[data-key-path="${CSS.escape(target.field)}"]`),
                ].find((el) => isRendered(el));

                return field && target.key ? findAnyElement(target.key, field) : field;
              })(),
    4000,
  ).catch(() => {
    throw new Error(
      typeof target === 'string'
        ? `Nothing shows the message “${target}”`
        : 'in' in target
          ? `No item ${target.index} in “${target.in}”`
          : 'text' in target
            ? `Nothing shows “${target.text}”`
            : `The entry has no “${target.field}” field on the screen`,
    );
  });

  return /** @type {HTMLElement} */ (element);
};

/**
 * Click what a step acts on, e.g. an element showing a message.
 * @param {StepTarget} target Target.
 */
const clickTarget = async (target) => {
  const element = await findTarget(target);

  /** @type {HTMLElement} */ (element.closest(CLICKABLE_SELECTOR) ?? element).click();
};

/**
 * Selector of the elements text can be typed in.
 */
const FIELD_SELECTOR = 'input:not([type="hidden"]), textarea, [contenteditable="true"]';

/**
 * Find the text field of a target: the target itself, the control its label is for, the field the
 * label names with `aria-labelledby`, or else the first field inside it or after it in its group.
 * @param {HTMLElement} element Target.
 * @returns {HTMLElement | undefined} Field.
 */
const findField = (element) => {
  if (element.matches(FIELD_SELECTOR)) return element;

  const label = element.closest('label');

  if (label?.control) return /** @type {HTMLElement} */ (label.control);

  const labelled = element.id
    ? document.querySelector(`[aria-labelledby~="${CSS.escape(element.id)}"]`)
    : null;

  return /** @type {HTMLElement | undefined} */ (
    (labelled?.matches(FIELD_SELECTOR) ? labelled : labelled?.querySelector(FIELD_SELECTOR)) ??
      element.querySelector(FIELD_SELECTOR) ??
      element
        .closest('[role="group"], [role="dialog"], [role="alertdialog"], fieldset, section')
        ?.querySelector(FIELD_SELECTOR) ??
      undefined
  );
};

/**
 * Replace the text of a field, as typing would.
 * @param {StepTarget} target Field, or what labels it.
 * @param {string} text Text.
 * @throws {Error} If the target has no field.
 */
const typeText = async (target, text) => {
  const field = findField(await findTarget(target));

  if (!field) {
    throw new Error(`No text field for ${JSON.stringify(target)}`);
  }

  field.focus();

  if (field.isContentEditable) {
    document.getSelection()?.selectAllChildren(field);
    document.execCommand('insertText', false, text);

    return;
  }

  const input = /** @type {HTMLInputElement | HTMLTextAreaElement} */ (field);

  // The setter of the prototype, as a framework may watch the property of the element
  const { set } = /** @type {PropertyDescriptor} */ (
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')
  );

  set?.call(input, text);
  input.dispatchEvent(
    new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }),
  );
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

/**
 * Make files to drop or upload.
 * @param {SampleFile[]} files Files.
 * @returns {DataTransfer} Data transfer holding the files.
 */
const createFiles = (files) => {
  const transfer = new DataTransfer();

  files.forEach(({ name, type = '', text, size }) => {
    transfer.items.add(
      new File([size === undefined ? (text ?? name) : ' '.repeat(size)], name, { type }),
    );
  });

  return transfer;
};

/**
 * Drag files over an element, and drop them unless only the drag is wanted.
 * @param {StepTarget} target Drop zone, or an element in it.
 * @param {SampleFile[]} files Files.
 * @param {object} [options] Options.
 * @param {boolean} [options.drop] Whether to drop them.
 */
const dragFiles = async (target, files, { drop = true } = {}) => {
  const element = await findTarget(target);
  const dataTransfer = createFiles(files);
  const events = drop ? ['dragenter', 'dragover', 'drop'] : ['dragenter', 'dragover'];

  events.forEach((type) => {
    element.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));
  });
};

/**
 * Choose files with the file input of a button, as the file picker would.
 * @param {StepTarget} target Button opening the file picker, or an element near the input.
 * @param {SampleFile[]} files Files.
 * @throws {Error} If there’s no file input.
 */
const uploadFiles = async (target, files) => {
  const element = await findTarget(target);

  const input = /** @type {HTMLInputElement | null} */ (
    [
      element,
      // A closed dialog may stay in the page, with a file input of its own
      ...[...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].filter((el) =>
        isRendered(el),
      ),
      document.body,
    ]
      .map((el) => el.closest('div, section, dialog, body')?.querySelector('input[type="file"]'))
      .find(Boolean) ?? null
  );

  if (!input) {
    throw new Error(`No file input for ${JSON.stringify(target)}`);
  }

  input.files = createFiles(files).files;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

/**
 * Open the context menu of an element.
 * @param {StepTarget} target Element.
 */
const rightClick = async (target) => {
  const element = await findTarget(target);
  const { x, y, width, height } = element.getBoundingClientRect();

  element.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2,
      clientX: x + width / 2,
      clientY: y + height / 2,
    }),
  );
};

/**
 * Change the frame’s Git repository on the server, e.g. to commit as a colleague.
 * @param {string} name Name of an action in `GIT_ACTIONS` of `git.js`.
 * @throws {Error} If the action fails.
 */
const runGitAction = async (name) => {
  const response = await realFetch(`/l10n-review/git/${encodeURIComponent(FRAME_ID)}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    // The server answers an error as JSON, but a request it doesn’t route gets plain text
    const { error = response.statusText } = await response.json().catch(() => ({}));

    throw new Error(`The Git action “${name}” failed: ${error}`);
  }
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
 * The Sveltia UI showcase a scenario mounted over the app, removed by the next scenario.
 * @type {Record<string, any> | undefined}
 */
let showcase;

/**
 * Show the Sveltia UI components the app doesn’t show over the app, with their strings.
 * @param {{ dialog?: boolean }} props Props of the showcase.
 */
const showShowcase = (props) => {
  showcase = mount(Showcase, { target: document.body, props });
};

/**
 * Open a route, and wait for the screen to show it.
 * @param {string} route Route, e.g. `#/collections/posts`.
 */
const goTo = async (route) => {
  if (window.location.hash === route) return;

  const before = getScreenSignature();

  window.location.hash = route;
  // The app takes a moment to show the new route, with a transition when an editor closes: wait for
  // the screen to change, or the scan would find the previous screen
  await waitFor(() => getScreenSignature() !== before, 3000).catch(() => undefined);
};

/**
 * Run a scenario: reset what the previous one opened, open the route, run the steps.
 * @param {{ route?: string, steps?: Record<string, any>[] }} scenario Scenario.
 */
const runScenario = async ({ route, steps = [] }) => {
  // The first screen keeps what the app logged while starting, also when it runs again
  const scenarioKey = JSON.stringify({ route, steps });
  const isFirstRun = !startEntries;

  startEntries ??= { scenario: scenarioKey, entries: consoleEntries, brief: shownBriefly };

  const isStartScreen = startEntries.scenario === scenarioKey;

  consoleEntries = isStartScreen ? startEntries.entries : [];
  // The first screen also keeps what showed while the app started, like a sign-in error, also when
  // it runs again. Its first run adds to the kept messages, as a message the app shows once, like a
  // late loading notification, may only show then; a later run adds to a copy
  shownBriefly = isStartScreen
    ? isFirstRun
      ? startEntries.brief
      : new Map(startEntries.brief)
    : new Map();
  outlines = { keys: [] };
  drawOutlines();

  if (showcase) {
    unmount(showcase);
    showcase = undefined;
  }

  // Close the menus and dialogs a previous scenario may have opened. Escape is only pressed when
  // one is open: in the content editor it closes the editor, which goes back in the history once
  // its transition ends, after the route below is set, so the app would end up on the previous
  // screen
  for (let attempt = 0; hasRun && attempt < 2 && hasOpenPopup(); attempt += 1) {
    press('Escape');
    // eslint-disable-next-line no-await-in-loop
    await settle({ quiet: 50, timeout: 1000 });
  }

  if (hasRun) {
    document.querySelectorAll('dialog[open]').forEach((dialog) => {
      /** @type {HTMLDialogElement} */ (dialog).close();
    });
  }

  hasRun = true;

  if (route) {
    await goTo(route);
  }

  await settle();

  // eslint-disable-next-line no-restricted-syntax
  for (const step of steps) {
    /* eslint-disable no-await-in-loop */
    if ('click' in step) {
      await clickTarget(step.click);
    } else if ('wait' in step) {
      await waitFor(() => findElement(step.wait), 6000).catch(() => {
        throw new Error(`The message “${step.wait}” didn’t show`);
      });
    } else if ('press' in step) {
      press(step.press);
    } else if ('type' in step) {
      await typeText(step.type, step.text ?? '');
    } else if ('rightClick' in step) {
      await rightClick(step.rightClick);
    } else if ('drop' in step) {
      await dragFiles(step.drop, step.files ?? []);
    } else if ('dragOver' in step) {
      await dragFiles(step.dragOver, step.files ?? [{ name: 'photo.jpg', type: 'image/jpeg' }], {
        drop: false,
      });
    } else if ('upload' in step) {
      await uploadFiles(step.upload, step.files ?? []);
    } else if ('focus' in step) {
      (findField(await findTarget(step.focus)) ?? (await findTarget(step.focus))).focus();
    } else if ('git' in step) {
      await runGitAction(step.git);
    } else if ('route' in step) {
      await goTo(step.route);
    } else if ('showcase' in step) {
      showShowcase(step.showcase === true ? {} : step.showcase);
    }
    /* eslint-enable no-await-in-loop */

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
      // With a Git repository, the app signs in with the stored session. A demo site has its own
      // button on the sign-in page
      if (!BOOT.git) {
        await clickTarget(BOOT.demo ? 'start_demo' : 'work_with_test_repo');
      }

      // The main screen has the account menu, as the end-to-end tests also expect
      await waitFor(() => findElement('show_account_menu'), 15000).catch(() => {
        throw new Error('Signing in didn’t finish');
      });
      mark('signIn');
    }

    if (BOOT.env?.includes('installable')) {
      offerInstall();
    }

    await settle();
    mark('settle');
    post({ type: 'ready', ms: performance.now() - start, phases });
  } catch (/** @type {any} */ ex) {
    post({ type: 'ready', ms: performance.now() - start, phases, error: ex.message });
  }
})();
