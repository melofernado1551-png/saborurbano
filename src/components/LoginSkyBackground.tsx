import { useState, useEffect, useMemo } from "react";

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

interface PhaseColors {
  skyTop: string;
  skyBottom: string;
  buildingFar: string;
  buildingMid: string;
  buildingNear: string;
}

const phaseMap: Record<TimePhase, PhaseColors> = {
  night: { skyTop: "#0a0e27", skyBottom: "#1a1a3e", buildingFar: "#12152e", buildingMid: "#0e1128", buildingNear: "#090c20" },
  dawn: { skyTop: "#2d1b4e", skyBottom: "#e8956b", buildingFar: "#4a2a5a", buildingMid: "#3a1f48", buildingNear: "#2a1535" },
  morning: { skyTop: "#87CEEB", skyBottom: "#FDE8C8", buildingFar: "#d4b896", buildingMid: "#c4a480", buildingNear: "#b0906a" },
  day: { skyTop: "#87CEEB", skyBottom: "#E8D5B5", buildingFar: "#C4A070", buildingMid: "#A88855", buildingNear: "#8C7040" },
  afternoon: { skyTop: "#D4A06A", skyBottom: "#E89060", buildingFar: "#B87848", buildingMid: "#9C6038", buildingNear: "#804828" },
  sunset: { skyTop: "#D46030", skyBottom: "#C04020", buildingFar: "#8C3818", buildingMid: "#702810", buildingNear: "#581808" },
  dusk: { skyTop: "#1a1040", skyBottom: "#6b3a5a", buildingFar: "#2a1840", buildingMid: "#201030", buildingNear: "#150a25" },
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

const lerpPhase = (a: PhaseColors, b: PhaseColors, t: number): PhaseColors => ({
  skyTop: lerpColor(a.skyTop, b.skyTop, t),
  skyBottom: lerpColor(a.skyBottom, b.skyBottom, t),
  buildingFar: lerpColor(a.buildingFar, b.buildingFar, t),
  buildingMid: lerpColor(a.buildingMid, b.buildingMid, t),
  buildingNear: lerpColor(a.buildingNear, b.buildingNear, t),
});

const getInterpolated = (h: number): PhaseColors => {
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
      return lerpPhase(phaseMap[from], phaseMap[to], t);
    }
  }
  return phaseMap[getPhase(h)];
};

const buildings = [
  { x: 0, w: 35, h: 90, layer: "far" },
  { x: 30, w: 25, h: 115, layer: "far" },
  { x: 55, w: 40, h: 80, layer: "far" },
  { x: 90, w: 30, h: 130, layer: "far" },
  { x: 118, w: 35, h: 85, layer: "far" },
  { x: 150, w: 28, h: 110, layer: "far" },
  { x: 175, w: 38, h: 95, layer: "far" },
  { x: 210, w: 30, h: 120, layer: "far" },
  { x: 240, w: 35, h: 80, layer: "far" },
  { x: 270, w: 28, h: 100, layer: "far" },
  { x: 295, w: 40, h: 125, layer: "far" },
  { x: 330, w: 30, h: 85, layer: "far" },
  { x: 360, w: 35, h: 110, layer: "far" },
  { x: 390, w: 30, h: 90, layer: "far" },
  { x: 10, w: 30, h: 100, layer: "mid" },
  { x: 45, w: 40, h: 135, layer: "mid" },
  { x: 85, w: 25, h: 85, layer: "mid" },
  { x: 110, w: 35, h: 120, layer: "mid" },
  { x: 145, w: 30, h: 90, layer: "mid" },
  { x: 180, w: 40, h: 145, layer: "mid" },
  { x: 215, w: 28, h: 95, layer: "mid" },
  { x: 248, w: 35, h: 125, layer: "mid" },
  { x: 280, w: 30, h: 90, layer: "mid" },
  { x: 310, w: 38, h: 115, layer: "mid" },
  { x: 348, w: 28, h: 105, layer: "mid" },
  { x: 378, w: 35, h: 130, layer: "mid" },
  { x: 5, w: 28, h: 70, layer: "near" },
  { x: 60, w: 35, h: 85, layer: "near" },
  { x: 130, w: 30, h: 65, layer: "near" },
  { x: 195, w: 35, h: 80, layer: "near" },
  { x: 260, w: 28, h: 70, layer: "near" },
  { x: 335, w: 30, h: 85, layer: "near" },
  { x: 385, w: 25, h: 68, layer: "near" },
];

