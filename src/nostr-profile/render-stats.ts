export function renderStats(
  label: string,
  value: number,
  isLoading: boolean
): string {
  return `
    <div class="stat" data-orientation="horizontal">
      <div class="stat-inner">
        <div class="stat-value">
          ${
            isLoading
              ? '<div style="width: 50px; height: 28px; border-radius: 5px" class="skeleton"></div>'
              : value.toLocaleString()
          }
        </div>
        <div class="stat-name">${label}</div>
      </div>
    </div>
  `;
}
