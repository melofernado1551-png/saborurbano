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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (session?.user) {
        // Fetch app_user info
        const { data } = await supabase
          .from("app_users" as any)
          .select("id, login, role, tenant_id")
          .eq("auth_id", session.user.id)
          .eq("active", true)
          .single();

        if (data) {
          setUser(data as unknown as AppUser);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (username: string, password: string) => {
    const response = await supabase.functions.invoke("custom-login", {
      body: { login: username, password },
    });

    if (response.error) {
      throw new Error(response.error.message || "Erro no login");
    }

    const data = response.data;
    if (data.error) {
      throw new Error(data.error);
    }

    // Set session from response
    if (data.session) {
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      setUser(data.user);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
