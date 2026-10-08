// SPDX-License-Identifier: MIT

import { launchExtensionContext, profileDir } from './launch.js';

const context = await launchExtensionContext({
  userDataDir: profileDir,
  headless: false,
  signer: false
});
const page = context.pages()[0] || await context.newPage();
console.log('');
console.log('Chromium is open with the unpacked extension.');
console.log('Profile directory: ' + profileDir);
console.log('Log into the TEST X account in this window (complete 2FA yourself).');
console.log('Do not install a NIP-07 signer in this profile if you want the read-only click check.');
console.log('Close the browser window when you are done.');
console.log('');
await page.goto('https://x.com/login', { waitUntil: 'domcontentloaded' });
await new Promise(function (resolve) {
  context.on('close', resolve);
});
