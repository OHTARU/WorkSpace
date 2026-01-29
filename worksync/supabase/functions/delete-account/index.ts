// Supabase Edge Function: 계정 삭제
// 사용자의 모든 데이터와 Auth 계정을 완전히 삭제합니다.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 환경 변수에서 Supabase 설정 가져오기
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    // Service Role 클라이언트 (관리자 권한)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // ... (사용자 인증 로직 동일)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid user token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = user.id;
    console.log(`Processing account deletion for user: ${userId}`);

    // 0. Stripe 구독 취소 (있는 경우)
    if (stripeSecretKey) {
      try {
        const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() });
        
        const { data: subData } = await supabaseAdmin
          .from('subscriptions')
          .select('stripe_subscription_id')
          .eq('user_id', userId)
          .single();

        if (subData?.stripe_subscription_id) {
          console.log(`Canceling Stripe subscription: ${subData.stripe_subscription_id}`);
          await stripe.subscriptions.cancel(subData.stripe_subscription_id);
          console.log('Stripe subscription canceled');
        }
      } catch (stripeError) {
        console.error('Stripe cancellation error (continuing):', stripeError);
      }
    }

    // 1. Storage에서 사용자 파일 삭제
    let storageDeleteSuccess = true;
    try {
      const { data: storageFiles, error: listError } = await supabaseAdmin.storage
        .from('clipboard-media')
        .list(userId);

      if (listError) {
        console.error('Failed to list storage files:', listError);
        storageDeleteSuccess = false;
      } else if (storageFiles && storageFiles.length > 0) {
        const filePaths = storageFiles.map((f) => `${userId}/${f.name}`);
        const { error: removeError } = await supabaseAdmin.storage
          .from('clipboard-media')
          .remove(filePaths);

        if (removeError) {
          console.error('Failed to delete storage files:', removeError);
          storageDeleteSuccess = false;
        } else {
          console.log(`Deleted ${filePaths.length} storage files`);
        }
      }
    } catch (storageError) {
      console.error('Storage deletion error:', storageError);
      storageDeleteSuccess = false;
    }

    // Storage 삭제 실패 시 경고 (계속 진행하되 로그에 기록)
    if (!storageDeleteSuccess) {
      console.warn('Storage deletion had issues, but continuing with account deletion');
    }

    // 2. 모든 사용자 데이터 삭제 (순서대로)
    const deleteResults = await Promise.allSettled([
      supabaseAdmin.from('clipboards').delete().eq('user_id', userId),
      supabaseAdmin.from('passwords').delete().eq('user_id', userId),
      supabaseAdmin.from('todos').delete().eq('user_id', userId),
      supabaseAdmin.from('projects').delete().eq('user_id', userId),
      supabaseAdmin.from('urls').delete().eq('user_id', userId),
      supabaseAdmin.from('profiles').delete().eq('id', userId),
    ]);

    // 삭제 결과 로깅
    const tableNames = ['clipboards', 'passwords', 'todos', 'projects', 'urls', 'profiles'];
    deleteResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to delete ${tableNames[index]}:`, result.reason);
      } else if (result.value.error) {
        console.error(`Error deleting ${tableNames[index]}:`, result.value.error);
      } else {
        console.log(`Deleted ${tableNames[index]}`);
      }
    });

    // 3. Auth 사용자 삭제 (Service Role 필요)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error('Failed to delete auth user:', deleteAuthError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete authentication account', details: deleteAuthError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully deleted account for user: ${userId}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
