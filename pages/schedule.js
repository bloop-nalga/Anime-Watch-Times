import { useEffect, useState } from 'react';
import AnimeCard from '../components/AnimeCard';
export default function Schedule(){
  const [list,setList]=useState([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    fetch('/api/schedule').then(r=>r.json()).then(d=>{setList(d);setLoading(false)}).catch(()=>setLoading(false));
  },[]);
  return (
    <main style={{padding:'1rem 1rem 3rem'}}>
      <h1 style={{textAlign:'center'}}>Anime Schedule</h1>
      {loading? <p style={{textAlign:'center'}}>Loading…</p> :
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:'14px',maxWidth:1200,margin:'0 auto'}}>
          {list.map(item => <AnimeCard key={item.media.id+'-'+item.episode} anime={item}/>)}
        </div>
      }
    </main>
  );
}
