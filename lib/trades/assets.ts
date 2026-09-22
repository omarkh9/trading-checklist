export type AssetClass =
  | "forex-major"
  | "forex-minor"
  | "forex-exotic"
  | "metal"
  | "energy"
  | "index"
  | "crypto"
  | "unknown";

export type Venue = "spot" | "cfd" | "futures";

export type UsdConversion = "quote-is-usd" | "base-is-usd" | "quote-to-usd";

export type AssetSpec = {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  venue: Venue;
  aliases: string[];
  baseCurrency: string;
  quoteCurrency: string;
  /** Units of the underlying controlled by 1.00 standard lot. */
  contractSize: number;
  contractUnit: string;
  /** Price increment that counts as 1 pip / point. */
  pipSize: number;
  /** Minimum quoted price increment. */
  tickSize: number;
  standardLot: number;
  miniLot: number;
  microLot: number;
  lotStep: number;
  usdConversion: UsdConversion;
  /**
   * Used only for non-USD quotes when a live quote-to-USD rate is not supplied.
   * Results that depend on this rate are marked approximate.
   */
  fallbackQuoteToUsd?: number;
};

export type ResolvedAsset = {
  spec: AssetSpec;
  recognized: boolean;
};

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  "forex-major": "Major Forex",
  "forex-minor": "Minor Forex",
  "forex-exotic": "Exotic Forex",
  metal: "Metal",
  energy: "Energy",
  index: "Index",
  crypto: "Crypto",
  unknown: "Unknown",
};

/**
 * Static quote→USD fallbacks for cross-currency P/L when no live rate exists.
 * USD-quoted and USD-base pairs never use these.
 */
const QUOTE_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.12,
  GBP: 1.3,
  JPY: 0.00675,
  CHF: 1.16,
  AUD: 0.66,
  NZD: 0.6,
  CAD: 0.73,
  CNH: 0.14,
  CNY: 0.14,
  SGD: 0.77,
  HKD: 0.128,
  SEK: 0.096,
  NOK: 0.093,
  DKK: 0.15,
  PLN: 0.26,
  HUF: 0.0029,
  CZK: 0.046,
  TRY: 0.029,
  ZAR: 0.057,
  MXN: 0.054,
  THB: 0.031,
  INR: 0.012,
  KRW: 0.00072,
  IDR: 0.000061,
  PHP: 0.017,
  SAR: 0.267,
  AED: 0.272,
  BRL: 0.19,
  CLP: 0.00105,
  COP: 0.00025,
  TWD: 0.032,
};

export function fallbackQuoteToUsd(quote: string): number | undefined {
  return QUOTE_TO_USD[quote];
}

const BROKER_SUFFIXES = [
  "MINI",
  "MICRO",
  "PERP",
  "SPOT",
  "CASH",
  "CFD",
  "PRO",
  "RAW",
  "ECN",
  "FOREX",
] as const;

export const UNKNOWN_ASSET_FALLBACK: AssetSpec = {
  symbol: "UNKNOWN",
  name: "Unrecognized instrument",
  assetClass: "unknown",
  venue: "cfd",
  aliases: [],
  baseCurrency: "",
  quoteCurrency: "USD",
  contractSize: 1,
  contractUnit: "unit",
  pipSize: 1,
  tickSize: 0.01,
  standardLot: 1,
  miniLot: 0.1,
  microLot: 0.01,
  lotStep: 0.01,
  usdConversion: "quote-is-usd",
};

function quoteToUsd(quote: string): number | undefined {
  return QUOTE_TO_USD[quote];
}

function usdConversionFor(base: string, quote: string): UsdConversion {
  if (quote === "USD" || quote === "USDT" || quote === "USDC") return "quote-is-usd";
  if (base === "USD") return "base-is-usd";
  return "quote-to-usd";
}

function fx(
  symbol: string,
  name: string,
  assetClass: Extract<AssetClass, "forex-major" | "forex-minor" | "forex-exotic">,
  aliases: string[] = [],
  overrides: Partial<AssetSpec> = {}
): AssetSpec {
  const base = overrides.baseCurrency ?? symbol.slice(0, 3);
  const quote = overrides.quoteCurrency ?? symbol.slice(3, 6);
  const jpyQuoted = quote === "JPY";
  const conversion = usdConversionFor(base, quote);

  return {
    symbol,
    name,
    assetClass,
    venue: "spot",
    aliases,
    baseCurrency: base,
    quoteCurrency: quote,
    contractSize: 100_000,
    contractUnit: base,
    pipSize: jpyQuoted ? 0.01 : 0.0001,
    tickSize: jpyQuoted ? 0.001 : 0.00001,
    standardLot: 1,
    miniLot: 0.1,
    microLot: 0.01,
    lotStep: 0.01,
    usdConversion: conversion,
    fallbackQuoteToUsd:
      conversion === "quote-to-usd" ? quoteToUsd(quote) : undefined,
    ...overrides,
  };
}

