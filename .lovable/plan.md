

# Banner Inteligente com Condicoes Climaticas

## Resumo

Implementar um sistema de banner climatico que enriquece o banner existente (CityScapeBackground) com dados de clima em tempo real, controlado por uma flag de ativacao global. Quando desativado, tudo funciona exatamente como hoje.

---

## 1. Configuracao Global no Banco de Dados

Criar uma tabela `app_settings` para armazenar configuracoes globais:

```sql
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT 'false',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Leitura publica
CREATE POLICY "Public read settings" ON app_settings FOR SELECT USING (true);

-- Apenas superadmin altera
CREATE POLICY "Superadmin update settings" ON app_settings FOR UPDATE USING (is_superadmin(auth.uid()));
CREATE POLICY "Superadmin insert settings" ON app_settings FOR INSERT WITH CHECK (is_superadmin(auth.uid()));

INSERT INTO app_settings (key, value) VALUES ('weather_banner_active', 'false');
```

---

## 2. Edge Function: `get-weather`

Criar uma edge function que:
- Recebe a cidade como parametro
- Chama a API OpenWeatherMap com timeout de 2 segundos
- Retorna condicao climatica simplificada (clear, clouds, rain, storm)
- Cacheia internamente por cidade/15 minutos (em memoria da funcao)

Requer a secret `OPENWEATHER_API_KEY` - sera solicitada ao usuario.

Retorno:
```json
{
  "condition": "rain",
  "intensity": "light",
  "description": "chuva leve"
}
```

Em caso de falha, retorna:
```json
{ "condition": "unknown" }
```

---

## 3. Hook: `useWeather`

Novo hook `src/hooks/useWeather.ts`:
- Busca `weather_banner_active` da tabela `app_settings`
- Se `false`, retorna `null` sem chamar nada
- Se `true` e cidade selecionada, chama a edge function `get-weather`
- Cache de 15 min via React Query (`staleTime: 900000`)
- Timeout e fallback silencioso integrados
- Retorna: `{ condition, intensity } | null`

---

## 4. Adaptacao do CityScapeBackground

O componente recebe uma prop opcional `weatherCondition`:

```typescript
interface Props {
  weatherCondition?: "clear" | "clouds_light" | "clouds_heavy" | "rain_light" | "rain_heavy" | "storm" | null;
}
```

Quando `weatherCondition` e `null` ou `undefined`: comportamento atual (sem mudanca).

Quando ativo, aplica **overlays adicionais sobre o fundo existente** (nao substitui):

- **clear**: Sem mudanca (o banner por horario ja cobre)
- **clouds_light**: Overlay com 2-3 nuvens SVG animadas lentas, opacidade baixa
- **clouds_heavy**: Overlay cinza translucido + nuvens mais densas
- **rain_light**: Nuvens densas + gotas SVG animadas (linhas finas descendo)
- **rain_heavy**: Ceu mais escuro via overlay + gotas mais densas
- **storm**: Overlay escuro + flash sutil de relampago (opacity pulse a cada 8-12s)

Todas as animacoes usam CSS transitions/animations, sem biblioteca extra.

---

## 5. Alerta Contextual

No `HeroSection`, quando condicao e `rain_heavy` ou `storm`:
- Exibir um banner fino translucido abaixo do texto do hero
- Mensagem: "Chuvas fortes podem afetar o tempo de entrega dos pedidos"
- Controlado por `sessionStorage` para mostrar apenas 1 vez por sessao
- Nao bloqueante, com botao de fechar

---

## 6. Integracao no Index.tsx

- O `Index.tsx` usa o hook `useWeather(selectedCity)`
- Passa o resultado para `HeroSection` como prop
- `HeroSection` passa para `CityScapeBackground`

---

## 7. Arquivos a Criar/Modificar

| Arquivo | Acao |
|---|---|
| `app_settings` (tabela) | Criar via migracao |
| `supabase/functions/get-weather/index.ts` | Criar |
| `src/hooks/useWeather.ts` | Criar |
| `src/components/CityScapeBackground.tsx` | Modificar - adicionar overlay climatico |
| `src/components/HeroSection.tsx` | Modificar - receber props + alerta |
| `src/pages/Index.tsx` | Modificar - usar hook e passar props |

---

## Detalhes Tecnicos

- A API OpenWeatherMap sera chamada via edge function (chave no servidor, nunca exposta)
- O cache em memoria da edge function usa um `Map<string, {data, timestamp}>` simples
- React Query no frontend com `staleTime: 900000` (15 min) evita chamadas redundantes
- Todos os overlays climaticos usam `pointer-events-none` para nao interferir na interacao
- Transicoes suaves de 2s entre estados climaticos
- Zero impacto no bundle quando desativado (condicional no hook impede fetch)

