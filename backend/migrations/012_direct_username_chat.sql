-- Allow direct conversations between any two users, independent of bookings.
ALTER TABLE public.conversations
    ALTER COLUMN booking_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_direct_pair
    ON public.conversations(customer_id, seller_id)
    WHERE booking_id IS NULL;

CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(
    p_user_a UUID,
    p_user_b UUID
)
RETURNS SETOF public.conversations
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_user_a = p_user_b THEN
        RAISE EXCEPTION 'A user cannot start a conversation with themselves.';
    END IF;

    INSERT INTO public.conversations (booking_id, customer_id, seller_id)
    VALUES (NULL, LEAST(p_user_a, p_user_b), GREATEST(p_user_a, p_user_b))
    ON CONFLICT (customer_id, seller_id) WHERE booking_id IS NULL
    DO NOTHING;

    RETURN QUERY
    SELECT c.*
    FROM public.conversations AS c
    WHERE c.booking_id IS NULL
      AND c.customer_id = LEAST(p_user_a, p_user_b)
      AND c.seller_id = GREATEST(p_user_a, p_user_b);
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_direct_conversation(UUID, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(UUID, UUID)
    TO service_role;

NOTIFY pgrst, 'reload schema';
