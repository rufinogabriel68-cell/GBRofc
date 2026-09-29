"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/utils";

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => setW(Math.floor(e[0].contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export type Series = { key: string; name: string; color: string };
export type Point = { label: string; [k: string]: number | string };

const compact = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".0", "")}mi`;
  if (a >= 1000) return `${(v / 1000).toFixed(1).replace(".0", "")}k`;
  return String(Math.round(v));
};

/** Gráfico SVG responsivo (área, linha ou barras agrupadas) com tooltip. */
export function Chart({ kind = "area", data, series, height = 220, format = (v: number) => String(v), emptyText = "Sem dados no período" }: { kind?: "area" | "line" | "bar"; data: Point[]; series: Series[]; height?: number; format?: (v: number) => string; emptyText?: string }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 44, padR = 10, padT = 12, padB = 26;
  const iw = Math.max(10, w - padL - padR);
  const ih = height - padT - padB;
  const all = data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0));
  const hasData = all.some((v) => v !== 0);
  let max = Math.max(...all, 0);
  let min = Math.min(...all, 0);
  if (max === min) max = min + 1;
  const range = max - min;
  const nice = (v: number) => v;
  const y = (v: number) => padT + ih - ((nice(v) - min) / range) * ih;
  const n = data.length;
  const x = (i: number) => padL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const bandW = iw / Math.max(n, 1);
  const bx = (i: number) => padL + bandW * i + bandW / 2;
  const step = Math.ceil(n / Math.max(2, Math.floor(iw / 62)));
  const ticks = [0, 1, 2, 3, 4].map((t) => min + (range * t) / 4);
  const gid = useRef("g" + Math.random().toString(36).slice(2, 7)).current;

  const path = (s: Series) => data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(Number(d[s.key]) || 0).toFixed(1)}`).join(" ");
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = kind === "bar" ? Math.floor((px - padL) / bandW) : Math.round(((px - padL) / iw) * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
  };

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label="Gráfico">
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`${gid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity=".32" />
                <stop offset="1" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={i ? "3 4" : undefined} />
              <text x={padL - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--fg-3)">{compact(t)}</text>
            </g>
          ))}
          {data.map((d, i) => (i % step === 0 ? <text key={i} x={kind === "bar" ? bx(i) : x(i)} y={height - 8} textAnchor="middle" fontSize="10" fill="var(--fg-3)">{d.label}</text> : null))}
          {kind === "bar" &&
            data.map((d, i) => {
              const bw = Math.max(3, Math.min(26, (bandW * 0.7) / series.length));
              return series.map((s, si) => {
                const v = Number(d[s.key]) || 0;
                const x0 = bx(i) - (bw * series.length) / 2 + si * bw;
                const y0 = y(Math.max(v, 0));
                const h = Math.max(1, Math.abs(y(v) - y(0)));
                return <rect key={`${i}-${s.key}`} x={x0 + 0.5} y={v >= 0 ? y0 : y(0)} width={bw - 1.5} height={h} rx={3} fill={s.color} opacity={hover === null || hover === i ? 1 : 0.45} />;
              });
            })}
          {kind !== "bar" &&
            series.map((s) => (
              <g key={s.key}>
                {kind === "area" && n > 1 && <path d={`${path(s)} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${gid}-${s.key})`} />}
                <path d={path(s)} fill="none" stroke={s.color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
                {n <= 40 && data.map((d, i) => <circle key={i} cx={x(i)} cy={y(Number(d[s.key]) || 0)} r={hover === i ? 4.5 : 2.4} fill={s.color} />)}
              </g>
            ))}
          {hover !== null && (
            <line x1={kind === "bar" ? bx(hover) : x(hover)} x2={kind === "bar" ? bx(hover) : x(hover)} y1={padT} y2={padT + ih} stroke="var(--line-2)" />
          )}
        </svg>
      )}
      {!hasData && <div className="absolute inset-0 grid place-items-center text-xs text-fg3 pointer-events-none">{emptyText}</div>}
      {hover !== null && data[hover] && (
        <div className="absolute z-10 glass rounded-xl px-3 py-2 text-xs pointer-events-none" style={{ left: Math.min(Math.max(8, (kind === "bar" ? bx(hover) : x(hover)) - 60), Math.max(8, w - 150)), top: 4 }}>
          <div className="font-semibold mb-1">{data[hover].label}</div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-2 whitespace-nowrap">
              <span className="size-2 rounded-full" style={{ background: s.color }} />
              <span className="text-fg2">{s.name}</span>
              <span className="font-semibold ml-auto pl-3 tabular-nums">{format(Number(data[hover][s.key]) || 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5 text-xs text-fg2">
          <span className="size-2.5 rounded-full" style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

export function Donut({ data, size = 150, center, format = (v: number) => String(v) }: { data: { label: string; value: number; color: string }[]; size?: number; center?: ReactNode; format?: (v: number) => string }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex items-center gap-5 flex-wrap justify-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label="Distribuição">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--solid-3)" strokeWidth={14} />
          {total > 0 &&
            data.map((d, i) => {
              const len = (d.value / total) * c;
              const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth={14} strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-acc} strokeLinecap="round" />;
              acc += len;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center text-sm font-bold">{center}</div>
      </div>
      <div className="space-y-1.5 min-w-[120px]">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span className="size-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-fg2">{d.label}</span>
            <span className="font-semibold ml-auto pl-3 tabular-nums">{format(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HBars({ data, format = (v: number) => String(v), color = "var(--accent)", empty = "Sem dados" }: { data: { label: string; value: number; color?: string; sub?: string }[]; format?: (v: number) => string; color?: string; empty?: string }) {
  const max = Math.max(...data.map((d) => d.value), 0) || 1;
  if (!data.length) return <div className="text-xs text-fg3 py-6 text-center">{empty}</div>;
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label}>
          <div className="flex justify-between text-xs mb-1 gap-2">
            <span className="truncate text-fg2">{d.label}</span>
            <span className="font-semibold tabular-nums shrink-0">{format(d.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-solid3 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, background: d.color || color }} />
          </div>
          {d.sub && <div className="text-[10.5px] text-fg3 mt-0.5">{d.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export function Ring({ value, size = 120, stroke = 11, color = "var(--accent)", children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${Math.round(v)}%`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--solid-3)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (v / 100) * c} style={{ transition: "stroke-dashoffset .8s ease" }} />
      </svg>
      <div className={cx("absolute inset-0 grid place-items-center text-center")}>{children}</div>
    </div>
  );
}

export function ProgressBar({ value, color = "var(--accent)" }: { value: number; color?: string }) {
  return (
    <div className="h-2 rounded-full bg-solid3 overflow-hidden" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}
