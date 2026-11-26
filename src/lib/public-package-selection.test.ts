import { describe, expect, it } from "vitest";
import { activeTenantPackages } from "./public-package-selection";

describe("public package selection", () => {
  const packages = [
    { id: "a", tenant_id: "buffet-a", active: true },
    { id: "b", tenant_id: "buffet-a", active: true },
    { id: "inactive", tenant_id: "buffet-a", active: false },
    { id: "other", tenant_id: "buffet-b", active: true },
  ];
  it("includes every active package from the linked buffet", () => {
    expect(activeTenantPackages(packages, "buffet-a").map((p) => p.id)).toEqual(["a", "b"]);
  });
  it("excludes inactive packages", () => {
    expect(activeTenantPackages(packages, "buffet-a").some((p) => p.id === "inactive")).toBe(false);
  });
  it("never includes packages from another buffet", () => {
    expect(activeTenantPackages(packages, "buffet-b").map((p) => p.id)).toEqual(["other"]);
  });
});