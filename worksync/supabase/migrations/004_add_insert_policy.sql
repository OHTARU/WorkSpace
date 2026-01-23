-- Add INSERT policy for profiles to allow users to create their own profile if missing
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);
