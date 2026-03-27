"use client"

import { useState } from "react"
import Link from "next/link"
import { DJIA_SYMBOLS, SP500_SYMBOLS } from "@/lib/symbols"
import type { StockData } from "@/lib/yahoo"

async function fetchStock(symbol: string): Promise<StockData | null> {
  try {
    const res = await fetch(`/api/stock/${symbol}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function fmt(v: number, dec = 1) { return v !== 0 ? v.toFixed(dec) : "—" }
function pct(v: number, dec = 1) { return v !== 0 ? `${v >= 0 ? "+" : ""}${v.toFixed(dec)}%` : "—" }
function usd(v: number) { return v > 0 ? `$${v.toFixed(2)}` : "—" }

function ScoreBadge({ value, label }: { value: number; label?: string }) {
  const color =
    value >= 70 ? "bg-green-900 text-green-300 border-green-700" :
    value >= 45 ? "bg-yellow-900 text-yellow-300 border-yellow-700" :
    "bg-red-900 text-red-300 border-red-700"
  return (
    <div className={`inline-flex flex-col items-center rounded-lg border px-2 py-1 ${color}`}>
      <span className="text-lg font-black leading-none">{value}</span>
      {label && <span className="text-[10px] opacity-70 mt-0.5">{label}</span>}
    </div>
  )
}

function Bar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const color = pct >= 70 ? "bg-green-500" : pct >= 45 ? "bg-yellow-500" : "bg-red-500"
  return (
    <div className="w-full bg-gray-800 rounded-full h-1.5 mt-1">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function ModelCell({ value, good, label }: { value: string; good: boolean | null; label?: string }) {
  const color = good === null ? "text-gray-300" : good ? "text-green-400" : "text-red-400"
  return (
    <div>
      <span className={`font-mono text-sm ${color}`}>{value}</span>
      {label && <div className="text-[10px] text-gray-600">{label}</div>}
    </div>
  )
}

type SortKey = "composite" | "value" | "quality" | "graham" | "lynch" | "peg" | "pfcf" | "ey" | "upside"

const SORT_OPTIONS: { key: SortKey; label: string; desc: string }[] = [
  {
    key: "composite",
    label: "Score compuesto",
    desc: "Combina todos los modelos en un solo número (55% valor + 45% calidad). Muestra las empresas que son baratas y tienen un negocio sólido al mismo tiempo. Es la vista más equilibrada.",
  },
  {
    key: "value",
    label: "Score de valor",
    desc: "Mide únicamente qué tan barata está la acción sin importar la calidad del negocio. Combina Graham Number, P/FCF, upside a target de analistas y Earnings Yield. Una empresa puede estar primera aquí y tener un negocio mediocre.",
  },
  {
    key: "quality",
    label: "Score de calidad",
    desc: "Mide qué tan bueno es el negocio sin importar el precio. Combina ROE, ROA, margen operativo y nivel de deuda. Una empresa puede estar primera aquí y estar cara.",
  },
  {
    key: "graham",
    label: "Descuento vs Graham",
    desc: "Ordena por el % que el precio actual está por debajo del Graham Number (√(22.5 × EPS × Book Value)). Positivo = barato. No aplica para empresas con EPS o book value negativo.",
  },
  {
    key: "lynch",
    label: "Descuento vs Lynch",
    desc: "Ordena por el % que el precio está por debajo de EPS × 15. Lynch argumentaba que una empresa promedio merece 15 veces sus ganancias. Similar a ordenar por P/E inverso con referencia fija de 15x.",
  },
  {
    key: "peg",
    label: "PEG más bajo",
    desc: "PEG = P/E ÷ crecimiento de EPS. Combina valoración y crecimiento en un número. PEG < 1 barata, PEG < 0.5 muy barata. El filtro favorito de Peter Lynch para empresas de crecimiento a buen precio.",
  },
  {
    key: "pfcf",
    label: "P/FCF más bajo",
    desc: "Precio dividido entre Free Cash Flow por acción. El FCF es el dinero real que genera el negocio y es difícil de manipular. P/FCF < 10 muy barato, < 15 barato, > 25 caro.",
  },
  {
    key: "ey",
    label: "Earnings Yield",
    desc: "EBITDA ÷ Enterprise Value expresado en %. Es el rendimiento que genera el negocio sobre su valor total. Comparar contra el bono del tesoro a 10Y (~4.5%): si el Earnings Yield es menor, el bono rinde más.",
  },
  {
    key: "upside",
    label: "Upside analistas",
    desc: "% de diferencia entre el precio actual y el precio objetivo promedio de los analistas de Wall Street. Referencia útil pero con cautela: los analistas tienden a ser optimistas y se equivocan frecuentemente.",
  },
]

export default function Parte1() {
  const [stocks, setStocks]     = useState<StockData[]>([])
  const [loading, setLoading]   = useState(false)
  const [ran, setRan]           = useState(false)
  const [progress, setProgress] = useState(0)
  const [fetched, setFetched]   = useState(0)
  const [universe, setUniverse] = useState<"dia" | "sp500">("dia")
  const [limit, setLimit]       = useState(50)
  const [sortBy, setSortBy]     = useState<SortKey>("composite")
  const [expanded, setExpanded] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setRan(false)
    setStocks([])
    setProgress(0)
    setFetched(0)

    const symbols = universe === "dia" ? DJIA_SYMBOLS : SP500_SYMBOLS.slice(0, limit)
    const results: StockData[] = []
    let done = 0

    for (let i = 0; i < symbols.length; i += 5) {
      const batch = await Promise.all(symbols.slice(i, i + 5).map(fetchStock))
      batch.forEach((s) => { if (s) results.push(s) })
      done += 5
      setProgress(Math.round((Math.min(done, symbols.length) / symbols.length) * 100))
      setFetched(results.length)
    }

    results.sort((a, b) => {
      switch (sortBy) {
        case "composite": return b.compositeScore - a.compositeScore
        case "value":     return b.valueScore - a.valueScore
        case "quality":   return b.qualityScore - a.qualityScore
        case "graham":    return b.discountToGraham - a.discountToGraham
        case "lynch":     return b.discountToLynch - a.discountToLynch
        case "peg":       return (a.peg > 0 ? a.peg : 999) - (b.peg > 0 ? b.peg : 999)
        case "pfcf":      return (a.pFcf > 0 ? a.pFcf : 999) - (b.pFcf > 0 ? b.pFcf : 999)
        case "ey":        return b.earningsYield - a.earningsYield
        case "upside":    return b.upsideToTarget - a.upsideToTarget
        default:          return 0
      }
    })

    setStocks(results)
    setLoading(false)
    setRan(true)
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-full mx-auto">

        {/* Nav */}
        <div className="flex items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Parte 1 — Valoración</h1>
            <p className="text-gray-400 mt-1">Modelos de valoración combinados con score compuesto</p>
          </div>
          <Link href="/" className="ml-auto text-sm text-gray-500 hover:text-gray-300 transition-colors">
            ← Screener básico
          </Link>
        </div>

        {/* Controles */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 flex flex-wrap gap-6 items-end">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Universo</label>
            <select value={universe}
              onChange={(e) => { setUniverse(e.target.value as "dia" | "sp500"); setStocks([]); setRan(false) }}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white">
              <option value="dia">Dow Jones 30</option>
              <option value="sp500">S&P 500</option>
            </select>
          </div>

          {universe === "sp500" && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Acciones</label>
              <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white">
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          )}

          <div className="flex-1 min-w-[260px]">
            <label className="block text-xs text-gray-400 mb-1">Ordenar por</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white w-full max-w-xs">
              {SORT_OPTIONS.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2 max-w-sm leading-relaxed">
              {SORT_OPTIONS.find(o => o.key === sortBy)?.desc}
            </p>
          </div>

          <button onClick={run} disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-400 text-white font-semibold px-5 py-2 rounded-lg transition-colors">
            {loading ? `Analizando... ${progress}%` : "Analizar"}
          </button>
        </div>

        {loading && fetched > 0 && (
          <p className="text-sm text-gray-500 mb-4">{fetched} acciones procesadas...</p>
        )}

        {ran && !loading && stocks.length === 0 && (
          <div className="text-center py-20 text-red-400">No se pudo obtener datos. Intenta de nuevo.</div>
        )}

        {/* Resultados */}
        {stocks.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-gray-500 mb-4">{stocks.length} empresas analizadas</p>

            {stocks.map((s) => {
              const open = expanded === s.symbol
              return (
                <div key={s.symbol}
                  className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">

                  {/* Fila principal */}
                  <button
                    onClick={() => setExpanded(open ? null : s.symbol)}
                    className="w-full text-left px-5 py-4 hover:bg-gray-800/50 transition-colors">
                    <div className="flex items-center gap-4 flex-wrap">

                      {/* Score compuesto */}
                      <ScoreBadge value={s.compositeScore} />

                      {/* Empresa */}
                      <div className="min-w-[140px]">
                        <div className="font-bold text-white text-base">{s.symbol}</div>
                        <div className="text-xs text-gray-400 truncate max-w-[160px]">{s.company}</div>
                        <div className="text-xs text-gray-600">{s.sector}</div>
                      </div>

                      {/* Precio */}
                      <div className="text-right min-w-[80px]">
                        <div className="font-mono text-white">${s.currentPrice.toFixed(2)}</div>
                        <div className={`text-xs font-mono ${s.dropFrom52w <= -20 ? "text-green-400" : "text-gray-500"}`}>
                          {s.dropFrom52w.toFixed(1)}% vs 52w
                        </div>
                      </div>

                      {/* Scores individuales */}
                      <div className="flex gap-3 flex-wrap">
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-0.5">Valor</div>
                          <div className={`text-sm font-bold ${s.valueScore >= 60 ? "text-green-400" : s.valueScore >= 35 ? "text-yellow-400" : "text-red-400"}`}>
                            {s.valueScore}
                          </div>
                          <Bar value={s.valueScore} />
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-0.5">Calidad</div>
                          <div className={`text-sm font-bold ${s.qualityScore >= 60 ? "text-green-400" : s.qualityScore >= 35 ? "text-yellow-400" : "text-red-400"}`}>
                            {s.qualityScore}
                          </div>
                          <Bar value={s.qualityScore} />
                        </div>
                      </div>

                      {/* Modelos clave en resumen */}
                      <div className="flex gap-4 flex-wrap ml-auto text-right">
                        <div>
                          <div className="text-xs text-gray-500">Graham</div>
                          <div className={`text-sm font-mono font-bold ${s.discountToGraham > 0 ? "text-green-400" : "text-red-400"}`}>
                            {s.grahamNumber > 0 ? pct(s.discountToGraham) : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">PEG</div>
                          <div className={`text-sm font-mono font-bold ${s.peg > 0 && s.peg < 1 ? "text-green-400" : s.peg < 2 ? "text-yellow-400" : "text-red-400"}`}>
                            {s.peg > 0 ? s.peg.toFixed(2) : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">P/FCF</div>
                          <div className={`text-sm font-mono font-bold ${s.pFcf > 0 && s.pFcf < 15 ? "text-green-400" : s.pFcf < 25 ? "text-yellow-400" : "text-red-400"}`}>
                            {s.pFcf > 0 ? s.pFcf.toFixed(1) : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Upside</div>
                          <div className={`text-sm font-mono font-bold ${s.upsideToTarget >= 20 ? "text-green-400" : s.upsideToTarget >= 0 ? "text-yellow-400" : "text-red-400"}`}>
                            {s.analystTarget > 0 ? pct(s.upsideToTarget) : "—"}
                          </div>
                        </div>
                      </div>

                      <span className="text-gray-600 text-xs ml-2">{open ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {/* Detalle expandido */}
                  {open && (
                    <div className="border-t border-gray-800 px-5 py-5 grid grid-cols-2 md:grid-cols-4 gap-6 bg-gray-950">

                      {/* Modelos de valor */}
                      <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Modelos de Valor</h3>
                        <div className="space-y-2.5">
                          <div>
                            <div className="text-xs text-gray-500">Graham Number</div>
                            <ModelCell value={usd(s.grahamNumber)} good={s.grahamNumber > 0 ? s.discountToGraham > 0 : null}
                              label={s.grahamNumber > 0 ? `${pct(s.discountToGraham)} vs precio` : "EPS o BV negativo"} />
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Peter Lynch (EPS×15)</div>
                            <ModelCell value={usd(s.lynchValue)} good={s.lynchValue > 0 ? s.discountToLynch > 0 : null}
                              label={s.lynchValue > 0 ? `${pct(s.discountToLynch)} vs precio` : "EPS negativo"} />
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Target analistas</div>
                            <ModelCell value={usd(s.analystTarget)} good={s.upsideToTarget > 10}
                              label={s.analystTarget > 0 ? `${pct(s.upsideToTarget)} upside · ${s.analystCount} analistas` : "Sin cobertura"} />
                          </div>
                        </div>
                      </div>

                      {/* Ratios de valoración */}
                      <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Ratios</h3>
                        <div className="space-y-2.5">
                          <div>
                            <div className="text-xs text-gray-500">PEG Ratio</div>
                            <ModelCell value={s.peg > 0 ? s.peg.toFixed(2) : "—"}
                              good={s.peg > 0 ? s.peg < 1 : null}
                              label="< 1 barato · < 0.5 muy barato" />
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Price / FCF</div>
                            <ModelCell value={s.pFcf > 0 ? s.pFcf.toFixed(1) : "—"}
                              good={s.pFcf > 0 ? s.pFcf < 15 : null}
                              label="< 15 barato · < 10 muy barato" />
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">EV/EBITDA</div>
                            <ModelCell value={s.evToEbitda > 0 ? s.evToEbitda.toFixed(1) : "—"}
                              good={s.evToEbitda > 0 ? s.evToEbitda < 12 : null}
                              label="< 12 atractivo · < 8 muy barato" />
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Earnings Yield</div>
                            <ModelCell value={s.earningsYield > 0 ? `${s.earningsYield.toFixed(1)}%` : "—"}
                              good={s.earningsYield > 4.5}
                              label="Comparar vs bono 10Y (~4.5%)" />
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">P/E · Forward P/E · P/B</div>
                            <span className="font-mono text-gray-300 text-sm">
                              {fmt(s.pe)} · {fmt(s.forwardPe)} · {fmt(s.pb)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Calidad */}
                      <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Calidad</h3>
                        <div className="space-y-2.5">
                          <div>
                            <div className="text-xs text-gray-500">ROE / ROA</div>
                            <ModelCell value={`${pct(s.roe * 100)} / ${pct(s.roa * 100)}`}
                              good={s.roe > 0.15}
                              label="ROE > 15% fuerte" />
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Margen operativo</div>
                            <ModelCell value={pct(s.operatingMargin * 100)}
                              good={s.operatingMargin > 0.15}
                              label="> 15% sólido" />
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Margen neto</div>
                            <ModelCell value={pct(s.netMargin * 100)}
                              good={s.netMargin > 0.10}
                              label="> 10% bueno" />
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Deuda / Patrimonio</div>
                            <ModelCell value={s.debtToEquity > 0 ? (s.debtToEquity / 100).toFixed(2) : "—"}
                              good={s.debtToEquity > 0 ? s.debtToEquity < 100 : null}
                              label="< 1.0x conservador" />
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Beta</div>
                            <span className="font-mono text-gray-300 text-sm">{fmt(s.beta, 2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Crecimiento */}
                      <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Crecimiento</h3>
                        <div className="space-y-2.5">
                          <div>
                            <div className="text-xs text-gray-500">Crecimiento EPS</div>
                            <ModelCell value={pct(s.earningsGrowth * 100)}
                              good={s.earningsGrowth > 0.08}
                              label="> 8% anual fuerte" />
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Crecimiento Ventas</div>
                            <ModelCell value={pct(s.revenueGrowth * 100)}
                              good={s.revenueGrowth > 0.05}
                              label="> 5% anual sólido" />
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">FCF</div>
                            <span className="font-mono text-gray-300 text-sm">
                              {s.freeCashflow > 0
                                ? `$${(s.freeCashflow / 1e9).toFixed(1)}B`
                                : s.freeCashflow < 0
                                ? `−$${(Math.abs(s.freeCashflow) / 1e9).toFixed(1)}B`
                                : "—"}
                            </span>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Dividend Yield</div>
                            <span className="font-mono text-gray-300 text-sm">
                              {s.dividendYield > 0 ? pct(s.dividendYield * 100) : "No paga"}
                            </span>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Market Cap</div>
                            <span className="font-mono text-gray-300 text-sm">
                              {s.marketCap > 1e12
                                ? `$${(s.marketCap / 1e12).toFixed(1)}T`
                                : `$${(s.marketCap / 1e9).toFixed(0)}B`}
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
