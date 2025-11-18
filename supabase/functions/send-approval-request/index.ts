import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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

interface ApprovalRequest {
  email: string;
  mobile_number: string;
  date_of_birth: string;
  user_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, mobile_number, date_of_birth, user_id }: ApprovalRequest = await req.json();
    
    console.log("Sending approval request for:", email);

    const approvalUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/approve-user?user_id=${user_id}&action=approve`;
    const rejectUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/approve-user?user_id=${user_id}&action=reject`;

    const emailResponse = await sendEmail(
      ["omkarbomble620@gmail.com"],
      "New User Registration Approval Required",
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">New User Registration</h1>
          <p>A new user has signed up and is awaiting approval:</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Mobile Number:</strong> ${mobile_number}</p>
            <p><strong>Date of Birth:</strong> ${date_of_birth}</p>
            <p><strong>User ID:</strong> ${user_id}</p>
          </div>
          
          <p>Please review and approve or reject this registration:</p>
          
          <div style="margin: 30px 0;">
            <a href="${approvalUrl}" 
               style="background-color: #22c55e; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; margin-right: 10px; 
                      display: inline-block;">
              Approve User
            </a>
            <a href="${rejectUrl}" 
               style="background-color: #ef4444; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Reject User
            </a>
          </div>
          
          <p style="color: #666; font-size: 12px; margin-top: 40px;">
            This is an automated email from StockPredict AI
          </p>
        </div>
      `
    );

    console.log("Approval request email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending approval request:", error);
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
