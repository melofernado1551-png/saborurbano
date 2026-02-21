import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_PASSWORD = "saborurbano";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller } } = await supabaseClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerUser } = await supabaseAdmin
      .from("app_users")
      .select("id, role, tenant_id")
      .eq("auth_id", caller.id)
      .eq("active", true)
      .single();

    if (!callerUser || !["superadmin", "tenant_admin"].includes(callerUser.role)) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get target user
    const { data: targetUser, error: targetErr } = await supabaseAdmin
      .from("app_users")
      .select("id, tenant_id, auth_id, role")
      .eq("id", user_id)
      .single();

    if (targetErr || !targetUser) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cannot reset own password through this flow
    if (callerUser.id === user_id) {
      return new Response(JSON.stringify({ error: "Não é possível resetar a própria senha por este fluxo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cannot reset superadmin password unless you are superadmin
    if (targetUser.role === "superadmin" && callerUser.role !== "superadmin") {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tenant admin can only reset users of their own tenant
    if (callerUser.role === "tenant_admin" && targetUser.tenant_id !== callerUser.tenant_id) {
      return new Response(JSON.stringify({ error: "Sem permissão para resetar este usuário" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reset password hash in app_users
    const { error: pwErr } = await supabaseAdmin.rpc("update_app_user_password", {
      _user_id: user_id,
      _password: DEFAULT_PASSWORD,
    });

    if (pwErr) {
      console.error("Password hash reset error:", pwErr.message);
      return new Response(JSON.stringify({ error: "Erro ao resetar senha" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reset auth password
    if (targetUser.auth_id) {
      const { error: authPwErr } = await supabaseAdmin.auth.admin.updateUserById(
        targetUser.auth_id,
        { password: DEFAULT_PASSWORD }
      );
      if (authPwErr) {
        console.error("Auth password reset error:", authPwErr.message);
      }
    }

    // Set must_change_password = true
    const { error: flagErr } = await supabaseAdmin
      .from("app_users")
      .update({ must_change_password: true })
      .eq("id", user_id);

    if (flagErr) {
      console.error("Flag update error:", flagErr.message);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Senha resetada com sucesso" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("reset-password error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