function metal(spec: Omit<AssetSpec, "assetClass" | "venue"> & Partial<Pick<AssetSpec, "venue">>): AssetSpec {
  return { assetClass: "metal", venue: spec.venue ?? "cfd", ...spec };
}

function energy(spec: Omit<AssetSpec, "assetClass" | "venue"> & Partial<Pick<AssetSpec, "venue">>): AssetSpec {
  return { assetClass: "energy", venue: spec.venue ?? "cfd", ...spec };
}

function indexSpec(spec: Omit<AssetSpec, "assetClass" | "venue"> & Partial<Pick<AssetSpec, "venue">>): AssetSpec {
  return { assetClass: "index", venue: spec.venue ?? "cfd", ...spec };
}

function crypto(spec: Omit<AssetSpec, "assetClass" | "venue"> & Partial<Pick<AssetSpec, "venue">>): AssetSpec {
  return { assetClass: "crypto", venue: spec.venue ?? "cfd", ...spec };
}

function cfdLots(
  quote: string,
  contractSize: number,
  pipSize: number,
  tickSize: number
): Pick<
  AssetSpec,
  | "contractSize"
  | "pipSize"
  | "tickSize"
  | "standardLot"
  | "miniLot"
  | "microLot"
  | "lotStep"
  | "usdConversion"
  | "fallbackQuoteToUsd"
> {
  const conversion = usdConversionFor("", quote);
  return {
    contractSize,
    pipSize,
    tickSize,
    standardLot: 1,
    miniLot: 0.1,
    microLot: 0.01,
    lotStep: 0.01,
    usdConversion: conversion,
    fallbackQuoteToUsd:
      conversion === "quote-to-usd" ? quoteToUsd(quote) : undefined,
  };
}

function futuresLots(
  quote: string,
  contractSize: number,
  pipSize: number,
  tickSize: number
): Pick<
  AssetSpec,
  | "contractSize"
  | "pipSize"
  | "tickSize"
  | "standardLot"
  | "miniLot"
  | "microLot"
  | "lotStep"
  | "usdConversion"
  | "fallbackQuoteToUsd"
> {
  const conversion = usdConversionFor("", quote);
  return {
    contractSize,
    pipSize,
    tickSize,
    standardLot: 1,
    miniLot: 1,
    microLot: 1,
    lotStep: 1,
    usdConversion: conversion,
    fallbackQuoteToUsd:
      conversion === "quote-to-usd" ? quoteToUsd(quote) : undefined,
  };
}

const FOREX_MAJORS: AssetSpec[] = [
  fx("EURUSD", "Euro / US Dollar", "forex-major", ["EUR", "EURO"]),
  fx("GBPUSD", "Pound / US Dollar", "forex-major", ["CABLE", "GU"]),
  fx("USDJPY", "US Dollar / Yen", "forex-major", ["UJ"]),
  fx("USDCHF", "US Dollar / Swiss Franc", "forex-major"),
  fx("AUDUSD", "Australian Dollar / US Dollar", "forex-major", ["AUSUSD", "AU"]),
  fx("USDCAD", "US Dollar / Canadian Dollar", "forex-major", ["LOONIE"]),
  fx("NZDUSD", "New Zealand Dollar / US Dollar", "forex-major", ["KIWI"]),
];

const FOREX_MINORS: AssetSpec[] = [
  fx("EURGBP", "Euro / Pound", "forex-minor"),
  fx("EURJPY", "Euro / Yen", "forex-minor"),
  fx("EURCHF", "Euro / Swiss Franc", "forex-minor"),
  fx("EURAUD", "Euro / Australian Dollar", "forex-minor"),
  fx("EURCAD", "Euro / Canadian Dollar", "forex-minor"),
  fx("EURNZD", "Euro / New Zealand Dollar", "forex-minor"),
  fx("GBPJPY", "Pound / Yen", "forex-minor", ["GJ", "YEN"]),
  fx("GBPCHF", "Pound / Swiss Franc", "forex-minor"),
  fx("GBPAUD", "Pound / Australian Dollar", "forex-minor"),
  fx("GBPCAD", "Pound / Canadian Dollar", "forex-minor"),
  fx("GBPNZD", "Pound / New Zealand Dollar", "forex-minor"),
  fx("AUDJPY", "Australian Dollar / Yen", "forex-minor"),
  fx("AUDNZD", "Australian Dollar / New Zealand Dollar", "forex-minor"),
  fx("AUDCAD", "Australian Dollar / Canadian Dollar", "forex-minor"),
  fx("AUDCHF", "Australian Dollar / Swiss Franc", "forex-minor"),
  fx("NZDJPY", "New Zealand Dollar / Yen", "forex-minor"),
  fx("NZDCAD", "New Zealand Dollar / Canadian Dollar", "forex-minor"),
  fx("NZDCHF", "New Zealand Dollar / Swiss Franc", "forex-minor"),
  fx("CADJPY", "Canadian Dollar / Yen", "forex-minor"),
  fx("CADCHF", "Canadian Dollar / Swiss Franc", "forex-minor"),
  fx("CHFJPY", "Swiss Franc / Yen", "forex-minor"),
];

