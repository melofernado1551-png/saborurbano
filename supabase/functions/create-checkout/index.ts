import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Não autorizado");

    const body = await req.json();
    const { tenant_id, items, observation, delivery_address, delivery_fee } = body;

    if (!tenant_id || !items?.length) throw new Error("Dados incompletos");

    // Get customer for this tenant
    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select("id, name, active")
      .eq("auth_id", user.id)
      .eq("tenant_id", tenant_id)
      .eq("active", true)
      .single();

    if (custErr || !customer) throw new Error("Cliente não encontrado para este estabelecimento");

    // Get next sale number
    const { data: saleNumber } = await supabase.rpc("next_sale_number", { _tenant_id: tenant_id });

    // Calculate total (including addons + delivery fee)
    const itemsTotal = items.reduce((sum: number, item: any) => {
      const price = item.promoPrice ?? item.price;
      const addonsTotal = (item.addons || []).reduce((a: number, addon: any) => a + (addon.price || 0), 0);
      return sum + (price + addonsTotal) * item.quantity;
    }, 0);

    const finalDeliveryFee = typeof delivery_fee === "number" ? delivery_fee : 0;
    const total = itemsTotal + finalDeliveryFee;

    // Create sale with address
    const { data: sale, error: saleErr } = await supabase
      .from("sales")
      .insert({
        tenant_id,
        customer_id: customer.id,
        valor_total: total,
        sale_number: saleNumber,
        financial_status: "pending",
        operational_status: "received",
        observacao: observation || null,
        delivery_address: delivery_address || null,
      })
      .select("id, sale_number")
      .single();

    if (saleErr) throw new Error("Erro ao criar venda: " + saleErr.message);

    // Create chat linked to sale
    const { data: chat, error: chatErr } = await supabase
      .from("chats")
      .insert({
        tenant_id,
        customer_id: customer.id,
        sale_id: sale.id,
        status: "open",
      })
      .select("id")
      .single();

    if (chatErr) throw new Error("Erro ao criar chat: " + chatErr.message);

    // Update sale with chat_id
    await supabase.from("sales").update({ chat_id: chat.id }).eq("id", sale.id);

    // Build order summary message (with addons, combos + address)
    const itemLines = items.map((item: any) => {
      const price = item.promoPrice ?? item.price;
      const addons = item.addons || [];
      const addonsTotal = addons.reduce((a: number, addon: any) => a + (addon.price || 0), 0);
      const itemTotal = (price + addonsTotal) * item.quantity;
      
      const lines: string[] = [];
      
      if (item.isCombo) {
        lines.push(`• ${item.quantity}x 📦 ${item.name} — R$ ${(price * item.quantity).toFixed(2)}`);
        const comboProducts = item.comboProducts || [];
        for (const cp of comboProducts) {
          lines.push(`   → ${cp.quantity}x ${cp.name}`);
        }
      } else {
        lines.push(`• ${item.quantity}x ${item.name} — R$ ${(price * item.quantity).toFixed(2)}`);
      }
      
      for (const addon of addons) {
        lines.push(`   + ${addon.name} — R$ ${Number(addon.price).toFixed(2)}`);
      }
      
      if (addons.length > 0) {
        lines.push(`   Total do item: R$ ${itemTotal.toFixed(2)}`);
      }
      
      if (item.observation) lines.push(`  📝 ${item.observation}`);
      return lines.join("\n");
    });

    // Address block
    const addressLines: string[] = [];
    if (delivery_address) {
      addressLines.push(`📍 **Endereço de entrega:**`);
      const addr = delivery_address;
      addressLines.push(`${addr.street}, ${addr.number}${addr.complement ? ` - ${addr.complement}` : ""}`);
      addressLines.push(`${addr.neighborhood} - ${addr.city}`);
      if (addr.reference) addressLines.push(`Ref: ${addr.reference}`);
    }

    const messageContent = [
      `📋 **Pedido #${saleNumber}**`,
      ``,
      ...itemLines,
      ``,
      ...(addressLines.length > 0 ? [...addressLines, ``] : []),
      `🚚 Frete: ${finalDeliveryFee === 0 ? "Grátis" : `R$ ${finalDeliveryFee.toFixed(2)}`}`,
      `💰 **Total: R$ ${total.toFixed(2)}**`,
      observation ? `\n📝 Obs: ${observation}` : "",
    ].filter(Boolean).join("\n");

    // Send first message as customer (order summary)
    await supabase.from("chat_messages").insert({
      chat_id: chat.id,
      sender_id: customer.id,
      sender_type: "customer",
      content: messageContent,
      message_type: "order_summary",
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        chat_id: chat.id, 
        sale_id: sale.id,
        sale_number: saleNumber 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
