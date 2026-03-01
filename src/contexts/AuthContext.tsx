import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AppUser {
  id: string;
  login: string;
  name: string | null;
  role: "superadmin" | "tenant_admin" | "colaborador" | "contador" | "garcom" | "user";
  tenant_id: string | null;
}

interface AuthContextType {
  user: AppUser | null;
  session: any;
  loading: boolean;
  mustChangePassword: boolean;
  setMustChangePassword: (v: boolean) => void;
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
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[Auth] onAuthStateChange:", event);
      setSession(session);
      if (session?.user) {
        setTimeout(async () => {
          try {
            const { data, error } = await supabase
              .from("profiles" as any)
              .select("id, login, name, role, tenant_id, must_change_password")
              .eq("auth_id", session.user.id)
              .eq("active", true)
              .single();

            console.log("[Auth] profiles lookup:", { data, error: error?.message });
            if (data) {
              const userData = data as any;
              setUser({
                id: userData.id,
                login: userData.login,
                name: userData.name || null,
                role: userData.role,
                tenant_id: userData.tenant_id,
              });
              setMustChangePassword(userData.must_change_password || false);
            } else {
              setUser(null);
              setMustChangePassword(false);
            }
          } catch (e) {
            console.error("[Auth] Error fetching profile:", e);
            setUser(null);
          }
          setLoading(false);
        }, 0);
      } else {
        setUser(null);
        setMustChangePassword(false);
        setLoading(false);
      }
    });

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

    if (response.error) {
      throw new Error(response.error.message || "Erro no login");
    }

    const data = response.data;
    if (data?.error) {
      throw new Error(data.error);
    }

    if (data?.session) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      if (sessionError) {
        throw new Error("Erro ao criar sessão: " + sessionError.message);
      }

      setUser(data.user);
      setMustChangePassword(data.must_change_password || false);
    } else {
      throw new Error("Resposta inválida do servidor");
    }
  };

  const logout = async () => {
    setUser(null);
    setSession(null);
    setMustChangePassword(false);
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Even if signOut fails, local state is already cleared
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, mustChangePassword, setMustChangePassword, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