const FOREX_EXOTICS: AssetSpec[] = [
  fx("USDTRY", "US Dollar / Turkish Lira", "forex-exotic"),
  fx("USDZAR", "US Dollar / South African Rand", "forex-exotic"),
  fx("USDMXN", "US Dollar / Mexican Peso", "forex-exotic"),
  fx("USDSEK", "US Dollar / Swedish Krona", "forex-exotic"),
  fx("USDNOK", "US Dollar / Norwegian Krone", "forex-exotic"),
  fx("USDDKK", "US Dollar / Danish Krone", "forex-exotic"),
  fx("USDPLN", "US Dollar / Polish Zloty", "forex-exotic"),
  fx("USDHUF", "US Dollar / Hungarian Forint", "forex-exotic", [], {
    pipSize: 0.01,
    tickSize: 0.001,
  }),
  fx("USDCZK", "US Dollar / Czech Koruna", "forex-exotic"),
  fx("USDTHB", "US Dollar / Thai Baht", "forex-exotic", [], {
    pipSize: 0.01,
    tickSize: 0.001,
  }),
  fx("USDSGD", "US Dollar / Singapore Dollar", "forex-exotic"),
  fx("USDHKD", "US Dollar / Hong Kong Dollar", "forex-exotic"),
  fx("USDCNH", "US Dollar / Offshore Yuan", "forex-exotic", ["USDCNY"]),
  fx("USDINR", "US Dollar / Indian Rupee", "forex-exotic", [], {
    pipSize: 0.01,
    tickSize: 0.001,
  }),
  fx("USDKRW", "US Dollar / Korean Won", "forex-exotic", [], {
    pipSize: 0.1,
    tickSize: 0.01,
  }),
  fx("USDIDR", "US Dollar / Indonesian Rupiah", "forex-exotic", [], {
    pipSize: 1,
    tickSize: 1,
  }),
  fx("USDPHP", "US Dollar / Philippine Peso", "forex-exotic", [], {
    pipSize: 0.01,
    tickSize: 0.001,
  }),
  fx("USDSAR", "US Dollar / Saudi Riyal", "forex-exotic"),
  fx("USDAED", "US Dollar / UAE Dirham", "forex-exotic"),
  fx("USDBRL", "US Dollar / Brazilian Real", "forex-exotic"),
  fx("USDCLP", "US Dollar / Chilean Peso", "forex-exotic", [], {
    pipSize: 0.1,
    tickSize: 0.01,
  }),
  fx("USDCOP", "US Dollar / Colombian Peso", "forex-exotic", [], {
    pipSize: 1,
    tickSize: 1,
  }),
  fx("USDTWD", "US Dollar / Taiwan Dollar", "forex-exotic", [], {
    pipSize: 0.01,
    tickSize: 0.001,
  }),
  fx("EURTRY", "Euro / Turkish Lira", "forex-exotic"),
  fx("EURZAR", "Euro / South African Rand", "forex-exotic"),
  fx("EURMXN", "Euro / Mexican Peso", "forex-exotic"),
  fx("EURSEK", "Euro / Swedish Krona", "forex-exotic"),
  fx("EURNOK", "Euro / Norwegian Krone", "forex-exotic"),
  fx("EURDKK", "Euro / Danish Krone", "forex-exotic"),
  fx("EURPLN", "Euro / Polish Zloty", "forex-exotic"),
  fx("EURHUF", "Euro / Hungarian Forint", "forex-exotic", [], {
    pipSize: 0.01,
    tickSize: 0.001,
  }),
  fx("EURCZK", "Euro / Czech Koruna", "forex-exotic"),
  fx("EURSGD", "Euro / Singapore Dollar", "forex-exotic"),
  fx("EURHKD", "Euro / Hong Kong Dollar", "forex-exotic"),
  fx("EURCNH", "Euro / Offshore Yuan", "forex-exotic"),
  fx("GBPSEK", "Pound / Swedish Krona", "forex-exotic"),
  fx("GBPNOK", "Pound / Norwegian Krone", "forex-exotic"),
  fx("GBPDKK", "Pound / Danish Krone", "forex-exotic"),
  fx("GBPPLN", "Pound / Polish Zloty", "forex-exotic"),
  fx("GBPZAR", "Pound / South African Rand", "forex-exotic"),
  fx("GBPSGD", "Pound / Singapore Dollar", "forex-exotic"),
  fx("GBPHKD", "Pound / Hong Kong Dollar", "forex-exotic"),
  fx("GBPTRY", "Pound / Turkish Lira", "forex-exotic"),
  fx("GBPMXN", "Pound / Mexican Peso", "forex-exotic"),
  fx("AUDSGD", "Australian Dollar / Singapore Dollar", "forex-exotic"),
  fx("NZDSGD", "New Zealand Dollar / Singapore Dollar", "forex-exotic"),
  fx("SGDJPY", "Singapore Dollar / Yen", "forex-exotic"),
  fx("TRYJPY", "Turkish Lira / Yen", "forex-exotic"),
  fx("ZARJPY", "South African Rand / Yen", "forex-exotic"),
  fx("MXNJPY", "Mexican Peso / Yen", "forex-exotic"),
];

