import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type WeatherCondition =
  | "clear"
  | "clouds_light"
  | "clouds_heavy"
  | "rain_light"
  | "rain_heavy"
  | "storm"
  | null;

interface WeatherApiResponse {
  condition: string;
  intensity: string;
  description: string;
}

function mapToWeatherCondition(data: WeatherApiResponse): WeatherCondition {
  const { condition, intensity } = data;
  if (condition === "unknown") return null;
  if (condition === "clear") return "clear";
  if (condition === "storm") return "storm";
  if (condition === "rain") {
    return intensity === "heavy" ? "rain_heavy" : "rain_light";
  }
  if (condition === "clouds") {
    return intensity === "heavy" ? "clouds_heavy" : "clouds_light";
  }
  return null;
}

export function useWeather(city: string | null): WeatherCondition {
  // Check if feature is active
  const { data: isActive } = useQuery({
    queryKey: ["app-setting", "weather_banner_active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "weather_banner_active")
        .maybeSingle();
      return data?.value === true || data?.value === "true";
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });

  // Fetch weather only if active AND city selected
  const { data: weatherCondition } = useQuery({
    queryKey: ["weather", city],
    enabled: !!isActive && !!city,
    staleTime: 15 * 60 * 1000, // 15 min
    retry: false,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-weather", {
          body: { city },
        });
        if (error || !data) return null;
        return mapToWeatherCondition(data as WeatherApiResponse);
      } catch {
        return null;
      }
    },
  });

  if (!isActive || !city) return null;
  return weatherCondition ?? null;
}
