import { describe, expect, it } from "vitest";
import {
  normalizeMobileBannerSlides,
  MOBILE_BANNER_RECOMMENDED,
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
