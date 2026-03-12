import { MarketCategory } from "@/types/market";

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
  category: MarketCategory;
  symbol?: string;
  imageUrl?: string;
}

const BASE_URL = "https://eodhd.com/api";
const API_KEY = process.env.EODHD_API_KEY;

const CATEGORY_SYMBOLS: Record<string, string[]> = {
  metals: ["XAU/USD", "XAG/USD"],
  energy: ["CL"],
  forex: ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD"],
  indices: ["SPX", "IXIC"],
};

function inferCategory(text: string, symbol?: string): MarketCategory {
  const lower = text.toLowerCase();

  if (symbol) {
    for (const [cat, symbols] of Object.entries(CATEGORY_SYMBOLS)) {
      if (symbols.includes(symbol)) return cat as MarketCategory;
    }
  }

  if (lower.includes("gold") || lower.includes("xau") || lower.includes("silver") || lower.includes("xag") || lower.includes("precious metal")) {
    return "metals";
  }
  if (lower.includes("oil") || lower.includes("crude") || lower.includes("opec") || lower.includes("energy") || lower.includes("brent")) {
    return "energy";
  }
  if (lower.includes("eur/usd") || lower.includes("gbp/usd") || lower.includes("usd/jpy") || lower.includes("forex") || lower.includes("currency") || lower.includes("dollar") || lower.includes("euro") || lower.includes("yen") || lower.includes("pound")) {
    return "forex";
  }
  if (lower.includes("s&p") || lower.includes("nasdaq") || lower.includes("index") || lower.includes("indices") || lower.includes("stocks") || lower.includes("equity") || lower.includes("earnings")) {
    return "indices";
  }

  return "forex";
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 172800) return "Yesterday";
  return `${Math.floor(seconds / 86400)}d ago`;
}

export { timeAgo };

