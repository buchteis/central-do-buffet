type ContractIdentity = { owner_id: string; tenant_id: string | null };
type BuffetBrandingSettings = ContractIdentity & {
  business_name: string | null;
  logo_url: string | null;
};

/** Resolve only the branding that belongs to this contract's buffet. */
export function resolveContractBranding(
  contract: ContractIdentity,
  settings: BuffetBrandingSettings | null,
) {
  if (
    !settings ||
    settings.owner_id !== contract.owner_id ||
    (contract.tenant_id !== null && settings.tenant_id !== contract.tenant_id)
  ) {
    return { businessName: "Contrato", logoPath: "" };
  }

  const value = settings.logo_url?.trim() ?? "";
  const marker = "/buffet-logos/";
  const position = value.indexOf(marker);
  const path = position >= 0 ? value.slice(position + marker.length).split("?")[0] : value;
  // Do not sign objects outside the buffet owner's folder, even for legacy URLs.
  const logoPath = path.startsWith(`${settings.owner_id}/`) && !path.includes("..") ? path : "";

  return { businessName: settings.business_name?.trim() || "Contrato", logoPath };
}