const utensils = [
  { x: 50, type: "fork" },
  { x: 140, type: "spoon" },
  { x: 230, type: "fork" },
  { x: 320, type: "spoon" },
  { x: 100, type: "spoon" },
  { x: 280, type: "fork" },
];

const LoginSkyBackground = () => {
  const [hour, setHour] = useState(getBrasiliaHour);

  useEffect(() => {
    const interval = setInterval(() => setHour(getBrasiliaHour()), 60000);
    return () => clearInterval(interval);
  }, []);

  const colors = useMemo(() => getInterpolated(hour), [hour]);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Sky gradient */}
      <div
        className="absolute inset-0 transition-colors duration-[3000ms]"
        style={{
          background: `linear-gradient(180deg, ${colors.skyTop} 0%, ${colors.skyBottom} 100%)`,
        }}
      />

      {/* SVG Cityscape - static, no sun/moon/stars/bokeh */}
      <svg
        viewBox="0 0 420 200"
        preserveAspectRatio="xMidYMax slice"
        className="absolute bottom-0 left-0 w-full h-full"
        style={{ minHeight: "100%" }}
      >
        {/* Far buildings */}
        {buildings
          .filter((b) => b.layer === "far")
          .map((b, i) => (
            <rect
              key={`far-${i}`}
              x={b.x}
              y={200 - b.h}
              width={b.w}
              height={b.h}
              fill={colors.buildingFar}
              className="transition-colors duration-[3000ms]"
              rx={1}
            />
          ))}

        {/* Mid buildings */}
        {buildings
          .filter((b) => b.layer === "mid")
          .map((b, i) => (
            <rect
              key={`mid-${i}`}
              x={b.x}
              y={200 - b.h}
              width={b.w}
              height={b.h}
              fill={colors.buildingMid}
              className="transition-colors duration-[3000ms]"
              rx={1}
            />
          ))}

        {/* Food utensils silhouettes */}
        {utensils.map((u, i) => (
          <g key={`utensil-${i}`} className="transition-colors duration-[3000ms]">
            {u.type === "fork" ? (
              <g transform={`translate(${u.x}, 130)`}>
                <rect x={0} y={0} width={1.5} height={70} fill={colors.buildingMid} rx={0.5} />
                <rect x={-3} y={0} width={1} height={20} fill={colors.buildingMid} rx={0.5} />
                <rect x={3.5} y={0} width={1} height={20} fill={colors.buildingMid} rx={0.5} />
                <rect x={-1} y={0} width={1} height={22} fill={colors.buildingMid} rx={0.5} />
                <rect x={2} y={0} width={1} height={22} fill={colors.buildingMid} rx={0.5} />
              </g>
            ) : (
              <g transform={`translate(${u.x}, 130)`}>
                <rect x={0} y={15} width={1.5} height={55} fill={colors.buildingMid} rx={0.5} />
                <ellipse cx={0.75} cy={8} rx={5} ry={8} fill={colors.buildingMid} />
              </g>
            )}
          </g>
        ))}

        {/* Near buildings */}
        {buildings
          .filter((b) => b.layer === "near")
          .map((b, i) => (
            <rect
              key={`near-${i}`}
              x={b.x}
              y={200 - b.h}
              width={b.w}
              height={b.h}
              fill={colors.buildingNear}
              className="transition-colors duration-[3000ms]"
              rx={1}
            />
          ))}
      </svg>
    </div>
  );
};

export default LoginSkyBackground;
