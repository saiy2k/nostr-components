// SPDX-License-Identifier: MIT

import { readFileSync, writeFileSync } from 'node:fs';

const filePath = process.argv[2];
if (!filePath) {
  throw new Error('Provide a generated file path');
}

const source = readFileSync(filePath, 'utf8');
writeFileSync(filePath, source.replace(/[\t ]+$/gm, ''));
