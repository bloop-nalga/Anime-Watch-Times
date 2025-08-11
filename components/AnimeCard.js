import Link from 'next/link';
export default function AnimeCard({ anime }){
  const { media, episode, airingAt } = anime;
  const title = media.title.english || media.title.romaji || 'Untitled';
  const img = media.coverImage?.large || '';
  const t = new Date(airingAt * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  return (
    <Link href={`/anime/${media.id}`}>
      <div style={{background:'#1e1e1e',borderRadius:12,padding:8,boxShadow:'0 2px 8px rgba(0,0,0,.4)'}}>
        <img src={img} alt={title} style={{width:'100%',aspectRatio:'1 / 1',objectFit:'cover',borderRadius:8}}/>
        <div style={{paddingTop:6}}>
          <div style={{fontSize:14, fontWeight:600, lineHeight:1.2}}>{title}</div>
          <div style={{fontSize:12, color:'#ccc'}}>Ep {episode} • {t}</div>
        </div>
      </div>
    </Link>
  );
}