import { Sparkles } from "lucide-react";
import heroCharacter from "@/assets/hero-character.png";
import CityScapeBackground from "./CityScapeBackground";

const HeroSection = () => {
  return (
    <section className="relative py-8 md:py-12 overflow-hidden min-h-[280px]">
      <CityScapeBackground />

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex items-center justify-between gap-8">
          <div className="text-center md:text-left max-w-2xl flex-1">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm text-primary text-sm font-semibold mb-4 animate-fade-in border border-white/30 shadow-sm">
              <Sparkles className="w-4 h-4" />
              Mais de 150 restaurantes disponíveis
            </div>
            
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold mb-4 animate-fade-in" style={{ animationDelay: "100ms" }}>
              <span className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">A melhor comida da cidade,{" "}</span>
              <span className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" style={{ WebkitTextStroke: "0.5px rgba(255,107,0,0.5)" }}>na sua porta</span>
            </h1>
            
            <p className="text-white/90 text-base md:text-lg max-w-lg animate-fade-in drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" style={{ animationDelay: "200ms" }}>
              Descubra os melhores restaurantes perto de você. Peça com rapidez e praticidade.
            </p>
          </div>

          <div className="hidden md:block flex-shrink-0 animate-fade-in" style={{ animationDelay: "300ms" }}>
            <img
              src={heroCharacter}
              alt="Entregador Sabor Urbano"
              className="w-44 lg:w-56 h-auto drop-shadow-lg"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
