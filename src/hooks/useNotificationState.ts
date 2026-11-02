import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAccess } from "@/hooks/useTenantAccess";

/**
 * Estado de leitura das notificações, salvo no banco por usuário
 * (vale no celular e no computador ao mesmo tempo).
 */
export type NotificationState = {
  quotes_seen_at: string | null;
  acked_alerts: string[];
  dashboard_seen: Record<string, number>;
};

const EMPTY: NotificationState = { quotes_seen_at: null, acked_alerts: [], dashboard_seen: {} };
const LEGACY_ACK_KEY = "cdb_alertas_confirmados";
const legacySeenKey = (userId: string) => `cdb_public_quotes_seen:${userId}`;

export const notificationStateKey = (userId?: string | null) => ["notification-state", userId ?? null];

function readLegacy(userId: string) {
  try {
    const acks = JSON.parse(localStorage.getItem(LEGACY_ACK_KEY) ?? "[]");
    const seen = localStorage.getItem(legacySeenKey(userId));
    return { acks: Array.isArray(acks) ? (acks as string[]) : [], seen };
  } catch {
    return { acks: [] as string[], seen: null as string | null };
  }
}

const laterOf = (a: string | null, b: string | null) => {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) > new Date(b) ? a : b;
};

async function save(userId: string, s: NotificationState) {
  await supabase.from("notification_state").upsert({
    user_id: userId,
    quotes_seen_at: s.quotes_seen_at,
    acked_alerts: s.acked_alerts.slice(-500),
    dashboard_seen: s.dashboard_seen,
    updated_at: new Date().toISOString(),
  });
}

export function useNotificationState() {
  const { data: access } = useTenantAccess();
  const userId = access?.userId as string | undefined;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: notificationStateKey(userId),
    enabled: !!userId,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<NotificationState> => {
      const { data } = await supabase
        .from("notification_state")
        .select("quotes_seen_at, acked_alerts, dashboard_seen")
        .eq("user_id", userId!)
        .maybeSingle();
      const legacy = readLegacy(userId!);
      const dbAcks = (data?.acked_alerts as string[] | null) ?? [];
      const state: NotificationState = {
        quotes_seen_at: laterOf((data?.quotes_seen_at as string | null) ?? null, legacy.seen),
        acked_alerts: Array.from(new Set([...dbAcks, ...legacy.acks])),
        dashboard_seen: ((data?.dashboard_seen as Record<string, number> | null) ?? {}) || {},
      };
      const changed =
        !data ||
        state.acked_alerts.length !== dbAcks.length ||
        state.quotes_seen_at !== (data?.quotes_seen_at ?? null);
      if (changed) await save(userId!, state);
      return state;
    },
  });

  const update = useCallback(
    async (patch: (prev: NotificationState) => Partial<NotificationState>) => {
      if (!userId) return;
      const prev = qc.getQueryData<NotificationState>(notificationStateKey(userId)) ?? EMPTY;
      const next = { ...prev, ...patch(prev) };
      qc.setQueryData(notificationStateKey(userId), next);
      await save(userId, next);
    },
    [qc, userId],
  );

  return { state: query.data ?? EMPTY, ready: query.isSuccess, update, userId };
}
