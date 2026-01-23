-- Add verifier column to profiles table for Master Password verification
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verifier TEXT;
