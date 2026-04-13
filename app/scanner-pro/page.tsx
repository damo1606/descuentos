"use client";

import { useState } from "react";
import type { ConvictionRow } from "@/app/api/scanner-pro/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number, d = 1) { return v ? v.toFixed(d) : "—"; }
function pct(v: number) { return v ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : "—"; }
function dollar(v: number) { return v ? `$${v.toFixed(2)}` : "—"; }

// ── Badge components ──────────────────────────────────────────────────────────

function GradeBadge({ grade }: { grade: string }) {
  const color =
    grade === "A+" ? "bg-emerald-500 text-white" :
    grade === "A"  ? "bg-green-600 text-white" :
    grade === "B"  ? "bg-blue-600 text-white" :
    grade === "C"  ? "bg-yellow-600 text-white" :
    grade === "D"  ? "bg-orange-600 text-white" :
    "bg-red-800 text-white";
  return <span className={`text-xs font-black px-2 py-0.5 rounded ${color}`}>{grade}</span>;
}

function VerdictBadge({ verdict }: { verdict: ConvictionRow["verdict"] }) {
  const style =
    verdict === "STRONG BUY" ? "bg-emerald-900 text-emerald-200 border border-emerald-700" :
    verdict === "BUY"        ? "bg-green-900/60 text-green-300 border border-green-800" :
    verdict === "WATCH"      ? "bg-yellow-900/60 text-yellow-300 border border-yellow-800" :
    "bg-gray-800 text-gray-400 border border-gray-700";
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-widest ${style}`}>{verdict}</span>;
}

function BiasBadge({ bias, noOptions }: { bias: ConvictionRow["soreBias"]; noOptions?: boolean }) {
  if (noOptions) return <span className="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-500 border border-gray-700">SIN OPC.</span>;
  const style =
    bias === "BULLISH" ? "bg-emerald-900/60 text-emerald-300 border border-emerald-800" :
    bias === "BEARISH" ? "bg-red-900/60 text-red-300 border border-red-800" :
    "bg-gray-800 text-gray-400 border border-gray-700";
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-widest ${style}`}>{bias}</span>;
}

