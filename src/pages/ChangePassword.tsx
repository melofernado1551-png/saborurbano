import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const ChangePasswordPage = () => {
  const { user, mustChangePassword, setMustChangePassword } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // If not logged in, redirect to login
  if (!user) return <Navigate to="/login" replace />;

  // If doesn't need to change password, redirect to admin
  if (!mustChangePassword) return <Navigate to="/admin" replace />;

  const validate = (): string[] => {
    const errs: string[] = [];
    if (newPassword.length < 8) errs.push("A senha deve ter no mínimo 8 caracteres");
    if (newPassword !== confirmPassword) errs.push("As senhas não coincidem");
    if (newPassword === "saborurbano") errs.push("A nova senha não pode ser igual à senha padrão");
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("change-password", {
        body: { new_password: newPassword },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Senha alterada com sucesso!");
      setMustChangePassword(false);
      navigate("/admin");
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <img src={logo} alt="Logo" className="w-16 h-16 rounded-2xl mx-auto" />
          </div>
          <div>
            <CardTitle className="text-xl flex items-center justify-center gap-2">
              <Lock className="w-5 h-5" />
              Alterar Senha
            </CardTitle>
            <CardDescription className="mt-2">
              Por segurança, você precisa criar uma nova senha antes de acessar o sistema.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-1">
                {errors.map((err, i) => (
                  <p key={i} className="text-sm text-destructive flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {err}
                  </p>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading || !newPassword || !confirmPassword}>
              {loading ? "Salvando..." : "Salvar Nova Senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChangePasswordPage;
