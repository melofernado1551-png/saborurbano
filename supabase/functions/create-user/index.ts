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
      .select("role, tenant_id")
      .eq("auth_id", caller.id)
      .eq("active", true)
      .single();

    if (!callerUser || !["superadmin", "tenant_admin"].includes(callerUser.role)) {
      return new Response(JSON.stringify({ error: "Sem permissão para criar usuários" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { login, role, tenant_id, name, cpf, cargo } = await req.json();

    if (!login || !role) {
      return new Response(JSON.stringify({ error: "Login e permissão são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate role
    const validRoles = ["tenant_admin", "colaborador", "contador"];
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: "Permissão inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine tenant_id
    let finalTenantId = tenant_id;
    if (callerUser.role === "tenant_admin") {
      finalTenantId = callerUser.tenant_id;
    }
    if (!finalTenantId) {
      return new Response(JSON.stringify({ error: "tenant_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check login uniqueness (global, active users only)
    const { data: existing } = await supabaseAdmin
      .from("app_users")
      .select("id")
      .eq("login", login)
      .eq("active", true)
      .single();

    if (existing) {
      return new Response(JSON.stringify({ error: "Login já existe" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create auth user with default password
    const fakeEmail = `${login}@app.internal`;
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: fakeEmail,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
    });

    if (authError) {
      return new Response(JSON.stringify({ error: "Erro ao criar usuário: " + authError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert into app_users with hashed default password and must_change_password = true
    const { data: newUser, error: insertError } = await supabaseAdmin.rpc("create_app_user", {
      _login: login,
      _password: DEFAULT_PASSWORD,
      _role: role,
      _tenant_id: finalTenantId,
      _auth_id: authUser.user.id,
      _name: name || null,
      _cpf: cpf || null,
      _cargo: cargo || null,
    });

    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return new Response(JSON.stringify({ error: "Erro ao salvar usuário" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Set must_change_password = true
    if (newUser) {
      await supabaseAdmin
        .from("app_users")
        .update({ must_change_password: true })
        .eq("id", newUser);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Usuário criado com sucesso" }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("create-user error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
