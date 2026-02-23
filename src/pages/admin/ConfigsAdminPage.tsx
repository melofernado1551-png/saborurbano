import { useState, useEffect, useRef } from "react";
import { useAdmin } from "@/contexts/AdminContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldAlert, Upload, Image, Type, Save, Loader2 } from "lucide-react";

const ConfigsAdminPage = () => {
  const { isSuperAdmin } = useAdmin();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [siteTitle, setSiteTitle] = useState("");
  const [siteSubtitle, setSiteSubtitle] = useState("");
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ["system-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_configs")
        .select("*")
        .eq("active", true)
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (config) {
      setSiteTitle(config.site_title || "");
      setSiteSubtitle(config.site_subtitle || "");
      if (config.favicon_url) setFaviconPreview(config.favicon_url);
    }
  }, [config]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/png", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];
    if (!allowed.includes(file.type)) {
      toast.error("Formato inválido. Use PNG, SVG ou ICO.");
      return;
    }

    setFaviconFile(file);
    setFaviconPreview(URL.createObjectURL(file));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let faviconUrl = config?.favicon_url || null;

      // Upload favicon if changed
      if (faviconFile) {
        const ext = faviconFile.name.split(".").pop();
        const path = `favicon.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("system-assets")
          .upload(path, faviconFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("system-assets")
          .getPublicUrl(path);

        faviconUrl = urlData.publicUrl;
      }

      const { error } = await supabase
        .from("system_configs")
        .update({
          site_title: siteTitle,
          site_subtitle: siteSubtitle,
          favicon_url: faviconUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config!.id);

      if (error) throw error;

      // Update browser tab title immediately
      document.title = siteTitle;

      // Update favicon immediately
      if (faviconUrl) {
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (link) {
          link.href = faviconUrl;
        } else {
          const newLink = document.createElement("link");
          newLink.rel = "icon";
          newLink.href = faviconUrl;
          document.head.appendChild(newLink);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-configs"] });
      toast.success("Configurações salvas com sucesso!");
      setFaviconFile(null);
    },
    onError: () => {
      toast.error("Erro ao salvar configurações.");
    },
  });

  if (!isSuperAdmin) {
    return (
      <div className="text-center py-20">
        <ShieldAlert className="w-16 h-16 mx-auto text-destructive/40 mb-4" />
        <h3 className="text-lg font-semibold mb-1">Acesso restrito</h3>
        <p className="text-muted-foreground text-sm">
          Apenas superadmins podem acessar esta página.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configs Admin</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configurações globais do sistema
        </p>
      </div>

      {/* Identidade Visual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Image className="w-5 h-5" />
            Identidade Visual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Favicon</Label>
            <p className="text-xs text-muted-foreground mb-3">
              Aceita PNG, SVG e ICO
            </p>
            <div className="flex items-center gap-4">
              {faviconPreview && (
                <div className="w-12 h-12 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                  <img
                    src={faviconPreview}
                    alt="Favicon preview"
                    className="w-8 h-8 object-contain"
                  />
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.svg,.ico"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                {faviconPreview ? "Trocar favicon" : "Enviar favicon"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Textos Globais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Type className="w-5 h-5" />
            Textos Globais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="site-title">Título do site</Label>
            <Input
              id="site-title"
              value={siteTitle}
              onChange={(e) => setSiteTitle(e.target.value)}
              placeholder="Ex: Sabor Urbano"
            />
          </div>
          <div>
            <Label htmlFor="site-subtitle">Subtítulo do site</Label>
            <Input
              id="site-subtitle"
              value={siteSubtitle}
              onChange={(e) => setSiteSubtitle(e.target.value)}
              placeholder="Ex: Descubra os melhores sabores"
            />
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full sm:w-auto"
      >
        {saveMutation.isPending ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Save className="w-4 h-4 mr-2" />
        )}
        Salvar alterações
      </Button>
    </div>
  );
};

export default ConfigsAdminPage;
