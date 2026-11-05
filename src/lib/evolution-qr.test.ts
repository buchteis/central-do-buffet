import { describe, expect, it } from "vitest";
import { toQrDataUrl } from "./evolution.server";

describe("toQrDataUrl", () => {
  it("renders Evolution raw QR content as an image data URL", async () => {
    const image = await toQrDataUrl("2@evolution-qr-payload");

    expect(image).toMatch(/^data:image\/png;base64,/);
    expect(image).not.toContain("2@evolution-qr-payload");
  });

  it("converts raw QR payloads stored in legacy image data URLs", async () => {
    const image = await toQrDataUrl("data:image/png;base64,2@legacy-qr-payload");

    expect(image).toMatch(/^data:image\/png;base64,/);
    expect(image).not.toContain("2@legacy-qr-payload");
  });

  it("preserves an existing image data URL", async () => {
    const image = "data:image/png;base64,aGVsbG8=";

    await expect(toQrDataUrl(image)).resolves.toBe(image);
  });
});
