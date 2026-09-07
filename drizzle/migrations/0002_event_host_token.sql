ALTER TABLE public.events ADD COLUMN IF NOT EXISTS host_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS events_host_token_key ON public.events(host_token);

CREATE OR REPLACE FUNCTION public.get_event_rsvp_guests(_host_token uuid)
RETURNS TABLE(guest_name text, phone text, companions integer, attending boolean, message text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.guest_name, r.phone, r.companions, r.attending, r.message, r.created_at
  FROM public.event_rsvps r
  JOIN public.events e ON e.id = r.event_id
  WHERE e.host_token = _host_token
  ORDER BY r.created_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.get_event_rsvp_guests(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_event_invite_host(_host_token uuid)
RETURNS TABLE(rsvp_token uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.rsvp_token FROM public.events e WHERE e.host_token = _host_token
$$;

GRANT EXECUTE ON FUNCTION public.get_event_invite_host(uuid) TO anon, authenticated;