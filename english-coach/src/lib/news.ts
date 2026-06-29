import { createClient } from "@supabase/supabase-js";

const FEEDS = [
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", label: "World News" },
  { url: "https://feeds.bbci.co.uk/news/business/rss.xml", label: "Business & Economy" },
  { url: "https://feeds.bbci.co.uk/news/technology/rss.xml", label: "Technology" },
  { url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", label: "Entertainment" },
  { url: "https://feeds.bbci.co.uk/sport/football/rss.xml", label: "Football/Soccer" },
  { url: "https://feeds.bbci.co.uk/sport/rss.xml", label: "Sports" },
  { url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", label: "Science" },
  { url: "https://feeds.bbci.co.uk/news/politics/rss.xml", label: "Politics" },
];

function extractTitles(xml: string): string[] {
  const titles: string[] = [];
  for (const m of xml.matchAll(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/g)) {
    const t = m[1].trim();
    if (t) titles.push(t);
  }
  if (titles.length === 0) {
    for (const m of xml.matchAll(/<title>([\s\S]*?)<\/title>/g)) {
      const t = m[1].replace(/<[^>]+>/g, "").trim();
      if (t) titles.push(t);
    }
  }
  return titles.slice(1, 6);
}

async function fetchLiveHeadlines(): Promise<{ label: string; titles: string[] }[]> {
  const timeout = (ms: number) =>
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));

  const results = await Promise.allSettled(
    FEEDS.map(async ({ url, label }) => {
      const res = await Promise.race([
        fetch(url, { cache: "no-store" }),
        timeout(4000),
      ]) as Response;
      const xml = await res.text();
      return { label, titles: extractTitles(xml) };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<{ label: string; titles: string[] }> =>
      r.status === "fulfilled" && r.value.titles.length > 0
    )
    .map(r => r.value);
}

// Save today's live headlines to Supabase (called by cron and as fallback)
export async function saveHeadlinesToDB(): Promise<void> {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
  const today = new Date().toISOString().split("T")[0];

  const feeds = await fetchLiveHeadlines();
  if (feeds.length === 0) return;

  await supabase.from("news_headlines").upsert(
    feeds.map(({ label, titles }) => ({
      date: today,
      category: label,
      titles,
    })),
    { onConflict: "date,category" }
  );
}

// Fetch headlines from Supabase for the last 30 days, grouped by date
export async function fetchNewsHeadlines(): Promise<string> {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
  const today = new Date().toISOString().split("T")[0];
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data } = await supabase
    .from("news_headlines")
    .select("date, category, titles")
    .gte("date", since)
    .order("date", { ascending: false });

  // If today has no rows yet, fetch live and save
  const hasTodayRows = data?.some(r => r.date === today);
  if (!hasTodayRows) {
    try {
      await saveHeadlinesToDB();
      const { data: fresh } = await supabase
        .from("news_headlines")
        .select("date, category, titles")
        .gte("date", since)
        .order("date", { ascending: false });
      return formatHeadlines(fresh ?? []);
    } catch {
      // DB save failed — fall back to live feed only
      const feeds = await fetchLiveHeadlines();
      return feeds.map(({ label, titles }) => `[${label}] ${titles.join(" | ")}`).join("\n");
    }
  }

  return formatHeadlines(data ?? []);
}

function formatHeadlines(rows: { date: string; category: string; titles: string[] }[]): string {
  if (rows.length === 0) return "";

  // Group by date, most recent first
  const byDate = new Map<string, Map<string, string[]>>();
  for (const row of rows) {
    if (!byDate.has(row.date)) byDate.set(row.date, new Map());
    byDate.get(row.date)!.set(row.category, row.titles);
  }

  const lines: string[] = [];
  for (const [date, categories] of byDate) {
    lines.push(`--- ${date} ---`);
    for (const [category, titles] of categories) {
      lines.push(`[${category}] ${titles.join(" | ")}`);
    }
  }

  return lines.join("\n");
}
