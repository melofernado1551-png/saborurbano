import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tenant_id: string;
  active: boolean;
}

interface CustomerAuthContextType {
  customer: Customer | null;
  session: any;
  loading: boolean;
  isInactive: boolean;
  signUp: (email: string, password: string, name: string, tenantId: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (tenantId: string) => Promise<void>;
  logout: () => Promise<void>;
  getOrCreateCustomerForTenant: (tenantId: string) => Promise<Customer | null>;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | null>(null);

export const useCustomerAuth = () => {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  return ctx;
};

export const CustomerAuthProvider = ({ children }: { children: ReactNode }) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [inactiveCustomer, setInactiveCustomer] = useState(false);

  const fetchCustomer = async (authUid: string) => {
    try {
      // First check if any customer exists (active or not)
      const { data: anyCustomer } = await supabase
        .from("customers" as any)
        .select("id, name, email, phone, tenant_id, active")
        .eq("auth_id", authUid)
        .limit(1)
        .maybeSingle();

      if (anyCustomer && !(anyCustomer as any).active) {
        // Customer is deactivated
        setCustomer(null);
        setInactiveCustomer(true);
        return null;
      }

      if (anyCustomer) {
        setCustomer(anyCustomer as any);
        setInactiveCustomer(false);
        return anyCustomer as any;
      }
      setInactiveCustomer(false);
      return null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, sess) => {
      setSession(sess);
      if (sess?.user) {
        // Check if this is a customer (not an admin user)
        setTimeout(async () => {
          // First check if this user is an admin (has profile)
          const { data: profile } = await supabase
            .from("profiles" as any)
            .select("id")
            .eq("auth_id", sess.user.id)
            .eq("active", true)
            .maybeSingle();

          if (profile) {
            // This is an admin user, not a customer
            setCustomer(null);
            setLoading(false);
            return;
          }

          await fetchCustomer(sess.user.id);
          setLoading(false);
        }, 0);
      } else {
        setCustomer(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (!s) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name: string, tenantId: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error("Erro ao criar conta");

    // Create customer record
    const { error: custError } = await supabase
      .from("customers" as any)
      .insert({
        name,
        email,
        tenant_id: tenantId,
        auth_id: data.user.id,
        active: true,
      });
    if (custError) throw new Error("Erro ao criar perfil do cliente: " + custError.message);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  };

  const signInWithGoogle = async (tenantId: string) => {
    // Store tenantId for post-login customer creation
    localStorage.setItem("pending_customer_tenant_id", tenantId);

    const { lovable } = await import("@/integrations/lovable/index");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.href,
    });
    if (result.error) throw new Error(String(result.error));
  };

  const getOrCreateCustomerForTenant = async (tenantId: string): Promise<Customer | null> => {
    if (!session?.user) return null;

    // Check if customer already exists for this tenant
    const { data: existing } = await supabase
      .from("customers" as any)
      .select("id, name, email, phone, tenant_id, active")
      .eq("auth_id", session.user.id)
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .maybeSingle();

    if (existing) {
      setCustomer(existing as any);
      return existing as any;
    }

    // Create customer for this tenant
    const userEmail = session.user.email;
    const userName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || userEmail?.split("@")[0] || "Cliente";

    const { data: created, error } = await supabase
      .from("customers" as any)
      .insert({
        name: userName,
        email: userEmail,
        tenant_id: tenantId,
        auth_id: session.user.id,
        active: true,
      })
      .select("id, name, email, phone, tenant_id, active")
      .single();

    if (error) {
      console.error("Error creating customer:", error);
      return null;
    }

    setCustomer(created as any);
    return created as any;
  };

  const logout = async () => {
    setCustomer(null);
    setSession(null);
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch { /* ignore */ }
  };

  return (
    <CustomerAuthContext.Provider value={{ customer, session, loading, isInactive: inactiveCustomer, signUp, signIn, signInWithGoogle, logout, getOrCreateCustomerForTenant }}>
      {children}
    </CustomerAuthContext.Provider>
  );
};
