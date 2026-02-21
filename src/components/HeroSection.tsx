import { Sparkles } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="relative py-8 md:py-12 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-hero -z-10" />
      <div className="absolute top-10 right-10 w-64 h-64 rounded-full bg-primary/5 blur-3xl -z-10" />
      <div className="absolute bottom-0 left-10 w-48 h-48 rounded-full bg-warning/5 blur-3xl -z-10" />

      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4 animate-fade-in">
            <Sparkles className="w-4 h-4" />
            Mais de 150 restaurantes disponíveis
          </div>
          
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground mb-4 animate-fade-in" style={{ animationDelay: "100ms" }}>
            A melhor comida da cidade,{" "}
            <span className="text-gradient">na sua porta</span>
          </h1>
          
          <p className="text-muted-foreground text-base md:text-lg max-w-lg mx-auto animate-fade-in" style={{ animationDelay: "200ms" }}>
            Descubra os melhores restaurantes perto de você. Peça com rapidez e praticidade.
          </p>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
