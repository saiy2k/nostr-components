// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import { renderLikeButton, shouldDisableLikeButton } from "../render";
import { getLikeButtonStyles } from "../style";

describe("renderLikeButton", () => {
  it("disables the button and sets aria-busy while loading", () => {
    const html = renderLikeButton({
      isLoading: true,
      isError: false,
      errorMessage: "",
      buttonText: "Like",
      isLiked: false,
      likeCount: 0,
    });

    expect(html).toContain("disabled");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="What is a like?"');
    expect(html).toContain("button-text-skeleton");
  });

  it("leaves the button enabled when not loading", () => {
    const html = renderLikeButton({
      isLoading: false,
      isError: false,
      errorMessage: "",
      buttonText: "Like",
      isLiked: false,
      likeCount: 0,
    });

    expect(html).not.toContain(" disabled");
    expect(html).not.toContain("aria-busy");
    expect(html).toContain(">Like</span>");
  });

  it("renders compact action-row markup with a numeric count", () => {
    const html = renderLikeButton({
      isLoading: false,
      isError: false,
      errorMessage: "",
      buttonText: "Like",
      isLiked: false,
      likeCount: 12,
      hasLikes: true,
      compact: true,
    });

    expect(html).toContain('aria-label="Like this post with Nostr"');
    expect(html).toContain(">12</span>");
    expect(html).not.toContain("12 likes");
    expect(html).not.toContain(">Like</span>");
    expect(html).not.toContain("help-icon");
    expect(html.indexOf(">12</span>")).toBeLessThan(html.indexOf("</button>"));
  });

  it("keeps compact actions enabled while only relay startup is pending", () => {
    expect(
      shouldDisableLikeButton({
        compact: true,
        actionLoading: false,
        connectionLoading: true,
      }),
    ).toBe(false);
    expect(
      shouldDisableLikeButton({
        compact: true,
        actionLoading: true,
        connectionLoading: true,
      }),
    ).toBe(true);
  });

  it("keeps compact actions retryable after a background relay error", () => {
    const html = renderLikeButton({
      isLoading: false,
      isError: true,
      errorMessage: "Failed to load likes",
      buttonText: "Like",
      isLiked: false,
      likeCount: 0,
      compact: true,
    });

    expect(html).not.toContain(" disabled");
    expect(html).toContain('aria-label="Like this post with Nostr"');
  });

  it("gives compact actions a full-width target and a legible icon stroke", () => {
    const styles = getLikeButtonStyles();

    expect(styles).toMatch(
      /:host\(\[compact\]\) \.nostr-like-button \{[^}]*width: 100%/s,
    );
    expect(styles).toMatch(
      /:host\(\[compact\]\) \.nostr-like-button svg path \{[^}]*stroke-width: 7/s,
    );
    expect(styles).not.toContain("pointer-events: none");
  });
});