export async function getMarketNews(options?: {
  symbol?: string;
  category?: string;
  limit?: number;
}): Promise<NewsArticle[]> {
  const limit = options?.limit || 20;

  // Attempt live API fetch if key is configured
  if (API_KEY) {
    try {
      // If a specific symbol is requested, fetch just that
      if (options?.symbol) {
        const articles = await fetchLiveNews(options.symbol, limit);
        const filtered = options?.category
          ? articles.filter((a) => a.category === options.category)
          : articles;
        if (filtered.length > 0) return filtered.slice(0, limit);
      }

      // If a specific category is requested, fetch targeted news for that category
      if (options?.category) {
        const articles = await fetchNewsByCategory(options.category as MarketCategory, limit);
        if (articles.length > 0) return articles.slice(0, limit);
      }

      // No filter: fetch from multiple categories to ensure coverage
      const [metalsNews, energyNews, forexNews, indicesNews] = await Promise.all([
        fetchNewsByCategory("metals", 10).catch(() => []),
        fetchNewsByCategory("energy", 10).catch(() => []),
        fetchLiveNews(undefined, 20).catch(() => []),  // general news (mostly forex/indices)
        fetchNewsByCategory("indices", 10).catch(() => []),
      ]);

      // Merge and deduplicate by title
      const allArticles = [...metalsNews, ...energyNews, ...forexNews, ...indicesNews];
      const seen = new Set<string>();
      const unique = allArticles.filter((a) => {
        const key = a.title.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Sort by date descending
      unique.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

      // If live API returned results, use them; otherwise fall through to mock
      if (unique.length > 0) {
        return unique.slice(0, limit);
      }
      console.warn("Live news API returned 0 articles, falling back to mock data");
    } catch (error) {
      console.error("Failed to fetch live news, falling back to mock data:", error);
    }
  }

  // Fallback to mock data
  let articles = getMockNews();

  if (options?.category) {
    articles = articles.filter((a) => a.category === options.category);
  }

  if (options?.symbol) {
    articles = articles.filter((a) => a.symbol === options.symbol);
  }

  return articles.slice(0, limit);
}

// EODHD symbol mapping for news queries
const NEWS_SYMBOL_MAP: Record<string, string> = {
  "XAU/USD": "XAUUSD.FOREX",
  "XAG/USD": "XAGUSD.FOREX",
  "EUR/USD": "EURUSD.FOREX",
  "GBP/USD": "GBPUSD.FOREX",
  "USD/JPY": "USDJPY.FOREX",
  "CL": "CLUSD.FOREX",
  "SPX": "GSPC.INDX",
  "IXIC": "IXIC.INDX",
};

// Topic tags for EODHD news when no specific symbol
const CATEGORY_TAGS: Record<string, string> = {
  metals: "gold silver commodities",
  energy: "oil energy crude",
  forex: "forex currency",
  indices: "stocks market indices",
};

// Fetch news for a specific category using category-specific symbols
async function fetchNewsByCategory(category: MarketCategory, limit: number): Promise<NewsArticle[]> {
  const categorySymbols: Record<string, string[]> = {
    metals: ["XAUUSD.FOREX", "XAGUSD.FOREX"],
    energy: ["CLUSD.FOREX"],
    forex: ["EURUSD.FOREX", "GBPUSD.FOREX", "USDJPY.FOREX"],
    indices: ["GSPC.INDX", "IXIC.INDX"],
  };

  const symbols = categorySymbols[category];
  if (!symbols || symbols.length === 0) {
    return fetchLiveNews(undefined, limit);
  }

  // Fetch news for each symbol in the category and merge
  const results = await Promise.all(
    symbols.map(async (s) => {
      const params = new URLSearchParams({
        api_token: API_KEY || "",
        s,
        limit: Math.min(limit, 30).toString(),
        fmt: "json",
      });
      const url = `${BASE_URL}/news?${params}`;
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) return [];
      const data = await response.json();
      if (!Array.isArray(data)) return [];

      return data.map((item: Record<string, unknown>, index: number) => {
        const articleSymbols = item.symbols as string[] | undefined;
        const firstSymbol = articleSymbols?.[0] || undefined;
        return {
          id: `live-${category}-${s}-${index}-${Date.now()}`,
          title: (item.title as string) || "Untitled",
          description: (item.content as string)?.substring(0, 300) || (item.title as string) || "",
          source: (item.source as string) || "Unknown",
          url: (item.link as string) || "#",
          publishedAt: (item.date as string) || new Date().toISOString(),
          category: category, // Force the category since we queried for it
          symbol: firstSymbol,
          imageUrl: undefined,
        } as NewsArticle;
      });
    })
  );

  // Flatten and deduplicate
  const all = results.flat();
  const seen = new Set<string>();
  const unique = all.filter((a) => {
    const key = a.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by date
  unique.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return unique.slice(0, limit);
}

async function fetchLiveNews(symbol: string | undefined, limit: number): Promise<NewsArticle[]> {
  const params: Record<string, string> = {
    api_token: API_KEY || "",
    limit: Math.min(limit, 50).toString(),
    fmt: "json",
  };

  if (symbol) {
    const eodSymbol = NEWS_SYMBOL_MAP[symbol];
    if (eodSymbol) {
      params.s = eodSymbol;
    } else {
      params.s = symbol;
    }
  } else {
    // Fetch general financial news using a broad tag
    params.t = "market";
  }

  const searchParams = new URLSearchParams(params);
  const url = `${BASE_URL}/news?${searchParams}`;

  const response = await fetch(url, { cache: "no-store" }); // Always fetch fresh news
  if (!response.ok) {
    throw new Error(`EODHD news API error: ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("Unexpected API response format");
  }

  return data.map((item: Record<string, unknown>, index: number) => {
    const symbols = item.symbols as string[] | undefined;
    const firstSymbol = symbols?.[0] || undefined;

    return {
      id: `live-${index}-${Date.now()}`,
      title: (item.title as string) || "Untitled",
      description: (item.content as string)?.substring(0, 300) || (item.title as string) || "",
      source: (item.source as string) || "Unknown",
      url: (item.link as string) || "#",
      publishedAt: (item.date as string) || new Date().toISOString(),
      category: inferCategory((item.title as string) || "", firstSymbol),
      symbol: firstSymbol,
      imageUrl: undefined,
    };
  });
}

function getMockNews(): NewsArticle[] {
  const now = new Date();

  function hoursAgo(h: number): string {
    return new Date(now.getTime() - h * 3600 * 1000).toISOString();
  }

  return [
    {
      id: "mock-1",
      title: "Gold Surges Past $3,150 as Fed Signals Extended Pause on Rate Cuts",
      description: "Gold prices reached new all-time highs on Tuesday as Federal Reserve Chair Jerome Powell indicated the central bank is in no rush to cut interest rates further, citing persistent inflation concerns. The precious metal gained 1.8% in the session, with analysts pointing to safe-haven demand amid ongoing geopolitical tensions.",
      source: "Reuters",
      url: "https://reuters.com",
      publishedAt: hoursAgo(1),
      category: "metals",
      symbol: "XAU/USD",
    },
    {
      id: "mock-2",
      title: "Crude Oil Drops 2.3% After OPEC+ Announces Production Increase for Q2",
      description: "Oil prices fell sharply after OPEC+ members agreed to gradually increase output starting in April, adding 400,000 barrels per day to global supply. WTI crude dropped below $72 as traders weighed the impact of additional supply against uncertain demand from China's slowing economy.",
      source: "Bloomberg",
      url: "https://bloomberg.com",
      publishedAt: hoursAgo(2),
      category: "energy",
      symbol: "CL",
    },
    {
      id: "mock-3",
      title: "EUR/USD Climbs to 1.0920 Following ECB's Hawkish Hold Decision",
      description: "The euro strengthened against the dollar after the European Central Bank kept rates unchanged but struck a more hawkish tone than expected. ECB President Christine Lagarde warned that inflation risks remain tilted to the upside, pushing back against market expectations for aggressive rate cuts in H2 2026.",
      source: "Financial Times",
      url: "https://ft.com",
      publishedAt: hoursAgo(3),
      category: "forex",
      symbol: "EUR/USD",
    },
    {
      id: "mock-4",
      title: "S&P 500 Posts Best Week Since January on Strong Tech Earnings",
      description: "The S&P 500 index closed at 5,890 after a series of better-than-expected earnings reports from major technology companies. Apple and Microsoft both beat estimates, while Nvidia raised its guidance for the next quarter on surging AI chip demand. The tech-heavy rally lifted the broader market by 2.1% for the week.",
      source: "CNBC",
      url: "https://cnbc.com",
      publishedAt: hoursAgo(4),
      category: "indices",
      symbol: "SPX",
    },
    {
      id: "mock-5",
      title: "Silver Demand Hits Record on Solar Panel Manufacturing Boom",
      description: "Industrial demand for silver reached unprecedented levels in Q1 2026, driven primarily by the rapid expansion of solar panel production worldwide. The Silver Institute reported a 15% year-over-year increase in industrial consumption, with silver prices rising to $38.50 per ounce amid tightening supply conditions.",
      source: "Kitco News",
      url: "https://kitco.com",
      publishedAt: hoursAgo(6),
      category: "metals",
      symbol: "XAG/USD",
    },
    {
      id: "mock-6",
      title: "NASDAQ Composite Breaks 19,000 Barrier on AI Stock Rally",
      description: "The NASDAQ Composite surged past the 19,000 level for the first time, fueled by a broad-based rally in artificial intelligence and semiconductor stocks. Market breadth improved as mid-cap tech companies joined large-cap leaders in posting strong gains, suggesting the AI trade is broadening beyond the mega-cap names.",
      source: "MarketWatch",
      url: "https://marketwatch.com",
      publishedAt: hoursAgo(5),
      category: "indices",
      symbol: "IXIC",
    },
    {
      id: "mock-7",
      title: "GBP/USD Falls Below 1.2700 as Bank of England Cuts Rates by 25bps",
      description: "The British pound weakened sharply against the US dollar after the Bank of England delivered its second rate cut of 2026, lowering the base rate to 4.25%. Governor Andrew Bailey cited weakening consumer spending and a softening labor market as key factors behind the decision, with markets now pricing in two more cuts by year-end.",
      source: "The Guardian",
      url: "https://theguardian.com",
      publishedAt: hoursAgo(8),
      category: "forex",
      symbol: "GBP/USD",
    },
    {
      id: "mock-8",
      title: "USD/JPY Retreats from 152 After Bank of Japan Intervention Warning",
      description: "The dollar-yen pair pulled back from multi-month highs near 152 after Japan's Finance Minister Shunichi Suzuki issued a strong warning against excessive currency moves. Traders reduced long positions on the pair as speculation mounted that the Bank of Japan could intervene in currency markets if the yen continues to weaken.",
      source: "Nikkei Asia",
      url: "https://asia.nikkei.com",
      publishedAt: hoursAgo(10),
      category: "forex",
      symbol: "USD/JPY",
    },
    {
      id: "mock-9",
      title: "Oil Markets Brace for Supply Disruptions Amid Middle East Tensions",
      description: "Crude oil futures rebounded from session lows as escalating tensions in the Middle East raised concerns about potential supply disruptions. Maritime shipping routes through the Red Sea remain under pressure, with insurance premiums for tankers hitting six-month highs. Brent crude traded near $76 per barrel.",
      source: "Reuters",
      url: "https://reuters.com",
      publishedAt: hoursAgo(12),
      category: "energy",
      symbol: "CL",
    },
    {
      id: "mock-10",
      title: "Gold ETF Inflows Hit $2.8 Billion in February, Highest Since 2020",
      description: "Global gold-backed ETFs recorded their largest monthly inflow since the pandemic era, with $2.8 billion in net additions during February 2026. Central bank purchases continue to provide a strong floor for prices, with China and India leading the buying. Analysts see potential for gold to test $3,200 by mid-year.",
      source: "World Gold Council",
      url: "https://gold.org",
      publishedAt: hoursAgo(14),
      category: "metals",
      symbol: "XAU/USD",
    },
    {
      id: "mock-11",
      title: "US Dollar Index Weakens as February Jobs Report Misses Expectations",
      description: "The US Dollar Index fell 0.4% after the Bureau of Labor Statistics reported that non-farm payrolls added only 145,000 jobs in February, well below the 210,000 consensus estimate. The unemployment rate ticked up to 4.2%, fueling expectations that the Federal Reserve may need to reconsider its rate path sooner than anticipated.",
      source: "Wall Street Journal",
      url: "https://wsj.com",
      publishedAt: hoursAgo(18),
      category: "forex",
    },
    {
      id: "mock-12",
      title: "S&P 500 Financials Sector Leads Gains on Steepening Yield Curve",
      description: "Financial stocks outperformed the broader S&P 500 as the yield curve steepened to its widest level in over a year. Major banks including JPMorgan and Goldman Sachs posted gains exceeding 3% as the improving interest rate environment boosted net interest margin expectations for the coming quarters.",
      source: "Barron's",
      url: "https://barrons.com",
      publishedAt: hoursAgo(20),
      category: "indices",
      symbol: "SPX",
    },
    {
      id: "mock-13",
      title: "AUD/USD Rebounds as Australia's GDP Growth Beats Forecasts",
      description: "The Australian dollar strengthened against the greenback after the country's Q4 2025 GDP growth came in at 0.8% quarter-over-quarter, surpassing the 0.5% forecast. The Reserve Bank of Australia is now expected to hold rates steady at its next meeting, providing support for the currency pair which climbed to 0.6580.",
      source: "Sydney Morning Herald",
      url: "https://smh.com.au",
      publishedAt: hoursAgo(22),
      category: "forex",
      symbol: "AUD/USD",
    },
    {
      id: "mock-14",
      title: "Natural Gas Prices Surge 8% on Late Winter Cold Snap Forecast",
      description: "Natural gas futures spiked as weather models projected a severe cold snap across the northeastern United States through mid-March. The unexpected late-winter demand boost caught traders off guard, with storage withdrawals expected to accelerate. Henry Hub prices jumped to $4.20 per million BTU, the highest level since December.",
      source: "Energy Information Administration",
      url: "https://eia.gov",
      publishedAt: hoursAgo(24),
      category: "energy",
    },
    {
      id: "mock-15",
      title: "NASDAQ Faces Headwinds as Treasury Yields Rise Above 4.5%",
      description: "Technology stocks came under pressure as the benchmark 10-year Treasury yield climbed above 4.5% for the first time in three months. Growth stocks are particularly sensitive to rising yields as higher discount rates reduce the present value of future earnings. The NASDAQ fell 0.7% in the afternoon session, with software stocks leading the decline.",
      source: "Bloomberg",
      url: "https://bloomberg.com",
      publishedAt: hoursAgo(26),
      category: "indices",
      symbol: "IXIC",
    },
  ];
}
