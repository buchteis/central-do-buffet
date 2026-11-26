export function activeTenantPackages<T extends { tenant_id: string | null; active: boolean }>(items: T[], tenantId: string): T[] {
  return items.filter((item) => item.tenant_id === tenantId && item.active);
}