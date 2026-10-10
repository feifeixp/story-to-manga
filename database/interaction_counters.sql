-- Optional gallery repair. Apply manually in Supabase only after reviewing it.
-- The JavaScript client cannot use SQL expressions in .update(). Counters belong
-- in database triggers so concurrent interactions update them atomically under RLS.
BEGIN;

CREATE OR REPLACE FUNCTION public.update_comic_interaction_counter()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_id UUID;
  delta INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    target_id := NEW.comic_id;
    delta := 1;
  ELSE
    target_id := OLD.comic_id;
    delta := -1;
  END IF;

  IF TG_TABLE_NAME = 'comic_likes' THEN
    UPDATE public.comics SET likes_count = GREATEST(0, COALESCE(likes_count, 0) + delta) WHERE id = target_id;
  ELSIF TG_TABLE_NAME = 'comic_favorites' THEN
    UPDATE public.comics SET favorites_count = GREATEST(0, COALESCE(favorites_count, 0) + delta) WHERE id = target_id;
  ELSIF TG_TABLE_NAME = 'comic_views' THEN
    UPDATE public.comics SET views_count = GREATEST(0, COALESCE(views_count, 0) + delta) WHERE id = target_id;
  ELSE
    RAISE EXCEPTION 'Unsupported interaction table';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.update_comic_interaction_counter() FROM PUBLIC;

DROP TRIGGER IF EXISTS sync_comic_likes_count ON public.comic_likes;
CREATE TRIGGER sync_comic_likes_count AFTER INSERT OR DELETE ON public.comic_likes
FOR EACH ROW EXECUTE FUNCTION public.update_comic_interaction_counter();
DROP TRIGGER IF EXISTS sync_comic_favorites_count ON public.comic_favorites;
CREATE TRIGGER sync_comic_favorites_count AFTER INSERT OR DELETE ON public.comic_favorites
FOR EACH ROW EXECUTE FUNCTION public.update_comic_interaction_counter();
DROP TRIGGER IF EXISTS sync_comic_views_count ON public.comic_views;
CREATE TRIGGER sync_comic_views_count AFTER INSERT OR DELETE ON public.comic_views
FOR EACH ROW EXECUTE FUNCTION public.update_comic_interaction_counter();

UPDATE public.comics AS c SET
  likes_count = (SELECT COUNT(*) FROM public.comic_likes WHERE comic_id = c.id),
  favorites_count = (SELECT COUNT(*) FROM public.comic_favorites WHERE comic_id = c.id),
  views_count = (SELECT COUNT(*) FROM public.comic_views WHERE comic_id = c.id);

COMMIT;
