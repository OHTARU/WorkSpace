-- Admin policies for subscriptions
CREATE POLICY "Admins can view all subscriptions" ON subscriptions
    FOR SELECT USING (
        (SELECT is_admin FROM profiles WHERE id = auth.uid()) = TRUE
    );

CREATE POLICY "Admins can update all subscriptions" ON subscriptions
    FOR UPDATE USING (
        (SELECT is_admin FROM profiles WHERE id = auth.uid()) = TRUE
    );

CREATE POLICY "Admins can insert subscriptions" ON subscriptions
    FOR INSERT WITH CHECK (
        (SELECT is_admin FROM profiles WHERE id = auth.uid()) = TRUE
    );

-- Admin policies for usage_tracking
CREATE POLICY "Admins can view all usage_tracking" ON usage_tracking
    FOR SELECT USING (
        (SELECT is_admin FROM profiles WHERE id = auth.uid()) = TRUE
    );
