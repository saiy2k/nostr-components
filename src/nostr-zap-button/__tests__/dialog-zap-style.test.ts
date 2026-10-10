// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import { getDialogStyles, invoiceChromeVisibility } from '../dialog-zap-style';

describe('zap dialog invoice chrome', () => {
  it('shows copy and wallet only while an invoice is unpaid', () => {
    expect(invoiceChromeVisibility(false, false)).toEqual({
      copy: false,
      wallet: false,
      thanks: false,
    });
    expect(invoiceChromeVisibility(true, false)).toEqual({
      copy: true,
      wallet: true,
      thanks: false,
    });
    expect(invoiceChromeVisibility(true, true)).toEqual({
      copy: false,
      wallet: false,
      thanks: true,
    });
  });

  it('keeps invoice actions and the thank-you line out of the layout until needed', () => {
    const css = getDialogStyles('light');
    const hidden = css.match(/\.success-overlay\[hidden\][\s\S]*?display:\s*none !important/);
    const resting = css.match(/\.nostr-base-dialog \.success-overlay \{[^}]+\}/)?.[0] || '';
    expect(css).toContain('.zap-dialog-content .copy-btn[hidden]');
    expect(css).toContain('.zap-dialog-content .cta-btn[hidden]');
    expect(css).toContain('.zap-dialog-content img.qr[hidden]');
    expect(hidden).not.toBeNull();
    expect(resting).toContain('display: none');
    expect(resting).not.toContain('display: flex');
    expect(css).toContain('.nostr-base-dialog.success .success-overlay');
  });
});
