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

    const { new_password } = await req.json();

    if (!new_password) {
      return new Response(JSON.stringify({ error: "Nova senha é obrigatória" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new_password.length < 8) {
      return new Response(JSON.stringify({ error: "A senha deve ter no mínimo 8 caracteres" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if new password is the default password
    const { data: isDefault } = await supabaseAdmin.rpc("verify_password", {
      _password: new_password,
      _hash: "$2a$10$dummy", // We'll check differently
    });

    // Simpler check: just compare raw value
    if (new_password === DEFAULT_PASSWORD) {
      return new Response(JSON.stringify({ error: "A nova senha não pode ser igual à senha padrão" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the user's app_users record
    const { data: appUser, error: appErr } = await supabaseAdmin
      .from("app_users")
      .select("id, must_change_password, auth_id")
      .eq("auth_id", caller.id)
      .eq("active", true)
      .single();

    if (appErr || !appUser) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update password hash in app_users
    const { error: pwErr } = await supabaseAdmin.rpc("update_app_user_password", {
      _user_id: appUser.id,
      _password: new_password,
    });

    if (pwErr) {
      console.error("Password update error:", pwErr.message);
      return new Response(JSON.stringify({ error: "Erro ao atualizar senha" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update auth password
    if (appUser.auth_id) {
      const { error: authPwErr } = await supabaseAdmin.auth.admin.updateUserById(
        appUser.auth_id,
        { password: new_password }
      );
      if (authPwErr) {
        console.error("Auth password update error:", authPwErr.message);
      }
    }

    // Set must_change_password = false
    const { error: flagErr } = await supabaseAdmin
      .from("app_users")
      .update({ must_change_password: false })
      .eq("id", appUser.id);

    if (flagErr) {
      console.error("Flag update error:", flagErr.message);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Senha alterada com sucesso" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("change-password error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
