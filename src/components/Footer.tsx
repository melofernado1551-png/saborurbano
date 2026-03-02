import { Settings, ArrowRight, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

const WHATSAPP_NUMBER = "558694726151";
const WHATSAPP_MESSAGE = encodeURIComponent(
  "Olá! Tenho interesse no sistema para restaurantes.\n\nGostaria de entender melhor como ele pode me ajudar a organizar pedidos, estoque e vendas."
);

const Footer = () => {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      return saved ? saved === "dark" : true;
    }
    return true;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (!saved) {
      document.documentElement.classList.add("dark");
    }
  }, []);

  return (
    <footer className="mt-12">
      {/* Conversion block */}
      <div className="bg-muted/50 border-t border-border">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <h3 className="text-lg md:text-xl font-semibold text-foreground">Quer mais organização, menos erro e mais controle na sua lanchonete ou restaurante?</h3>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">Nosso sistema ajuda você a organizar pedidos e acompanhar suas vendas de forma simples.</p>
            <div className="pt-4">
              <Button size="lg" className="w-full sm:w-auto gap-2" asChild>
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`}
                  target="_blank"
                  rel="noopener noreferrer">
                  Quero assinar o sistema
                  <ArrowRight className="w-4 h-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border py-6">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">© 2025 Sabor Urbano</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDark(!isDark)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Alternar modo escuro"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              <span className="text-xs hidden sm:inline">{isDark ? "Modo Claro" : "Modo Escuro"}</span>
            </button>
            <a
              href="/login"
              className="text-muted-foreground/30 hover:text-primary transition-colors">
              <Settings className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;