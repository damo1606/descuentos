// Perfiles sectoriales basados en datos empíricos de Damodaran (enero 2024)
// Fuente: pages.stern.nyu.edu/~adamodar/
//
// Breakpoints: [terrible, mediocre, bueno, excelente] → output [0, 25, 65, 100]
// Todos los valores en % (ej: 40 = 40%)

export type SectorConfig = {
  label: string
  yahooNames: string[]
  moatType: string           // Tipo de moat dominante en el sector
  capRange: string           // Rango típico del CAP (años de ventaja sostenible)
  // Breakpoints de márgenes (en %)
  grossMarginBp:     [number, number, number, number]
  operatingMarginBp: [number, number, number, number]
  netMarginBp:       [number, number, number, number]
  // Breakpoints de retorno de capital (en %)
  roicBp:            [number, number, number, number]
  roeBp:             [number, number, number, number]
  // Pesos del pilar Moat para este sector (deben sumar 1.0)
  grossMarginWeight:     number
  operatingMarginWeight: number
  netMarginWeight:       number
}

const SECTORS: SectorConfig[] = [
  {
    label: "Tecnología",
    yahooNames: ["Technology"],
    moatType: "Switching costs + Network effects",
    capRange: "10–20 años",
    // Software puro → márgenes muy altos. Gross > 65% = excelente
    grossMarginBp:     [20, 45, 65, 85],
    operatingMarginBp: [ 0, 10, 22, 35],
    netMarginBp:       [ 0,  8, 18, 30],
    // ROIC alto porque requiere poco capital físico
    roicBp:            [ 0,  8, 18, 35],
    roeBp:             [ 0, 10, 22, 40],
    grossMarginWeight:     0.45,
    operatingMarginWeight: 0.35,
    netMarginWeight:       0.20,
  },
  {
    label: "Salud",
    yahooNames: ["Healthcare"],
    moatType: "Patentes + Aprobación regulatoria (FDA/EMA)",
    capRange: "7–20 años (vida útil de patente)",
    // Farma tiene márgenes altos protegidos por patentes
    grossMarginBp:     [20, 45, 65, 85],
    operatingMarginBp: [ 0, 10, 20, 32],
    netMarginBp:       [ 0,  8, 16, 28],
    roicBp:            [ 0,  6, 14, 28],
    roeBp:             [ 0, 10, 20, 35],
    // Operating margin pesa igual que gross — R&D es clave
    grossMarginWeight:     0.40,
    operatingMarginWeight: 0.40,
    netMarginWeight:       0.20,
  },
  {
    label: "Servicios Financieros",
    yahooNames: ["Financial Services"],
    moatType: "Escala + Regulación + Red de distribución",
    capRange: "10–20 años",
    // Gross margin no aplica igual — NIM (net interest margin) es la métrica real
    // Usamos como proxy pero con peso muy bajo
    grossMarginBp:     [ 0, 20, 40, 60],
    operatingMarginBp: [ 0, 15, 28, 40],
    netMarginBp:       [ 0, 12, 22, 35],
    // Bancos tienen ROIC/ROE estructuralmente más bajos — usan mucho apalancamiento
    roicBp:            [ 0,  6, 12, 20],
    roeBp:             [ 0,  8, 14, 22],
    // Operating y net margin pesan más que gross en financieros
    grossMarginWeight:     0.15,
    operatingMarginWeight: 0.45,
    netMarginWeight:       0.40,
  },
  {
    label: "Consumo Defensivo",
    yahooNames: ["Consumer Defensive"],
    moatType: "Marca + Distribución masiva + Hábito del consumidor",
    capRange: "20–50 años",
    // Coca-Cola, P&G: márgenes menores que software pero extremadamente estables
    grossMarginBp:     [15, 28, 42, 60],
    operatingMarginBp: [ 0,  8, 15, 24],
    netMarginBp:       [ 0,  5, 12, 20],
    roicBp:            [ 0,  8, 15, 28],
    roeBp:             [ 0, 12, 22, 40],
    grossMarginWeight:     0.45,
    operatingMarginWeight: 0.35,
    netMarginWeight:       0.20,
  },
  {
    label: "Consumo Cíclico",
    yahooNames: ["Consumer Cyclical"],
    moatType: "Marca + Escala de distribución",
    capRange: "5–15 años",
    // Retail/autos: márgenes más ajustados, más sensibles al ciclo económico
    grossMarginBp:     [10, 22, 38, 55],
    operatingMarginBp: [ 0,  6, 12, 20],
    netMarginBp:       [ 0,  4,  9, 16],
    roicBp:            [ 0,  6, 12, 22],
    roeBp:             [ 0, 10, 20, 35],
    grossMarginWeight:     0.40,
    operatingMarginWeight: 0.40,
    netMarginWeight:       0.20,
  },
  {
    label: "Industrial",
    yahooNames: ["Industrials"],
    moatType: "Cost advantage + Escala operativa + Contratos a largo plazo",
    capRange: "5–15 años",
    // Manufactura/defensa: márgenes medianos pero predecibles
    grossMarginBp:     [10, 22, 35, 50],
    operatingMarginBp: [ 0,  7, 14, 22],
    netMarginBp:       [ 0,  5, 10, 18],
    roicBp:            [ 0,  7, 14, 24],
    roeBp:             [ 0, 10, 18, 30],
    // Operating margin pesa más — eficiencia operativa es el driver
    grossMarginWeight:     0.35,
    operatingMarginWeight: 0.45,
    netMarginWeight:       0.20,
  },
  {
    label: "Energía",
    yahooNames: ["Energy"],
    moatType: "Recursos naturales + Integración vertical",
    capRange: "Variable — depende del ciclo commodity",
    // Márgenes muy cíclicos — un año bueno no significa moat
    grossMarginBp:     [10, 22, 38, 55],
    operatingMarginBp: [ 0,  8, 16, 25],
    netMarginBp:       [ 0,  5, 12, 20],
    roicBp:            [ 0,  5, 12, 20],
    roeBp:             [ 0,  8, 16, 28],
    grossMarginWeight:     0.35,
    operatingMarginWeight: 0.45,
    netMarginWeight:       0.20,
  },
  {
    label: "Comunicaciones",
    yahooNames: ["Communication Services"],
    moatType: "Network effects + Switching costs + Contenido exclusivo",
    capRange: "10–25 años",
    // Google, Meta, Netflix: márgenes altos por escala digital
    grossMarginBp:     [15, 35, 55, 75],
    operatingMarginBp: [ 0, 10, 22, 35],
    netMarginBp:       [ 0,  8, 18, 30],
    roicBp:            [ 0,  7, 15, 28],
    roeBp:             [ 0, 10, 20, 35],
    grossMarginWeight:     0.45,
    operatingMarginWeight: 0.35,
    netMarginWeight:       0.20,
  },
  {
    label: "Utilities",
    yahooNames: ["Utilities"],
    moatType: "Efficient scale + Concesión regulada por el Estado",
    capRange: "20–40 años (duración de la concesión)",
    // Negocio regulado: márgenes predecibles pero ROIC bajo por activos intensivos
    grossMarginBp:     [10, 25, 38, 52],
    operatingMarginBp: [ 0, 12, 22, 32],
    netMarginBp:       [ 0,  7, 14, 22],
    // ROIC estructuralmente bajo — no penalizar igual que software
    roicBp:            [ 0,  3,  7, 12],
    roeBp:             [ 0,  6, 11, 16],
    grossMarginWeight:     0.30,
    operatingMarginWeight: 0.50,
    netMarginWeight:       0.20,
  },
  {
    label: "Materiales",
    yahooNames: ["Basic Materials"],
    moatType: "Cost advantage + Acceso privilegiado a recursos",
    capRange: "Variable — ciclo commodity",
    // Commodities: márgenes bajos y cíclicos
    grossMarginBp:     [ 5, 18, 30, 45],
    operatingMarginBp: [ 0,  8, 16, 25],
    netMarginBp:       [ 0,  5, 10, 18],
    roicBp:            [ 0,  5, 12, 20],
    roeBp:             [ 0,  8, 16, 28],
    grossMarginWeight:     0.35,
    operatingMarginWeight: 0.45,
    netMarginWeight:       0.20,
  },
  {
    label: "Inmobiliario",
    yahooNames: ["Real Estate"],
    moatType: "Efficient scale + Ubicación + Contratos de arrendamiento largos",
    capRange: "15–30 años",
    // REITs: márgenes razonables pero ROIC bajo por intensidad de activos
    grossMarginBp:     [10, 28, 42, 60],
    operatingMarginBp: [ 0, 15, 28, 42],
    netMarginBp:       [ 0, 10, 20, 32],
    roicBp:            [ 0,  3,  7, 12],
    roeBp:             [ 0,  5, 10, 16],
    grossMarginWeight:     0.30,
    operatingMarginWeight: 0.50,
    netMarginWeight:       0.20,
  },
]

// Config por defecto cuando el sector no está mapeado
const DEFAULT: SectorConfig = {
  label: "General",
  yahooNames: [],
  moatType: "Indeterminado",
  capRange: "Indeterminado",
  grossMarginBp:     [15, 30, 50, 70],
  operatingMarginBp: [ 0, 10, 22, 35],
  netMarginBp:       [ 0,  8, 18, 30],
  roicBp:            [ 0,  7, 15, 28],
  roeBp:             [ 0, 10, 20, 35],
  grossMarginWeight:     0.45,
  operatingMarginWeight: 0.35,
  netMarginWeight:       0.20,
}

export function getSectorConfig(sector: string): SectorConfig {
  return SECTORS.find(s => s.yahooNames.includes(sector)) ?? DEFAULT
}
