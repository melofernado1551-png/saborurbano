import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Navigation, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface CitySelectionModalProps {
  open: boolean;
  onCitySelect: (city: string) => void;
}

const CitySelectionModal = ({ open, onCitySelect }: CitySelectionModalProps) => {
  const [search, setSearch] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [detectedCity, setDetectedCity] = useState<string | null>(null);

  const { data: cities = [] } = useQuery({
    queryKey: ["available-cities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("city")
        .eq("active", true)
        .not("city", "is", null);
      if (error) throw error;
      const uniqueCities = [...new Set(data.map((t) => t.city).filter(Boolean))] as string[];
      return uniqueCities.sort();
    },
  });

  const filteredCities = cities.filter((c) =>
    c.toLowerCase().includes(search.toLowerCase())
  );

  const handleDetectLocation = () => {
    if (!navigator.geolocation) return;
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json&accept-language=pt`
          );
          const data = await response.json();
          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.municipality ||
            null;
          if (city) {
            setDetectedCity(city);
            // Check if this city has restaurants
            const match = cities.find(
              (c) => c.toLowerCase() === city.toLowerCase()
            );
            if (match) {
              setDetectedCity(match);
            }
          }
        } catch {
          // ignore geocoding errors
        } finally {
          setDetecting(false);
        }
      },
      () => setDetecting(false),
      { timeout: 10000 }
    );
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <MapPin className="w-5 h-5 text-primary" />
            Onde você está?
          </DialogTitle>
          <DialogDescription>
            Selecione sua cidade para ver os restaurantes disponíveis na sua região.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Auto-detect */}
          <Button
            variant="outline"
            className="w-full gap-2 h-12"
            onClick={handleDetectLocation}
            disabled={detecting}
          >
            {detecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Navigation className="w-4 h-4 text-primary" />
            )}
            {detecting ? "Detectando..." : "Usar minha localização"}
          </Button>

          {/* Detected city confirmation */}
          {detectedCity && (
            <div className="bg-secondary rounded-xl p-4 space-y-3">
              <p className="text-sm text-muted-foreground">Localização detectada:</p>
              <p className="font-semibold text-lg">{detectedCity}</p>
              {cities.some((c) => c.toLowerCase() === detectedCity.toLowerCase()) ? (
                <Button
                  className="w-full"
                  onClick={() => {
                    const match = cities.find(
                      (c) => c.toLowerCase() === detectedCity.toLowerCase()
                    );
                    onCitySelect(match || detectedCity);
                  }}
                >
                  Confirmar cidade
                </Button>
              ) : (
                <p className="text-sm text-destructive">
                  Ainda não temos restaurantes nessa cidade. Selecione outra abaixo.
                </p>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou selecione manualmente</span>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* City list */}
          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredCities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {cities.length === 0
                  ? "Nenhuma cidade com restaurantes cadastrados"
                  : "Nenhuma cidade encontrada"}
              </p>
            ) : (
              filteredCities.map((city) => (
                <button
                  key={city}
                  onClick={() => onCitySelect(city)}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-secondary transition-colors flex items-center gap-3"
                >
                  <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="font-medium">{city}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CitySelectionModal;
