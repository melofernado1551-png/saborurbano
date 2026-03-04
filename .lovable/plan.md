

## Plano: Lógica de frete baseada na configuração da loja

### Problema atual
Hoje o sistema tem 3 cenários de frete na config da loja:
1. **Frete grátis** (`free_shipping = true`) — deveria ignorar qualquer valor de bairro
2. **Frete a combinar** (`free_shipping = false`, `shipping_fee = null`) — deveria usar o valor do bairro
3. **Valor fixo** (`free_shipping = false`, `shipping_fee = X`) — deveria usar esse valor fixo, ignorando o bairro

Porém, quando o cliente seleciona um endereço, o sistema usa `address.shipping_fee` (valor do bairro) diretamente, sem considerar as regras da loja.

### Alterações necessárias

**1. CartContext.tsx — `setSelectedAddress`** (linha 163-173)
Ajustar a lógica de cálculo do frete ao selecionar endereço:
- Se `freeShipping = true` → frete = 0 (sempre, independente do bairro)
- Se `baseShippingFee` tem valor (fixo da loja) → frete = `baseShippingFee` (ignora bairro)
- Se `baseShippingFee` é null (a combinar) → frete = valor do bairro (`address.shipping_fee`)

**2. CartContext.tsx — `addItem`** (linha 144-156)
Mesma lógica ao computar `deliveryFee` quando já há endereço selecionado.

**3. CustomerAddressesModal.tsx — Exibição do frete no bairro**
Ajustar a exibição do valor do frete no modal de endereços para refletir a regra da loja (mostrar "Grátis" se frete grátis, ou o valor fixo da loja se configurado).

**4. CartDrawer.tsx — Exibição do frete**
Garantir que o label de frete exibido respeite a mesma lógica (já deve funcionar pois usa `deliveryFee` do contexto).

### Detalhes técnicos
A lógica central será centralizada no `CartContext`:
```typescript
// Ao selecionar endereço:
const computeFee = (address, freeShipping, baseShippingFee) => {
  if (freeShipping) return 0;
  if (baseShippingFee != null && baseShippingFee > 0) return baseShippingFee;
  return address?.shipping_fee ?? 0;
};
```

