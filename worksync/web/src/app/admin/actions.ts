'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Update a user's plan (Admin only)
 */
export async function updateUserPlan(userId: string, planName: string) {
  const supabase = createClient();
  
  // 1. Check if current user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    throw new Error('Forbidden: Admin access required');
  }

  // 2. Get the plan ID for the requested plan name
  const { data: plan } = await supabase
    .from('plans')
    .select('id')
    .eq('name', planName)
    .single();

  if (!plan) throw new Error(`Plan '${planName}' not found`);

  // 3. Update the subscription
  // We use upsert to handle cases where subscription might be missing or needs update
  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId,
      plan_id: plan.id,
      status: 'active',
      billing_cycle: 'monthly' // Default to monthly for admin manual overrides
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('Error updating plan:', error);
    throw new Error('Failed to update plan');
  }

  revalidatePath('/admin');
  return { success: true };
}
