-- Add is_admin column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Create policy for admins to view all profiles
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (
        (SELECT is_admin FROM profiles WHERE id = auth.uid()) = TRUE
    );

-- Create policy for admins to update all profiles (for plan management)
CREATE POLICY "Admins can update all profiles" ON profiles
    FOR UPDATE USING (
        (SELECT is_admin FROM profiles WHERE id = auth.uid()) = TRUE
    );
