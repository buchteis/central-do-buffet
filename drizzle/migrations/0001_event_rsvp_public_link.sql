-- Token público de convite por evento
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS rsvp_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS events_rsvp_token_key ON public.events(rsvp_token);

-- Confirmações de presença dos convidados
CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  guest_name text NOT NULL,
  phone text,
  companions integer NOT NULL DEFAULT 0,
  attending boolean NOT NULL DEFAULT true,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_rsvps_event_id_idx ON public.event_rsvps(event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_rsvps TO authenticated;
GRANT ALL ON public.event_rsvps TO service_role;

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read rsvps of their events" ON public.event_rsvps;
CREATE POLICY "Owners read rsvps of their events"
ON public.event_rsvps FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.events ev WHERE ev.id = event_rsvps.event_id AND ev.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Owners delete rsvps of their events" ON public.event_rsvps;
CREATE POLICY "Owners delete rsvps of their events"
ON public.event_rsvps FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.events ev WHERE ev.id = event_rsvps.event_id AND ev.owner_id = auth.uid()));

-- Leitura pública restrita do evento pelo token
CREATE OR REPLACE FUNCTION public.get_event_invite(_token uuid)
RETURNS TABLE (
  event_id uuid,
  event_date date,
  event_time time,
  event_address text,
  event_type text,
  client_name text,
  confirmed_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.event_date,
    e.event_time,
    e.event_address,
    COALESCE(p.name, 'Evento')::text,
    c.name::text,
    (SELECT COALESCE(SUM(1 + r.companions), 0)::int FROM public.event_rsvps r WHERE r.event_id = e.id AND r.attending)
  FROM public.events e
  LEFT JOIN public.clients c ON c.id = e.client_id
  LEFT JOIN public.packages p ON p.id = e.package_id
  WHERE e.rsvp_token = _token AND e.status <> 'cancelado'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_invite(uuid) TO anon, authenticated;

-- Envio público de confirmação
CREATE OR REPLACE FUNCTION public.submit_event_rsvp(
  _token uuid,
  _guest_name text,
  _phone text,
  _companions integer,
  _attending boolean,
  _message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event_id uuid;
  _new_id uuid;
BEGIN
  SELECT id INTO _event_id FROM public.events
   WHERE rsvp_token = _token AND status <> 'cancelado' LIMIT 1;
  IF _event_id IS NULL THEN
    RAISE EXCEPTION 'Convite inválido';
  END IF;
  IF _guest_name IS NULL OR length(trim(_guest_name)) < 2 THEN
    RAISE EXCEPTION 'Nome inválido';
  END IF;

  INSERT INTO public.event_rsvps (event_id, guest_name, phone, companions, attending, message)
  VALUES (_event_id, left(trim(_guest_name), 120), left(coalesce(_phone,''), 30), greatest(least(coalesce(_companions,0), 20), 0), coalesce(_attending, true), left(coalesce(_message,''), 500))
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_event_rsvp(uuid, text, text, integer, boolean, text) TO anon, authenticated;