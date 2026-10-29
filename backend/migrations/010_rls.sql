-- 010_rls.sql: Row Level Security with NO anonymous access
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspicious_flags ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_auth_role() RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
END;
$$ LANGUAGE plpgsql STABLE;

-- No anon access: only authenticated or service_role policies
-- Users
CREATE POLICY users_authenticated_select ON users FOR SELECT 
    TO authenticated USING (true);

CREATE POLICY users_authenticated_update ON users FOR UPDATE 
    TO authenticated USING (
        id = NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid
        OR get_auth_role() IN ('admin', 'service_role')
    );

-- Resources
CREATE POLICY resources_authenticated_select ON resources FOR SELECT 
    TO authenticated USING (is_active = true OR get_auth_role() IN ('owner', 'manager', 'admin', 'service_role'));

CREATE POLICY resources_authenticated_insert ON resources FOR INSERT 
    TO authenticated WITH CHECK (
        owner_id = NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid
        OR get_auth_role() IN ('owner', 'admin', 'service_role')
    );

CREATE POLICY resources_authenticated_update ON resources FOR UPDATE 
    TO authenticated USING (
        owner_id = NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid
        OR get_auth_role() IN ('admin', 'service_role')
    );

-- Bookings
CREATE POLICY bookings_authenticated_select ON bookings FOR SELECT 
    TO authenticated USING (
        user_id = NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid
        OR resource_id IN (SELECT id FROM resources WHERE owner_id = NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid)
        OR get_auth_role() IN ('manager', 'admin', 'service_role')
    );

CREATE POLICY bookings_authenticated_insert ON bookings FOR INSERT 
    TO authenticated WITH CHECK (
        user_id = NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid
        OR get_auth_role() IN ('service_role')
    );

CREATE POLICY bookings_authenticated_update ON bookings FOR UPDATE 
    TO authenticated USING (
        user_id = NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid
        OR resource_id IN (SELECT id FROM resources WHERE owner_id = NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid)
        OR get_auth_role() IN ('manager', 'admin', 'service_role')
    );

-- Agreements
CREATE POLICY agreements_authenticated_select ON agreements FOR SELECT 
    TO authenticated USING (
        booking_id IN (
            SELECT id FROM bookings 
            WHERE user_id = NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid
               OR resource_id IN (SELECT id FROM resources WHERE owner_id = NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid)
        )
        OR get_auth_role() IN ('manager', 'admin', 'service_role')
    );

CREATE POLICY agreements_authenticated_update ON agreements FOR UPDATE 
    TO authenticated USING (
        booking_id IN (
            SELECT id FROM bookings 
            WHERE user_id = NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid
               OR resource_id IN (SELECT id FROM resources WHERE owner_id = NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid)
        )
        OR get_auth_role() IN ('manager', 'admin', 'service_role')
    );

-- Notifications
CREATE POLICY notifications_authenticated_select ON notifications FOR SELECT 
    TO authenticated USING (
        user_id = NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid
        OR get_auth_role() = 'service_role'
    );

CREATE POLICY notifications_authenticated_update ON notifications FOR UPDATE 
    TO authenticated USING (
        user_id = NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid
        OR get_auth_role() = 'service_role'
    );

-- Audit Log (read-only for managers and admins)
CREATE POLICY audit_log_authenticated_select ON audit_log FOR SELECT 
    TO authenticated USING (
        get_auth_role() IN ('manager', 'admin', 'service_role')
    );

-- Service Role policies for backend operations
CREATE POLICY service_all_users ON users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_all_resources ON resources FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_all_credentials ON user_credentials FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_all_bookings ON bookings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_all_agreements ON agreements FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_all_waitlist ON waitlist FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_all_inspections ON inspections FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_all_photos ON inspection_photos FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_all_incidents ON incidents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_all_notifications ON notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_all_audit ON audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_all_flags ON suspicious_flags FOR ALL TO service_role USING (true) WITH CHECK (true);

