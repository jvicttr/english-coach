const FEEDS = [
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", label: "World News" },
  { url: "https://feeds.bbci.co.uk/news/business/rss.xml", label: "Business & Economy" },
  { url: "https://feeds.bbci.co.uk/news/technology/rss.xml", label: "Technology" },
  { url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", label: "Entertainment" },
  { url: "https://feeds.bbci.co.uk/sport/rss.xml", label: "Sports" },
  { url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", label: "Science" },
];

function extractTitles(xml: string): string[] {
  const titles: string[] = [];
  // CDATA titles: <title><![CDATA[...]]></title>
  for (const m of xml.matchAll(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/g)) {
    const t = m[1].trim();
    if (t) titles.push(t);
  }
  // Plain titles: <title>...</title>
  if (titles.length === 0) {
    for (const m of xml.matchAll(/<title>([\s\S]*?)<\/title>/g)) {
      const t = m[1].replace(/<[^>]+>/g, "").trim();
      if (t) titles.push(t);
    }
  }
  // First title is usually the feed name — skip it
  return titles.slice(1, 4);
}

export async function fetchNewsHeadlines(): Promise<string> {
  const timeout = (ms: number) =>
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));

  const results = await Promise.allSettled(
    FEEDS.map(async ({ url, label }) => {
      const res = await Promise.race([
        fetch(url, { next: { revalidate: 1800 } }),
        timeout(3000),
      ]) as Response;
      const xml = await res.text();
      const titles = extractTitles(xml);
      return { label, titles };
    })
  );

  const lines: string[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.titles.length > 0) {
      lines.push(`[${r.value.label}] ${r.value.titles.join(" | ")}`);
    }
  }

  return lines.join("\n");
}
