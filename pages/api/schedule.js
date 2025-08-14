// pages/api/schedule.js

// API: /api/schedule?offset=0|±1|±2|...
// Returns { weekStart, entries } where entries = AniList airingSchedules for the EST week.

export default async function handler(req, res) {
  try {
    const offset = parseInt(req.query.offset || "0", 10);

    // ---- EST helpers (match client logic) ----
    const toEST = (date) => {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: false,
      })
        .formatToParts(date)
        .reduce((acc, p) => {
          if (p.type !== "literal") acc[p.type] = p.value;
          return acc;
        }, {});
      return new Date(
        +parts.year,
        +parts.month - 1,
        +parts.day,
        +parts.hour,
        +parts.minute,
        +parts.second
      );
    };

    const now = Date.now();
    const estNow = toEST(new Date(now));
    const sunday = new Date(
      estNow.getFullYear(),
      estNow.getMonth(),
      estNow.getDate() - estNow.getDay()
    );
    sunday.setDate(sunday.getDate() + offset * 7);
    const weekStart = Math.floor(sunday.getTime() / 1000); // unix seconds

    const s0 = weekStart;
    const e3 = s0 + 4 * 86400; // Sun..Wed
    const s4 = s0 + 4 * 86400; // Thu..Sat
    const e6 = s0 + 6 * 86400 + 86399;

    // ---- AniList GraphQL ----
    const QUERY = `
      query ($from: Int, $to: Int) {
        Page(perPage: 100) {
          airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
            airingAt
            episode
            media {
              id
              title { romaji english }
              coverImage { large }
              averageScore
              trending
              popularity
            }
          }
        }
      }
    `;

    const q = async (from, to) => {
      const r = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query: QUERY, variables: { from, to } }),
      });
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(`AniList error: ${r.status} ${text}`);
      }
      const j = await r.json();
      return j?.data?.Page?.airingSchedules || [];
    };

    const [a, b] = await Promise.all([q(s0, e3), q(s4, e6)]);
    const entries = [...a, ...b];

    // Edge caching: 1h fresh, serve stale for a day while revalidating
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json({ weekStart, entries });
  } catch (e) {
    console.error("Schedule API failed:", e?.message || e);
    res.status(500).json({ error: "schedule_failed" });
  }
}
