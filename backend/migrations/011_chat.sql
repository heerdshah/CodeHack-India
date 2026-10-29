-- Booking-scoped private chat. Supabase Realtime uses the participant RLS policies below.
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS name TEXT GENERATED ALWAYS AS (full_name) STORED;

CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id TEXT NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT conversations_distinct_participants CHECK (customer_id <> seller_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_customer ON public.conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_seller ON public.conversations(seller_id);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 4000),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
    ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_unread
    ON public.messages(conversation_id, sender_id)
    WHERE is_read = FALSE;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversations_participant_select ON public.conversations;
CREATE POLICY conversations_participant_select ON public.conversations
    FOR SELECT TO authenticated
    USING (auth.uid() IN (customer_id, seller_id));

DROP POLICY IF EXISTS messages_participant_select ON public.messages;
CREATE POLICY messages_participant_select ON public.messages
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.conversations c
            WHERE c.id = conversation_id
              AND auth.uid() IN (c.customer_id, c.seller_id)
        )
    );

DROP POLICY IF EXISTS service_all_conversations ON public.conversations;
CREATE POLICY service_all_conversations ON public.conversations
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_all_messages ON public.messages;
CREATE POLICY service_all_messages ON public.messages
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;
