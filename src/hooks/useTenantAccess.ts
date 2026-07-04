import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useTenantAccess() {
  return useQuery({
    queryKey: ["tenant-access"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [{ data: tenant }, { data: roles }] = await Promise.all([
        supabase.from("tenants").select("*").eq("owner_id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      ]);
      const roleList = (roles ?? []).map((r: any) => r.role);
      return {
        userId: u.user.id,
        email: u.user.email,
        tenant,
        roles: roleList,
        isSuperAdmin: roleList.includes("super_admin"),
      };
    },
    staleTime: 30_000,
  });
}
