CREATE TABLE public.notification_state (
  user_id uuid PRIMARY KEY,
  quotes_seen_at timestamptz,
  acked_alerts text[] NOT NULL DEFAULT '{}',
  dashboard_seen jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_state TO authenticated;
GRANT ALL ON public.notification_state TO service_role;
ALTER TABLE public.notification_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notification state select" ON public.notification_state FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notification state insert" ON public.notification_state FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notification state update" ON public.notification_state FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);