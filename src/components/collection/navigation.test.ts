import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { openGoogleMaps, openWaze } from "./navigation";

const target = {
  name: "SARIZAT",
  address: "D111,KLG CAMPUS BLOCK D TAMAN SRI PULAI 81110 JOHOR BAHRU JOHOR",
  lat: 1.5722394,
  lng: 103.6201727,
};

describe("导航链接优先按地址而非坐标", () => {
  let openSpy: ReturnType<typeof vi.fn>;
  const origOpen = (globalThis as { open?: unknown }).open;

  beforeEach(() => {
    openSpy = vi.fn();
    (globalThis as { open?: unknown }).open = openSpy;
  });
  afterEach(() => {
    (globalThis as { open?: unknown }).open = origOpen;
  });

  // @kliv-spec-derived — 用户要求：网页按导航的结果要和自己在 Google Maps 输入地址一致
  it("Google 导航链接带完整地址原文，不带图钉坐标", () => {
    openGoogleMaps(target);
    expect(openSpy).toHaveBeenCalledTimes(1);
    const url = openSpy.mock.calls[0][0] as string;
    expect(url).toContain("destination=" + encodeURIComponent(target.address));
    expect(url).not.toContain("1.5722");
  });

  it("Waze 导航链接按地址搜索", () => {
    openWaze(target);
    const url = openSpy.mock.calls[0][0] as string;
    expect(url).toContain("q=" + encodeURIComponent(target.address));
    expect(url).toContain("navigate=yes");
  });

  it("明确选坐标回退时仍可用图钉坐标", () => {
    openGoogleMaps(target, true);
    const url = openSpy.mock.calls[0][0] as string;
    expect(url).toContain("destination=1.5722394,103.6201727");
  });
});