const METALS: AssetSpec[] = [
  metal({
    symbol: "XAUUSD",
    name: "Gold / US Dollar",
    aliases: ["GOLD", "XAU", "GOLDUSD"],
    baseCurrency: "XAU",
    quoteCurrency: "USD",
    contractUnit: "oz",
    ...cfdLots("USD", 100, 0.01, 0.01),
  }),
  metal({
    symbol: "XAUEUR",
    name: "Gold / Euro",
    aliases: ["GOLDEUR"],
    baseCurrency: "XAU",
    quoteCurrency: "EUR",
    contractUnit: "oz",
    ...cfdLots("EUR", 100, 0.01, 0.01),
  }),
  metal({
    symbol: "XAUGBP",
    name: "Gold / Pound",
    aliases: ["GOLDGBP"],
    baseCurrency: "XAU",
    quoteCurrency: "GBP",
    contractUnit: "oz",
    ...cfdLots("GBP", 100, 0.01, 0.01),
  }),
  metal({
    symbol: "XAUAUD",
    name: "Gold / Australian Dollar",
    aliases: ["GOLDAUD"],
    baseCurrency: "XAU",
    quoteCurrency: "AUD",
    contractUnit: "oz",
    ...cfdLots("AUD", 100, 0.01, 0.01),
  }),
  metal({
    symbol: "XAUJPY",
    name: "Gold / Yen",
    aliases: ["GOLDJPY"],
    baseCurrency: "XAU",
    quoteCurrency: "JPY",
    contractUnit: "oz",
    ...cfdLots("JPY", 100, 1, 1),
  }),
  metal({
    symbol: "XAGUSD",
    name: "Silver / US Dollar",
    aliases: ["SILVER", "XAG", "SILVERUSD"],
    baseCurrency: "XAG",
    quoteCurrency: "USD",
    contractUnit: "oz",
    ...cfdLots("USD", 5_000, 0.001, 0.001),
  }),
  metal({
    symbol: "XAGEUR",
    name: "Silver / Euro",
    aliases: ["SILVEREUR"],
    baseCurrency: "XAG",
    quoteCurrency: "EUR",
    contractUnit: "oz",
    ...cfdLots("EUR", 5_000, 0.001, 0.001),
  }),
  metal({
    symbol: "XPTUSD",
    name: "Platinum / US Dollar",
    aliases: ["PLATINUM", "XPT"],
    baseCurrency: "XPT",
    quoteCurrency: "USD",
    contractUnit: "oz",
    ...cfdLots("USD", 100, 0.01, 0.01),
  }),
  metal({
    symbol: "XPDUSD",
    name: "Palladium / US Dollar",
    aliases: ["PALLADIUM", "XPD"],
    baseCurrency: "XPD",
    quoteCurrency: "USD",
    contractUnit: "oz",
    ...cfdLots("USD", 100, 0.01, 0.01),
  }),
  metal({
    symbol: "XCUUSD",
    name: "Copper / US Dollar",
    aliases: ["COPPER", "COPPERUSD"],
    baseCurrency: "XCU",
    quoteCurrency: "USD",
    contractUnit: "lbs",
    ...cfdLots("USD", 5_000, 0.001, 0.0001),
  }),
  metal({
    symbol: "GC",
    name: "Gold Futures",
    aliases: ["GC1", "GCF"],
    baseCurrency: "XAU",
    quoteCurrency: "USD",
    venue: "futures",
    contractUnit: "oz",
    ...futuresLots("USD", 100, 0.1, 0.1),
  }),
  metal({
    symbol: "MGC",
    name: "Micro Gold Futures",
    aliases: ["MGCM", "MICROGOLD"],
    baseCurrency: "XAU",
    quoteCurrency: "USD",
    venue: "futures",
    contractUnit: "oz",
    ...futuresLots("USD", 10, 0.1, 0.1),
  }),
  metal({
    symbol: "SI",
    name: "Silver Futures",
    aliases: ["SI1"],
    baseCurrency: "XAG",
    quoteCurrency: "USD",
    venue: "futures",
    contractUnit: "oz",
    ...futuresLots("USD", 5_000, 0.005, 0.005),
  }),
  metal({
    symbol: "SIL",
    name: "Micro Silver Futures",
    aliases: [],
    baseCurrency: "XAG",
    quoteCurrency: "USD",
    venue: "futures",
    contractUnit: "oz",
    ...futuresLots("USD", 1_000, 0.005, 0.005),
  }),
  metal({
    symbol: "HG",
    name: "Copper Futures",
    aliases: ["HG1"],
    baseCurrency: "HG",
    quoteCurrency: "USD",
    venue: "futures",
    contractUnit: "lbs",
    ...futuresLots("USD", 25_000, 0.0005, 0.0005),
  }),
];

