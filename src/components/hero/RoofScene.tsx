import { useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";

export type HeroFocus =
  | "tetofedes"
  | "tetojavitas"
  | "badogozas"
  | "ereszcsatorna"
  | "tetoszigeteles"
  | "egyeb";

const P1 = { x: 70, y: 350 };
const P2 = { x: 250, y: 250 };
const P3 = { x: 500, y: 310 };
const P4 = { x: 320, y: 410 };

const poly = (pts: { x: number; y: number }[]) => pts.map((p) => `${p.x},${p.y}`).join(" ");
const lerp = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/** Roof plane, optionally lifted by dy to fake a stacked layer. */
function planePoints(dy: number) {
  return poly([
    { x: P1.x, y: P1.y - dy },
    { x: P2.x, y: P2.y - dy },
    { x: P3.x, y: P3.y - dy },
    { x: P4.x, y: P4.y - dy },
  ]);
}

const layerTransition = (delay: number) => ({
  duration: 0.55,
  delay,
  ease: [0.22, 1, 0.36, 1] as const,
});

export function RoofScene({ focus }: { focus: HeroFocus }) {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [weather, setWeather] = useState(false);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18 });
  const sy = useSpring(my, { stiffness: 60, damping: 18 });

  const { scrollY } = useScroll();
  const scrollLift = useTransform(scrollY, [0, 600], [0, -40]);

  useEffect(() => {
    if (reduce) return;
    const timer = window.setTimeout(() => setWeather(true), 4200);
    return () => window.clearTimeout(timer);
  }, [reduce]);

  const onMove = (e: React.MouseEvent) => {
    if (reduce) return;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set(((e.clientX - rect.left) / rect.width - 0.5) * 26);
    my.set(((e.clientY - rect.top) / rect.height - 0.5) * 18);
  };

  const tileRows = useMemo(() => {
    const rows: { points: string; delay: number }[] = [];
    const steps = 9;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const t1 = (i + 0.92) / steps;
      const a = lerp(P2, P1, t0);
      const b = lerp(P3, P4, t0);
      const c = lerp(P3, P4, t1);
      const d = lerp(P2, P1, t1);
      rows.push({ points: poly([a, b, c, d]), delay: 2.15 + i * 0.06 });
    }
    return rows;
  }, []);

  const battens = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 1; i < 10; i++) {
      const t = i / 10;
      const a = lerp(P2, P1, t);
      const b = lerp(P3, P4, t);
      lines.push({ x1: a.x, y1: a.y - 16, x2: b.x, y2: b.y - 16 });
    }
    return lines;
  }, []);

  const rafters = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const a = lerp(P1, P4, t);
      const b = lerp(P2, P3, t);
      lines.push({ x1: a.x, y1: a.y - 4, x2: b.x, y2: b.y - 4 });
    }
    return lines;
  }, []);

  const highlight = (key: HeroFocus) => (focus === key ? 1 : 0);

  return (
    <div
      ref={wrapRef}
      onMouseMove={onMove}
      onMouseLeave={() => {
        mx.set(0);
        my.set(0);
      }}
      className="relative w-full"
      aria-hidden="true"
    >
      <motion.div {...(reduce ? {} : { style: { x: sx, y: sy, translateY: scrollLift } })}>
        <svg viewBox="0 0 580 520" className="h-auto w-full overflow-visible">
          <defs>
            <linearGradient id="tileGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.96" />
              <stop offset="100%" stopColor="var(--slate-cool)" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="wallGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--surface)" />
              <stop offset="100%" stopColor="color-mix(in oklab, var(--surface) 82%, var(--slate-cool))" />
            </linearGradient>
            <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="white" stopOpacity="0" />
              <stop offset="45%" stopColor="white" stopOpacity="0.55" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <clipPath id="roofClip">
              <polygon points={planePoints(28)} />
            </clipPath>
          </defs>

          {/* alapvonal */}
          <motion.line
            x1="20"
            y1="470"
            x2="560"
            y2="470"
            stroke="color-mix(in oklab, var(--primary) 18%, transparent)"
            strokeWidth="1"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8 }}
          />

          {/* 1. épület alapforma */}
          <motion.g
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={layerTransition(0.1)}
          >
            <polygon
              points={poly([
                P1,
                P4,
                { x: P4.x, y: P4.y + 90 },
                { x: P1.x, y: P1.y + 90 },
              ])}
              fill="url(#wallGrad)"
              stroke="color-mix(in oklab, var(--primary) 22%, transparent)"
            />
            <polygon
              points={poly([
                P4,
                P3,
                { x: P3.x, y: P3.y + 70 },
                { x: P4.x, y: P4.y + 90 },
              ])}
              fill="color-mix(in oklab, var(--primary) 12%, var(--surface))"
              stroke="color-mix(in oklab, var(--primary) 22%, transparent)"
            />
            <rect
              x={P1.x + 40}
              y={P1.y + 26}
              width="46"
              height="52"
              rx="3"
              fill="color-mix(in oklab, var(--forest) 24%, var(--surface))"
              stroke="color-mix(in oklab, var(--primary) 25%, transparent)"
            />
            <rect
              x={P1.x + 120}
              y={P1.y + 40}
              width="46"
              height="52"
              rx="3"
              fill="color-mix(in oklab, var(--forest) 24%, var(--surface))"
              stroke="color-mix(in oklab, var(--primary) 25%, transparent)"
            />
          </motion.g>

          {/* 2. fa tetőszerkezet */}
          <motion.g
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={layerTransition(0.6)}
          >
            <polygon
              points={planePoints(4)}
              fill="color-mix(in oklab, var(--accent) 14%, var(--surface))"
              stroke="color-mix(in oklab, var(--accent) 55%, transparent)"
            />
            {rafters.map((r, i) => (
              <motion.line
                key={i}
                {...r}
                stroke="color-mix(in oklab, var(--accent) 70%, transparent)"
                strokeWidth="2.4"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.45, delay: 0.65 + i * 0.06 }}
              />
            ))}
          </motion.g>

          {/* 3. hőszigetelés */}
          <motion.g
            initial={{ opacity: 0, y: 12 }}
            animate={{
              opacity: focus === "tetoszigeteles" ? 1 : 0.85,
              y: 0,
              scale: 1 + highlight("tetoszigeteles") * 0.012,
            }}
            transition={layerTransition(1.15)}
            style={{ transformOrigin: "290px 330px" }}
          >
            <polygon
              points={planePoints(11)}
              fill="color-mix(in oklab, var(--forest) 32%, var(--surface))"
              stroke="color-mix(in oklab, var(--forest) 60%, transparent)"
              strokeDasharray="5 4"
            />
          </motion.g>

          {/* 4. tetőfólia */}
          <motion.polygon
            points={planePoints(17)}
            fill="color-mix(in oklab, var(--slate-cool) 26%, var(--surface))"
            stroke="color-mix(in oklab, var(--slate-cool) 70%, transparent)"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={layerTransition(1.5)}
          />

          {/* 5. lécek */}
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={layerTransition(1.85)}>
            {battens.map((b, i) => (
              <motion.line
                key={i}
                {...b}
                stroke="color-mix(in oklab, var(--accent) 60%, transparent)"
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.35, delay: 1.85 + i * 0.04 }}
              />
            ))}
          </motion.g>

          {/* 6. tetőcserepek */}
          <motion.g
            animate={{ scale: 1 + highlight("tetofedes") * 0.014 }}
            style={{ transformOrigin: "290px 330px" }}
            transition={{ duration: 0.5 }}
          >
            {tileRows.map((row, i) => (
              <motion.polygon
                key={i}
                points={row.points}
                fill="url(#tileGrad)"
                stroke="color-mix(in oklab, var(--surface) 30%, transparent)"
                strokeWidth="0.8"
                initial={{ opacity: 0, y: -14 }}
                animate={{
                  opacity: focus === "tetojavitas" && i === 3 ? 0.35 : 1,
                  y: focus === "tetojavitas" && i === 3 ? -6 : -28,
                  x: focus === "tetojavitas" && i === 3 ? 10 : 0,
                }}
                transition={{ duration: 0.5, delay: row.delay }}
              />
            ))}
          </motion.g>

          {/* 7. bádogos elemek: gerinc, kémény, szegély */}
          <motion.g
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0, scale: 1 + highlight("badogozas") * 0.02 }}
            transition={layerTransition(2.75)}
            style={{ transformOrigin: "370px 280px" }}
          >
            <polyline
              points={poly([
                { x: P2.x, y: P2.y - 30 },
                { x: P3.x, y: P3.y - 30 },
              ])}
              fill="none"
              stroke={focus === "badogozas" ? "var(--accent)" : "color-mix(in oklab, var(--primary) 75%, var(--surface))"}
              strokeWidth="7"
              strokeLinecap="round"
            />
            <polygon
              points={poly([
                { x: 350, y: 262 },
                { x: 392, y: 275 },
                { x: 392, y: 232 },
                { x: 350, y: 219 },
              ])}
              fill="color-mix(in oklab, var(--primary) 82%, var(--surface))"
            />
            <polygon
              points={poly([
                { x: 344, y: 266 },
                { x: 398, y: 283 },
                { x: 398, y: 274 },
                { x: 344, y: 257 },
              ])}
              fill={focus === "badogozas" ? "var(--accent)" : "var(--slate-cool)"}
            />
          </motion.g>

          {/* 8. ereszcsatorna */}
          <motion.g
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0, scale: 1 + highlight("ereszcsatorna") * 0.03 }}
            transition={layerTransition(3.15)}
            style={{ transformOrigin: `${P4.x}px ${P4.y}px` }}
          >
            <polyline
              points={poly([
                { x: P1.x - 6, y: P1.y - 20 },
                { x: P4.x + 6, y: P4.y - 20 },
              ])}
              fill="none"
              stroke={focus === "ereszcsatorna" ? "var(--accent)" : "color-mix(in oklab, var(--primary) 70%, var(--surface))"}
              strokeWidth="8"
              strokeLinecap="round"
            />
            <line
              x1={P4.x + 4}
              y1={P4.y - 18}
              x2={P4.x + 4}
              y2={P4.y + 78}
              stroke={focus === "ereszcsatorna" ? "var(--accent)" : "color-mix(in oklab, var(--primary) 70%, var(--surface))"}
              strokeWidth="6"
              strokeLinecap="round"
            />
          </motion.g>

          {/* 9. fényhatás a kész tetőn */}
          <g clipPath="url(#roofClip)">
            <motion.rect
              x="-260"
              y="180"
              width="220"
              height="260"
              fill="url(#sweep)"
              initial={{ x: -260 }}
              animate={{ x: [-260, 560] }}
              transition={{ duration: 1.8, delay: 3.5, repeat: Infinity, repeatDelay: 6 }}
            />
          </g>

          {/* időjárási történet */}
          {weather && !reduce ? (
            <>
              {Array.from({ length: 14 }).map((_, i) => (
                <motion.line
                  key={i}
                  x1={110 + i * 30}
                  y1={40}
                  x2={104 + i * 30}
                  y2={70}
                  stroke="color-mix(in oklab, var(--slate-cool) 80%, transparent)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  initial={{ opacity: 0, y: -40 }}
                  animate={{ opacity: [0, 0.9, 0], y: [0, 210, 240] }}
                  transition={{
                    duration: 1.1,
                    delay: i * 0.09,
                    repeat: 3,
                    repeatDelay: 0.5,
                  }}
                />
              ))}
              <motion.polyline
                points={poly([
                  lerp(P2, P1, 0.15),
                  lerp(P3, P4, 0.15),
                  { x: P4.x + 4, y: P4.y + 70 },
                ])}
                fill="none"
                stroke="color-mix(in oklab, var(--forest) 70%, transparent)"
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: [0, 1], opacity: [0, 0.9, 0.2] }}
                transition={{ duration: 2.4, delay: 0.8 }}
              />
              <motion.polygon
                points={planePoints(30)}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.85, 0.25] }}
                transition={{ duration: 2.6, delay: 2.6 }}
              />
            </>
          ) : null}
        </svg>
      </motion.div>
    </div>
  );
}
