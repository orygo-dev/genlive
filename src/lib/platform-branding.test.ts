import { describe, expect, it } from "vitest";
import {
  normalizeMobileBannerSlides,
  normalizeMobilePopupAd,
  MOBILE_BANNER_RECOMMENDED,
  defaultMobilePopupAd,
} from "./platform-branding";

describe("mobile banner slides", () => {
  it("normalizes valid slides and drops invalid ones", () => {
    expect(
      normalizeMobileBannerSlides([
        {
          id: "1",
          imageUrl: "/api/media/brand/a.jpg",
          title: "Halo",
          body: "Deskripsi",
          active: true,
        },
        { id: "", imageUrl: "/x.jpg" },
        { id: "2", imageUrl: "" },
      ]),
    ).toEqual([
      {
        id: "1",
        imageUrl: "/api/media/brand/a.jpg",
        title: "Halo",
        body: "Deskripsi",
        linkUrl: null,
        active: true,
      },
    ]);
  });

  it("caps max slides", () => {
    const input = Array.from(
      { length: MOBILE_BANNER_RECOMMENDED.maxSlides + 3 },
      (_, index) => ({
        id: `s${index}`,
        imageUrl: `/img-${index}.jpg`,
      }),
    );
    expect(normalizeMobileBannerSlides(input)).toHaveLength(
      MOBILE_BANNER_RECOMMENDED.maxSlides,
    );
  });
});

describe("mobile popup ads", () => {
  it("returns defaults for empty input", () => {
    expect(normalizeMobilePopupAd(null)).toEqual(defaultMobilePopupAd);
    expect(normalizeMobilePopupAd(undefined)).toEqual(defaultMobilePopupAd);
  });

  it("requires enabled + imageUrl to be active", () => {
    expect(
      normalizeMobilePopupAd({
        enabled: true,
        imageUrl: "",
        linkUrl: "https://example.com",
      }),
    ).toEqual({
      enabled: false,
      imageUrl: null,
      linkUrl: "https://example.com",
      updatedAt: null,
    });

    expect(
      normalizeMobilePopupAd({
        enabled: true,
        imageUrl: "/api/media/brand/popup.png",
        linkUrl: " https://example.com ",
        updatedAt: "2026-08-03T00:00:00.000Z",
      }),
    ).toEqual({
      enabled: true,
      imageUrl: "/api/media/brand/popup.png",
      linkUrl: "https://example.com",
      updatedAt: "2026-08-03T00:00:00.000Z",
    });
  });
});