const ENERGIES: AssetSpec[] = [
  energy({
    symbol: "USOIL",
    name: "WTI Crude Oil CFD",
    aliases: ["WTI", "WTIUSD", "CRUDE", "CRUDEOIL", "XTIUSD", "OIL"],
    baseCurrency: "WTI",
    quoteCurrency: "USD",
    contractUnit: "barrels",
    ...cfdLots("USD", 1_000, 0.01, 0.01),
  }),
  energy({
    symbol: "UKOIL",
    name: "Brent Crude Oil CFD",
    aliases: ["BRENT", "BRENTUSD", "UKOUSD", "BRENTCRUDE"],
    baseCurrency: "BRENT",
    quoteCurrency: "USD",
    contractUnit: "barrels",
    ...cfdLots("USD", 1_000, 0.01, 0.01),
  }),
  energy({
    symbol: "CL",
    name: "WTI Crude Oil Futures",
    aliases: ["CL1", "CLF"],
    baseCurrency: "WTI",
    quoteCurrency: "USD",
    venue: "futures",
    contractUnit: "barrels",
    ...futuresLots("USD", 1_000, 0.01, 0.01),
  }),
  energy({
    symbol: "MCL",
    name: "Micro WTI Crude Futures",
    aliases: [],
    baseCurrency: "WTI",
    quoteCurrency: "USD",
    venue: "futures",
    contractUnit: "barrels",
    ...futuresLots("USD", 100, 0.01, 0.01),
  }),
  energy({
    symbol: "NATGAS",
    name: "Natural Gas CFD",
    aliases: ["XNGUSD", "GAS", "NGUSD"],
    baseCurrency: "NG",
    quoteCurrency: "USD",
    contractUnit: "MMBtu",
    ...cfdLots("USD", 10_000, 0.001, 0.001),
  }),
  energy({
    symbol: "NG",
    name: "Natural Gas Futures",
    aliases: ["NG1"],
    baseCurrency: "NG",
    quoteCurrency: "USD",
    venue: "futures",
    contractUnit: "MMBtu",
    ...futuresLots("USD", 10_000, 0.001, 0.001),
  }),
  energy({
    symbol: "RB",
    name: "RBOB Gasoline Futures",
    aliases: ["RBF", "GASOLINE"],
    baseCurrency: "RB",
    quoteCurrency: "USD",
    venue: "futures",
    contractUnit: "gallons",
    ...futuresLots("USD", 42_000, 0.0001, 0.0001),
  }),
  energy({
    symbol: "HO",
    name: "Heating Oil Futures",
    aliases: ["HOF"],
    baseCurrency: "HO",
    quoteCurrency: "USD",
    venue: "futures",
    contractUnit: "gallons",
    ...futuresLots("USD", 42_000, 0.0001, 0.0001),
  }),
];

