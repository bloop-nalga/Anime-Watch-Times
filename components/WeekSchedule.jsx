"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/* Toggle this if you use /pages/api/schedule.js */
const USE_PROXY = true;

/* ---------- Helpers: EST week math & formatting ---------- */
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function toEST(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric", hour12: false,
  }).formatToParts(date).reduce((acc, p) => { if (p.type !== "literal") acc[p.type] = p.value; return acc; }, {});
  return new Date(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
}

function estSundayStart(nowMs, weekOffset) {
  const estNow = toEST(new Date(nowMs));
  const sunday = new Date(estNow.getFullYear(), estNow.getMonth(), estNow.getDate() - estNow.getDay());
  sunday.setDate(sunday.getDate() + weekOffset * 7);
  return Math.floor(sunday.getTime() / 1000);
}

function estWeekdayNameFromEpoch(airingAtSec) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long" })
    .format(new Date(airingAtSec * 1000));
}

function shortMonthDay(baseUnixSec, dayIndex) {
  const d = new Date((baseUnixSec + dayIndex * 86400) * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ---------- Slug helpers ---------- */
function slugifyTitle(title) {
  return (title || "untitled")
    .toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
function makeSlug({ id, title }) { return `${slugifyTitle(title)}-${id}`; }

/* ---------- AniList GraphQL ---------- */
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
}`;

async function fetchChunk(from, to, signal) {
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { from, to } }),
    signal,
  });
  if (!res.ok) throw new Error("AniList error");
  const j = await res.json();
  return j?.data?.Page?.airingSchedules || [];
}

/* ---------- Client cache / Abort / Prefetch ---------- */
const weekCache = new Map();  // weekStart -> Promise<entries[]>
const inflight = new Map();   // weekStart -> AbortController

async function fetchWeekRawDirect(weekOffset, signal) {
  const weekStart = estSundayStart(Date.now(), weekOffset);
  const s0 = weekStart, e3 = s0 + 4 * 86400, s4 = s0 + 4 * 86400, e6 = s0 + 6 * 86400 + 86399;
  const [a, b] = await Promise.all([fetchChunk(s0, e3, signal), fetchChunk(s4, e6, signal)]);
  return { entries: [...a, ...b], weekStart };
}
async function fetchWeekRawViaProxy(weekOffset, signal) {
  const r = await fetch(`/api/schedule?offset=${weekOffset}`, { signal });
  if (!r.ok) throw new Error("Proxy error");
  const j = await r.json();
  return { entries: j.entries, weekStart: j.weekStart };
}

function fetchWeek(weekOffset) {
  const weekStart = estSundayStart(Date.now(), weekOffset);
  if (weekCache.has(weekStart)) return weekCache.get(weekStart);

  const prev = inflight.get(weekStart); if (prev) prev.abort();
  const controller = new AbortController(); inflight.set(weekStart, controller);
  const raw = USE_PROXY ? fetchWeekRawViaProxy : fetchWeekRawDirect;

  const p = raw(weekOffset, controller.signal)
    .then(({ entries }) => { inflight.delete(weekStart); return entries; })
    .catch(e => { inflight.delete(weekStart); throw e; });

  weekCache.set(weekStart, p);
  return p;
}

function prefetchWeek(offset) {
  const ws = estSundayStart(Date.now(), offset);
  if (weekCache.has(ws)) return;
  const run = () => { fetchWeek(offset).catch(() => { }); };
  if (typeof requestIdleCallback !== "undefined") requestIdleCallback(run, { timeout: 800 }); else setTimeout(run, 200);
}

/* ---------- Group by day & combine same‑day eps ---------- */
function combineByDay(entries, weekOffset) {
  const weekStart = estSundayStart(Date.now(), weekOffset);
  const byDay = Object.fromEntries(WEEKDAYS.map(d => [d, {}]));

  for (const e of entries) {
    const day = estWeekdayNameFromEpoch(e.airingAt);
    const id = e.media.id;
    const title = e.media.title.english || e.media.title.romaji || "Untitled";
    const timeLocal = new Date(e.airingAt * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const ex = byDay[day][id];
    if (!ex) {
      byDay[day][id] = {
        id, title, image: e.media.coverImage.large,
        firstEp: e.episode, lastEp: e.episode, timeLocal,
        score: e.media.averageScore || 0, trending: e.media.trending || 0, popularity: e.media.popularity || 0,
      };
    } else {
      ex.firstEp = Math.min(ex.firstEp, e.episode);
      ex.lastEp = Math.max(ex.lastEp, e.episode);
      if (timeLocal < ex.timeLocal) ex.timeLocal = timeLocal;
    }
  }

  const sortShows = (a, b) =>
    b.score === a.score ? (b.trending === a.trending ? b.popularity - a.popularity : b.trending - a.trending) : b.score - a.score;

  const out = {}; WEEKDAYS.forEach(d => { out[d] = Object.values(byDay[d]).sort(sortShows); });
  return { data: out, weekStart };
}

/* ---------- Component ---------- */
export default function WeekSchedule() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [weekStart, setWeekStart] = useState(null);

  const todayESTIndex = useMemo(() => toEST(new Date()).getDay(), []);
  const [openDays, setOpenDays] = useState(() => new Set([todayESTIndex]));

  useEffect(() => {
    let mounted = true;
    setLoading(true); setError(null);

    fetchWeek(weekOffset)
      .then(entries => {
        if (!mounted) return;
        const { data: grouped, weekStart } = combineByDay(entries, weekOffset);
        setData(grouped);
        setWeekStart(weekStart);
        setOpenDays(weekOffset === 0 ? new Set([todayESTIndex]) : new Set());
        prefetchWeek(weekOffset + 1);
        prefetchWeek(weekOffset - 1);
      })
      .catch(() => mounted && setError("Failed to load anime schedule."))
      .finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
  }, [weekOffset, todayESTIndex]);

  const clampOffset = (next) => (next < -3 || next > 3 ? weekOffset : next);

  return (
    <div className="wrap">
      <div className="fullBleed">
        {/* Top controls */}
        <div className="nav">
          <button className="navBtn" onClick={() => setWeekOffset(w => clampOffset(w - 1))}>Past Week</button>
          <button className="navBtn" onClick={() => setWeekOffset(w => clampOffset(w + 1))}>Next Week</button>
        </div>

        {loading && <p className="status">Loading…</p>}
        {error && <p className="status error">{error}</p>}

        {!loading && !error && data && weekStart !== null && (
          <div className="days">
            {WEEKDAYS.map((day, i) => {
              const isOpen = openDays.has(i);
              const shows = data[day];
              const displayDate = shortMonthDay(weekStart, i);
              const isToday = weekOffset === 0 && i === todayESTIndex;

              return (
                <div className="day" key={day}>
                  <button
                    className={"dayHeader" + (isToday ? " current" : "")}
                    onClick={() =>
                    setOpenDays(prev => {
                      const next = new Set(prev);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      return next;
                    })
                    }
                    aria-expanded={isOpen}
                    aria-controls={`panel-${i}`}
                  >
                    <span className="title">{day} – {displayDate}</span>
                    <span className={"arrow" + (isOpen ? " open" : "")}>▼</span>
                  </button>

                  <div id={`panel-${i}`} className={`dayPanel${isOpen ? " open" : ""}`}>
                    <div className="panelInner">
                      {/* ===== exact grid behavior from AWT-UI:DesignOnly.html ===== */}
                      <div className="grid">
                        {shows.map(s => {
                          const ep = s.firstEp === s.lastEp ? `Ep ${s.firstEp}` : `Ep ${s.firstEp}–${s.lastEp}`;
                          const slug = makeSlug({ id: s.id, title: s.title });
                          return (
                            <Link key={s.id} href={`/anime/${slug}`} legacyBehavior>
                              <a className="card">
                                <div className="posterWrap">
                                  <img src={s.image} alt={s.title} />
                                </div>
                                <div className={"titleText" + (s.title.length > 35 ? " long" : "")}>{s.title}</div>
                                <div className="meta">{ep} – {s.timeLocal}</div>
                              </a>
                            </Link>
                          );
                        })}
                        {shows.length === 0 && <div className="empty">No shows scheduled.</div>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------- Styles (copied to match AWT-UI:DesignOnly.html) ---------- */}
      <style jsx>{`
  :global(body) {
    margin: 0; background: #000; color: #fff;
    -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
    font-family: Arial, sans-serif;
  }

  /* Top nav */
  .nav { display:flex; justify-content:space-between; padding:1rem; background:#1a1a1a; position:sticky; top:0; z-index:5; }
  .nav button { background:#bee7e8; color:#000; font-weight:bold; border:none; border-radius:4px; padding:.5rem 1rem; cursor:pointer; }

  .status { text-align:center; padding:1rem; color:#bee7e8; }
  .status.error { color:#ff6b6b; }

  /* Weekday headers */
  .day { width:100%; }
  .dayHeader{
    -webkit-appearance:none; appearance:none; border:0; border-radius:0;
    width:100%; display:flex; justify-content:space-between; align-items:center;
    padding:14px 16px; background:#111; color:#bee7e8; text-align:left; cursor:pointer;
    border-bottom:1px solid #333; font-weight:500; font-size:17px; letter-spacing:.2px;
  }
  .dayHeader.current { background:coral !important; color:#000; }
  .arrow { transition: transform .3s ease; }
  .arrow.open { transform: rotate(180deg); }

  .dayPanel { display:none; background:#121212; padding:12px; }
  .dayPanel.open { display:block; }

  /* ===== Slightly smaller tiles to match the UI more closely ===== */
  .grid {
    display:grid;
    grid-template-columns: repeat(auto-fill, 96px);  /* was 100px */
    gap: 6px;
    align-items: stretch;         /* row height = tallest card */
    justify-content: start;
  }

  /* Cards */
  .card, .card:link, .card:visited, .card:hover, .card:active { text-decoration:none; color:inherit; }
  .card {
    width:100%;
    height:100%;
    background:#1e1e1e;
    border:1px solid #2a2a2a;
    border-radius:6px;
    padding:5px;
    box-sizing:border-box;
    display:flex;
    flex-direction:column;
  }

  .posterWrap {
    width:100%;
    height:136px;                 /* was 140px; slightly smaller */
    border-radius:4px;
    overflow:hidden;
    background:#0d0d0d;
    flex:0 0 auto;
  }
  .posterWrap img { width:100%; height:100%; object-fit:cover; display:block; border-radius:0; }

  /* Title */
  .titleText {
    color:#fff !important;
    font-size:0.83em;             /* slightly smaller for compact tiles */
    line-height:1.2em;
    margin:8px 4px 2px;
    word-break:break-word;
    flex:0 0 auto;
    text-align:center;
  }
  .titleText.long { font-size:0.76em; line-height:1.18em; }

  /* Ep / Time: stack neatly under title; AM/PM centered under the first line */
  .meta {
    font-size:0.74em;
    color:#ccc;
    line-height:1.15em;
    margin:0 4px 4px;
    text-align:center;

    /* allow wrapping (no ellipsis) and keep centered */
    white-space: normal;          /* wrap to 2 lines if needed */
    overflow: visible;
    text-overflow: clip;

    display:flex;                 /* center multi-line vertically */
    flex-direction: column;
    align-items: center;
    gap: 0;                        /* lines sit snugly */
    flex:0 0 auto;                 /* stays directly under the title */
  }

  /* Slightly larger on wider screens while keeping proportions */
  @media (min-width: 640px) {
    .grid { grid-template-columns: repeat(auto-fill, 106px); gap: 7px; }
    .posterWrap { height:146px; }
  }
  @media (min-width: 900px) {
    .grid { grid-template-columns: repeat(auto-fill, 116px); gap: 8px; }
    .posterWrap { height:160px; }
  }
`}</style>
    </div>
  );
}
