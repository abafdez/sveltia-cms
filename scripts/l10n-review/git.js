/**
 * A Git host for the screens that need one, such as the Editorial Workflow: the in-memory GitHub
 * repository the end-to-end tests use (`e2e/fixtures/github.js`), filled with the sample site. The
 * tests keep it answering the app’s requests as the app changes, so the review tool doesn’t have
 * to.
 *
 * Each app frame gets its own repository when it starts. The frame sends its requests to GitHub to
 * the review tool’s server, which passes them to the frame’s repository, so the app works with it
 * as it would with GitHub, committing and opening pull requests.
 */

// cspell:ignore githubstatus

import { readFile } from 'fs/promises';
import path from 'path';

import { MockGitHub } from '../../e2e/fixtures/github.js';

import { getDemoDir, listSeedFiles } from './site.js';

/**
 * @import { IncomingMessage, ServerResponse } from 'http';
 * @import { MockResponse } from '../../e2e/fixtures/git.js';
 */

/**
 * Hosts of the requests passed to the repository: the API, the status page and the avatars.
 */
export const GIT_HOSTS = [
  'https://api.github.com/',
  'https://www.githubstatus.com/',
  'https://avatars.githubusercontent.com/',
];

/**
 * Backend configuration for the repository.
 */
export const GITHUB_BACKEND = { name: 'github', repo: 'sveltia/e2e-site', branch: 'main' };

/**
 * Posts with a pull request in the Editorial Workflow setup, by their status.
 */
export const WORKFLOW_POSTS = {
  draft: 'the-waterfall-trail',
  pending_review: 'desert-after-dark',
  pending_publish: 'slow-days-in-bruges',
};

/**
 * Open a pull request for a post the way the app does, with a change to its English title.
 * @param {MockGitHub} github Repository.
 * @param {string} slug Post slug.
 * @param {string} status Workflow status.
 */
const openPostPullRequest = (github, slug, status) => {
  const filePath = `content/posts/en/${slug}.md`;
  const content = github.readFile(filePath);
  const branch = `cms/posts/${slug}`;

  github.createBranch(branch, github.head.oid);
  github.commit(
    { [filePath]: String(content).replace(/^title: (.+)$/m, 'title: $1 (revised)') },
    { branch, author: github.user, message: `Update Post “${slug}”` },
  );
  github.openPullRequest({
    title: `Update Post “${slug}”`,
    head: branch,
    draft: status === 'draft',
    labels: [`sveltia-cms/${status}`],
    author: github.user,
  });
};

/**
 * States of the repository the scenarios can start with, keyed with their name. Each one sets up
 * the repository once it has the sample site, and says whether the user is signed in to it.
 * @type {Record<string, { session?: boolean, empty?: boolean, setup?: (github: MockGitHub) =>
 * void }>}
 */
