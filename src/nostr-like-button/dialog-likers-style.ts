// SPDX-License-Identifier: MIT

export function getLikersDialogStyles(theme: 'light' | 'dark' = 'light'): string {
  const isDark = theme === 'dark';
  
  return `
    .likers-dialog-content {
      padding: 0;
      max-height: 60vh;
      overflow-y: auto;
    }

    .likers-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .like-entry {
      display: flex;
      align-items: center;
      padding: 12px;
      border-radius: 8px;
      background: ${isDark ? '#2a2a2a' : '#f8f9fa'};
      border: 1px solid ${isDark ? '#3a3a3a' : '#e9ecef'};
      transition: background-color 0.2s ease;
    }

    .like-entry:hover {
      background: ${isDark ? '#3a3a3a' : '#e9ecef'};
    }

    .like-author-info {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
    }

    .like-author-picture {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
    }

    .like-author-picture-default {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: ${isDark ? '#3a3a3a' : '#e9ecef'};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
    }

    .like-author-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      min-width: 0;
    }

    .like-author-link {
      color: ${isDark ? '#ffffff' : '#000000'};
      text-decoration: none;
      font-weight: 500;
      font-size: 14px;
      transition: color 0.2s ease;
    }

    .like-author-link:hover {
      color: ${isDark ? '#4a9eff' : '#1877f2'};
      text-decoration: underline;
    }

    .like-date {
      color: ${isDark ? '#b0b0b0' : '#65676b'};
      font-size: 12px;
      font-weight: 400;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .like-status {
      font-weight: 500;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .like-status.liked {
      color: ${isDark ? '#4a9eff' : '#1877f2'};
      background: ${isDark ? 'rgba(74, 158, 255, 0.1)' : 'rgba(24, 119, 242, 0.1)'};
    }

    .like-status.disliked {
      color: #d32f2f;
      background: rgba(211, 47, 47, 0.1);
    }

    .no-likes {
      text-align: center;
      color: ${isDark ? '#b0b0b0' : '#65676b'};
      font-size: 14px;
      padding: 40px 20px;
    }

    /* Skeleton loading states */
    .skeleton-entry {
      opacity: 0.7;
    }

    .skeleton-picture {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(90deg, 
        ${isDark ? '#3a3a3a' : '#f0f0f0'} 25%, 
        ${isDark ? '#4a4a4a' : '#e0e0e0'} 50%, 
        ${isDark ? '#3a3a3a' : '#f0f0f0'} 75%
      );
      background-size: 200% 100%;
      animation: skeleton-loading 1.5s infinite;
      flex-shrink: 0;
    }

    .skeleton-name {
      width: 120px;
      height: 14px;
      background: linear-gradient(90deg, 
        ${isDark ? '#3a3a3a' : '#f0f0f0'} 25%, 
        ${isDark ? '#4a4a4a' : '#e0e0e0'} 50%, 
        ${isDark ? '#3a3a3a' : '#f0f0f0'} 75%
      );
      background-size: 200% 100%;
      animation: skeleton-loading 1.5s infinite;
      border-radius: 2px;
    }

    @keyframes skeleton-loading {
      0% {
        background-position: -200% 0;
      }
      100% {
        background-position: 200% 0;
      }
    }

    /* Responsive */
    @media (max-width: 480px) {
      .likers-dialog-content {
        max-height: 70vh;
      }

      .like-entry {
        padding: 10px;
      }

      .like-author-picture,
      .like-author-picture-default,
      .skeleton-picture {
        width: 36px;
        height: 36px;
      }

      .like-author-link {
        font-size: 13px;
      }

      .like-date {
        font-size: 11px;
      }
    }

    /* Scrollbar styling */
    .likers-dialog-content::-webkit-scrollbar {
      width: 6px;
    }

    .likers-dialog-content::-webkit-scrollbar-track {
      background: ${isDark ? '#2a2a2a' : '#f1f1f1'};
      border-radius: 3px;
    }

    .likers-dialog-content::-webkit-scrollbar-thumb {
      background: ${isDark ? '#555' : '#c1c1c1'};
      border-radius: 3px;
    }

    .likers-dialog-content::-webkit-scrollbar-thumb:hover {
      background: ${isDark ? '#777' : '#a8a8a8'};
    }
  `;
}
