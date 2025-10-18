/**
 * Dialog styles for nostr-zap component
 * Extracted from dialog.ts for better organization
 * Uses CSS variables from nostr-zap component for consistency
 */

export const getDialogStyles = (theme: 'light' | 'dark' = 'light'): string => {
  const isDark = theme === 'dark';
  
  return `
    /* === ZAP DIALOG CONTENT STYLES === */
    .zap-dialog-content {
      text-align: center;
      color: ${isDark ? '#ffffff' : '#000000'};
    }

    .zap-dialog-content p {
      margin: 4px 0;
      word-break: break-word;
    }

    /* === AMOUNT BUTTONS === */
    .zap-dialog-content .amount-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 16px 0 8px;
    }

    .zap-dialog-content .amount-buttons button {
      flex: 1 1 30%;
      min-width: 72px;
      padding: 8px 0;
      border: 1px solid ${isDark ? '#3a3a3a' : '#e2e8f0'};
      border-radius: 6px;
      background: ${isDark ? '#262626' : '#f7fafc'};
      cursor: pointer;
      font-size: 14px;
      color: ${isDark ? '#ffffff' : '#000000'};
    }

    .zap-dialog-content .amount-buttons button.active {
      background: #7f00ff;
      color: #ffffff;
    }

    /* === ACTION BUTTONS === */
    .zap-dialog-content .cta-btn {
      width: 100%;
      padding: 12px 0;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      margin-top: 16px;
      cursor: pointer;
      background: #7f00ff;
      color: #ffffff;
    }

    .zap-dialog-content .copy-btn {
      margin-top: 12px;
      cursor: pointer;
      font-size: 14px;
      background: none;
      border: none;
      color: #7f00ff;
    }

    .zap-dialog-content .update-zap-btn {
      background: #7f00ff;
      color: #ffffff;
    }

    /* === QR CODE === */
    .zap-dialog-content img.qr {
      margin-top: 16px;
      border: 1px solid ${isDark ? '#3a3a3a' : '#e2e8f0'};
      border-radius: 8px;
    }

    /* === INPUT CONTAINERS === */
    .zap-dialog-content .update-zap-container {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 8px;
    }

    .zap-dialog-content .update-zap-container .custom-amount {
      flex-grow: 1;
    }

    .zap-dialog-content .comment-container {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 8px;
    }

    .zap-dialog-content .comment-container .comment-input {
      flex-grow: 1;
    }

    .zap-dialog-content input {
      background: ${isDark ? '#262626' : '#ffffff'};
      border: 1px solid ${isDark ? '#3a3a3a' : '#e2e8f0'};
      color: ${isDark ? '#ffffff' : '#000000'};
    }

    /* === LOADING OVERLAY === */
    .nostr-base-dialog .loading-overlay {
      position: absolute;
      inset: 0;
      background: ${isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)'};
      display: flex;
      justify-content: center;
      align-items: center;
      border-radius: 10px;
      opacity: 0;
      transition: opacity 0.2s ease;
      pointer-events: none;
    }

    .nostr-base-dialog.loading .loading-overlay {
      opacity: 1;
      pointer-events: auto;
    }

    .nostr-base-dialog .loading-overlay .loader {
      width: 40px;
      height: 40px;
      border: 4px solid ${isDark ? '#3a3a3a' : '#ccc'};
      border-top-color: #7f00ff;
      border-radius: 50%;
      animation: nstrc-spin 1s linear infinite;
    }

    /* === SUCCESS OVERLAY === */
    .nostr-base-dialog .success-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
      display: flex;
      justify-content: center;
      align-items: center;
      color: #ffffff;
      font-size: 24px;
      border-radius: 10px;
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    }

    .nostr-base-dialog.success .success-overlay {
      opacity: 1;
      pointer-events: auto;
    }

    /* === ANIMATIONS === */
    @keyframes nstrc-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;
};