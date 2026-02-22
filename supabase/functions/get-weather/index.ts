const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-memory cache: city -> { data, timestamp }
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

type WeatherCondition = "clear" | "clouds" | "rain" | "storm" | "unknown";

interface WeatherResponse {
  condition: WeatherCondition;
  intensity: "light" | "heavy" | "none";
  description: string;
}

function mapWeather(weatherId: number, description: string): WeatherResponse {
  // OpenWeatherMap weather condition codes:
  // 2xx: Thunderstorm, 3xx: Drizzle, 5xx: Rain, 6xx: Snow, 7xx: Atmosphere, 800: Clear, 80x: Clouds
  if (weatherId >= 200 && weatherId < 300) {
    return { condition: "storm", intensity: "heavy", description };
  }
  if (weatherId >= 300 && weatherId < 400) {
    return { condition: "rain", intensity: "light", description };
  }
  if (weatherId >= 500 && weatherId < 510) {
    const intensity = weatherId <= 501 ? "light" : "heavy";
    return { condition: "rain", intensity, description };
  }
  if (weatherId >= 510 && weatherId < 600) {
    return { condition: "rain", intensity: "heavy", description };
  }
  if (weatherId >= 600 && weatherId < 700) {
    return { condition: "rain", intensity: "light", description };
  }
  if (weatherId >= 700 && weatherId < 800) {
    return { condition: "clouds", intensity: "heavy", description };
  }
  if (weatherId === 800) {
    return { condition: "clear", intensity: "none", description };
  }
  if (weatherId === 801 || weatherId === 802) {
    return { condition: "clouds", intensity: "light", description };
  }
  if (weatherId === 803 || weatherId === 804) {
    return { condition: "clouds", intensity: "heavy", description };
  }
  return { condition: "unknown", intensity: "none", description };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city } = await req.json();

    if (!city || typeof city !== "string") {
      return new Response(
        JSON.stringify({ condition: "unknown", intensity: "none", description: "" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cacheKey = city.toLowerCase().trim();

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("OPENWEATHER_API_KEY");
    if (!apiKey) {
      console.error("OPENWEATHER_API_KEY not configured");
      return new Response(
        JSON.stringify({ condition: "unknown", intensity: "none", description: "" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch with 2s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)},BR&appid=${apiKey}&lang=pt_br&units=metric`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        console.error(`OpenWeather API error: ${response.status}`);
        return new Response(
          JSON.stringify({ condition: "unknown", intensity: "none", description: "" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      const weather = data.weather?.[0];

      if (!weather) {
        return new Response(
          JSON.stringify({ condition: "unknown", intensity: "none", description: "" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = mapWeather(weather.id, weather.description || "");

      // Store in cache
      cache.set(cacheKey, { data: result, timestamp: Date.now() });

      // Clean old cache entries (keep max 50)
      if (cache.size > 50) {
        const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
        for (let i = 0; i < oldest.length - 50; i++) {
          cache.delete(oldest[i][0]);
        }
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      console.error("Weather fetch error:", fetchError);
      return new Response(
        JSON.stringify({ condition: "unknown", intensity: "none", description: "" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Request error:", error);
    return new Response(
      JSON.stringify({ condition: "unknown", intensity: "none", description: "" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
