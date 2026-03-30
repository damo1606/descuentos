"use client"

import { useState } from "react"
import Link from "next/link"
import { DJIA_SYMBOLS, SP500_SYMBOLS, NASDAQ100_SYMBOLS, RUSSELL_SYMBOLS } from "@/lib/symbols"
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

function pct(v: number, decimals = 1) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(decimals)}%`
}

function fmt(v: number, decimals = 1) {
  return v > 0 ? v.toFixed(decimals) : "—"
}

function DropBadge({ value }: { value: number }) {
  const color =
    value <= -30 ? "text-green-400" :
    value <= -15 ? "text-yellow-300" :
    "text-gray-400"
  return <span className={`font-bold font-mono ${color}`}>{value.toFixed(1)}%</span>
}

function UpBadge({ value }: { value: number }) {
  const color = value >= 20 ? "text-green-400" : value >= 0 ? "text-yellow-300" : "text-red-400"
  return <span className={`font-bold font-mono ${color}`}>{pct(value)}</span>
}

function GrahamBadge({ value }: { value: number }) {
  const color = value >= 20 ? "text-green-400" : value >= 0 ? "text-yellow-300" : "text-red-400"
  return <span className={`font-bold font-mono ${color}`}>{pct(value)}</span>
}

export default function Home() {
  const [stocks, setStocks]           = useState<StockData[]>([])
  const [loading, setLoading]         = useState(false)
  const [ran, setRan]                 = useState(false)
  const [progress, setProgress]       = useState(0)
  const [fetchedCount, setFetchedCount] = useState(0)
  const [universe, setUniverse]       = useState<"dia" | "sp500" | "nasdaq" | "russell">("dia")
  const [limit, setLimit]             = useState(50)
  const [sortBy, setSortBy]           = useState<"drop" | "graham" | "upside">("drop")

  async function runScreener() {
    setLoading(true)
    setRan(false)
    setStocks([])
    setProgress(0)
    setFetchedCount(0)

    const symbols =
      universe === "dia"     ? DJIA_SYMBOLS :
      universe === "nasdaq"  ? NASDAQ100_SYMBOLS :
      universe === "russell" ? RUSSELL_SYMBOLS :
      SP500_SYMBOLS.slice(0, limit)
    const results: StockData[] = []
    let done = 0

    const batchSize = 5
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize)
      const fetched = await Promise.all(batch.map(fetchStock))
      fetched.forEach((s) => { if (s) results.push(s) })
      done += batch.length
      setProgress(Math.round((done / symbols.length) * 100))
      setFetchedCount(results.length)
    }

    const sorted = [...results].sort((a, b) => {
      if (sortBy === "drop")    return a.dropFrom52w - b.dropFrom52w
      if (sortBy === "graham")  return b.discountToGraham - a.discountToGraham
      if (sortBy === "upside")  return b.upsideToTarget - a.upsideToTarget
      return 0
    })

    setStocks(sorted)
    setLoading(false)
    setRan(true)
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-full mx-auto px-2">

        <div className="flex items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Descuentos</h1>
            <p className="text-gray-400 mt-1">Empresas de calidad castigadas por el mercado — Yahoo Finance</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Link href="/sectores"
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors border border-gray-700">
              Sectores →
            </Link>
            <Link href="/parte1"
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors border border-gray-700">
              Valoración →
            </Link>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 flex flex-wrap gap-6 items-end">

          <div>
            <label className="block text-xs text-gray-400 mb-1">Universo</label>
            <select
              value={universe}
              onChange={(e) => { setUniverse(e.target.value as "dia" | "sp500"); setStocks([]); setRan(false) }}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
            >
              <option value="dia">Dow Jones 30</option>
              <option value="sp500">S&P 500</option>
              <option value="nasdaq">Nasdaq 100</option>
              <option value="russell">Russell 1000</option>
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

          <div>
            <label className="block text-xs text-gray-400 mb-1">Ordenar por</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white">
              <option value="drop">Mayor caída desde 52w</option>
              <option value="graham">Mayor descuento vs Graham</option>
              <option value="upside">Mayor upside a target analistas</option>
            </select>
          </div>

          <button onClick={runScreener} disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-400 text-white font-semibold px-5 py-2 rounded-lg transition-colors">
            {loading ? `Consultando... ${progress}%` : "Buscar descuentos"}
          </button>
        </div>

        {/* Estado */}
        {loading && fetchedCount > 0 && (
          <div className="text-sm text-gray-400 mb-4">
            {fetchedCount} acciones obtenidas...
          </div>
        )}

        {ran && !loading && stocks.length === 0 && fetchedCount === 0 && (
          <div className="text-center py-20">
            <p className="text-red-400 font-semibold">No se pudo obtener datos de Yahoo Finance.</p>
            <p className="text-gray-500 text-sm mt-2">Intenta de nuevo en unos segundos.</p>
          </div>
        )}

        {/* Tabla */}
        {stocks.length > 0 && (
          <>
            <div className="text-sm text-gray-400 mb-3">
              {stocks.length} empresas consultadas
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                    <th className="pb-2 pr-6">Empresa</th>
                    <th className="pb-2 pr-4">Sector</th>
                    <th className="pb-2 pr-4 text-right">Precio</th>
                    <th className="pb-2 pr-4 text-right">Máx 52w</th>
                    <th className="pb-2 pr-4 text-right">Caída</th>
                    <th className="pb-2 pr-4 text-right">Graham #</th>
                    <th className="pb-2 pr-4 text-right">vs Graham</th>
                    <th className="pb-2 pr-4 text-right">Target</th>
                    <th className="pb-2 pr-4 text-right">Upside</th>
                    <th className="pb-2 pr-4 text-right">P/E</th>
                    <th className="pb-2 pr-4 text-right">P/B</th>
                    <th className="pb-2 pr-4 text-right">ROE</th>
                    <th className="pb-2 pr-4 text-right">D/E</th>
                    <th className="pb-2 text-right">Crec. EPS</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((s) => (
                    <tr key={s.symbol} className="border-b border-gray-800/50 hover:bg-gray-900/50 transition-colors">
                      <td className="py-3 pr-6">
                        <div className="font-bold text-white">{s.symbol}</div>
                        <div className="text-xs text-gray-400 max-w-[160px] truncate">{s.company}</div>
                      </td>
                      <td className="py-3 pr-4 text-xs text-gray-400 max-w-[100px] truncate">{s.sector}</td>
                      <td className="py-3 pr-4 text-right font-mono">${s.currentPrice.toFixed(2)}</td>
                      <td className="py-3 pr-4 text-right font-mono text-gray-400">${s.high52w.toFixed(2)}</td>
                      <td className="py-3 pr-4 text-right"><DropBadge value={s.dropFrom52w} /></td>
                      <td className="py-3 pr-4 text-right font-mono text-gray-300">
                        {s.grahamNumber > 0 ? `$${s.grahamNumber.toFixed(2)}` : "—"}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {s.grahamNumber > 0 ? <GrahamBadge value={s.discountToGraham} /> : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-gray-300">
                        {s.analystTarget > 0 ? `$${s.analystTarget.toFixed(2)}` : "—"}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {s.analystTarget > 0 ? <UpBadge value={s.upsideToTarget} /> : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono">{fmt(s.pe)}</td>
                      <td className="py-3 pr-4 text-right font-mono">{fmt(s.pb)}</td>
                      <td className="py-3 pr-4 text-right font-mono">{s.roe !== 0 ? pct(s.roe * 100) : "—"}</td>
                      <td className="py-3 pr-4 text-right font-mono">{fmt(s.debtToEquity / 100)}</td>
                      <td className="py-3 text-right font-mono">
                        {s.earningsGrowth !== 0 ? pct(s.earningsGrowth * 100) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
