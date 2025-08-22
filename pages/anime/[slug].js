import Head from "next/head";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

function slugifyTitle(t) {
  return (t || "untitled")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
function makeSlug({ id, title }) {
  return `${slugifyTitle(title)}-${id}`;
}

export default function AnimeDetail({ anime, id }) {
  const title =
    anime?.title?.english ||
    anime?.title?.romaji ||
    anime?.title?.native ||
    "Unknown";

  const epNum = anime?.nextAiringEpisode?.episode ?? null;
  const secondsToAir = anime?.nextAiringEpisode?.timeUntilAiring ?? null;

  function useCountdown(secondsFromNow) {
    const target = secondsFromNow ? Date.now() + secondsFromNow * 1000 : null;
    const [remain, setRemain] = useState(() =>
      target ? Math.max(0, Math.floor((target - Date.now()) / 1000)) : 0
    );
    useEffect(() => {
      if (!target) return;
      const t = setInterval(() => {
        setRemain((s) => Math.max(0, Math.floor((target - Date.now()) / 1000)));
      }, 1000);
      return () => clearInterval(t);
    }, [target]);
    const d = Math.floor(remain / 86400);
    const h = Math.floor((remain % 86400) / 3600);
    const m = Math.floor((remain % 3600) / 60);
    const s = remain % 60;
    return { d, h, m, s, has: Boolean(target) };
  }

  const cd = useCountdown(secondsToAir);

    const titleScale = useMemo(() => {
  const t = (title || "").trim();
  const len = t.length;
  const longest = t.split(/\s+/).reduce((m, w) => Math.max(m, w.length), 0);
  let s = 1;
  if (len > 64) s = 0.72;
  else if (len > 56) s = 0.78;
  else if (len > 48) s = 0.86;
  else if (len > 40) s = 0.94;
  if (longest >= 10) s *= 0.95;
  if (longest >= 12) s *= 0.90;
  return s;
}, [title]);

  const bgImg = anime?.bannerImage || anime?.coverImage?.extraLarge || "";

    const router = useRouter();
    const [backBusy, setBackBusy] = useState(false);
    const goBack = () => {
      if (backBusy) return;
      setBackBusy(true);
      router.back();
      setTimeout(() => setBackBusy(false), 650);
    };

  const siteMap = {
    Crunchyroll: "crunchyroll",
    Netflix: "netflix",
    Hulu: "hulu",
    "Amazon Prime Video": "primevideo",
    Amazon: "primevideo",
    "Disney Plus": "disneyplus",
    "Disney+": "disneyplus",
    HIDIVE: "hidive",
    "Apple TV": "appletv",
  };

  const streaming = useMemo(() => {
    const links = [];
    const seen = new Set();
    const add = (site, url) => {
      const k = siteMap[site];
      if (!k || seen.has(k)) return;
      seen.add(k);
      links.push({ key: k, site, url });
    };
    (anime?.externalLinks || []).forEach((l) => add(l.site, l.url));
    (anime?.streamingEpisodes || []).forEach((l) => add(l.site, l.url));
    return links;
  }, [anime]);

  const genres = (anime?.genres || []).join(", ");
  const studio =
    anime?.studios?.nodes?.[0]?.name ||
    anime?.studios?.edges?.[0]?.node?.name ||
    "";

  return (
    <>
      <Head>
        <title>{title} • Anime Watch Times</title>
        <meta name="description" content={`Countdown, where to watch, and info for ${title}.`} />
      </Head>

      <div className="page awt-detail">
        <div className="bg" style={{ backgroundImage: `url(${bgImg})` }} />



        <main className="wrap">
          <section className="headerGrid">
            <button type="button" className="back" onClick={goBack} disabled={backBusy}>
            ← Back to schedule
            </button>
            <div className="card posterCard">
              {anime?.coverImage?.extraLarge && (
                <Image
                  src={anime.coverImage.extraLarge}
                  alt={`${title} poster`}
                  width={520}
                  height={780}
                  className="poster"
                  priority
                />
              )}
            </div>

            <div className="card infoCard">
              <h1 className="title" style={{ "--title-scale": titleScale }}>{title}</h1>
              <div className="subtitle">
                {epNum ? `Ep. ${epNum}` : anime?.episodes ? `Ep. ${anime.episodes}` : ""}
              </div>

              <div className="countdownLabel">Countdown</div>
              <div className="countdown">
                {cd.has ? (
                  <>
                    {cd.d}d {cd.h}h {cd.m}m {cd.s}s
                  </>
                ) : (
                  "No upcoming episode"
                )}
              </div>
            </div>
          </section>

          <section className="card streamCard">
            <div className="sectionTitle">Streaming on</div>
            <div className="badges">
              {streaming.length === 0 ? (
                <div className="muted">No official streaming links listed.</div>
              ) : (
                streaming.map((s) => (
                  <a
                    key={s.key}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="badge"
                    aria-label={s.site}
                    title={s.site}
                  >
                    <img src={`/brands/${s.key}.svg`} alt={s.site} />
                  </a>
                ))
              )}
            </div>
          </section>

          {anime?.description && (
            <section className="card">
              <div className="sectionTitle">Summary</div>
              <p className="desc">{stripTags(anime.description)}</p>
            </section>
          )}

          <section className="card">
            <div className="sectionTitle">Details</div>
            <ul className="details">
              <li>
                <strong>Format:</strong> {anime?.format || "—"}
              </li>
              <li>
                <strong>Status:</strong> {anime?.status || "—"}
              </li>
              <li>
                <strong>Genres:</strong> {genres || "—"}
              </li>
              <li>
                <strong>Studio:</strong> {studio || "—"}
              </li>
              <li>
                <strong>Source:</strong>{" "}
                <a href={`https://anilist.co/anime/${id}`} target="_blank" rel="noreferrer">
                  AniList
                </a>
              </li>
            </ul>
          </section>
        </main>
      </div>
      
      {/* Ratings & Stats */}
{(anime?.averageScore || anime?.meanScore || anime?.popularity || anime?.favourites || (anime?.rankings?.length || 0) > 0) && (
  <section className="card">
    <div className="sectionTitle">Ratings & Stats</div>
    <div className="statGrid">
      {typeof anime?.averageScore === "number" && (
        <div className="stat"><div className="statNum">{anime.averageScore}</div><div className="statLbl">Average</div></div>
      )}
      {typeof anime?.meanScore === "number" && (
        <div className="stat"><div className="statNum">{anime.meanScore}</div><div className="statLbl">Mean</div></div>
      )}
      {typeof anime?.popularity === "number" && (
        <div className="stat"><div className="statNum">{anime.popularity.toLocaleString()}</div><div className="statLbl">Popularity</div></div>
      )}
      {typeof anime?.favourites === "number" && (
        <div className="stat"><div className="statNum">{anime.favourites.toLocaleString()}</div><div className="statLbl">Favourites</div></div>
      )}
    </div>
    {(anime?.rankings?.length || 0) > 0 && (
      <ul className="rankList">
        {anime.rankings.slice(0, 4).map((r, idx) => (
          <li key={idx}>#{r.rank} {r.context}</li>
        ))}
      </ul>
    )}
  </section>
)}

{/* Trailer */}
{anime?.trailer?.id && (() => {
  const site = (anime.trailer.site || "").toLowerCase();
  const src = site === "youtube"
    ? `https://www.youtube.com/embed/${anime.trailer.id}?rel=0`
    : site === "vimeo"
    ? `https://player.vimeo.com/video/${anime.trailer.id}`
    : null;
  return src ? (
    <section className="card">
      <div className="sectionTitle">Trailer</div>
      <div className="trailerWrap">
        <iframe
          className="trailer"
          src={src}
          title="Trailer"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </section>
  ) : null;
})()}

{/* Characters & Voice */}
{(anime?.characters?.edges?.length || 0) > 0 && (
  <section className="card">
    <div className="sectionTitle">Characters & Voice</div>
    <div className="hscroll">
      {anime.characters.edges.slice(0, 16).map((ed, i) => {
        const c = ed?.node;
        const va = ed?.voiceActors?.[0];
        return (
          <div className="chipTall" key={(c?.id || i) + "-char"}>
            <img className="chipImg" src={c?.image?.large} alt={c?.name?.full || "Character"} />
            <div className="chipName">{c?.name?.full || "—"}</div>
            {va && <div className="chipSub">{va.name?.full}</div>}
          </div>
        );
      })}
    </div>
  </section>
)}

{/* Staff */}
{(anime?.staff?.edges?.length || 0) > 0 && (
  <section className="card">
    <div className="sectionTitle">Staff</div>
    <div className="hscroll">
      {anime.staff.edges
        .filter(ed => /Director|Composition|Script|Music|Creator|Design/i.test(ed?.role || ""))
        .slice(0, 16)
        .map((ed, i) => (
          <div className="chipTall" key={(ed?.node?.id || i) + "-staff"}>
            <img className="chipImg" src={ed?.node?.image?.large} alt={ed?.node?.name?.full || "Staff"} />
            <div className="chipName">{ed?.node?.name?.full || "—"}</div>
            <div className="chipSub">{ed?.role || ""}</div>
          </div>
        ))}
    </div>
  </section>
)}

{/* Related Entries */}
{(anime?.relations?.edges?.length || 0) > 0 && (
  <section className="card">
    <div className="sectionTitle">Related</div>
    <div className="relatedGrid">
      {anime.relations.edges
        .filter(e => e?.node?.type === "ANIME")
        .slice(0, 12)
        .map((e, i) => {
          const n = e.node;
          const relTitle = n?.title?.english || n?.title?.romaji || "Untitled";
          const slug = makeSlug({ id: n.id, title: relTitle });
          return (
            <a key={(n?.id || i) + "-rel"} className="relCard" href={`/anime/${slug}`} title={relTitle}>
              <img src={n?.coverImage?.large} alt={relTitle} />
              <div className="relMeta">
                <div className="relTitle">{relTitle}</div>
                <div className="relType">{e?.relationType || ""}</div>
              </div>
            </a>
          );
        })}
    </div>
  </section>
)}

{/* Recommendations */}
{(anime?.recommendations?.nodes?.length || 0) > 0 && (
  <section className="card">
    <div className="sectionTitle">Recommendations</div>
    <div className="relatedGrid">
      {anime.recommendations.nodes.slice(0, 12).map((r, i) => {
        const m = r?.mediaRecommendation;
        const recTitle = m?.title?.english || m?.title?.romaji || "Untitled";
        const slug = makeSlug({ id: m?.id, title: recTitle });
        return (
          <a key={(m?.id || i) + "-rec"} className="relCard" href={`/anime/${slug}`} title={recTitle}>
            <img src={m?.coverImage?.large} alt={recTitle} />
            <div className="relMeta">
              <div className="relTitle">{recTitle}</div>
              <div className="relType">Rating {r?.rating ?? "—"}</div>
            </div>
          </a>
        );
      })}
    </div>
  </section>
)}

    {/* Tags & Content Notices */}
    {(anime?.tags?.length || 0) > 0 && (
      <section className="card">
        <div className="sectionTitle">Tags & Notices</div>
        <div className="chipRow">
          {anime.tags.slice(0, 16).map((t, i) => (
            <span key={t?.name || i} className="tagChip">{t?.name}</span>
          ))}
        </div>
        {anime.tags.some(t => t.isAdult || t.isGeneralSpoiler || t.isMediaSpoiler) && (
          <div className="notices">
            {anime.tags.filter(t => t.isAdult || t.isGeneralSpoiler || t.isMediaSpoiler).map((t, i) => (
              <span key={t?.name || i} className="noticeChip">{t?.name}</span>
            ))}
          </div>
        )}
      </section>
    )}

    {/* Episode Previews */}
    {(anime?.streamingEpisodes?.length || 0) > 0 && (
      <section className="card">
        <div className="sectionTitle">Episode Previews</div>
        <div className="gallery">
          {anime.streamingEpisodes.slice(0, 12).map((e, i) => (
            <a key={(e?.url || i) + "-ep"} href={e?.url || "#"} target="_blank" rel="noopener noreferrer" className="thumb">
              <img src={e?.thumbnail} alt={e?.title || "Episode"} />
              <div className="thumbTitle">{e?.title || ""}</div>
            </a>
          ))}
        </div>
      </section>
    )}

    {/* Official & External Links */}
    {(() => {
      const streamingNames = new Set(Object.keys(siteMap));
      const others = (anime?.externalLinks || []).filter(l => !streamingNames.has(l.site));
      return others.length ? (
        <section className="card">
          <div className="sectionTitle">Official & External</div>
          <div className="chipRow">
            {others.map((l, i) => (
              <a key={(l?.url || i) + "-ext"} href={l.url} target="_blank" rel="noopener noreferrer" className="extChip">
                {l.site}
              </a>
            ))}
            <a href={`https://anilist.co/anime/${id}`} target="_blank" rel="noreferrer" className="extChip">AniList</a>
          </div>
        </section>
      ) : (
        <section className="card">
          <div className="sectionTitle">Official & External</div>
          <div className="chipRow">
            <a href={`https://anilist.co/anime/${id}`} target="_blank" rel="noreferrer" className="extChip">AniList</a>
          </div>
        </section>
      );
    })()}

          <style jsx>{`
  :global(:root) {
    --link-blue: hsl(210deg 100% 80%);
    --gutter: 12px;
  }

  .page { position: relative; min-height: 100vh; color:#fff; overflow-x:hidden; }
  .bg { position:fixed; inset:0; background-size:cover; background-position:center;
        filter:blur(6.5px) brightness(0.6); transform:scale(1.05); z-index:-1; }

  .wrap {
    --side-pad: clamp(20px, 5vw, 28px);
    max-width:1060px;
    margin:12px auto 64px;
    padding:0 var(--side-pad) 32px;
    box-sizing:border-box;
  }
  @supports (padding:max(0px)) {
    .wrap {
      --safe-left: env(safe-area-inset-left);
      --safe-right: env(safe-area-inset-right);
      padding-left:max(var(--side-pad), var(--safe-left));
      padding-right:max(var(--side-pad), var(--safe-right));
    }
  }

  /* Cards */
  .card {
    background: rgba(255,255,255,0.06);
    border: 1px solid #56c9ff;
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 0 0 1px rgba(86,201,255,0.25), 0 10px 30px rgba(0,0,0,0.35);
    margin: 0 0 var(--gutter);     /* <-- gives every tile its own gap */
  }
  
  .headerGrid .card { margin: 0; }

  .infoCard { min-width:0; }
  .infoCard .title { overflow-wrap:anywhere; word-break:break-word; }

  .topbar { display:none; }

  .headerGrid {
    display:grid;
    grid-template-columns:minmax(220px,40%) minmax(0,1fr);
    grid-template-rows:auto 1fr;
    gap:16px;
    align-items:start;
    margin-top:12px;
    margin-bottom: var(--gutter);
  }
  @media (min-width:700px){ .headerGrid{ grid-template-columns:260px 1fr; } }

  .back{
    grid-column:1; grid-row:1;
    justify-self:start; align-self:center;
    display:inline-flex; align-items:center; gap:8px;
    padding:8px 14px; border:1px solid #56c9ff; border-radius:999px;
    background:rgba(255,255,255,0.06); color:var(--link-blue);
    text-decoration:none; font-weight:600; -webkit-tap-highlight-color:transparent; cursor:pointer;
  }
  .back[disabled]{ opacity:.6; pointer-events:none; }

  .posterCard{
    grid-column:1; grid-row:2;
    overflow:hidden; border-radius:16px;
    display:flex; justify-content:center; align-items:center;
  }
  .poster{ width:100%; height:auto; display:block; border-radius:16px; }
  .posterCard :global(img){ border-radius:16px; display:block; }

  .infoCard{ grid-column:2; grid-row:2; min-width:0; }
  .infoCard .title{
    margin:4px 0 0; font-weight:800;
    font-size:clamp(24px, calc(3.9vw * var(--title-scale)), 44px);
    line-height:1.06; text-transform:uppercase;
    overflow-wrap:break-word; word-break:keep-all; hyphens:auto; text-wrap:balance;
    padding-right:6px; letter-spacing:-0.01em;
  }
  .subtitle{ margin-top:6px; color:#cfefff; opacity:.9; font-weight:600; }
  .countdownLabel{ margin-top:18px; font-weight:700; letter-spacing:.02em; color:#cfefff; opacity:.9; }
  .countdown{ margin-top:6px; font-size:clamp(20px,4.2vw,36px); font-weight:800; }

  .sectionTitle{ font-weight:800; margin-bottom:10px; letter-spacing:.02em; }
  .badges{ display:flex; flex-wrap:wrap; gap:10px 12px; }
  .badge{ display:inline-flex; align-items:center; justify-content:center; padding:6px 10px;
          border:1px solid #56c9ff; border-radius:999px; background:rgba(0,0,0,0.5); text-decoration:none; }
  .badge img{ height:22px; width:auto; display:block; }

  .desc{ white-space:pre-wrap; line-height:1.6; }
  .details{ margin:0; padding-left:18px; line-height:1.8; }
  .details strong{ color:#cfefff; }

  .page :global(a),
  .page :global(a:visited),
  .page :global(a:active),
  .page :global(a:hover){
    color:var(--link-blue) !important;
    text-decoration:none !important;
    border-bottom:0 !important;
    -webkit-tap-highlight-color:transparent;
    font-weight:600;
  }

  /* New tiles */
  .statGrid{ display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:12px; margin-bottom:8px; }
  .stat{ text-align:center; padding:8px 6px; border-radius:12px; background:rgba(0,0,0,0.35); }
  .statNum{ font-size:26px; font-weight:800; line-height:1; }
  .statLbl{ opacity:.85; margin-top:4px; font-weight:600; }
  .rankList{ margin:8px 0 0; padding-left:18px; }
  .rankList li{ line-height:1.6; }

  .trailerWrap{ position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:12px; background:#000; }
  .trailerWrap .trailer{ position:absolute; inset:0; width:100%; height:100%; border:0; }

  .hscroll{ display:grid; grid-auto-flow:column; grid-auto-columns:minmax(120px,140px); gap:12px; overflow-x:auto; padding-bottom:6px; }
  .chipTall{ background:rgba(0,0,0,0.35); border:1px solid #56c9ff; border-radius:12px; padding:8px; text-align:center; }
  .chipImg{ width:100%; height:160px; object-fit:cover; border-radius:8px; display:block; }
  .chipName{ font-weight:700; margin-top:6px; }
  .chipSub{ opacity:.85; font-size:13px; margin-top:2px; }

  .relatedGrid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:12px; }
  .relCard{ display:flex; flex-direction:column; text-decoration:none; color:inherit; border:1px solid #56c9ff; border-radius:12px; overflow:hidden; background:rgba(0,0,0,0.35); }
  .relCard img{ width:100%; height:180px; object-fit:cover; display:block; }
  .relMeta{ padding:8px; }
  .relTitle{ font-weight:700; line-height:1.25; }
  .relType{ opacity:.85; font-size:12px; margin-top:2px; }

  .chipRow{ display:flex; flex-wrap:wrap; gap:8px 10px; }
  .tagChip,.noticeChip,.extChip{ display:inline-flex; align-items:center; padding:6px 10px; border:1px solid #56c9ff; border-radius:999px; background:rgba(0,0,0,0.5); text-decoration:none; }
  .extChip{ color:var(--link-blue); font-weight:600; }

  .gallery{ display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:10px; }
  .thumb{ display:flex; flex-direction:column; color:inherit; text-decoration:none; border:1px solid #56c9ff; border-radius:12px; overflow:hidden; background:rgba(0,0,0,0.35); }
  .thumb img{ width:100%; height:100px; object-fit:cover; display:block; }
  .thumbTitle{ padding:8px; font-size:13px; line-height:1.25; }
`}</style>
    </>
  );
}

function stripTags(s) {
  return String(s).replace(/<\/?[^>]*>/g, "");
}

export async function getStaticPaths() {
  return { paths: [], fallback: "blocking" };
}

export async function getStaticProps({ params }) {
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const match = slug && slug.match(/-(\d+)$/);
  const id = match ? parseInt(match[1], 10) : null;

  if (!id) return { notFound: true, revalidate: 60 };

  const query = `
  query ($id:Int) {
    Media(id:$id, type:ANIME) {
      id
      title { romaji english native }
      episodes
      duration
      season
      seasonYear
      countryOfOrigin
      nextAiringEpisode { episode timeUntilAiring }
      description(asHtml:false)
      coverImage { large extraLarge color }
      bannerImage
      externalLinks { site url }
      streamingEpisodes { site url title thumbnail }
      format
      status
      genres
      studios(isMain:true) { nodes { name } }
      averageScore
      meanScore
      popularity
      favourites
      rankings { rank context year season allTime type format }
      trailer { id site thumbnail }
      characters(perPage: 16, sort: [ROLE, RELEVANCE]) {
        edges {
          role
          node { id name { full } image { large } }
          voiceActors(language: JAPANESE) {
            id
            name { full }
            languageV2
            image { large }
          }
        }
      }
      staff(perPage: 24, sort: [RELEVANCE, ROLE]) {
        edges {
          role
          node { id name { full } image { large } }
        }
      }
      relations {
        edges {
          relationType
          node {
            id
            type
            title { romaji english }
            coverImage { large }
          }
        }
      }
      recommendations(perPage: 12, sort: RATING_DESC) {
        nodes {
          rating
          mediaRecommendation {
            id
            title { romaji english }
            coverImage { large }
          }
        }
      }
      tags { name isAdult isGeneralSpoiler isMediaSpoiler rank }
    }
  }`;

  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables: { id } }),
  });

  if (!res.ok) return { notFound: true, revalidate: 60 };

  const json = await res.json();
  const anime = json?.data?.Media || null;

  if (!anime) return { notFound: true, revalidate: 60 };

  return {
    props: { anime, id },
    revalidate: 3600,
  };
}
