import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin privileges required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get request body
    const { user_id, action } = await req.json();

    if (!user_id || !action) {
      return new Response(JSON.stringify({ error: 'Missing user_id or action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'approve') {
      // Approve user
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          is_approved: true,
          approved_at: new Date().toISOString(),
          approved_by: user.id
        })
        .eq('id', user_id);

      if (updateError) {
        throw updateError;
      }

      // Add user role
      await supabase
        .from('user_roles')
        .insert({
          user_id: user_id,
          role: 'user',
          assigned_by: user.id
        });

      // Log activity
      await supabase
        .from('admin_activity_log')
        .insert({
          admin_id: user.id,
          action: 'approve_user',
          target_id: user_id,
          details: { timestamp: new Date().toISOString() }
        });

      return new Response(
        JSON.stringify({ success: true, message: 'User approved successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'reject') {
      // Delete profile
      const { error: deleteProfileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user_id);

      if (deleteProfileError) {
        throw deleteProfileError;
      }

      // Delete auth user
      const { error: deleteUserError } = await supabase.auth.admin.deleteUser(user_id);
      
      if (deleteUserError) {
        throw deleteUserError;
      }

      // Log activity
      await supabase
        .from('admin_activity_log')
        .insert({
          admin_id: user.id,
          action: 'reject_user',
          target_id: user_id,
          details: { timestamp: new Date().toISOString() }
        });

      return new Response(
        JSON.stringify({ success: true, message: 'User rejected and deleted' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'delete') {
      // Prevent self-deletion
      if (user_id === user.id) {
        return new Response(
          JSON.stringify({ error: 'Cannot delete your own account' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user email for logging
      const { data: profileData } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user_id)
        .single();

      // Delete profile (cascades to user_roles and user_plans)
      const { error: deleteProfileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user_id);

      if (deleteProfileError) {
        throw deleteProfileError;
      }

      // Delete auth user
      const { error: deleteUserError } = await supabase.auth.admin.deleteUser(user_id);
      if (deleteUserError) {
        throw deleteUserError;
      }

      // Log deletion
      await supabase.from('admin_activity_log').insert({
        admin_id: user.id,
        action: 'delete_user',
        target_id: user_id,
        details: { email: profileData?.email, timestamp: new Date().toISOString() }
      });

      return new Response(
        JSON.stringify({ success: true, message: 'User permanently deleted' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Error in admin-approve-user:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
