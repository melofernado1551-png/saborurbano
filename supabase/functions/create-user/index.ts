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

    // Get caller's app_user info
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

    const { login, password, role, tenant_id, name, cpf, cargo } = await req.json();

    if (!login || !password || !role) {
      return new Response(JSON.stringify({ error: "Login, senha e permissão são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate role - tenant_admin can only create roles below their level
    const validRoles = ["tenant_admin", "colaborador", "contador"];
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: "Permissão inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // tenant_admin cannot create other tenant_admins
    if (callerUser.role === "tenant_admin" && role === "tenant_admin") {
      // Allow - admins can create other admins in their tenant
    }

    // Determine tenant_id
    let finalTenantId = tenant_id;
    if (callerUser.role === "tenant_admin") {
      finalTenantId = callerUser.tenant_id; // Force to caller's tenant
    }
    if (!finalTenantId) {
      return new Response(JSON.stringify({ error: "tenant_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check login uniqueness
    const { data: existing } = await supabaseAdmin
      .from("app_users")
      .select("id")
      .eq("login", login)
      .single();

    if (existing) {
      return new Response(JSON.stringify({ error: "Login já existe" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create auth user
    const fakeEmail = `${login}@app.internal`;
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: fakeEmail,
      password: password,
      email_confirm: true,
    });

    if (authError) {
      return new Response(JSON.stringify({ error: "Erro ao criar usuário: " + authError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert into app_users with hashed password
    const { data: newUser, error: insertError } = await supabaseAdmin.rpc("create_app_user", {
      _login: login,
      _password: password,
      _role: role,
      _tenant_id: finalTenantId,
      _auth_id: authUser.user.id,
      _name: name || null,
      _cpf: cpf || null,
      _cargo: cargo || null,
    });

    if (insertError) {
      // Cleanup auth user on failure
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return new Response(JSON.stringify({ error: "Erro ao salvar usuário" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: "Usuário criado com sucesso" }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
