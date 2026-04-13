import { NextRequest, NextResponse } from "next/server";
import { computeAnalysis } from "@/lib/gex";
import { computeAnalysis2 } from "@/lib/gex2";
import { computeAnalysis3 } from "@/lib/gex3";
import type { ExpData } from "@/lib/gex3";

// ── Yahoo Finance helpers ─────────────────────────────────────────────────────

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://finance.yahoo.com/",
};

async function getCredentials(): Promise<{ crumb: string; cookie: string }> {
  const res1 = await fetch("https://fc.yahoo.com", { headers: HEADERS, redirect: "follow" });
  const setCookie = res1.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(",").map((c) => c.split(";")[0].trim()).join("; ");
  const res2 = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
    headers: { ...HEADERS, Cookie: cookie },
  });
  if (!res2.ok) throw new Error(`Could not get crumb (${res2.status})`);
  const crumb = await res2.text();
  if (!crumb || crumb.includes("<")) throw new Error("Invalid crumb response");
  return { crumb, cookie };
}

async function fetchOptions(ticker: string, cookie: string, crumb: string, dateTs?: number) {
  const params = new URLSearchParams({ crumb });
  if (dateTs) params.set("date", String(dateTs));
  const url = `https://query2.finance.yahoo.com/v7/finance/options/${ticker}?${params}`;
  const res = await fetch(url, { headers: { ...HEADERS, Cookie: cookie }, cache: "no-store" });
  if (!res.ok) throw new Error(`Yahoo returned ${res.status}`);
  const json = await res.json();
  const result = json?.optionChain?.result?.[0];
  if (!result) throw new Error(`No options data for ${ticker}`);
  return result;
}

