import { useState, useEffect, useMemo } from "react";

/**
 * Returns Brasilia time (UTC-3) hours as a decimal (e.g. 14.5 = 2:30 PM)
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

interface PhaseColors {
  skyTop: string;
  skyBottom: string;
  buildingFar: string;
  buildingMid: string;
  buildingNear: string;
  bokeh: string;
  stars: number; // opacity 0-1
  sunGlow: string;
  sunY: number;
}

const phaseMap: Record<TimePhase, PhaseColors> = {
  night: {
    skyTop: "#0a0e27",
    skyBottom: "#1a1a3e",
    buildingFar: "#12152e",
    buildingMid: "#0e1128",
    buildingNear: "#090c20",
    bokeh: "rgba(100,130,255,0.08)",
    stars: 1,
    sunGlow: "rgba(100,130,255,0.05)",
    sunY: 200,
  },
  dawn: {
    skyTop: "#2d1b4e",
    skyBottom: "#e8956b",
    buildingFar: "#4a2a5a",
    buildingMid: "#3a1f48",
    buildingNear: "#2a1535",
    bokeh: "rgba(255,180,120,0.12)",
    stars: 0.2,
    sunGlow: "rgba(255,160,80,0.3)",
    sunY: 140,
  },
  morning: {
    skyTop: "#87CEEB",
    skyBottom: "#FDE8C8",
    buildingFar: "#d4b896",
    buildingMid: "#c4a480",
    buildingNear: "#b0906a",
    bokeh: "rgba(255,220,170,0.15)",
    stars: 0,
    sunGlow: "rgba(255,200,100,0.25)",
    sunY: 60,
  },
  day: {
    skyTop: "#87CEEB",
    skyBottom: "#E8D5B5",
    buildingFar: "#C4A070",
    buildingMid: "#A88855",
    buildingNear: "#8C7040",
    bokeh: "rgba(255,255,255,0.15)",
    stars: 0,
    sunGlow: "rgba(255,230,150,0.2)",
    sunY: 20,
  },
  afternoon: {
    skyTop: "#D4A06A",
    skyBottom: "#E89060",
    buildingFar: "#B87848",
    buildingMid: "#9C6038",
    buildingNear: "#804828",
    bokeh: "rgba(255,200,120,0.18)",
    stars: 0,
    sunGlow: "rgba(255,160,60,0.3)",
    sunY: 80,
  },
  sunset: {
    skyTop: "#D46030",
    skyBottom: "#C04020",
    buildingFar: "#8C3818",
    buildingMid: "#702810",
    buildingNear: "#581808",
    bokeh: "rgba(255,120,60,0.2)",
    stars: 0,
    sunGlow: "rgba(255,80,20,0.4)",
    sunY: 140,
  },
  dusk: {
    skyTop: "#1a1040",
    skyBottom: "#6b3a5a",
    buildingFar: "#2a1840",
    buildingMid: "#201030",
    buildingNear: "#150a25",
    bokeh: "rgba(180,120,200,0.1)",
    stars: 0.5,
    sunGlow: "rgba(200,100,150,0.15)",
    sunY: 170,
  },
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const lerpColor = (a: string, b: string, t: number): string => {
  // Handle hex
  const parse = (c: string) => {
    if (c.startsWith("#")) {
      const hex = c.slice(1);
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    }
    // rgba
    const m = c.match(/[\d.]+/g);
    return m ? [parseFloat(m[0]), parseFloat(m[1]), parseFloat(m[2])] : [0, 0, 0];
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
  bokeh: a.bokeh, // skip lerp for rgba strings
  stars: lerp(a.stars, b.stars, t),
  sunGlow: a.sunGlow,
  sunY: lerp(a.sunY, b.sunY, t),
});

const getInterpolatedColors = (h: number): PhaseColors => {
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

// Building definitions (x, width, height) — heights relative to viewBox 200
const buildings = [
  // Far layer - tall background buildings
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
  // Mid layer
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
  // Near layer - shorter foreground
  { x: 5, w: 28, h: 70, layer: "near" },
  { x: 60, w: 35, h: 85, layer: "near" },
  { x: 130, w: 30, h: 65, layer: "near" },
  { x: 195, w: 35, h: 80, layer: "near" },
  { x: 260, w: 28, h: 70, layer: "near" },
  { x: 335, w: 30, h: 85, layer: "near" },
  { x: 385, w: 25, h: 68, layer: "near" },
];

// Food utensils as "lampposts"
const utensils = [
  { x: 50, type: "fork" },
  { x: 140, type: "spoon" },
  { x: 230, type: "fork" },
  { x: 320, type: "spoon" },
  { x: 100, type: "spoon" },
  { x: 280, type: "fork" },
];

// Stable random for windows (seeded by position)
const stableRandom = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const stars = Array.from({ length: 30 }, (_, i) => ({
  cx: (i * 37 + 13) % 420,
  cy: (i * 23 + 7) % 100,
  r: 0.5 + (i % 3) * 0.4,
  delay: i * 0.3,
}));

const bokehBubbles = Array.from({ length: 12 }, (_, i) => ({
  cx: (i * 41 + 20) % 420,
  cy: 40 + (i * 17) % 120,
  r: 8 + (i % 5) * 6,
  delay: i * 1.5,
  duration: 6 + (i % 4) * 2,
}));

const CityScapeBackground = () => {
  const [hour, setHour] = useState(getBrasiliaHour);

  useEffect(() => {
    const interval = setInterval(() => setHour(getBrasiliaHour()), 60000);
    return () => clearInterval(interval);
  }, []);

  const colors = useMemo(() => getInterpolatedColors(hour), [hour]);
  const isNight = colors.stars > 0.3;

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      {/* Sky gradient */}
      <div
        className="absolute inset-0 transition-colors duration-[3000ms]"
        style={{
          background: `linear-gradient(180deg, ${colors.skyTop} 0%, ${colors.skyBottom} 100%)`,
        }}
      />

      {/* SVG Cityscape */}
      <svg
        viewBox="0 0 420 200"
        preserveAspectRatio="xMidYMax slice"
        className="absolute bottom-0 left-0 w-full h-full"
        style={{ minHeight: "100%" }}
      >
        <defs>
          <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFE87C" stopOpacity="1" />
            <stop offset="40%" stopColor="#FFD700" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#FF8C00" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sunCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="50%" stopColor="#FFF176" />
            <stop offset="100%" stopColor="#FFB300" />
          </radialGradient>
          <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(200,220,255,0.4)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id="moonSurface" cx="40%" cy="40%" r="50%">
            <stop offset="0%" stopColor="#F5F5F0" />
            <stop offset="100%" stopColor="#D0D0C8" />
          </radialGradient>
        </defs>

        {/* === SUN === visible ~5:30 to 19:00 */}
        {(() => {
          const sunRise = 5.5;
          const sunSet = 19;
          const sunDuration = sunSet - sunRise;
          const sunProgress = Math.max(0, Math.min(1, (hour - sunRise) / sunDuration));
          const sunX = -20 + sunProgress * 460;
          const sunArc = Math.sin(sunProgress * Math.PI);
          const sunY = 95 - sunArc * 75;
          const sunOpacity = hour >= sunRise && hour <= sunSet ? Math.min(1, sunArc * 3) : 0;
          return sunOpacity > 0 ? (
            <g opacity={sunOpacity}>
              <circle cx={sunX} cy={sunY} r="40" fill="url(#sunGlow)">
                <animate attributeName="r" values="38;44;38" dur="6s" repeatCount="indefinite" />
              </circle>
              <circle cx={sunX} cy={sunY} r="12" fill="url(#sunCore)" />
              {Array.from({ length: 8 }, (_, i) => {
                const angle = (i * 45) * (Math.PI / 180);
                return (
                  <line key={`ray-${i}`} x1={sunX + Math.cos(angle) * 16} y1={sunY + Math.sin(angle) * 16} x2={sunX + Math.cos(angle) * 24} y2={sunY + Math.sin(angle) * 24} stroke="#FFD700" strokeWidth="1.5" strokeLinecap="round" opacity="0.7">
                    <animate attributeName="opacity" values="0.4;0.8;0.4" dur={`${3 + i * 0.3}s`} repeatCount="indefinite" />
                  </line>
                );
              })}
            </g>
          ) : null;
        })()}

        {/* === MOON === visible ~19:00 to 5:30 */}
        {(() => {
          const moonRise = 19;
          const moonSet = 5.5;
          let moonProgress: number;
          if (hour >= moonRise) {
            moonProgress = (hour - moonRise) / (24 - moonRise + moonSet);
          } else if (hour <= moonSet) {
            moonProgress = (hour + 24 - moonRise) / (24 - moonRise + moonSet);
          } else {
            moonProgress = -1;
          }
          const moonX = -20 + moonProgress * 460;
          const moonArc = Math.sin(moonProgress * Math.PI);
          const moonY = 75 - moonArc * 50;
          const moonOpacity = moonProgress >= 0 && moonProgress <= 1 ? Math.min(1, moonArc * 3) : 0;
          return moonOpacity > 0 ? (
            <g opacity={moonOpacity}>
              <circle cx={moonX} cy={moonY} r="30" fill="url(#moonGlow)">
                <animate attributeName="r" values="28;34;28" dur="8s" repeatCount="indefinite" />
              </circle>
              <circle cx={moonX} cy={moonY} r="9" fill="url(#moonSurface)" />
              <circle cx={moonX - 2} cy={moonY - 2} r="1.5" fill="rgba(180,180,170,0.4)" />
              <circle cx={moonX + 3} cy={moonY + 1} r="1" fill="rgba(180,180,170,0.3)" />
              <circle cx={moonX - 1} cy={moonY + 3} r="0.8" fill="rgba(180,180,170,0.25)" />
              <circle cx={moonX + 3} cy={moonY - 1} r="7.5" fill="rgba(20,20,40,0.15)" />
            </g>
          ) : null;
        })()}

        {/* Stars */}
        {stars.map((s, i) => (
          <circle
            key={`star-${i}`}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill="white"
            opacity={colors.stars}
            className="transition-opacity duration-[3000ms]"
          >
            <animate
              attributeName="opacity"
              values={`${colors.stars * 0.4};${colors.stars};${colors.stars * 0.4}`}
              dur={`${2 + s.delay % 3}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}

        {/* Far buildings */}
        {buildings
          .filter((b) => b.layer === "far")
          .map((b, i) => (
            <g key={`far-${i}`}>
              <rect
                x={b.x}
                y={200 - b.h}
                width={b.w}
                height={b.h}
                fill={colors.buildingFar}
                className="transition-colors duration-[3000ms]"
                rx={1}
              />
              {/* Windows for night */}
              {isNight &&
                Array.from({ length: Math.floor(b.h / 12) }, (_, wi) =>
                  Array.from({ length: Math.floor(b.w / 8) }, (_, wj) => (
                    <rect
                      key={`w-${wi}-${wj}`}
                      x={b.x + 3 + wj * 8}
                      y={200 - b.h + 4 + wi * 12}
                      width={3}
                      height={4}
                      fill={stableRandom(b.x * 100 + wi * 10 + wj) > 0.5 ? "rgba(255,220,120,0.6)" : "rgba(255,220,120,0.15)"}
                      rx={0.3}
                    />
                  ))
                )}
            </g>
          ))}

        {/* Mid buildings */}
        {buildings
          .filter((b) => b.layer === "mid")
          .map((b, i) => (
            <g key={`mid-${i}`}>
              <rect
                x={b.x}
                y={200 - b.h}
                width={b.w}
                height={b.h}
                fill={colors.buildingMid}
                className="transition-colors duration-[3000ms]"
                rx={1}
              />
              {isNight &&
                Array.from({ length: Math.floor(b.h / 14) }, (_, wi) =>
                  Array.from({ length: Math.floor(b.w / 9) }, (_, wj) => (
                    <rect
                      key={`w-${wi}-${wj}`}
                      x={b.x + 4 + wj * 9}
                      y={200 - b.h + 5 + wi * 14}
                      width={3.5}
                      height={5}
                      fill={stableRandom(b.x * 100 + wi * 10 + wj + 500) > 0.4 ? "rgba(255,220,120,0.7)" : "rgba(100,150,255,0.3)"}
                      rx={0.3}
                    />
                  ))
                )}
            </g>
          ))}

        {/* Food utensils as silhouettes */}
        {utensils.map((u, i) => (
          <g key={`utensil-${i}`} className="transition-colors duration-[3000ms]">
            {u.type === "fork" ? (
              <g transform={`translate(${u.x}, 130)`}>
                {/* Fork */}
                <rect x={0} y={0} width={1.5} height={70} fill={colors.buildingMid} rx={0.5} />
                <rect x={-3} y={0} width={1} height={20} fill={colors.buildingMid} rx={0.5} />
                <rect x={3.5} y={0} width={1} height={20} fill={colors.buildingMid} rx={0.5} />
                <rect x={-1} y={0} width={1} height={22} fill={colors.buildingMid} rx={0.5} />
                <rect x={2} y={0} width={1} height={22} fill={colors.buildingMid} rx={0.5} />
              </g>
            ) : (
              <g transform={`translate(${u.x}, 130)`}>
                {/* Spoon */}
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

        {/* Bokeh bubbles */}
        {bokehBubbles.map((b, i) => (
          <circle
            key={`bokeh-${i}`}
            cx={b.cx}
            cy={b.cy}
            r={b.r}
            fill="white"
            opacity={0.06}
          >
            <animate
              attributeName="cy"
              values={`${b.cy};${b.cy - 15};${b.cy}`}
              dur={`${b.duration}s`}
              repeatCount="indefinite"
              begin={`${b.delay}s`}
            />
            <animate
              attributeName="opacity"
              values="0.03;0.1;0.03"
              dur={`${b.duration}s`}
              repeatCount="indefinite"
              begin={`${b.delay}s`}
            />
          </circle>
        ))}
      </svg>

      {/* Subtle top fade for text readability */}
      <div
        className="absolute top-0 left-0 right-0 h-1/2 pointer-events-none"
        style={{
          background: `linear-gradient(to bottom, ${colors.skyTop}99, transparent)`,
        }}
      />
    </div>
  );
};

export default CityScapeBackground;
