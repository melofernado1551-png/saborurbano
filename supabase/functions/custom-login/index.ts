import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { login, password } = await req.json();

    if (!login || !password) {
      return new Response(JSON.stringify({ error: "Login e senha são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Get user by login
    const { data: user, error: userError } = await supabaseAdmin
      .from("profiles")
      .select("id, login, role, tenant_id, active, auth_id, password_hash, must_change_password")
      .eq("login", login)
      .eq("active", true)
      .single();

    if (userError || !user) {
      console.log("User lookup failed:", userError?.message);
      return new Response(JSON.stringify({ error: "Credenciais inválidas" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify password using database function
    const { data: passwordMatch, error: verifyErr } = await supabaseAdmin.rpc("verify_password", {
      _password: password,
      _hash: user.password_hash,
    });

    if (verifyErr) {
      console.error("Password verify error:", verifyErr.message);
      return new Response(JSON.stringify({ error: "Erro ao verificar senha" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!passwordMatch) {
      return new Response(JSON.stringify({ error: "Credenciais inválidas" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check tenant active (if not superadmin)
    if (user.role !== "superadmin" && user.tenant_id) {
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("active")
        .eq("id", user.tenant_id)
        .single();

      if (!tenant?.active) {
        return new Response(JSON.stringify({ error: "Estabelecimento desativado" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Create or get auth user
    const fakeEmail = `${login}@app.internal`;
    let authId = user.auth_id;

    if (!authId) {
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: fakeEmail,
        password: password,
        email_confirm: true,
      });

      if (authError) {
        console.error("Auth create error:", authError.message);
        return new Response(JSON.stringify({ error: "Erro ao criar sessão" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      authId = authUser.user.id;
      await supabaseAdmin.from("profiles").update({ auth_id: authId }).eq("id", user.id);
    } else {
      // Sync password to auth
      try {
        const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authId, { password });
        if (updateErr) console.error("Update user password error:", updateErr.message);
      } catch (e) {
        console.error("Update user failed:", e);
      }
    }

    // Sign in
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, anonKey);

    const { data: signInData, error: signInErr } = await supabaseClient.auth.signInWithPassword({
      email: fakeEmail,
      password: password,
    });

    if (signInErr) {
      console.error("Sign in error:", signInErr.message);
      return new Response(JSON.stringify({ error: "Erro na autenticação: " + signInErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        session: signInData.session,
        user: {
          id: user.id,
          login: user.login,
          role: user.role,
          tenant_id: user.tenant_id,
        },
        must_change_password: user.must_change_password || false,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
