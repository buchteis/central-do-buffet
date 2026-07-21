CREATE OR REPLACE FUNCTION public.trg_events_sync_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.sync_event_stock(NEW.id);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Ao cancelar, devolver TUDO ao estoque (reservado + já consumido)
    IF NEW.status = 'cancelado' AND OLD.status IS DISTINCT FROM 'cancelado' THEN
      PERFORM public.return_event_stock(NEW.id);
    ELSIF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.package_id IS DISTINCT FROM OLD.package_id
       OR NEW.guest_count IS DISTINCT FROM OLD.guest_count THEN
      PERFORM public.sync_event_stock(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END; $function$;