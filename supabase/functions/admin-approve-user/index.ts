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

      // PHASE 2: Send approval notification email to user
      const { data: profileData } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user_id)
        .single();

      if (profileData?.email) {
        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        
        if (resendApiKey) {
          try {
            // Extract project ID from Supabase URL for login link
            const projectMatch = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/);
            const loginUrl = projectMatch ? `https://${projectMatch[1]}.lovable.app` : 'https://lovable.app';
            
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'Stock Predictor <onboarding@resend.dev>',
                to: [profileData.email],
                subject: '🎉 Your Account Has Been Approved!',
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #16a34a;">Welcome to Stock Predictor!</h1>
                    <p style="font-size: 16px;">Great news! Your account has been approved by an administrator.</p>
                    
                    <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px; margin: 20px 0;">
                      <h2 style="color: #15803d; margin-top: 0;">You can now access:</h2>
                      <ul style="color: #166534;">
                        <li>✅ AI-powered options trading predictions</li>
                        <li>✅ Real-time NSE data analysis</li>
                        <li>✅ Backtesting and accuracy metrics</li>
                        <li>✅ Technical & sentiment analysis</li>
                      </ul>
                    </div>
                    
                    <p style="font-size: 16px;">Ready to start trading? Click the button below to log in:</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${loginUrl}" 
                         style="background-color: #16a34a; color: white; padding: 14px 32px; 
                                text-decoration: none; border-radius: 6px; font-size: 16px; 
                                font-weight: bold; display: inline-block;">
                        Login to Your Account
                      </a>
                    </div>
                    
                    <p style="font-size: 14px; color: #666;">
                      If you have any questions, feel free to reach out to our support team.
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                    
                    <p style="font-size: 12px; color: #999;">
                      This is an automated message from Stock Predictor. Please do not reply to this email.
                    </p>
                  </div>
                `,
              }),
            });
            console.log(`✓ Approval notification sent to ${profileData.email}`);
          } catch (emailError) {
            console.error('Failed to send approval email:', emailError);
            // Don't fail the approval if email fails
          }
        }
      }

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