export const GIT_SETUPS = {
  'signed-in': {},
  'signed-out': { session: false },
  workflow: {
    // eslint-disable-next-line jsdoc/require-jsdoc
    setup: (github) => {
      Object.entries(WORKFLOW_POSTS).forEach(([status, slug]) => {
        openPostPullRequest(github, slug, status);
      });
    },
  },
  'deploy-preview': {
    // eslint-disable-next-line jsdoc/require-jsdoc
    setup: (github) => {
      GIT_SETUPS.workflow.setup?.(github);
      github.pullRequests.forEach((pullRequest, index) => {
        const sha = /** @type {string} */ (github.refs.get(pullRequest.head));

        github.reportBuild(sha, {
          deployments: [
            {
              environment: 'Preview',
              state: ['SUCCESS', 'IN_PROGRESS', 'FAILURE'][index % 3],
              environmentUrl: 'https://preview.example.com/',
            },
          ],
        });
      });
    },
  },
  'open-authoring': {
    // eslint-disable-next-line jsdoc/require-jsdoc
    setup: (github) => {
      github.canWrite = false;
    },
  },
  'open-authoring-forked': {
    // eslint-disable-next-line jsdoc/require-jsdoc
    setup: (github) => {
      github.canWrite = false;
      github.createFork();
    },
  },
  'open-authoring-no-forking': {
    // eslint-disable-next-line jsdoc/require-jsdoc
    setup: (github) => {
      github.canWrite = false;
      github.allowForking = false;
    },
  },
  'open-authoring-invitation': {
    // eslint-disable-next-line jsdoc/require-jsdoc
    setup: (github) => {
      github.canWrite = false;
      github.canRead = false;
      github.invitations = [GITHUB_BACKEND.repo];
    },
  },
  'open-authoring-private': {
    // eslint-disable-next-line jsdoc/require-jsdoc
    setup: (github) => {
      github.canWrite = false;
      github.canRead = false;
      github.scopes = 'public_repo, read:user';
    },
  },
  'read-only-branch': {
    // eslint-disable-next-line jsdoc/require-jsdoc
    setup: (github) => {
      github.branchRule = { viewerCanPush: false };
    },
  },
  'minor-incident': {
    // eslint-disable-next-line jsdoc/require-jsdoc
    setup: (github) => {
      github.statusIndicator = 'minor';
    },
  },
  'major-incident': {
    // eslint-disable-next-line jsdoc/require-jsdoc
    setup: (github) => {
      github.statusIndicator = 'major';
    },
  },
  'no-write-access': {
    // eslint-disable-next-line jsdoc/require-jsdoc
    setup: (github) => {
      github.canWrite = false;
    },
  },
  'not-found': {
    // eslint-disable-next-line jsdoc/require-jsdoc
    setup: (github) => {
      github.canRead = false;
    },
  },
  'rate-limited': {
    // eslint-disable-next-line jsdoc/require-jsdoc
    setup: (github) => {
      github.rateLimited = true;
    },
  },
  empty: { empty: true },
};

/**
 * Repository of each frame, keyed with the frame ID.
 * @type {Map<string, MockGitHub>}
 */
const repositories = new Map();

/**
 * Changes a scenario step can make to the repository while the app runs, keyed with their name.
 * @type {Record<string, (github: MockGitHub) => void>}
 */
export const GIT_ACTIONS = {
  // eslint-disable-next-line jsdoc/require-jsdoc
  'colleague-edits-post': (github) => {
    const filePath = 'content/posts/en/welcome-to-the-demo.md';

    github.commit(
      { [filePath]: String(github.readFile(filePath)).replace(/^title: .+$/m, 'title: Welcome!') },
      { message: 'Update Post “welcome-to-the-demo”' },
    );
  },
  // eslint-disable-next-line jsdoc/require-jsdoc
  'colleague-deletes-post': (github) => {
    github.commit(
      { 'content/posts/en/welcome-to-the-demo.md': null },
      { message: 'Delete Post “welcome-to-the-demo”' },
    );
  },
};

/**
 * Run an action on the repository of a frame.
 * @param {string} frameId Frame ID.
 * @param {unknown} name Name of an action in {@link GIT_ACTIONS}.
 * @throws {Error} If the frame has no repository or the action isn’t known.
 */
export const runGitAction = (frameId, name) => {
  const github = repositories.get(frameId);

  const action =
    typeof name === 'string' && Object.hasOwn(GIT_ACTIONS, name) ? GIT_ACTIONS[name] : undefined;

  if (!github || !action) {
    throw new Error(`No repository or no action named ${name}`);
  }

  action(github);
};

/**
 * Create the repository of a frame, with the sample site, replacing the one it had.
 * @param {string} frameId Frame ID.
 * @param {string} setupName Name of a setup in {@link GIT_SETUPS}.
 * @returns {Promise<{ session?: Record<string, any> }>} Session to store in the frame, for the app
 * to sign in on its own, unless the setup leaves the user signed out.
 * @throws {Error} If the setup isn’t known.
 */
