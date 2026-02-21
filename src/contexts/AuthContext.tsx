import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AppUser {
  id: string;
  login: string;
  role: "superadmin" | "tenant_admin" | "user";
  tenant_id: string | null;
}

interface AuthContextType {
  user: AppUser | null;
  session: any;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[Auth] onAuthStateChange:", event);
      setSession(session);
      if (session?.user) {
        // Use setTimeout to prevent Supabase client deadlock
        setTimeout(async () => {
          try {
            const { data, error } = await supabase
              .from("app_users" as any)
              .select("id, login, role, tenant_id")
              .eq("auth_id", session.user.id)
              .eq("active", true)
              .single();

            console.log("[Auth] app_users lookup:", { data, error: error?.message });
            if (data) {
              setUser(data as unknown as AppUser);
            } else {
              setUser(null);
            }
          } catch (e) {
            console.error("[Auth] Error fetching app_user:", e);
            setUser(null);
          }
          setLoading(false);
        }, 0);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("[Auth] getSession:", session ? "has session" : "no session");
      setSession(session);
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (username: string, password: string) => {
    console.log("[Auth] login attempt for:", username);
    
    const response = await supabase.functions.invoke("custom-login", {
      body: { login: username, password },
    });

    console.log("[Auth] custom-login response:", {
      data: response.data,
      error: response.error,
    });

    if (response.error) {
      throw new Error(response.error.message || "Erro no login");
    }

    const data = response.data;
    if (data?.error) {
      throw new Error(data.error);
    }

    // Set session from response
    if (data?.session) {
      console.log("[Auth] Setting session...");
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      if (sessionError) {
        console.error("[Auth] setSession error:", sessionError.message);
        throw new Error("Erro ao criar sessão: " + sessionError.message);
      }

      // Set user immediately (don't wait for onAuthStateChange)
      setUser(data.user);
      console.log("[Auth] Login complete, user set:", data.user);
    } else {
      throw new Error("Resposta inválida do servidor");
    }
  };

  const logout = async () => {
    // Clear local state first, regardless of server response
    setUser(null);
    setSession(null);
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Even if signOut fails, local state is already cleared
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
