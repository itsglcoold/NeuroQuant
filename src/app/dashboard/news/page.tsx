"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Newspaper, Search, ExternalLink, Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { type NewsArticle, timeAgo } from "@/lib/market/news";
import type { MarketCategory } from "@/types/market";

const CATEGORY_TABS = [
  { key: "all", label: "All Markets" },
  { key: "metals", label: "Metals" },
  { key: "energy", label: "Energy" },
  { key: "forex", label: "Forex" },
  { key: "indices", label: "Indices" },
] as const;

const CATEGORY_BADGE_STYLES: Record<MarketCategory, string> = {
  metals: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  energy: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  forex: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  indices: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20",
};

const CATEGORY_LABELS: Record<MarketCategory, string> = {
  metals: "Metals",
  energy: "Energy",
  forex: "Forex",
  indices: "Indices",
};

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchNews = useCallback(async (tab: string) => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (tab !== "all") {
        params.set("category", tab);
      }
      const url = `/api/news?${params}`;
      console.log("[News] Fetching:", url);
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        console.log("[News] Got", (data.data || []).length, "articles for tab:", tab);
        setArticles(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch news:", error);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchNews(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredArticles = useMemo(() => {
    // No need to filter by category — the API already returns the right category
    if (!searchQuery.trim()) return articles;

    const query = searchQuery.toLowerCase();
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(query) ||
        a.description.toLowerCase().includes(query) ||
        a.source.toLowerCase().includes(query) ||
        (a.symbol && a.symbol.toLowerCase().includes(query))
    );
  }, [articles, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Market News
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stay informed with the latest market-moving news
          </p>
        </div>
        <button
          onClick={() => fetchNews(activeTab)}
          disabled={refreshing}
          className={cn(
            "flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            refreshing && "pointer-events-none opacity-50"
          )}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Category tabs */}
        <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); void fetchNews(tab.key); }}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === tab.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search news..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none sm:w-64"
          />
        </div>
      </div>

      {/* News content */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <NewsCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16">
          <Newspaper className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            {searchQuery
              ? "No news articles match your search"
              : "No news articles available for this category"}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredArticles.map((article) => (
            <NewsCard key={article.id} article={article} />
          ))}
        </div>
      )}

      {/* Article count */}
      {!loading && filteredArticles.length > 0 && (
        <p className="text-center text-xs text-muted-foreground/60">
          Showing {filteredArticles.length} article{filteredArticles.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

function NewsCard({ article }: { article: NewsArticle }) {
  return (
    <article className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-all hover:border-border/80 hover:bg-accent">
      {/* Top row: category badge + time */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            CATEGORY_BADGE_STYLES[article.category]
          )}
        >
          {CATEGORY_LABELS[article.category]}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
          <Clock className="h-3 w-3" />
          {timeAgo(article.publishedAt)}
        </span>
      </div>

      {/* Headline */}
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex items-start gap-1 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-foreground"
      >
        <span className="line-clamp-2 flex-1">{article.title}</span>
        <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" />
      </a>

      {/* Description */}
      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
        {article.description}
      </p>

      {/* Bottom row: source + symbol */}
      <div className="mt-auto flex items-center gap-2 pt-3">
        <span className="text-[11px] font-medium text-muted-foreground">
          {article.source}
        </span>
        {article.symbol && (
          <>
            <span className="text-muted-foreground/40">&middot;</span>
            <span className="inline-flex items-center rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground">
              {article.symbol}
            </span>
          </>
        )}
      </div>
    </article>
  );
}

function NewsCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        <div className="h-3 w-12 animate-pulse rounded bg-muted" />
      </div>
      <div className="mt-3 h-5 w-full animate-pulse rounded bg-muted" />
      <div className="mt-1 h-5 w-3/4 animate-pulse rounded bg-muted" />
      <div className="mt-3 space-y-1.5">
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        <div className="h-4 w-14 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
