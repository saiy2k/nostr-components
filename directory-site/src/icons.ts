export const icon = {
  arrow: () => `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>`,
  check: () => `
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path d="m6.5 10.1 2.1 2.2 5-5" />
      <path d="M10 2.7 16 5v4.3c0 3.8-2.4 6.5-6 8-3.6-1.5-6-4.2-6-8V5l6-2.3Z" />
    </svg>`,
  chevron: () => `
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path d="m6 8 4 4 4-4" />
    </svg>`,
  close: () => `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>`,
  copy: () => `
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <rect x="6.5" y="6.5" width="9" height="9" rx="1.5" />
      <path d="M13.5 6.5V5A1.5 1.5 0 0 0 12 3.5H5A1.5 1.5 0 0 0 3.5 5v7A1.5 1.5 0 0 0 5 13.5h1.5" />
    </svg>`,
  database: () => `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="5" rx="7.5" ry="3" />
      <path d="M4.5 5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V5M4.5 11v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6" />
    </svg>`,
  external: () => `
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path d="M11 4h5v5M9 11l7-7M15 11v4.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5H9" />
    </svg>`,
  menu: () => `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>`,
  plusUser: () => `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="7" r="3" />
      <path d="M3.5 19v-2.2c0-2.1 1.7-3.8 3.8-3.8h3.4c1.4 0 2.6.7 3.3 1.8M18 13v6M15 16h6" />
    </svg>`,
  search: () => `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle cx="10.8" cy="10.8" r="6.4" />
      <path d="m16 16 4.2 4.2" />
    </svg>`,
};

export function brandMark(): string {
  return `
    <svg class="brand-mark" aria-hidden="true" viewBox="0 0 36 36" fill="none">
      <path d="M18 2.5c.8 9.7 5.8 14.7 15.5 15.5C23.8 18.8 18.8 23.8 18 33.5 17.2 23.8 12.2 18.8 2.5 18 12.2 17.2 17.2 12.2 18 2.5Z" />
    </svg>`;
}

export function networkGraphic(): string {
  return `
    <svg class="network-graphic" aria-label="A connected open social network" viewBox="0 0 620 310" fill="none" role="img">
      <g class="network-lines">
        <path d="M48 124 145 58l90 49 93-64 86 62 111-45" />
        <path d="m48 124 71 80 116-97 80 95 99-97 111 72" />
        <path d="m119 204 107 52 89-54 95 57 115-82" />
        <path d="M145 58 119 204M235 107l-9 149M328 43l-13 159M414 105l-4 154" />
        <path class="dashed" d="m48 124 178 132M145 58l170 144M235 107l175 152M328 43l197 134" />
      </g>
      <g class="network-nodes">
        <circle cx="48" cy="124" r="7" />
        <circle cx="145" cy="58" r="8" />
        <circle cx="119" cy="204" r="8" />
        <circle cx="235" cy="107" r="9" />
        <circle cx="226" cy="256" r="7" />
        <circle cx="328" cy="43" r="7" />
        <circle class="network-core" cx="315" cy="202" r="28" />
        <circle cx="414" cy="105" r="10" />
        <circle cx="410" cy="259" r="8" />
        <circle cx="525" cy="60" r="7" />
        <circle cx="525" cy="177" r="9" />
      </g>
      <path class="core-star" d="M315 186c.5 10 5 14.5 15 16-10 1.5-14.5 6-15 16-.5-10-5-14.5-15-16 10-1.5 14.5-6 15-16Z" />
    </svg>`;
}
