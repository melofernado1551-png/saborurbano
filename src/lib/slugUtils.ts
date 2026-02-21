import { supabase } from "@/integrations/supabase/client";

/**
 * Generate a URL-friendly slug from a name.
 */
export const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9\s-]/g, "") // remove special chars
    .trim()
    .replace(/\s+/g, "-") // spaces to hyphens
    .replace(/-+/g, "-"); // collapse multiple hyphens
};

/**
 * Generate a unique tenant slug, appending -2, -3, etc. if needed.
 */
export const generateUniqueTenantSlug = async (
  name: string,
  excludeId?: string
): Promise<string> => {
  const base = generateSlug(name);
  let slug = base;
  let counter = 1;

  while (true) {
    let query = supabase
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .limit(1);

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { data } = await query;
    if (!data || data.length === 0) return slug;

    counter++;
    slug = `${base}-${counter}`;
  }
};

/**
 * Generate a unique product slug within a tenant, appending -2, -3, etc. if needed.
 */
export const generateUniqueProductSlug = async (
  name: string,
  tenantId: string,
  excludeProductId?: string
): Promise<string> => {
  const base = generateSlug(name);
  let slug = base;
  let counter = 1;

  while (true) {
    let query = supabase
      .from("products")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("slug", slug)
      .limit(1);

    if (excludeProductId) {
      query = query.neq("id", excludeProductId);
    }

    const { data } = await query;
    if (!data || data.length === 0) return slug;

    counter++;
    slug = `${base}-${counter}`;
  }
};