const INDICES: AssetSpec[] = [
  indexSpec({
    symbol: "US30",
    name: "Dow Jones 30 CFD",
    aliases: ["DJ30", "DJI", "DOW", "WALLSTREET", "WS30", "DJIA"],
    baseCurrency: "US30",
    quoteCurrency: "USD",
    contractUnit: "points",
    ...cfdLots("USD", 1, 1, 1),
  }),
  indexSpec({
    symbol: "NAS100",
    name: "Nasdaq 100 CFD",
    aliases: ["US100", "USTEC", "NASDAQ", "NDX", "NASDAQ100", "USTECH"],
    baseCurrency: "NAS100",
    quoteCurrency: "USD",
    contractUnit: "points",
    ...cfdLots("USD", 1, 1, 0.1),
  }),
  indexSpec({
    symbol: "SPX500",
    name: "S&P 500 CFD",
    aliases: ["US500", "SP500", "SPX", "US500CASH"],
    baseCurrency: "SPX500",
    quoteCurrency: "USD",
    contractUnit: "points",
    ...cfdLots("USD", 1, 1, 0.1),
  }),
  indexSpec({
    symbol: "US2000",
    name: "Russell 2000 CFD",
    aliases: ["RUSSELL", "RUT", "US2000CASH"],
    baseCurrency: "US2000",
    quoteCurrency: "USD",
    contractUnit: "points",
    ...cfdLots("USD", 1, 1, 0.1),
  }),
  indexSpec({
    symbol: "GER40",
    name: "Germany 40 / DAX CFD",
    aliases: ["DE40", "DAX", "DAX40", "GER30", "DE30"],
    baseCurrency: "GER40",
    quoteCurrency: "EUR",
    contractUnit: "points",
    ...cfdLots("EUR", 1, 1, 0.1),
  }),
  indexSpec({
    symbol: "UK100",
    name: "UK 100 / FTSE CFD",
    aliases: ["FTSE", "FTSE100", "UKX"],
    baseCurrency: "UK100",
    quoteCurrency: "GBP",
    contractUnit: "points",
    ...cfdLots("GBP", 1, 1, 0.1),
  }),
  indexSpec({
    symbol: "FRA40",
    name: "France 40 / CAC CFD",
    aliases: ["FR40", "CAC", "CAC40"],
    baseCurrency: "FRA40",
    quoteCurrency: "EUR",
    contractUnit: "points",
    ...cfdLots("EUR", 1, 1, 0.1),
  }),
  indexSpec({
    symbol: "EU50",
    name: "Euro Stoxx 50 CFD",
    aliases: ["ESTX50", "STOXX50", "SX5E", "EUSTX50"],
    baseCurrency: "EU50",
    quoteCurrency: "EUR",
    contractUnit: "points",
    ...cfdLots("EUR", 1, 1, 0.1),
  }),
  indexSpec({
    symbol: "JPN225",
    name: "Japan 225 / Nikkei CFD",
    aliases: ["JP225", "NIKKEI", "NI225", "J225", "NKY"],
    baseCurrency: "JPN225",
    quoteCurrency: "USD",
    contractUnit: "points",
    ...cfdLots("USD", 1, 1, 1),
  }),
  indexSpec({
    symbol: "AUS200",
    name: "Australia 200 CFD",
    aliases: ["AU200", "ASX200", "XJO"],
    baseCurrency: "AUS200",
    quoteCurrency: "AUD",
    contractUnit: "points",
    ...cfdLots("AUD", 1, 1, 1),
  }),
  indexSpec({
    symbol: "HK50",
    name: "Hong Kong 50 / Hang Seng CFD",
    aliases: ["HK33", "HSI", "HANGSENG", "HKG50"],
    baseCurrency: "HK50",
    quoteCurrency: "HKD",
    contractUnit: "points",
    ...cfdLots("HKD", 1, 1, 1),
  }),
  indexSpec({
    symbol: "SPA35",
    name: "Spain 35 / IBEX CFD",
    aliases: ["ES35", "IBEX", "IBEX35"],
    baseCurrency: "SPA35",
    quoteCurrency: "EUR",
    contractUnit: "points",
    ...cfdLots("EUR", 1, 1, 1),
  }),
  indexSpec({
    symbol: "IT40",
    name: "Italy 40 / MIB CFD",
    aliases: ["ITA40", "MIB", "FTMIB"],
    baseCurrency: "IT40",
    quoteCurrency: "EUR",
    contractUnit: "points",
    ...cfdLots("EUR", 1, 1, 1),
  }),
  indexSpec({
    symbol: "CHI50",
    name: "China A50 CFD",
    aliases: ["CHINA50", "CH50", "CN50"],
    baseCurrency: "CHI50",
    quoteCurrency: "USD",
    contractUnit: "points",
    ...cfdLots("USD", 1, 1, 1),
  }),
  indexSpec({
    symbol: "VIX",
    name: "Volatility Index CFD",
    aliases: ["VOLX", "VIXCASH"],
    baseCurrency: "VIX",
    quoteCurrency: "USD",
    contractUnit: "points",
    ...cfdLots("USD", 1, 0.01, 0.01),
  }),
  indexSpec({
    symbol: "NETH25",
    name: "Netherlands 25 / AEX CFD",
    aliases: ["AEX", "NL25"],
    baseCurrency: "NETH25",
    quoteCurrency: "EUR",
    contractUnit: "points",
    ...cfdLots("EUR", 1, 0.01, 0.01),
  }),
  indexSpec({
    symbol: "SWI20",
    name: "Switzerland 20 / SMI CFD",
    aliases: ["SMI", "CH20"],
    baseCurrency: "SWI20",
    quoteCurrency: "CHF",
    contractUnit: "points",
    ...cfdLots("CHF", 1, 1, 1),
  }),
  indexSpec({
    symbol: "ES",
    name: "E-mini S&P 500",
    aliases: ["ES1", "ESH", "ESM", "ESU", "ESZ"],
    baseCurrency: "SPX",
    quoteCurrency: "USD",
    venue: "futures",
    contractUnit: "points",
    ...futuresLots("USD", 50, 0.25, 0.25),
  }),
  indexSpec({
    symbol: "MES",
    name: "Micro E-mini S&P 500",
    aliases: ["MES1"],
    baseCurrency: "SPX",
    quoteCurrency: "USD",
    venue: "futures",
    contractUnit: "points",
    ...futuresLots("USD", 5, 0.25, 0.25),
  }),
  indexSpec({
    symbol: "NQ",
    name: "E-mini Nasdaq 100",
    aliases: ["NQ1"],
    baseCurrency: "NDX",
    quoteCurrency: "USD",
    venue: "futures",
    contractUnit: "points",
    ...futuresLots("USD", 20, 0.25, 0.25),
  }),
  indexSpec({
    symbol: "MNQ",
    name: "Micro E-mini Nasdaq 100",
    aliases: ["MNQ1"],
    baseCurrency: "NDX",
    quoteCurrency: "USD",
    venue: "futures",
    contractUnit: "points",
    ...futuresLots("USD", 2, 0.25, 0.25),
  }),
  indexSpec({
    symbol: "YM",
    name: "E-mini Dow",
    aliases: ["YM1"],
    baseCurrency: "DJIA",
    quoteCurrency: "USD",
    venue: "futures",
    contractUnit: "points",
    ...futuresLots("USD", 5, 1, 1),
  }),
  indexSpec({
    symbol: "MYM",
    name: "Micro E-mini Dow",
    aliases: ["MYM1"],
    baseCurrency: "DJIA",
    quoteCurrency: "USD",
    venue: "futures",
    contractUnit: "points",
    ...futuresLots("USD", 0.5, 1, 1),
  }),
  indexSpec({
    symbol: "RTY",
    name: "E-mini Russell 2000",
    aliases: ["RTY1"],
    baseCurrency: "RUT",
    quoteCurrency: "USD",
    venue: "futures",
    contractUnit: "points",
    ...futuresLots("USD", 50, 0.1, 0.1),
  }),
  indexSpec({
    symbol: "M2K",
    name: "Micro E-mini Russell 2000",
    aliases: ["M2K1"],
    baseCurrency: "RUT",
    quoteCurrency: "USD",
    venue: "futures",
    contractUnit: "points",
    ...futuresLots("USD", 5, 0.1, 0.1),
  }),
];

