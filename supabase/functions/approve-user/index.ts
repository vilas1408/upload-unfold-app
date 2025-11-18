import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

async function sendEmail(to: string[], subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: "StockPredict AI <onboarding@resend.dev>", to, subject, html }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Resend API error: ${JSON.stringify(error)}`);
  }
  
  return response.json();
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const user_id = url.searchParams.get("user_id");
    const action = url.searchParams.get("action");

    if (!user_id || !action) {
      throw new Error("Missing user_id or action parameter");
    }

    console.log(`Processing ${action} for user:`, user_id);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (action === "approve") {
      // Update profile to approved
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          is_approved: true,
          approved_at: new Date().toISOString(),
        })
        .eq("id", user_id);

      if (updateError) throw updateError;

      // Get user email
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", user_id)
        .single();

      if (profileError) throw profileError;

      // Send approval email to user
      await sendEmail(
        [profile.email],
        "Your StockPredict AI Account Has Been Approved!",
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #22c55e;">Welcome to StockPredict AI!</h1>
            <p>Great news! Your account has been approved and you can now login to access AI-powered stock predictions.</p>
            
            <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;"><strong>What's next?</strong></p>
              <p style="margin: 10px 0 0 0;">Visit our platform and login with your credentials to start exploring stock predictions.</p>
            </div>
            
            <p>If you have any questions, feel free to reach out to our support team.</p>
            
            <p style="color: #666; font-size: 12px; margin-top: 40px;">
              This is an automated email from StockPredict AI
            </p>
          </div>
        `
      );

      console.log("User approved and notification sent");

      return new Response(
        `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f5f5f5; }
              .container { text-align: center; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .success { color: #22c55e; font-size: 48px; margin-bottom: 20px; }
              h1 { color: #333; }
              p { color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success">✓</div>
              <h1>User Approved Successfully</h1>
              <p>The user has been notified via email and can now login to the app.</p>
            </div>
          </body>
        </html>
        `,
        {
          status: 200,
          headers: { "Content-Type": "text/html", ...corsHeaders },
        }
      );
    } else if (action === "reject") {
      // Delete the user profile and auth user
      const { error: deleteProfileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", user_id);

      if (deleteProfileError) throw deleteProfileError;

      // Delete from auth.users (requires service role key)
      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(user_id);
      
      if (deleteAuthError) throw deleteAuthError;

      console.log("User rejected and deleted");

      return new Response(
        `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f5f5f5; }
              .container { text-align: center; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .reject { color: #ef4444; font-size: 48px; margin-bottom: 20px; }
              h1 { color: #333; }
              p { color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="reject">✗</div>
              <h1>User Rejected</h1>
              <p>The user registration has been rejected and their account has been deleted.</p>
            </div>
          </body>
        </html>
        `,
        {
          status: 200,
          headers: { "Content-Type": "text/html", ...corsHeaders },
        }
      );
    } else {
      throw new Error("Invalid action. Must be 'approve' or 'reject'");
    }
  } catch (error: any) {
    console.error("Error processing approval:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
