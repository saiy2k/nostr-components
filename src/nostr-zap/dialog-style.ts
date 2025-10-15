/**
 * Dialog styles for nostr-zap component
 * Extracted from dialog.ts for better organization
 * Uses CSS variables from nostr-zap component for consistency
 */

export const getDialogStyles = (theme: 'light' | 'dark' = 'light'): string => {
  const isDark = theme === 'dark';
  
  return `
    /* === DIALOG BASE STYLES === */
    .nostr-zap-dialog {
      width: 424px;
      max-width: 90vw;
      border: none;
      border-radius: 10px;
      padding: 20px 20px;
      background: ${isDark ? '#141414' : '#ffffff'};
      color: ${isDark ? '#ffffff' : '#000000'};
      position: relative;
      font-family: ui-sans-serif, system-ui, sans-serif;
      text-align: center;
    }

    .nostr-zap-dialog[open] {
      display: block;
    }

    /* === DARK MODE OVERRIDES === */
    .nostr-zap-dialog.dark .amount-buttons button {
      background: ${isDark ? '#262626' : '#f7fafc'};
      border: 1px solid ${isDark ? '#3a3a3a' : '#e2e8f0'};
      color: ${isDark ? '#ffffff' : '#000000'};
    }

    .nostr-zap-dialog.dark .amount-buttons button.active {
      background: #7f00ff;
      color: #ffffff;
    }

    .nostr-zap-dialog.dark .close-btn {
      background: ${isDark ? '#262626' : '#f7fafc'};
      color: ${isDark ? '#ffffff' : '#000000'};
    }

    .nostr-zap-dialog.dark .cta-btn {
      background: #7f00ff;
      color: #ffffff;
    }

    .nostr-zap-dialog.dark .copy-btn {
      color: #7f00ff;
    }

    .nostr-zap-dialog.dark input {
      background: ${isDark ? '#262626' : '#ffffff'};
      border: 1px solid ${isDark ? '#3a3a3a' : '#e2e8f0'};
      color: ${isDark ? '#ffffff' : '#000000'};
    }

    .nostr-zap-dialog.dark .update-zap-btn {
      background: #7f00ff;
      color: #ffffff;
    }

    .nostr-zap-dialog.dark .loading-overlay {
      background: ${isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)'};
    }

    /* === TYPOGRAPHY === */
    .nostr-zap-dialog h2 {
      font-size: 1.25rem;
      font-weight: 700;
      margin: 4px 0;
    }

    .nostr-zap-dialog p {
      margin: 4px 0;
      word-break: break-word;
    }

    /* === AMOUNT BUTTONS === */
    .nostr-zap-dialog .amount-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 16px 0 8px;
    }

    .nostr-zap-dialog .amount-buttons button {
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

    .nostr-zap-dialog .amount-buttons button.active {
      background: #7f00ff;
      color: #ffffff;
    }

    /* === ACTION BUTTONS === */
    .nostr-zap-dialog .cta-btn {
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

    .nostr-zap-dialog .close-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      border: none;
      background: ${isDark ? '#262626' : '#f7fafc'};
      border-radius: 50%;
      width: 36px;
      height: 36px;
      font-size: 18px;
      cursor: pointer;
      color: ${isDark ? '#ffffff' : '#000000'};
    }

    .nostr-zap-dialog .copy-btn {
      margin-top: 12px;
      cursor: pointer;
      font-size: 14px;
      background: none;
      border: none;
      color: #7f00ff;
    }

    /* === QR CODE === */
    .nostr-zap-dialog img.qr {
      margin-top: 16px;
      border: 1px solid ${isDark ? '#3a3a3a' : '#e2e8f0'};
      border-radius: 8px;
    }

    /* === INPUT CONTAINERS === */
    .nostr-zap-dialog .update-zap-container {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 8px;
    }

    .nostr-zap-dialog .update-zap-container .custom-amount {
      flex-grow: 1;
    }

    .nostr-zap-dialog .comment-container {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 8px;
    }

    .nostr-zap-dialog .comment-container .comment-input {
      flex-grow: 1;
    }

    /* === LOADING OVERLAY === */
    .nostr-zap-dialog .loading-overlay {
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

    .nostr-zap-dialog.loading .loading-overlay {
      opacity: 1;
      pointer-events: auto;
    }

    .nostr-zap-dialog .loading-overlay .loader {
      width: 40px;
      height: 40px;
      border: 4px solid ${isDark ? '#3a3a3a' : '#ccc'};
      border-top-color: #7f00ff;
      border-radius: 50%;
      animation: nstrc-spin 1s linear infinite;
    }

    /* === SUCCESS OVERLAY === */
    .nostr-zap-dialog .success-overlay {
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

    .nostr-zap-dialog.success .success-overlay {
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