const CRYPTOS: AssetSpec[] = [
  crypto({
    symbol: "BTCUSD",
    name: "Bitcoin / US Dollar",
    aliases: ["BTC", "XBTUSD", "XBT", "BITCOIN", "BTCUSDT", "BTCUSDC"],
    baseCurrency: "BTC",
    quoteCurrency: "USD",
    contractUnit: "BTC",
    ...cfdLots("USD", 1, 1, 0.01),
    microLot: 0.001,
    lotStep: 0.001,
  }),
  crypto({
    symbol: "ETHUSD",
    name: "Ethereum / US Dollar",
    aliases: ["ETH", "ETHEREUM", "ETHUSDT", "ETHUSDC"],
    baseCurrency: "ETH",
    quoteCurrency: "USD",
    contractUnit: "ETH",
    ...cfdLots("USD", 1, 0.01, 0.01),
  }),
  crypto({
    symbol: "SOLUSD",
    name: "Solana / US Dollar",
    aliases: ["SOL", "SOLUSDT"],
    baseCurrency: "SOL",
    quoteCurrency: "USD",
    contractUnit: "SOL",
    ...cfdLots("USD", 1, 0.01, 0.01),
  }),
  crypto({
    symbol: "XRPUSD",
    name: "XRP / US Dollar",
    aliases: ["XRP", "XRPUSDT"],
    baseCurrency: "XRP",
    quoteCurrency: "USD",
    contractUnit: "XRP",
    ...cfdLots("USD", 1, 0.0001, 0.0001),
  }),
  crypto({
    symbol: "ADAUSD",
    name: "Cardano / US Dollar",
    aliases: ["ADA", "ADAUSDT"],
    baseCurrency: "ADA",
    quoteCurrency: "USD",
    contractUnit: "ADA",
    ...cfdLots("USD", 1, 0.0001, 0.0001),
  }),
  crypto({
    symbol: "DOGEUSD",
    name: "Dogecoin / US Dollar",
    aliases: ["DOGE", "DOGEUSDT"],
    baseCurrency: "DOGE",
    quoteCurrency: "USD",
    contractUnit: "DOGE",
    ...cfdLots("USD", 1, 0.00001, 0.00001),
  }),
  crypto({
    symbol: "LTCUSD",
    name: "Litecoin / US Dollar",
    aliases: ["LTC", "LTCUSDT"],
    baseCurrency: "LTC",
    quoteCurrency: "USD",
    contractUnit: "LTC",
    ...cfdLots("USD", 1, 0.01, 0.01),
  }),
  crypto({
    symbol: "BNBUSD",
    name: "BNB / US Dollar",
    aliases: ["BNB", "BNBUSDT"],
    baseCurrency: "BNB",
    quoteCurrency: "USD",
    contractUnit: "BNB",
    ...cfdLots("USD", 1, 0.01, 0.01),
  }),
  crypto({
    symbol: "AVAXUSD",
    name: "Avalanche / US Dollar",
    aliases: ["AVAX", "AVAXUSDT"],
    baseCurrency: "AVAX",
    quoteCurrency: "USD",
    contractUnit: "AVAX",
    ...cfdLots("USD", 1, 0.01, 0.01),
  }),
  crypto({
    symbol: "DOTUSD",
    name: "Polkadot / US Dollar",
    aliases: ["DOT", "DOTUSDT"],
    baseCurrency: "DOT",
    quoteCurrency: "USD",
    contractUnit: "DOT",
    ...cfdLots("USD", 1, 0.001, 0.001),
  }),
  crypto({
    symbol: "LINKUSD",
    name: "Chainlink / US Dollar",
    aliases: ["LINK", "LINKUSDT"],
    baseCurrency: "LINK",
    quoteCurrency: "USD",
    contractUnit: "LINK",
    ...cfdLots("USD", 1, 0.001, 0.001),
  }),
  crypto({
    symbol: "MATICUSD",
    name: "Polygon / US Dollar",
    aliases: ["MATIC", "MATICUSDT", "POLUSD", "POL"],
    baseCurrency: "MATIC",
    quoteCurrency: "USD",
    contractUnit: "MATIC",
    ...cfdLots("USD", 1, 0.0001, 0.0001),
  }),
  crypto({
    symbol: "ATOMUSD",
    name: "Cosmos / US Dollar",
    aliases: ["ATOM", "ATOMUSDT"],
    baseCurrency: "ATOM",
    quoteCurrency: "USD",
    contractUnit: "ATOM",
    ...cfdLots("USD", 1, 0.001, 0.001),
  }),
  crypto({
    symbol: "UNIUSD",
    name: "Uniswap / US Dollar",
    aliases: ["UNI", "UNIUSDT"],
    baseCurrency: "UNI",
    quoteCurrency: "USD",
    contractUnit: "UNI",
    ...cfdLots("USD", 1, 0.001, 0.001),
  }),
  crypto({
    symbol: "BCHUSD",
    name: "Bitcoin Cash / US Dollar",
    aliases: ["BCH", "BCHUSDT"],
    baseCurrency: "BCH",
    quoteCurrency: "USD",
    contractUnit: "BCH",
    ...cfdLots("USD", 1, 0.01, 0.01),
  }),
  crypto({
    symbol: "NEARUSD",
    name: "NEAR / US Dollar",
    aliases: ["NEAR", "NEARUSDT"],
    baseCurrency: "NEAR",
    quoteCurrency: "USD",
    contractUnit: "NEAR",
    ...cfdLots("USD", 1, 0.001, 0.001),
  }),
  crypto({
    symbol: "APTUSD",
    name: "Aptos / US Dollar",
    aliases: ["APT", "APTUSDT"],
    baseCurrency: "APT",
    quoteCurrency: "USD",
    contractUnit: "APT",
    ...cfdLots("USD", 1, 0.001, 0.001),
  }),
  crypto({
    symbol: "SUIUSD",
    name: "Sui / US Dollar",
    aliases: ["SUI", "SUIUSDT"],
    baseCurrency: "SUI",
    quoteCurrency: "USD",
    contractUnit: "SUI",
    ...cfdLots("USD", 1, 0.0001, 0.0001),
  }),
  crypto({
    symbol: "TONUSD",
    name: "Toncoin / US Dollar",
    aliases: ["TON", "TONUSDT"],
    baseCurrency: "TON",
    quoteCurrency: "USD",
    contractUnit: "TON",
    ...cfdLots("USD", 1, 0.001, 0.001),
  }),
];

