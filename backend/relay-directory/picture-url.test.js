// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import {
  fetchXAvatarUrl,
  httpsPictureUrl,
  upgradeTwitterAvatarUrl,
} from "./picture-url.js";

describe("https picture URLs", () => {
  it("keeps https URLs and canonicalizes the host", () => {
    expect(httpsPictureUrl(" HTTPS://CDN.Example/a.png ")).toBe(
      "https://cdn.example/a.png",
    );
  });

  it("rejects non-https, credentialed, and oversized URLs", () => {
    expect(httpsPictureUrl("http://cdn.example/a.png")).toBeNull();
    expect(httpsPictureUrl("javascript:alert(1)")).toBeNull();
    expect(httpsPictureUrl("data:image/png;base64,aaaa")).toBeNull();
    expect(httpsPictureUrl("https://user:pass@cdn.example/a.png")).toBeNull();
    expect(httpsPictureUrl(`https://cdn.example/${"a".repeat(2000)}.png`)).toBeNull();
    expect(httpsPictureUrl("")).toBeNull();
    expect(httpsPictureUrl(null)).toBeNull();
  });

  it("upgrades small Twitter avatars to 200px and leaves other hosts alone", () => {
    expect(
      upgradeTwitterAvatarUrl(
        "https://pbs.twimg.com/profile_images/1/photo_normal.jpg",
      ),
    ).toBe("https://pbs.twimg.com/profile_images/1/photo_200x200.jpg");
    expect(
      upgradeTwitterAvatarUrl(
        "https://pbs.twimg.com/profile_images/1/photo_200x200.jpg",
      ),
    ).toBe("https://pbs.twimg.com/profile_images/1/photo_200x200.jpg");
    expect(upgradeTwitterAvatarUrl("https://cdn.example/photo_normal.jpg")).toBe(
      "https://cdn.example/photo_normal.jpg",
    );
  });

  it("reads a matching FxTwitter avatar and ignores a mismatched profile", async () => {
    const avatar = await fetchXAvatarUrl("Alice", {
      fetchImpl: async (url) => {
        expect(url).toBe("https://api.fxtwitter.com/2/profile/alice");
        return {
          ok: true,
          json: async () => ({
            code: 200,
            user: {
              id: "1",
              screen_name: "Alice",
              avatar_url:
                "https://pbs.twimg.com/profile_images/1/photo_normal.jpg",
            },
          }),
        };
      },
    });
    expect(avatar).toBe(
      "https://pbs.twimg.com/profile_images/1/photo_200x200.jpg",
    );

    await expect(
      fetchXAvatarUrl("alice", {
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({
            code: 200,
            user: {
              id: "1",
              screen_name: "bob",
              avatar_url: "https://cdn.example/bob.png",
            },
          }),
        }),
      }),
    ).resolves.toBeNull();
  });
});
