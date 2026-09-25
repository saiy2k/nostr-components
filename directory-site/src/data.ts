export type DirectoryCategory = "Popular on X.com" | "Popular on Nostr";

export interface DirectoryProfile {
  readonly id: string;
  readonly name: string;
  readonly handle: string;
  readonly nip05: string;
  readonly category: DirectoryCategory;
  readonly followers: number | null;
  readonly verified: boolean;
  readonly npub: string;
  readonly youtube: string;
  readonly avatar: {
    readonly initials: string;
    readonly foreground: string;
    readonly background: string;
  };
}

export const categories: readonly DirectoryCategory[] = [
  "Popular on X.com",
  "Popular on Nostr",
];

// Sample fixtures used by unit tests only. The site loads profiles through api.ts.
export const directoryProfiles: readonly DirectoryProfile[] = [
  {
    id: "jack",
    name: "jack",
    handle: "@jack",
    nip05: "jack@nostr.com",
    category: "Popular on X.com",
    followers: 311200,
    verified: true,
    npub: "npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m",
    youtube: "",
    avatar: { initials: "J", foreground: "#172033", background: "#c8ff62" },
  },
  {
    id: "damus",
    name: "Damus",
    handle: "@damus",
    nip05: "damus.io",
    category: "Popular on Nostr",
    followers: 201500,
    verified: true,
    npub: "npub1damus5csw6s4r9m3j8ql7v2hk0e6w3x5k9af2t8q7u4y6p0d3znq6x2m2h",
    youtube: "",
    avatar: { initials: "D", foreground: "#ffffff", background: "#101018" },
  },
  {
    id: "nostr",
    name: "Nostr",
    handle: "@nostr",
    nip05: "nostr.com",
    category: "Popular on Nostr",
    followers: 178300,
    verified: true,
    npub: "npub1j9tzv4m3z6x0d2s7q8w5h1c9k4p6e3r8u2y7a5f0n9l6v4b1gqsk3m0ueu",
    youtube: "",
    avatar: { initials: "N", foreground: "#ffffff", background: "#7456f6" },
  },
  {
    id: "tbot",
    name: "tbot",
    handle: "@tbot",
    nip05: "tbot.io",
    category: "Popular on X.com",
    followers: 122700,
    verified: true,
    npub: "npub1y0e8t2r5u7i9o3p6a4s8d1f5g7h2j9k3l6z0x4c8v1b5n7m2qsp7c5d9a",
    youtube: "",
    avatar: { initials: "TB", foreground: "#172033", background: "#8bd8cf" },
  },
  {
    id: "guy-swann",
    name: "Guy Swann",
    handle: "@guyswann",
    nip05: "guyswann.com",
    category: "Popular on X.com",
    followers: 98400,
    verified: true,
    npub: "npub1k3d2l8w4m6p0q9r7t5y2u8i1o4a6s3d9f7g5h2j0k8l4z6x1cq6f8w7m",
    youtube: "",
    avatar: { initials: "GS", foreground: "#ffffff", background: "#3b5166" },
  },
  {
    id: "snort",
    name: "Snort",
    handle: "@snort",
    nip05: "snort.social",
    category: "Popular on Nostr",
    followers: 76100,
    verified: true,
    npub: "npub1cxd4v8b2n6m0q7w3e9r5t1y8u4i2o6p0a7s3d9f5g1h8j4k2lq9a2t6q",
    youtube: "",
    avatar: { initials: "S", foreground: "#ffffff", background: "#1b1b2e" },
  },
];