export const createRepository = async (frameId, setupName) => {
  const preset = Object.hasOwn(GIT_SETUPS, setupName) ? GIT_SETUPS[setupName] : undefined;

  if (!preset) {
    throw new Error(`Unknown Git setup: ${setupName}`);
  }

  const github = new MockGitHub();

  if (!preset.empty) {
    const seedDir = path.join(getDemoDir(), 'seed');
    const files = await listSeedFiles();

    const contents = await Promise.all(
      files.map(async (filePath) => [filePath, await readFile(path.join(seedDir, filePath))]),
    );

    github.commit(Object.fromEntries(contents), { message: 'Add the sample site' });
  }

  preset.setup?.(github);
  repositories.set(frameId, github);

  if (preset.session === false) {
    return {};
  }

  const { id, login, name, email } = github.user;

  return { session: { backendName: 'github', id, login, name, email, token: github.token } };
};

/**
 * Read the body of a request.
 * @param {IncomingMessage} req Request.
 * @returns {Promise<Buffer>} Body.
 */
const readBody = async (req) => {
  const chunks = [];

  // eslint-disable-next-line no-restricted-syntax
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
};

/**
 * Answer a request a frame sends to GitHub from the frame’s repository. The repository answers
 * Playwright routes, so the request is given to it as one.
 * @param {string} frameId Frame ID.
 * @param {URL} url Request URL, with the URL of the request to GitHub in the `url` parameter.
 * @param {IncomingMessage} req Request.
 * @param {ServerResponse} res Response.
 * @param {(message: string) => void} warn Function logging a request the repository can’t answer.
 */
export const handleGitRequest = async (frameId, url, req, res, warn) => {
  const github = repositories.get(frameId);
  const target = new URL(url.searchParams.get('url') ?? '');

  if (!github || !GIT_HOSTS.some((host) => target.href.startsWith(host))) {
    res.statusCode = 404;
    res.end();

    return;
  }

  const body = await readBody(req);
  const method = req.method ?? 'GET';
  /** @type {MockResponse & { body?: string | Buffer, contentType?: string }} */
  let response = { status: 404 };

  if (target.hostname === 'www.githubstatus.com') {
    response = { json: { status: { indicator: github.statusIndicator } } };
  } else if (target.hostname === 'api.github.com') {
    const unhandled = github.unhandled.length;

    const route = {
      // eslint-disable-next-line jsdoc/require-jsdoc
      request: () => ({
        // eslint-disable-next-line jsdoc/require-jsdoc
        url: () => target.href,
        // eslint-disable-next-line jsdoc/require-jsdoc
        method: () => method,
        // eslint-disable-next-line jsdoc/require-jsdoc
        headers: () => /** @type {Record<string, string>} */ (req.headers),
        // eslint-disable-next-line jsdoc/require-jsdoc
        postDataJSON: () => (body.length ? JSON.parse(body.toString('utf-8')) : null),
      }),
      /**
       * Keep the response.
       * @param {any} value Response.
       */
      fulfill: async (value) => {
        response = value;
      },
    };

    await github.handleRoute(/** @type {any} */ (route));
    github.unhandled.slice(unhandled).forEach((label) => {
      warn(`[l10n-review] The GitHub repository can’t answer ${label}`);
    });
  }

  const { status = 200, json, body: content, contentType, headers = {} } = response;

  res.statusCode = status;
  Object.entries(headers).forEach(([name, value]) => res.setHeader(name, value));
  res.setHeader('Cache-Control', 'no-store');

  if (json !== undefined && !(json instanceof Buffer) && typeof json !== 'string') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(json));
  } else if (status === 204 || (json === undefined && content === undefined)) {
    res.end();
  } else {
    res.setHeader(
      'Content-Type',
      contentType ??
        (typeof (json ?? content) === 'string' ? 'text/plain' : 'application/octet-stream'),
    );
    res.end(json ?? content);
  }
};
