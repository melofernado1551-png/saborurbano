

# Sistema Centralizado de Tags de Produtos

## Resumo

Implementar um sistema completo de tags de produtos, gerenciado exclusivamente pelo superadmin, com slugs gerados automaticamente. As tags serao usadas para filtrar e organizar produtos na home e nas paginas de restaurantes.

---

## Etapa 1: Banco de Dados

Criar duas tabelas via migracao:

**Tabela `tags`**
- `id` (uuid, PK)
- `name` (text, not null)
- `emoji` (text, not null)
- `slug` (text, unique, not null) -- gerado automaticamente via trigger
- `active` (boolean, default true)
- `created_at` (timestamptz, default now())

**Tabela `product_tags`**
- `id` (uuid, PK)
- `product_id` (uuid, FK -> products.id)
- `tag_id` (uuid, FK -> tags.id)
- `active` (boolean, default true)

**Trigger para slug automatico**: criar funcao `generate_tag_slug()` que gera o slug a partir do `name` (lowercase, sem acentos, espacos vira hifen) e garante unicidade com sufixo incremental. Executado em INSERT e UPDATE do campo name.

**RLS**:
- `tags`: SELECT publico (active=true), INSERT/UPDATE/DELETE apenas superadmin (`is_superadmin(auth.uid())`)
- `product_tags`: SELECT publico (active=true), INSERT/DELETE para membros do tenant (via produto), UPDATE para membros do tenant

**Dados iniciais** (inseridos na migracao):
- 🔥 Mais pedido
- ⭐ Destaque
- 💥 Promocao
- 🆕 Novidade
- ⚡ Entrega rapida
- 🎁 Combo
- ❤️ Favorito
- 🌱 Vegetariano

---

## Etapa 2: Painel Admin - Gerenciamento de Tags

**Rota**: `/admin/tags` (visivel apenas para superadmin)

**Arquivo**: `src/pages/admin/TagsPage.tsx`

Tela com:
- Listagem em tabela: emoji, nome, slug (somente leitura), status (badge ativo/inativo), acoes (editar, ativar/desativar)
- Botao "+ Nova Tag" abre dialog com formulario: Nome, Emoji, Status ativo
- Campo slug NAO aparece no formulario (gerado pelo trigger no banco)
- Edicao via dialog: mesmos campos
- Ativar/desativar via toggle

**Sidebar**: Adicionar item "Tags" no `AdminSidebarNew.tsx`, visivel apenas para superadmin, com icone `Tag`.

**App.tsx**: Adicionar rota `<Route path="tags" element={<TagsPage />} />` dentro do bloco admin.

---

## Etapa 3: Integracao com Produtos (Cadastro/Edicao)

Nao ha pagina de cadastro de produto implementada ainda (apenas placeholder). Este passo sera documentado para implementacao futura: no formulario de produto, adicionar campo multi-select de tags com chips (emoji + nome), buscando apenas tags ativas.

---

## Etapa 4: Tags na Pagina Inicial

**Arquivo**: `src/pages/Index.tsx`

Modificacoes:

1. **Buscar tags e product_tags** do banco:
   - Tags ativas que tenham ao menos 1 produto ativo (via join com product_tags e products)
   - Limitar a 6 tags, priorizadas pela ordem: Promocao > Mais pedido > Destaque > Entrega rapida > Novidade > Vegetariano > outros

2. **Trilho de tags** (scroll horizontal):
   - Inserir abaixo do bloco de busca/filtros existente
   - Chips arredondados com emoji + nome
   - Ao clicar, filtrar produtos que possuam a tag selecionada
   - Exibir "Mostrando produtos {emoji} {nome}" e botao "Limpar filtro"

3. **Badge no card de produto**:
   - Mostrar a tag de maior prioridade como badge no card (max 1)
   - Prioridade: Promocao > Destaque > Mais pedido

4. **Blocos curados por tag**:
   - Apos cada 6 produtos na listagem, inserir um bloco curado
   - Titulo amigavel (ex: "Destaques da galera", "O que todo mundo esta pedindo")
   - Max 4 produtos por bloco, cards maiores
   - Max 3 blocos curados na home
   - Nao repetir produto em blocos seguidos

5. **Comportamento**:
   - Filtros sem reload
   - Skeleton loading durante busca
   - Mensagem amigavel quando vazio

---

## Etapa 5: Substituir categorias hardcoded

As categorias hardcoded (Lanchonete, Pizzaria, etc.) na home continuam para filtrar restaurantes. As tags sao um sistema separado para filtrar produtos. Ambos coexistem.

---

## Detalhes Tecnicos

```text
Arquivos a criar:
  src/pages/admin/TagsPage.tsx

Arquivos a modificar:
  - Migracao SQL (via ferramenta de migracao)
  - src/App.tsx (adicionar rota /admin/tags)
  - src/components/admin/AdminSidebarNew.tsx (adicionar item Tags)
  - src/pages/Index.tsx (trilho de tags, blocos curados, filtro por tag)
  - src/components/ProductCard.tsx (badge de tag)
```

Dependencias: nenhuma nova necessaria.

