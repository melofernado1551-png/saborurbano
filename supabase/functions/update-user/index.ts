import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // Extract user from JWT using admin client
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (!caller || authError) {
      console.error("Auth error:", authError?.message);
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerUser } = await supabaseAdmin
      .from("profiles")
      .select("role, tenant_id")
      .eq("auth_id", caller.id)
      .eq("active", true)
      .single();

    if (!callerUser || !["superadmin", "tenant_admin"].includes(callerUser.role)) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, name, cpf, cargo, role, password, active, login } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get target user
    const { data: targetUser, error: targetErr } = await supabaseAdmin
      .from("profiles")
      .select("id, tenant_id, auth_id, role")
      .eq("id", user_id)
      .single();

    if (targetErr || !targetUser) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tenant admin can only edit users of their own tenant
    if (callerUser.role === "tenant_admin" && targetUser.tenant_id !== callerUser.tenant_id) {
      return new Response(JSON.stringify({ error: "Sem permissão para editar este usuário" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cannot edit a superadmin unless you are superadmin
    if (targetUser.role === "superadmin" && callerUser.role !== "superadmin") {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate role if provided
    if (role) {
      const validRoles = ["tenant_admin", "colaborador", "contador"];
      if (!validRoles.includes(role)) {
        return new Response(JSON.stringify({ error: "Permissão inválida" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check login uniqueness if changed
    if (login) {
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("login", login)
        .eq("active", true)
        .neq("id", user_id)
        .single();

      if (existing) {
        return new Response(JSON.stringify({ error: "Este login já está em uso. Escolha outro nome de usuário." }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Update login email in auth if login changed
    if (login && targetUser.auth_id) {
      const fakeEmail = `${login}@app.internal`;
      await supabaseAdmin.auth.admin.updateUserById(targetUser.auth_id, { email: fakeEmail });
    }

    // Build update payload
    const updatePayload: Record<string, any> = {};
    if (name !== undefined) updatePayload.name = name;
    if (cpf !== undefined) updatePayload.cpf = cpf;
    if (cargo !== undefined) updatePayload.cargo = cargo;
    if (role !== undefined) updatePayload.role = role;
    if (active !== undefined) updatePayload.active = active;
    if (login !== undefined) updatePayload.login = login;

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateErr } = await supabaseAdmin
        .from("profiles")
        .update(updatePayload)
        .eq("id", user_id);

      if (updateErr) {
        return new Response(JSON.stringify({ error: "Erro ao atualizar: " + updateErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Update password if provided
    if (password) {
      const { error: pwErr } = await supabaseAdmin.rpc("update_app_user_password", {
        _user_id: user_id,
        _password: password,
      });
      if (pwErr) console.error("Password hash update error:", pwErr.message);

      if (targetUser.auth_id) {
        const { error: authPwErr } = await supabaseAdmin.auth.admin.updateUserById(
          targetUser.auth_id,
          { password }
        );
        if (authPwErr) console.error("Auth password update error:", authPwErr.message);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Usuário atualizado com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
