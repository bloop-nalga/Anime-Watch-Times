import { useRouter } from 'next/router';
export default function Page(){
  const { slug } = useRouter().query;
  return <main style={{padding:'2rem'}}><h1>Anime ID: {slug}</h1><p>Details page scaffold.</p></main>
}