function PressureBar({ value }: { value: number }) {
  const clamped = Math.max(-100, Math.min(100, value));
  const isPos = clamped >= 0;
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden flex">
        {isPos ? (
          <>
            <div className="w-1/2" />
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${clamped / 2}%` }} />
          </>
        ) : (
          <>
            <div className="h-full bg-red-500 rounded-full ml-auto" style={{ width: `${-clamped / 2}%` }} />
            <div className="w-1/2" />
          </>
        )}
      </div>
      <span className={`text-xs font-mono ${isPos ? "text-emerald-400" : "text-red-400"}`}>
        {isPos ? "+" : ""}{clamped.toFixed(0)}
      </span>
    </div>
  );
}

// ── Sort helpers ──────────────────────────────────────────────────────────────

type SortKey = keyof ConvictionRow;

function sortRows(rows: ConvictionRow[], key: SortKey, asc: boolean): ConvictionRow[] {
  return [...rows].sort((a, b) => {
    const av = a[key] as any;
    const bv = b[key] as any;
    if (typeof av === "number" && typeof bv === "number") return asc ? av - bv : bv - av;
    return asc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });
}

// ── Column header ─────────────────────────────────────────────────────────────

function Th({ label, sortKey, current, asc, onSort }: {
  label: string; sortKey: SortKey;
  current: SortKey; asc: boolean;
  onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th
      className="px-3 py-2 text-left text-[10px] font-bold tracking-widest text-muted cursor-pointer hover:text-text select-none whitespace-nowrap"
      onClick={() => onSort(sortKey)}
    >
      {label} {active ? (asc ? "▲" : "▼") : ""}
    </th>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const UNIVERSES = [
  { value: "sp500",   label: "S&P 500" },
  { value: "nasdaq",  label: "Nasdaq 100" },
  { value: "dia",     label: "Dow Jones" },
  { value: "russell", label: "Russell 1000" },
];

const SCORE_THRESHOLDS = [40, 50, 60, 70];

export default function ScannerProPage() {
  const [universe, setUniverse]       = useState("sp500");
  const [minBuyScore, setMinBuyScore] = useState(50);
  const [limit, setLimit]             = useState(20);
  const [rows, setRows]               = useState<ConvictionRow[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [sortKey, setSortKey]         = useState<SortKey>("convictionScore");
  const [sortAsc, setSortAsc]         = useState(false);

  async function handleAnalyze() {
    setLoading(true);
    setError("");
    setRows([]);
    try {
      const res = await fetch(
        `/api/scanner-pro?universe=${universe}&limit=${limit}&minBuyScore=${minBuyScore}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error del servidor");
      setRows(json.rows ?? []);
    } catch (e: any) {
      setError(e.message ?? "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  }

  const sorted = sortRows(rows, sortKey, sortAsc);

  return (
    <div className="min-h-screen bg-bg text-text">

      {/* Header intro */}
      <div className="border-b border-border px-4 sm:px-6 py-4 bg-surface">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-baseline gap-3 mb-1">
            <h1 className="text-lg font-black tracking-[0.2em] text-accent">SCANNER PRO</h1>
            <span className="text-xs text-muted tracking-widest">FUNDAMENTALES × FLUJO INSTITUCIONAL</span>
          </div>
          <p className="text-xs text-subtle leading-relaxed max-w-2xl">
            Combina el score fundamental de Descuentos con la presión institucional de opciones (GEX · M1).
            Detecta acciones baratas donde los dealers ya están posicionados — la mayor convicción de entrada.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="border-b border-border px-4 sm:px-6 py-3 bg-bg sticky top-11 z-40">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3">

          {/* Universe */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted tracking-widest">UNIVERSO</span>
            <select
              value={universe}
              onChange={(e) => setUniverse(e.target.value)}
              className="bg-bg border border-border text-text text-xs px-2 py-1.5 focus:outline-none focus:border-accent"
            >
              {UNIVERSES.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>

          {/* Min score */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted tracking-widest">SCORE MÍN.</span>
            <div className="flex gap-1">
              {SCORE_THRESHOLDS.map((t) => (
                <button
                  key={t}
                  onClick={() => setMinBuyScore(t)}
                  className={`text-xs px-2.5 py-1 border transition-colors ${
                    minBuyScore === t
                      ? "border-accent text-accent bg-accent/10"
                      : "border-border text-muted hover:text-text"
                  }`}
                >
                  {t}+
                </button>
              ))}
            </div>
          </div>

          {/* Limit */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted tracking-widest">TOP</span>
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="bg-bg border border-border text-text text-xs px-2 py-1.5 focus:outline-none focus:border-accent"
            >
              {[10, 15, 20, 25, 30].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="bg-accent text-white px-5 py-1.5 text-xs font-bold tracking-widest hover:opacity-80 disabled:opacity-40 transition-opacity"
          >
            {loading ? "ANALIZANDO..." : "ANALIZAR"}
          </button>

          {rows.length > 0 && !loading && (
            <span className="text-xs text-muted ml-auto">
              {rows.length} resultados · {rows.filter(r => r.verdict === "STRONG BUY").length} STRONG BUY · {rows.filter(r => r.verdict === "BUY").length} BUY
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-muted tracking-widest">
              Obteniendo fundamentales + opciones para {limit} tickers...
            </p>
            <p className="text-[10px] text-muted/60">Esto puede tomar 8–15 segundos</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger rounded">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && rows.length === 0 && (
          <div className="text-center py-20 text-muted text-sm">
            Selecciona universo y score mínimo, luego presiona ANALIZAR.
          </div>
        )}

        {/* Table */}
        {sorted.length > 0 && !loading && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <Th label="TICKER"       sortKey="symbol"               current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <Th label="EMPRESA"      sortKey="company"              current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <Th label="GRADO"        sortKey="grade"                current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <Th label="CONVICCIÓN"   sortKey="convictionScore"      current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <Th label="VEREDICTO"    sortKey="verdict"              current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <Th label="SORE BIAS"    sortKey="soreBias"             current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <Th label="SCORE DESC."  sortKey="buyScore"             current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <Th label="PRESIÓN INST" sortKey="institutionalPressure" current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <Th label="SOPORTE GEX"  sortKey="support"              current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <Th label="RESIST. GEX"  sortKey="resistance"           current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <Th label="CAÍDA 52W"    sortKey="dropFrom52w"          current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <Th label="VS GRAHAM"    sortKey="discountToGraham"     current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <Th label="P/E"          sortKey="pe"                   current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <Th label="ROE"          sortKey="roe"                  current={sortKey} asc={sortAsc} onSort={handleSort} />
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr
                    key={row.symbol}
                    className={`border-b border-border/50 hover:bg-surface/60 transition-colors ${
                      row.verdict === "STRONG BUY" ? "border-l-2 border-l-emerald-600" : ""
                    }`}
                  >
                    <td className="px-3 py-2.5 font-bold text-accent tracking-wider">
                      {row.symbol}
                    </td>
                    <td className="px-3 py-2.5 text-subtle text-xs max-w-[160px] truncate">
                      {row.company}
                    </td>
                    <td className="px-3 py-2.5">
                      <GradeBadge grade={row.grade} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`font-black text-sm ${
                        row.convictionScore >= 75 ? "text-emerald-400" :
                        row.convictionScore >= 60 ? "text-green-400" :
                        row.convictionScore >= 45 ? "text-yellow-400" :
                        "text-gray-500"
                      }`}>
                        {row.convictionScore.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <VerdictBadge verdict={row.verdict} />
                    </td>
                    <td className="px-3 py-2.5">
                      <BiasBadge bias={row.soreBias} noOptions={row.noOptions} />
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-text">
                      {row.buyScore}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.noOptions
                        ? <span className="text-xs text-muted">—</span>
                        : <PressureBar value={row.institutionalPressure} />
                      }
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-subtle">
                      {row.noOptions ? "—" : dollar(row.support)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-subtle">
                      {row.noOptions ? "—" : dollar(row.resistance)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">
                      <span className={row.dropFrom52w <= -20 ? "text-green-400" : "text-gray-400"}>
                        {pct(row.dropFrom52w)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">
                      <span className={row.discountToGraham >= 20 ? "text-green-400" : row.discountToGraham >= 0 ? "text-yellow-400" : "text-red-400"}>
                        {pct(row.discountToGraham)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-subtle">
                      {fmt(row.pe)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-subtle">
                      {row.roe ? `${(row.roe * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        {sorted.length > 0 && !loading && (
          <div className="mt-6 flex flex-wrap gap-4 text-[10px] text-muted tracking-widest border-t border-border pt-4">
            <span>CONVICCIÓN = Score Desc. (50%) + Presión Inst. (30%) + Confluencia GEX (20%)</span>
            <span className="text-emerald-600">■</span><span>STRONG BUY ≥ 75</span>
            <span className="text-green-600">■</span><span>BUY ≥ 60</span>
            <span className="text-yellow-600">■</span><span>WATCH ≥ 45</span>
          </div>
        )}
      </div>
    </div>
  );
}
