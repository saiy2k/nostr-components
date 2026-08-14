// SPDX-License-Identifier: MIT

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { lookupDirectoryHandle as lookupDirectoryRecord } from './lookup.js';

initializeApp();
const db = getFirestore();

async function handleDirectoryLookup(request, response) {
  if (request.method !== 'GET') {
    response.set('Allow', 'GET');
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  if (request.query.platform && request.query.platform !== 'twitter') {
    response.status(400).json({ error: 'unsupported_platform' });
    return;
  }

  try {
    const result = await lookupDirectoryRecord(db, request.query.handle);
    response.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    response.status(result.status).json(result.body);
  } catch (error) {
    console.error('Directory lookup failed', {
      message: error instanceof Error ? error.message : String(error)
    });
    response.status(503).json({ error: 'directory_unavailable' });
  }
}

export const lookupDirectoryHandle = onRequest(
  {
    region: 'us-central1',
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 10
  },
  handleDirectoryLookup
);
