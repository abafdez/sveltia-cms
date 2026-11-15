/**
 * Invisible markers telling which message a piece of text comes from. A marker is the message key
 * spelled with Unicode tag characters, which mirror printable ASCII and render as nothing, between
 * the language tag and cancel tag characters. The app shows `<marker>Save` where it would show
 * `Save`, so a scan of the page finds every message with its key, in text and in attributes.
 */

/**
 * Character starting a marker.
 */
const MARKER_START = '\u{E0001}';
/**
 * Character ending a marker.
 */
const MARKER_END = '\u{E007F}';
/**
 * Offset between an ASCII character and the tag character mirroring it.
 */
const TAG_OFFSET = 0xe0000;
/**
 * Regular expression matching a marker, capturing the tag characters spelling the key.
 */
const MARKER_REGEX = /\u{E0001}([\u{E0020}-\u{E007E}]+)\u{E007F}/gu;

/**
 * Get the marker of a message key.
 * @param {string} key Message key, in printable ASCII.
 * @returns {string} Marker.
 */
export const encodeKey = (key) =>
  MARKER_START +
  [...key]
    .map((char) => /** @type {number} */ (char.codePointAt(0)))
    .filter((code) => code >= 0x20 && code <= 0x7e)
    .map((code) => String.fromCodePoint(TAG_OFFSET + code))
    .join('') +
  MARKER_END;

/**
 * Get the key a marker spells.
 * @param {string} tags Tag characters of the marker.
 * @returns {string} Message key.
 */
const decodeTags = (tags) =>
  [...tags]
    .map((char) => String.fromCodePoint(/** @type {number} */ (char.codePointAt(0)) - TAG_OFFSET))
    .join('');

/**
 * Check whether a text has any marker, cheaply.
 * @param {string | null | undefined} text Text.
 * @returns {boolean} Whether it has one.
 */
export const hasMarker = (text) => !!text && text.includes(MARKER_START);

/**
 * Split a text into the messages it shows. Text before the first marker isn’t from a message and
 * is left out.
 * @param {string} text Text.
 * @returns {{ key: string, text: string }[]} Message keys with their text, markers removed.
 */
export const splitMarkedText = (text) => {
  if (!hasMarker(text)) {
    return [];
  }

  const matches = [...text.matchAll(MARKER_REGEX)];

  return matches.map((match, index) => {
    const start = /** @type {number} */ (match.index) + match[0].length;
    const end = matches[index + 1]?.index ?? text.length;

    return {
      key: decodeTags(match[1]),
      // eslint-disable-next-line no-use-before-define
      text: stripMarkers(text.slice(start, end)).trim(),
    };
  });
};

/**
 * Remove the markers from a text.
 * @param {string} text Text.
 * @returns {string} Text without markers.
 */
export const stripMarkers = (text) => text.replace(MARKER_REGEX, '');
