import { useState, useEffect, useMemo } from "react";

/**
 * Returns Brasilia time (UTC-3) hours as a decimal
 */
const getBrasiliaHour = (): number => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const brasilia = new Date(utc - 3 * 3600000);
  return brasilia.getHours() + brasilia.getMinutes() / 60;
};

type TimePhase = "night" | "dawn" | "morning" | "day" | "afternoon" | "sunset" | "dusk";

const getPhase = (h: number): TimePhase => {
  if (h < 5) return "night";
  if (h < 6.5) return "dawn";
  if (h < 10) return "morning";
  if (h < 15) return "day";
  if (h < 17) return "afternoon";
  if (h < 19) return "sunset";
  if (h < 20.5) return "dusk";
  return "night";
};

interface SkyColors {
  skyTop: string;
  skyBottom: string;
}

const phaseMap: Record<TimePhase, SkyColors> = {
  night: { skyTop: "#0a0e27", skyBottom: "#1a1a3e" },
  dawn: { skyTop: "#2d1b4e", skyBottom: "#e8956b" },
  morning: { skyTop: "#87CEEB", skyBottom: "#FDE8C8" },
  day: { skyTop: "#87CEEB", skyBottom: "#E8D5B5" },
  afternoon: { skyTop: "#D4A06A", skyBottom: "#E89060" },
  sunset: { skyTop: "#D46030", skyBottom: "#C04020" },
  dusk: { skyTop: "#1a1040", skyBottom: "#6b3a5a" },
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const lerpColor = (a: string, b: string, t: number): string => {
  const parse = (c: string) => {
    const hex = c.slice(1);
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const r = Math.round(lerp(r1, r2, t));
  const g = Math.round(lerp(g1, g2, t));
  const bl = Math.round(lerp(b1, b2, t));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
};

const lerpSky = (a: SkyColors, b: SkyColors, t: number): SkyColors => ({
  skyTop: lerpColor(a.skyTop, b.skyTop, t),
  skyBottom: lerpColor(a.skyBottom, b.skyBottom, t),
});

const getInterpolatedSky = (h: number): SkyColors => {
  const transitions: [number, number, TimePhase, TimePhase][] = [
    [4.5, 6.5, "night", "dawn"],
    [6.5, 8, "dawn", "morning"],
    [8, 10, "morning", "day"],
    [14, 16, "day", "afternoon"],
    [16.5, 18.5, "afternoon", "sunset"],
    [18.5, 20, "sunset", "dusk"],
    [20, 21.5, "dusk", "night"],
  ];

  for (const [start, end, from, to] of transitions) {
    if (h >= start && h < end) {
      const t = (h - start) / (end - start);
      return lerpSky(phaseMap[from], phaseMap[to], t);
    }
  }

  return phaseMap[getPhase(h)];
};

const LoginSkyBackground = () => {
  const [hour, setHour] = useState(getBrasiliaHour);

  useEffect(() => {
    const interval = setInterval(() => setHour(getBrasiliaHour()), 60000);
    return () => clearInterval(interval);
  }, []);

  const sky = useMemo(() => getInterpolatedSky(hour), [hour]);

  return (
    <div
      className="fixed inset-0 -z-10 transition-colors duration-[3000ms]"
      style={{
        background: `linear-gradient(180deg, ${sky.skyTop} 0%, ${sky.skyBottom} 100%)`,
      }}
    />
  );
};

export default LoginSkyBackground;