export const ASSET_LIST: AssetSpec[] = [
  ...FOREX_MAJORS,
  ...FOREX_MINORS,
  ...FOREX_EXOTICS,
  ...METALS,
  ...ENERGIES,
  ...INDICES,
  ...CRYPTOS,
];

export const ASSET_SPECS: Record<string, AssetSpec> = Object.fromEntries(
  ASSET_LIST.map((asset) => [asset.symbol, asset])
);

const LOOKUP = new Map<string, AssetSpec>();

for (const spec of ASSET_LIST) {
  LOOKUP.set(spec.symbol, spec);
  for (const alias of spec.aliases) {
    LOOKUP.set(normalizeSymbol(alias), spec);
  }
}

export function normalizeSymbol(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function stripBrokerSuffix(symbol: string): string {
  for (const suffix of BROKER_SUFFIXES) {
    if (symbol.endsWith(suffix) && symbol.length > suffix.length) {
      return symbol.slice(0, -suffix.length);
    }
  }

  if (symbol.endsWith("M") && symbol.length >= 7) {
    const stripped = symbol.slice(0, -1);
    if (LOOKUP.has(stripped)) return stripped;
  }

  return symbol;
}

export function getAssetSpec(symbol: string): AssetSpec | null {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return null;

  const direct = LOOKUP.get(normalized);
  if (direct) return direct;

  const stripped = stripBrokerSuffix(normalized);
  return LOOKUP.get(stripped) ?? null;
}

export function resolveAsset(symbol: string): ResolvedAsset {
  const spec = getAssetSpec(symbol);
  if (spec) return { spec, recognized: true };

  const normalized = normalizeSymbol(symbol);
  return {
    spec: {
      ...UNKNOWN_ASSET_FALLBACK,
      symbol: normalized || UNKNOWN_ASSET_FALLBACK.symbol,
    },
    recognized: false,
  };
}

export function getAssetsByClass(assetClass: AssetClass): AssetSpec[] {
  return ASSET_LIST.filter((asset) => asset.assetClass === assetClass);
}

export function listKnownSymbols(): string[] {
  return ASSET_LIST.map((asset) => asset.symbol);
}

export function pipValueInQuote(spec: AssetSpec): number {
  return spec.contractSize * spec.pipSize;
}

export function unitsForLotSize(spec: AssetSpec, lots: number): number {
  return spec.contractSize * lots;
}
