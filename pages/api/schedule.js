export default async function handler(req,res){
  const query = `
    query ($from:Int,$to:Int){
      Page(perPage:100){
        airingSchedules(airingAt_greater:$from, airingAt_lesser:$to, sort:TIME){
          airingAt
          episode
          media{
            id
            title{ romaji english }
            coverImage{ large }
            averageScore
            trending
            popularity
          }
        }
      }
    }`;
  const now = new Date();
  const estNow = new Date(now.toLocaleString('en-US',{timeZone:'America/New_York'}));
  const sunday = new Date(estNow.getFullYear(), estNow.getMonth(), estNow.getDate() - estNow.getDay());
  const start = Math.floor(sunday.getTime()/1000);
  const wed = start + 4*86400;
  const satEnd = start + 6*86400 + 86399;
  const post = async (from,to)=>{
    const r = await fetch('https://graphql.anilist.co',{
      method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify({ query, variables:{ from, to } })
    });
    const j = await r.json();
    return j?.data?.Page?.airingSchedules || [];
  };
  try{
    const [a,b] = await Promise.all([ post(start,wed), post(wed,satEnd) ]);
    res.status(200).json([...a,...b]);
  }catch(e){
    res.status(500).json({error:'Failed to load schedule'});
  }
}