function extractRaw(opts: any) {
  return {
    calls: (opts?.calls ?? []).map((c: any) => ({
      strike: c.strike ?? 0,
      impliedVolatility: c.impliedVolatility ?? 0,
      openInterest: c.openInterest ?? 0,
    })),
    puts: (opts?.puts ?? []).map((p: any) => ({
      strike: p.strike ?? 0,
      impliedVolatility: p.impliedVolatility ?? 0,
      openInterest: p.openInterest ?? 0,
    })),
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConvictionRow {
  symbol: string;
  company: string;
  sector: string;
  // Descuentos
  buyScore: number;
  grade: string;
  currentPrice: number;
  dropFrom52w: number;
  grahamNumber: number;
  discountToGraham: number;
  upsideToTarget: number;
  pe: number;
  roe: number;
  // M1 — GEX / Vanna / Dealer Flow
  m1Pressure: number;       // institutionalPressure -100 a +100
  m1Support: number;
  m1Resistance: number;
  m1GammaFlip: number;
  m1NetGex: number;
  m1Pcr: number;
  // M2 — Z-Score GEX + PCR
  m2Pressure: number;       // max institutionalPressure de filteredStrikes
  m2Support: number;
  m2Resistance: number;
  // M3 — Confluencia multi-expiración
  m3Confluence: number;     // max confluenceScore
  m3SupportConf: number;    // supportConfidence 0-100
  m3ResistanceConf: number;
  m3Support: number;
  m3Resistance: number;
  // Combined
  convictionScore: number;
  verdict: "STRONG BUY" | "BUY" | "WATCH" | "NEUTRAL";
  soreBias: "BULLISH" | "BEARISH" | "NEUTRAL";
  noOptions?: boolean;
}

// ── Scoring helpers ───────────────────────────────────────────────────────────

function calcConviction(
  buyScore: number,
  m1Pressure: number,
  m2Pressure: number,
  m3Confluence: number,
  m3SupportConf: number,
  support: number,
  resistance: number,
  spot: number
): number {
  const p1 = Math.max(0, m1Pressure);          // M1 bullish pressure 0-100
  const p2 = Math.max(0, m2Pressure) * 20;     // M2 z-score normalized
  const p3 = Math.max(0, m3SupportConf);        // M3 confidence 0-100
  const confluence = support > 0 && support < spot && spot < resistance ? 100 : 0;
  return Math.min(
    100,
    buyScore * 0.40 +
    p1 * 0.20 +
    p2 * 0.15 +
    p3 * 0.15 +
    confluence * 0.10
  );
}

function toVerdict(score: number): ConvictionRow["verdict"] {
  if (score >= 75) return "STRONG BUY";
  if (score >= 60) return "BUY";
  if (score >= 45) return "WATCH";
  return "NEUTRAL";
}

function toSoreBias(m1: number, m2: number, m3conf: number): ConvictionRow["soreBias"] {
  const avg = (m1 + m2 * 20) / 2;
  if (avg > 20 || m3conf > 60) return "BULLISH";
  if (avg < -20) return "BEARISH";
  return "NEUTRAL";
}

// ── Per-ticker analysis ───────────────────────────────────────────────────────

async function analyzeTickerWithM1M2M3(
  symbol: string,
  cookie: string,
  crumb: string
) {
  // Fetch first expiration (used for M1 + M2)
  const initial = await fetchOptions(symbol, cookie, crumb);
  const spot: number = initial.quote?.regularMarketPrice;
  if (!spot) throw new Error(`No price for ${symbol}`);

  const expTimestamps: number[] = initial.expirationDates ?? [];
  const expirations = expTimestamps.map(
    (ts) => new Date(ts * 1000).toISOString().split("T")[0]
  );

  const opts0 = initial.options?.[0];
  if (!opts0) throw new Error("No options chain");
  const { calls: calls0, puts: puts0 } = extractRaw(opts0);

  // M1
  const m1 = computeAnalysis(symbol, spot, expirations[0], expirations, calls0, puts0);

  // M2 (same data)
  const m2 = computeAnalysis2(symbol, spot, expirations[0], expirations, calls0, puts0);

  // M3 — fetch up to 2 more expirations for multi-exp confluence
  const expDataList: ExpData[] = [{ expiration: expirations[0], calls: calls0, puts: puts0 }];

  const extraExps = expTimestamps.slice(1, 3); // up to 2 more
  const extraResults = await Promise.allSettled(
    extraExps.map((ts) => fetchOptions(symbol, cookie, crumb, ts))
  );
  for (let i = 0; i < extraResults.length; i++) {
    const r = extraResults[i];
    if (r.status === "fulfilled") {
      const opts = r.value.options?.[0];
      if (opts) {
        const { calls, puts } = extractRaw(opts);
        expDataList.push({ expiration: expirations[i + 1], calls, puts });
      }
    }
  }

  const m3 = computeAnalysis3(symbol, spot, expDataList);

  return { spot, m1, m2, m3 };
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const universe    = searchParams.get("universe") ?? "sp500";
  const limit       = Math.min(parseInt(searchParams.get("limit") ?? "20"), 30);
  const minBuyScore = parseInt(searchParams.get("minBuyScore") ?? "50");

  // 1. Fetch fundamental screener
  let fundamentals: any[] = [];
  try {
    const base = new URL(request.url);
    const res = await fetch(
      `${base.origin}/api/screener?universe=${universe}&limit=${limit}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("Screener fetch failed");
    fundamentals = (await res.json()).stocks ?? [];
  } catch (e: any) {
    return NextResponse.json({ error: `Screener error: ${e.message}` }, { status: 500 });
  }

  // 2. Score + filter
  const { scoreStock } = await import("@/lib/scoring");
  const scored = fundamentals
    .map((s: any) => ({ stock: s, score: scoreStock(s) }))
    .filter(({ score }) => score.buyScore >= minBuyScore)
    .sort((a, b) => b.score.buyScore - a.score.buyScore)
    .slice(0, limit);

  if (scored.length === 0) return NextResponse.json({ rows: [], total: 0 });

  // 3. Yahoo credentials (shared)
  let crumb = "", cookie = "";
  try {
    ({ crumb, cookie } = await getCredentials());
  } catch (e: any) {
    return NextResponse.json({ error: `Yahoo auth: ${e.message}` }, { status: 500 });
  }

  // 4. M1 + M2 + M3 per ticker in parallel batches
  const BATCH = 8; // smaller batch since M3 fetches 2 extra expirations
  const rows: ConvictionRow[] = [];

  for (let i = 0; i < scored.length; i += BATCH) {
    const batch = scored.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async ({ stock, score }) => {
        try {
          const { spot, m1, m2, m3 } = await analyzeTickerWithM1M2M3(
            stock.symbol, cookie, crumb
          );

          // M2 max institutional pressure from filteredStrikes
          const m2PressureMax = m2.filteredStrikes.length > 0
            ? Math.max(...m2.filteredStrikes.map((s: any) => s.institutionalPressure))
            : 0;

          // M3 max confluence score
          const m3ConfluenceMax = m3.filteredStrikes.length > 0
            ? Math.max(...m3.filteredStrikes.map((s: any) => Math.abs(s.confluenceScore)))
            : 0;

          const conviction = calcConviction(
            score.buyScore,
            m1.institutionalPressure,
            m2PressureMax,
            m3ConfluenceMax,
            m3.supportConfidence ?? 0,
            m1.levels.support,
            m1.levels.resistance,
            spot
          );

          return {
            symbol: stock.symbol,
            company: stock.company,
            sector: stock.sector ?? "—",
            buyScore: score.buyScore,
            grade: score.grade,
            currentPrice: spot,
            dropFrom52w: stock.dropFrom52w ?? 0,
            grahamNumber: stock.grahamNumber ?? 0,
            discountToGraham: stock.discountToGraham ?? 0,
            upsideToTarget: stock.upsideToTarget ?? 0,
            pe: stock.pe ?? 0,
            roe: stock.roe ?? 0,
            m1Pressure: m1.institutionalPressure,
            m1Support: m1.levels.support,
            m1Resistance: m1.levels.resistance,
            m1GammaFlip: m1.levels.gammaFlip,
            m1NetGex: m1.netGex,
            m1Pcr: m1.putCallRatio,
            m2Pressure: parseFloat(m2PressureMax.toFixed(2)),
            m2Support: m2.support,
            m2Resistance: m2.resistance,
            m3Confluence: parseFloat(m3ConfluenceMax.toFixed(2)),
            m3SupportConf: m3.supportConfidence ?? 0,
            m3ResistanceConf: m3.resistanceConfidence ?? 0,
            m3Support: m3.support,
            m3Resistance: m3.resistance,
            convictionScore: parseFloat(conviction.toFixed(1)),
            verdict: toVerdict(conviction),
            soreBias: toSoreBias(m1.institutionalPressure, m2PressureMax, m3.supportConfidence ?? 0),
          } satisfies ConvictionRow;
        } catch {
          const conviction = calcConviction(score.buyScore, 0, 0, 0, 0, 0, 0, 0);
          return {
            symbol: stock.symbol,
            company: stock.company,
            sector: stock.sector ?? "—",
            buyScore: score.buyScore,
            grade: score.grade,
            currentPrice: stock.currentPrice ?? 0,
            dropFrom52w: stock.dropFrom52w ?? 0,
            grahamNumber: stock.grahamNumber ?? 0,
            discountToGraham: stock.discountToGraham ?? 0,
            upsideToTarget: stock.upsideToTarget ?? 0,
            pe: stock.pe ?? 0,
            roe: stock.roe ?? 0,
            m1Pressure: 0, m1Support: 0, m1Resistance: 0,
            m1GammaFlip: 0, m1NetGex: 0, m1Pcr: 0,
            m2Pressure: 0, m2Support: 0, m2Resistance: 0,
            m3Confluence: 0, m3SupportConf: 0, m3ResistanceConf: 0,
            m3Support: 0, m3Resistance: 0,
            convictionScore: parseFloat(conviction.toFixed(1)),
            verdict: toVerdict(conviction),
            soreBias: "NEUTRAL",
            noOptions: true,
          } satisfies ConvictionRow;
        }
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled") rows.push(r.value);
    }
  }

  rows.sort((a, b) => b.convictionScore - a.convictionScore);
  return NextResponse.json({ rows, total: rows.length });
}
