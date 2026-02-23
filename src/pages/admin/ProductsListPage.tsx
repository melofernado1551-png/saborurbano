import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/contexts/AdminContext";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Power, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 15;

const ProductsListPage = () => {
  const { effectiveTenantId } = useAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  const tenantId = effectiveTenantId;

  // Fetch categories for filter
  const { data: categories = [] } = useQuery({
    queryKey: ["product-categories", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("id, name")
        .eq("tenant_id", tenantId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch products with relations
  const { data: productsData, isLoading } = useQuery({
    queryKey: ["admin-products", tenantId, search, statusFilter, categoryFilter, page],
    enabled: !!tenantId,
    queryFn: async () => {
      // Get product IDs matching category filter first
      let productIdsFromCategory: string[] | null = null;
      if (categoryFilter !== "all") {
        const { data: rels } = await supabase
          .from("product_category_relations")
          .select("product_id")
          .eq("category_id", categoryFilter)
          .eq("active", true);
        productIdsFromCategory = rels?.map((r) => r.product_id) || [];
      }

      let query = supabase
        .from("products")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });

      if (search.trim()) {
        query = query.ilike("name", `%${search.trim()}%`);
      }
      if (statusFilter === "active") query = query.eq("active", true);
      if (statusFilter === "inactive") query = query.eq("active", false);

      if (productIdsFromCategory !== null) {
        if (productIdsFromCategory.length === 0) return { products: [], total: 0 };
        query = query.in("id", productIdsFromCategory);
      }

      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return { products: data || [], total: count || 0 };
    },
  });

  const products = productsData?.products || [];
  const totalCount = productsData?.total || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Fetch category relations for all products
  const productIds = products.map((p: any) => p.id);
  const { data: categoryRelations = [] } = useQuery({
    queryKey: ["product-cat-rels", productIds],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_category_relations")
        .select("product_id, category_id, product_categories(name)")
        .in("product_id", productIds)
        .eq("active", true);
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch tags for all products
  const { data: productTagsData = [] } = useQuery({
    queryKey: ["product-tags-list", productIds],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_tags")
        .select("product_id, tag_id, tags(name, emoji)")
        .in("product_id", productIds)
        .eq("active", true);
      if (error) throw error;
      return data as any[];
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("products")
        .update({ active: !active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success("Status atualizado");
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  const getCategoriesForProduct = (productId: string) => {
    return categoryRelations
      .filter((r) => r.product_id === productId)
      .map((r) => r.product_categories?.name)
      .filter(Boolean);
  };

  const getTagsForProduct = (productId: string) => {
    return productTagsData
      .filter((r) => r.product_id === productId)
      .map((r) => ({ name: r.tags?.name, emoji: r.tags?.emoji }))
      .filter((t) => t.name);
  };

  const formatPrice = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-sm text-muted-foreground">Gerencie os produtos do seu estabelecimento</p>
        </div>
        <Button onClick={() => navigate("/admin/produtos/novo")} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Produto
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {categories.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden md:table-cell">Categoria</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Tags</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  Nenhum produto encontrado
                </TableCell>
              </TableRow>
            ) : (
              products.map((p: any) => {
                const cats = getCategoriesForProduct(p.id);
                const tags = getTagsForProduct(p.id);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.name}
                      {p.has_discount && p.promo_price && (
                        <Badge variant="destructive" className="ml-2 text-xs">Promo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {cats.length > 0 ? cats.join(", ") : "—"}
                    </TableCell>
                    <TableCell>
                      {p.has_discount && p.promo_price ? (
                        <div>
                          <span className="line-through text-muted-foreground text-xs mr-1">{formatPrice(p.price)}</span>
                          <span className="text-green-600 font-medium">{formatPrice(p.promo_price)}</span>
                        </div>
                      ) : (
                        <span>{formatPrice(p.price)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.active ? "default" : "secondary"}>
                        {p.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {tags.length > 0 ? tags.map((t, i) => (
                          <Badge key={i} variant="outline" className="text-xs gap-1">
                            {t.emoji} {t.name}
                          </Badge>
                        )) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Editar" onClick={() => navigate(`/admin/produtos/${p.id}`)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={p.active ? "Desativar" : "Ativar"}
                          onClick={() => toggleActive.mutate({ id: p.id, active: p.active })}
                        >
                          <Power className={`w-4 h-4 ${p.active ? "text-green-500" : "text-muted-foreground"}`} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{totalCount} produto(s) • Página {page + 1} de {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              Próxima <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsListPage;
