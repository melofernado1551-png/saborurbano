import { useEffect } from "react";
import { useTheme } from "next-themes";

/**
 * Automatically toggles dark mode based on Brasília time (UTC-3).
 * Dark mode: 20:00–05:59 | Light mode: 06:00–19:59
 */
export const useAutoTheme = () => {
  const { setTheme } = useTheme();

  useEffect(() => {
    const update = () => {
      const now = new Date();
      // Brasília = UTC-3
      const brasiliaHour = (now.getUTCHours() - 3 + 24) % 24;
      setTheme(brasiliaHour >= 20 || brasiliaHour < 6 ? "dark" : "light");
    };

    update();
    const interval = setInterval(update, 60_000); // check every minute
    return () => clearInterval(interval);
  }, [setTheme]);
};
