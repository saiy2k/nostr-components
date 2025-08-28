import { escapeHtml } from "../common/utils";

export function renderStats(
  label: string,
  value: number,
  isLoading: boolean
): string {
  const safeLabel = escapeHtml(label)
  return `
    <div class="stat" data-orientation="horizontal" aria-busy="${isLoading}" aria-live="polite">
      <div class="stat-inner">
        <div class="stat-value">
          ${
            isLoading
              ? '<div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>'
              : value.toLocaleString()
          }
        </div>
        <div class="stat-name">${safeLabel}</div>
      </div>
    </div>
  `;
}
