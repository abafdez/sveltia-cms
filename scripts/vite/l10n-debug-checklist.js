import { readFileSync } from 'fs';
import path from 'path';

import { APP_LOCALES_DIR } from './locales.js';

/**
 * How to get to each part of the app, keyed with the section headings of `en-US.yaml`. The sample
 * site the overlay serves has the collections mentioned here. A section without a hint is still
 * listed.
 */
const HINTS = {
  'Common Actions': 'Buttons used everywhere. They show up as you go through the other parts.',
  'Common UI Elements': 'Toolbar regions of each page, and a search without results.',
  'Miscellaneous Labels': 'Slug field, singletons, and the Copy buttons.',
  'Sign-In Page':
    'Sign out from the account menu. Most errors need a Git backend and can’t be reached here.',
  'Authentication and Account': 'Account menu (top right) and the Sign In with Mobile dialog.',
  'Global Toolbar':
    'Toolbar of each page: the Create (+) menu, notifications, the Help menu and the infobars.',
  'Content and Asset Libraries':
    'Collection list, a collection, a singleton, the list and grid views, and the asset folders.',
  'List Controls: Sort, Filter, and Group':
    'Sort, Filter and Group menus of a collection (Posts has all three) and of the Asset Library.',
  'Entry and Collection Actions':
    'Collections that can’t be added to or have a limit (Announcements, FAQs…).',
  Search: 'Search from the Contents and Assets pages, with and without results.',
  'Asset Management':
    'Asset Library: upload, rename, replace, edit a text file (guide.txt), new/rename/delete folder.',
  'Delete Confirmations':
    'Delete an asset, several assets, an entry and several entries, including ones in use.',
  'Entry Reordering': 'A collection with manual order: FAQs.',
  'Bulk Entry Editing':
    'Venues: switch to the table view and use Edit Entries in Bulk, then save and cancel edits.',
  'File Upload and Processing':
    'Upload to Image/File fields: large, unsupported and convertible files.',
  'Entry Management': 'Create, duplicate and delete entries; the menus of the entry editor.',
  'Success Notifications': 'Toasts after saving, deleting, renaming, copying and uploading.',
  'Content Editor':
    'Entry editor: toolbar menus, preview, revert/restore dialogs, and the locale switcher in the' +
    ' multilingual collections (Articles, Guides, Destinations).',
  'Field Validation': 'Save entries with empty required fields or invalid values (Events).',
  'Entry Sidebar': 'Entry editor sidebar: Validation, Slug, History and Backlinks panels.',
  'Asset Editor': 'Open an asset in the Asset Library.',
  'Asset Info Panel': 'Select an asset and show its info panel.',
  'List and Object Field Controls':
    'List and Object fields: add, remove, move, copy/paste and collapse items (Events, Posts).',
  'Field Widgets': 'Every field type: Events covers the ones Posts doesn’t.',
  'Cloud Storage Services':
    'Asset picker of an Image field: external locations and stock photos need API keys.',
  'Configuration Validation':
    'Only shown with an invalid configuration, so it can’t be reached with the sample site.',
  'Local Workflow': 'Sign out and use Work with Local Repository (Chromium-based browsers).',
  'Editorial Workflow':
    'Needs a Git backend with publish_mode: editorial_workflow, not the test repository.',
  'Settings Dialog': 'Account menu › Settings: go through every tab.',
  'Keyboard Shortcuts': 'Help menu › Keyboard Shortcuts.',
  'File Type Labels': 'Info panel of assets of different types.',
  'File Size Units': 'Info panel and upload previews of files of different sizes.',
};

/**
 * Regular expression matching a section banner line in a locale file.
 */
const BANNER_REGEX = /^# =+$/;
/**
 * Regular expression matching a top-level key in a locale file.
 */
const TOP_LEVEL_KEY_REGEX = /^([A-Za-z_][\w-]*):/;

/**
 * Get the section each top-level key of a locale file is in. A section starts with a banner: a
 * line of `=` signs, the heading and another line of `=` signs, all commented out.
 * @param {string} content Content of the locale file.
 * @returns {Map<string, string>} Section headings, keyed with the top-level key.
 */
export const getKeySections = (content) => {
  const lines = content.split('\n');
  /** @type {Map<string, string>} */
  const sections = new Map();
  let section = '';

  lines.forEach((line, index) => {
    if (BANNER_REGEX.test(line) && BANNER_REGEX.test(lines[index + 2] ?? '')) {
      section = lines[index + 1].replace(/^#\s*/, '').trim();

      return;
    }

    const [, key] = line.match(TOP_LEVEL_KEY_REGEX) ?? [];

    if (key) {
      sections.set(key, section);
    }
  });

  return sections;
};

/**
 * Build the checklist of the Sveltia CMS strings: an item for each section of `en-US.yaml`, with
 * the keys in it and a hint on how to get to that part of the app.
 * @param {string[]} keys Dot-separated paths of all the Sveltia CMS messages.
 * @param {string} source Package name.
 * @returns {import('@sveltia/utils/l10n-debug').L10nDebugChecklistItem[]} Items.
 */
export const getCmsChecklist = (keys, source) => {
  const sections = getKeySections(
    readFileSync(path.resolve(APP_LOCALES_DIR, 'en-US.yaml'), 'utf-8'),
  );

  /** @type {Map<string, string[]>} */
  const groups = new Map();

  keys.forEach((key) => {
    const section = sections.get(key.split('.')[0]) || 'Other';

    groups.set(section, [...(groups.get(section) ?? []), key]);
  });

  // List the sections in the order of the file, and the keys outside any section at the end
  const order = [...new Set(sections.values())];

  /**
   * Get the position of a section in the file.
   * @param {string} label Section heading.
   * @returns {number} Position.
   */
  const getPosition = (label) => {
    const index = order.indexOf(label);

    return index === -1 ? order.length : index;
  };

  return [...groups]
    .sort(([a], [b]) => getPosition(a) - getPosition(b))
    .map(([label, groupKeys]) => ({
      id: `${source}:${label}`,
      label,
      source,
      keys: groupKeys,
      group: source,
      hint: /** @type {Record<string, string>} */ (HINTS)[label],
    }));
};
