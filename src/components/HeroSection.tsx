import { useState, useEffect, useRef, useCallback } from "react";
import { X, CloudRain } from "lucide-react";
import heroCharacter from "@/assets/hero-character.png";
import CityScapeBackground, { type WeatherOverlay } from "./CityScapeBackground";

interface HeroSectionProps {
  weatherCondition?: WeatherOverlay;
}

const ALERT_SESSION_KEY = "weather_alert_dismissed";

const HeroSection = ({ weatherCondition }: HeroSectionProps) => {
  const [showAlert, setShowAlert] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const shouldShow =
      (weatherCondition === "rain_heavy" || weatherCondition === "storm") &&
      !sessionStorage.getItem(ALERT_SESSION_KEY);
    setShowAlert(shouldShow);
  }, [weatherCondition]);

  const handleScroll = useCallback(() => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const sectionHeight = sectionRef.current.offsetHeight;
    // Normalize scroll: 0 when top of section is at viewport top, 1 when fully scrolled past
    const progress = Math.max(0, Math.min(1, -rect.top / sectionHeight));
    setScrollY(progress);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const dismissAlert = () => {
    setShowAlert(false);
    sessionStorage.setItem(ALERT_SESSION_KEY, "1");
  };

  // Parallax offsets (different speeds for depth)
  const skyOffset = scrollY * 30;         // Sky moves slowest
  const farOffset = scrollY * 50;         // Far buildings
  const midOffset = scrollY * 70;         // Mid buildings  
  const nearOffset = scrollY * 90;        // Near buildings move fastest
  const textOffset = scrollY * 40;        // Text moves at medium speed
  const characterOffset = scrollY * 60;   // Character
  const fadeOpacity = 1 - scrollY * 1.5;  // Fade out as scrolling

  return (
    <section
      ref={sectionRef}
      className="relative pb-0 overflow-hidden min-h-[260px] md:min-h-[420px] lg:min-h-[500px] xl:min-h-[560px] flex flex-col justify-end"
    >
      {/* Parallax background layers */}
      <CityScapeBackground
        weatherCondition={weatherCondition}
        parallaxOffsets={{
          sky: skyOffset,
          far: farOffset,
          mid: midOffset,
          near: nearOffset,
        }}
      />

      {/* Gradient overlay for depth */}
      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          background: `linear-gradient(180deg, transparent 0%, transparent 50%, rgba(0,0,0,0.15) 100%)`,
        }}
      />

      <div
        className="container mx-auto px-4 relative z-10"
        style={{
          transform: `translateY(-${textOffset}px)`,
          opacity: Math.max(0, fadeOpacity),
          willChange: "transform, opacity",
        }}
      >
        <div className="flex items-end justify-between gap-4 md:gap-8">
          <div className="text-left max-w-2xl flex-1 pb-4 md:pb-8">
            
            <h1 className="text-xl md:text-4xl lg:text-5xl font-extrabold mb-2 md:mb-4 animate-fade-in leading-tight" style={{ animationDelay: "100ms" }}>
              <span className="text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">A melhor comida da cidade,{" "}</span>
              <span className="text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]" style={{ WebkitTextStroke: "0.5px rgba(255,107,0,0.5)" }}>na sua porta</span>
            </h1>
            
            <p className="text-white/90 text-sm md:text-lg max-w-lg animate-fade-in drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]" style={{ animationDelay: "200ms" }}>
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

          <div
            className="flex-shrink-0 animate-fade-in self-end"
            style={{
              animationDelay: "300ms",
              transform: `translateY(-${characterOffset * 0.3}px)`,
              willChange: "transform",
            }}
          >
            <img
              src={heroCharacter}
              alt="Entregador Sabor Urbano"
              className="w-24 sm:w-32 md:w-44 lg:w-56 h-auto drop-shadow-[0_4px_20px_rgba(0,0,0,0.3)] translate-y-[2px]"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
