import { describe, expect, it } from "vitest";
import { resolveContractBranding } from "./contract-branding";

describe("contract buffet isolation", () => {
  const contract = { owner_id: "buffet-a-owner", tenant_id: "buffet-a" };

  it("rejects settings from another buffet", () => {
    const branding = resolveContractBranding(contract, {
      owner_id: "buffet-b-owner",
      tenant_id: "buffet-b",
      business_name: "Buffet B",
      logo_url: "buffet-b-owner/logo.png",
    });
    expect(branding.logoPath).toBe("");
    expect(branding.businessName).not.toBe("Buffet B");
  });

  it("rejects another tenant even when the settings owner matches", () => {
    const branding = resolveContractBranding(contract, {
      ...contract,
      tenant_id: "buffet-b",
      business_name: "Buffet B",
      logo_url: "buffet-a-owner/logo.png",
    });
    expect(branding.logoPath).toBe("");
    expect(branding.businessName).not.toBe("Buffet B");
  });

  it("only signs the contract buffet's own stored logo", () => {
    const branding = resolveContractBranding(contract, {
      ...contract,
      business_name: "Buffet A",
      logo_url: "https://storage.example/storage/v1/object/sign/buffet-logos/buffet-a-owner/logo.png?token=expired",
    });
    expect(branding.logoPath).toBe("buffet-a-owner/logo.png");

    const foreignLogo = resolveContractBranding(contract, {
      ...contract,
      business_name: "Buffet A",
      logo_url: "buffet-b-owner/logo.png",
    });
    expect(foreignLogo.logoPath).toBe("");
  });
});