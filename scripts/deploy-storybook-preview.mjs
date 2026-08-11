#!/usr/bin/env node
/**
 * Build local-dist Storybook and deploy a Firebase Hosting preview channel
 * on test-nostr-components ONLY (never the live nostr-components site).
 *
 * Usage:
 *   ISSUE_NUMBER=123 node scripts/deploy-storybook-preview.mjs
 *   CHANNEL_ID=issue-123 node scripts/deploy-storybook-preview.mjs
 *
 * Env:
 *   ISSUE_NUMBER or CHANNEL_ID  — required (channel id becomes issue-<n> if ISSUE_NUMBER set)
 *   FIREBASE_HOSTING_SA_KEY     — preferred Cloud secret: full service-account JSON
 *                                 for sat-the-standard Hosting (not GCP_SA_KEY)
 *   GOOGLE_APPLICATION_CREDENTIALS — local path to the same JSON (dev machines)
 *   FIREBASE_TOKEN              — legacy fallback (firebase login:ci); discouraged
 *   EXPIRES                     — optional channel TTL (default 7d)
 *   SKIP_BUILD                  — if "1", skip npm build + build-storybook
 *
 * Do not reuse GCP_SA_KEY here — that secret is for other GCP projects (e.g. Cloud Run).
 *
 * Prints the channel URL on stdout as: PREVIEW_URL=<url>
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const PROJECT = 'sat-the-standard';
const STAGING_SITE = 'test-nostr-components';
const FORBIDDEN_SITES = new Set(['nostr-components']);
const EXPIRES = process.env.EXPIRES || '7d';

function fail(message) {
  console.error(`\nERROR: ${message}`);
  process.exit(1);
}

function run(command, args, { env = process.env, capture = false } = {}) {
  console.log(`\n$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    encoding: 'utf8',
    stdio: capture ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    if (capture) {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    }
    fail(`${command} exited with code ${result.status}`);
  }

  return result;
}

/** Prefer Hosting SA JSON; never require GCP_SA_KEY (reserved for other GCP work). */
function resolveCredentialsEnv(baseEnv = process.env) {
  const env = { ...baseEnv };
  let tempKeyPath = null;

  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    if (!fs.existsSync(env.GOOGLE_APPLICATION_CREDENTIALS)) {
      fail(`GOOGLE_APPLICATION_CREDENTIALS file not found: ${env.GOOGLE_APPLICATION_CREDENTIALS}`);
    }
    delete env.FIREBASE_TOKEN;
    return { env, tempKeyPath };
  }

  const rawKey = env.FIREBASE_HOSTING_SA_KEY?.trim();
  if (rawKey) {
    if (!rawKey.startsWith('{')) {
      fail('FIREBASE_HOSTING_SA_KEY must be the full service-account JSON.');
    }
    tempKeyPath = path.join(os.tmpdir(), `nc-firebase-sa-${process.pid}.json`);
    fs.writeFileSync(tempKeyPath, rawKey, { mode: 0o600 });
    env.GOOGLE_APPLICATION_CREDENTIALS = tempKeyPath;
    delete env.FIREBASE_TOKEN;
    return { env, tempKeyPath };
  }

  if (env.GCP_SA_KEY) {
    console.warn(
      'WARN: GCP_SA_KEY is set but ignored for Storybook Hosting. Use FIREBASE_HOSTING_SA_KEY instead.'
    );
  }

  if (!env.FIREBASE_TOKEN) {
    console.warn(
      'WARN: No FIREBASE_HOSTING_SA_KEY / GOOGLE_APPLICATION_CREDENTIALS / FIREBASE_TOKEN; using local Firebase CLI login.'
    );
  } else {
    console.warn('WARN: Using legacy FIREBASE_TOKEN. Prefer FIREBASE_HOSTING_SA_KEY.');
  }

  return { env, tempKeyPath };
}

const issueNumber = process.env.ISSUE_NUMBER?.trim();
const channelIdRaw = process.env.CHANNEL_ID?.trim();
const channelId = channelIdRaw || (issueNumber ? `issue-${issueNumber}` : '');

if (!channelId) {
  fail('Set ISSUE_NUMBER or CHANNEL_ID (e.g. ISSUE_NUMBER=123).');
}

if (!/^[a-z0-9][a-z0-9-]*$/.test(channelId)) {
  fail(`Invalid CHANNEL_ID "${channelId}". Use lowercase letters, numbers, hyphens.`);
}

if (STAGING_SITE === 'nostr-components' || FORBIDDEN_SITES.has(STAGING_SITE)) {
  fail('Refusing to deploy to live site nostr-components.');
}

const { env: credEnv, tempKeyPath } = resolveCredentialsEnv(process.env);

try {
  if (process.env.SKIP_BUILD !== '1') {
    run('npm', ['run', 'build'], { env: credEnv });
    run('npm', ['run', 'build-storybook:local'], {
      env: {
        ...credEnv,
        STORYBOOK_ENV: 'production',
        STORYBOOK_BUNDLE: 'local',
      },
    });
  }

  const deployArgs = [
    'hosting:channel:deploy',
    channelId,
    '--project',
    PROJECT,
    '--site',
    STAGING_SITE,
    '--expires',
    EXPIRES,
    '--json',
  ];

  const deploy = run('firebase', deployArgs, { env: credEnv, capture: true });
  const combined = `${deploy.stdout || ''}\n${deploy.stderr || ''}`;

  let previewUrl = '';
  try {
    const json = JSON.parse(deploy.stdout || '{}');
    previewUrl =
      json?.result?.[STAGING_SITE]?.url ||
      json?.result?.url ||
      json?.url ||
      '';
  } catch {
    // Fall through to regex parse.
  }

  if (!previewUrl) {
    const match = combined.match(/https:\/\/[^\s"']+web\.app[^\s"']*/);
    previewUrl = match?.[0] || '';
  }

  if (!previewUrl) {
    console.error(combined);
    fail('Deploy succeeded but could not parse preview URL from Firebase output.');
  }

  if (previewUrl.includes('://nostr-components.web.app') && !previewUrl.includes('test-nostr-components')) {
    fail(`Refusing to continue: preview URL looks like live site: ${previewUrl}`);
  }

  console.log(`\nDeployed preview channel "${channelId}"`);
  console.log(`PREVIEW_URL=${previewUrl}`);

  run('node', ['scripts/smoke-storybook-preview.mjs', previewUrl], { env: credEnv });

  console.log('\nPreview is ready.');
  console.log(`PREVIEW_URL=${previewUrl}`);
} finally {
  if (tempKeyPath) {
    try {
      fs.unlinkSync(tempKeyPath);
    } catch {
      // ignore cleanup errors
    }
  }
}