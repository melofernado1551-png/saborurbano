import { useState, useEffect } from "react";
import { Sparkles, X, CloudRain } from "lucide-react";
import heroCharacter from "@/assets/hero-character.png";
import CityScapeBackground, { type WeatherOverlay } from "./CityScapeBackground";

interface HeroSectionProps {
  weatherCondition?: WeatherOverlay;
}

const ALERT_SESSION_KEY = "weather_alert_dismissed";

const HeroSection = ({ weatherCondition }: HeroSectionProps) => {
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    const shouldShow =
      (weatherCondition === "rain_heavy" || weatherCondition === "storm") &&
      !sessionStorage.getItem(ALERT_SESSION_KEY);
    setShowAlert(shouldShow);
  }, [weatherCondition]);

  const dismissAlert = () => {
    setShowAlert(false);
    sessionStorage.setItem(ALERT_SESSION_KEY, "1");
  };

  return (
    <section className="relative pb-0 overflow-hidden min-h-[220px] md:min-h-[340px] lg:min-h-[400px] xl:min-h-[440px] flex flex-col justify-end">
      <CityScapeBackground weatherCondition={weatherCondition} />

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex items-end justify-between gap-4 md:gap-8">
          <div className="text-left max-w-2xl flex-1 pb-4 md:pb-8">
            
            <h1 className="text-xl md:text-4xl lg:text-5xl font-extrabold mb-2 md:mb-4 animate-fade-in leading-tight" style={{ animationDelay: "100ms" }}>
              <span className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">A melhor comida da cidade,{" "}</span>
              <span className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" style={{ WebkitTextStroke: "0.5px rgba(255,107,0,0.5)" }}>na sua porta</span>
            </h1>
            
            <p className="text-white/90 text-sm md:text-lg max-w-lg animate-fade-in drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" style={{ animationDelay: "200ms" }}>
              Descubra as melhores lojas perto de você.
            </p>

            {/* Weather alert */}
            {showAlert && (
              <div
                className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-black/30 backdrop-blur-sm text-white/90 text-xs md:text-sm animate-fade-in border border-white/10"
                style={{ animationDelay: "400ms" }}
              >
                <CloudRain className="w-4 h-4 flex-shrink-0 text-blue-300" />
                <span>🌧️ Chuvas fortes podem afetar o tempo de entrega dos pedidos</span>
                <button
                  onClick={dismissAlert}
                  className="ml-auto flex-shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors"
                  aria-label="Fechar alerta"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex-shrink-0 animate-fade-in self-end" style={{ animationDelay: "300ms" }}>
            <img
              src={heroCharacter}
              alt="Entregador Sabor Urbano"
              className="w-24 sm:w-32 md:w-44 lg:w-56 h-auto drop-shadow-lg translate-y-[2px]"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
