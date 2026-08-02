import { mkdir, writeFile, unlink, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const userAgent = 'JapanMap/1.0 (local itinerary asset builder)';
const outputDir = new URL('../assets/locations/', import.meta.url);
const manualImages = new Map([
  ['d06-02-arashiyama', {
    title:'Arashiyama Bamboo Grove (Unsplash)',
    url:'local:day-06-arashiyama',
    source:'https://commons.wikimedia.org/wiki/File:Arashiyama_Bamboo_Grove_(Unsplash).jpg',
    artist:'Erol Ahmed',
    license:'Wikimedia Commons source'
  }],
  ['d10-02-teamlab', {
    title:'Original generated travel image',
    url:'generated:teamlab-planets',
    source:'Generated locally with OpenAI image generation',
    artist:'OpenAI image generation',
    license:'Project asset'
  }]
]);

const locations = [
  ['d01-01-meiji-jingu', 'Meiji Shrine Tokyo', 'Meiji Shrine'],
  ['d01-02-tokyu-plaza', 'Tokyu Plaza Omotesando Harajuku', 'Tokyu Plaza Omotesando Harajuku'],
  ['d01-03-takeshita-street', 'Takeshita Street Harajuku', 'Takeshita Street'],
  ['d01-04-hachiko', 'Hachiko statue Shibuya', 'Hachikō'],
  ['d01-05-shibuya-crossing', 'Shibuya Crossing', 'Shibuya Crossing'],
  ['d01-06-shibuya-sky', 'Shibuya Sky observation deck', 'Shibuya Sky'],
  ['d02-01-umeda-sky', 'Umeda Sky Building Osaka', 'Umeda Sky Building'],
  ['d02-02-tsutenkaku', 'Tsutenkaku Osaka', 'Tsūtenkaku'],
  ['d02-03-namba', 'Namba Osaka', 'Namba'],
  ['d02-04-dotonbori', 'Dotonbori Osaka', 'Dōtonbori'],
  ['d03-01-himeji-castle', 'Himeji Castle', 'Himeji Castle'],
  ['d03-02-atomic-bomb-dome', 'Hiroshima Atomic Bomb Dome', 'Hiroshima Peace Memorial'],
  ['d03-03-peace-park', 'Hiroshima Peace Memorial Park', 'Hiroshima Peace Memorial Park'],
  ['d04-01-itsukushima', 'Itsukushima Shrine Miyajima', 'Itsukushima Shrine'],
  ['d05-01-kiyomizudera', 'Kiyomizu-dera Kyoto', 'Kiyomizu-dera'],
  ['d05-02-sannenzaka', 'Sannenzaka Kyoto', 'Sannenzaka'],
  ['d05-03-ninenzaka', 'Ninenzaka Kyoto', 'Ninenzaka'],
  ['d05-04-yasaka-pagoda', 'Yasaka Pagoda Kyoto', 'Hōkan-ji'],
  ['d05-05-sanjusangendo', 'Sanjusangen-do Kyoto', 'Sanjūsangen-dō'],
  ['d05-06-nishiki-market', 'Nishiki Market Kyoto', 'Nishiki Market'],
  ['d06-01-kinkakuji', 'Kinkaku-ji Kyoto', 'Kinkaku-ji'],
  ['d06-02-arashiyama', 'Arashiyama Bamboo Grove Kyoto', 'Arashiyama'],
  ['d07-01-fushimi-inari', 'Fushimi Inari Taisha Kyoto', 'Fushimi Inari-taisha'],
  ['d07-02-nara-park', 'Nara Park deer', 'Nara Park'],
  ['d07-03-todaiji', 'Todai-ji Nara', 'Tōdai-ji'],
  ['d07-04-nakatanidou', 'Nakatanidou mochi Nara', 'Nakatanidou'],
  ['d08-01-kamakura-buddha', 'Great Buddha Kamakura Kotoku-in', 'Kōtoku-in'],
  ['d09-01-lake-ashi', 'Lake Ashi Hakone', 'Lake Ashi'],
  ['d09-02-hakone-ropeway', 'Hakone Ropeway', 'Hakone Ropeway'],
  ['d10-01-tsukiji', 'Tsukiji Outer Market Tokyo', 'Tsukiji fish market'],
  ['d10-02-teamlab', 'teamLab Planets Tokyo', 'teamLab Planets'],
  ['d10-03-akihabara', 'Akihabara Tokyo', 'Akihabara'],
  ['d10-04-ueno-park', 'Ueno Park Tokyo', 'Ueno Park'],
  ['d10-05-ginza', 'Ginza Tokyo', 'Ginza'],
  ['d10-06-odaiba', 'Odaiba Tokyo', 'Odaiba'],
  ['d10-07-minato-mirai', 'Minato Mirai Yokohama', 'Minato Mirai 21'],
  ['d10-08-shinjuku', 'Shinjuku Tokyo skyline', 'Shinjuku'],
  ['d11-01-sensoji', 'Senso-ji Asakusa Tokyo', 'Sensō-ji'],
  ['d11-02-skytree', 'Tokyo Skytree', 'Tokyo Skytree'],
  ['d11-03-haneda', 'Haneda Airport Tokyo', 'Haneda Airport'],
];

function clean(value='') {
  return value.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
}

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function json(url) {
  const {stdout}=await run('/usr/bin/curl',[
    '-L','--fail','--silent','--show-error','--retry','5','--retry-all-errors','--retry-delay','1',
    '-A',userAgent,url
  ],{maxBuffer:4*1024*1024});
  return JSON.parse(stdout);
}

async function wikipediaImages() {
  const params = new URLSearchParams({
    action:'query', titles:locations.map(([, ,title])=>title).join('|'), redirects:'1',
    prop:'pageimages', piprop:'thumbnail|name|original', pithumbsize:'720', format:'json', origin:'*'
  });
  const data = await json(`https://en.wikipedia.org/w/api.php?${params}`);
  const normalized=new Map((data.query?.normalized||[]).map(item=>[item.from,item.to]));
  const redirects=new Map((data.query?.redirects||[]).map(item=>[item.from,item.to]));
  const byTitle=new Map(Object.values(data.query?.pages||{}).map(page=>[page.title,page]));
  return new Map(locations.map(([, ,title])=>{
    const resolved=redirects.get(normalized.get(title)||title)||normalized.get(title)||title;
    const page=byTitle.get(resolved);
    if(!page?.thumbnail?.source) return [title,null];
    return [title,{
    title:page.pageimage || page.title,
    url:page.thumbnail.source,
    source:`https://en.wikipedia.org/?curid=${page.pageid}`,
    artist:'Wikimedia contributor', license:'See source page'
  }];
  }));
}

async function commonsCandidates(query) {
  const params = new URLSearchParams({
    action:'query', generator:'search', gsrsearch:`${query} filetype:bitmap`, gsrnamespace:'6', gsrlimit:'10',
    prop:'imageinfo', iiprop:'url|mime|extmetadata', iiurlwidth:'720', format:'json', origin:'*'
  });
  const data = await json(`https://commons.wikimedia.org/w/api.php?${params}`);
  const pages = Object.values(data.query?.pages || {}).sort((a,b)=>(a.index||99)-(b.index||99));
  return pages.flatMap(page=>{
    const info=page.imageinfo?.[0];
    if(!info?.thumburl || !info.mime?.startsWith('image/')) return [];
    return [{
      title:page.title.replace(/^File:/,''), url:info.thumburl,
      source:info.descriptionurl,
      artist:clean(info.extmetadata?.Artist?.value) || 'Wikimedia contributor',
      license:clean(info.extmetadata?.LicenseShortName?.value) || 'See source page'
    }];
  });
}

async function findImage(query, pageTitle, used, wikiImages) {
  const wikipedia=wikiImages.get(pageTitle);
  if(wikipedia && !used.has(wikipedia.url)) return wikipedia;
  const candidates=[];
  try { candidates.push(...await commonsCandidates(query)); } catch {}
  const unique=candidates.filter((candidate,index,list)=>list.findIndex(item=>item.url===candidate.url)===index);
  return unique.find(candidate=>!used.has(candidate.url)) || unique[0];
}

async function buildAsset([id,query,pageTitle], used, wikiImages) {
  const candidate=manualImages.get(id) || await findImage(query,pageTitle,used,wikiImages);
  if(!candidate) throw new Error(`No image found for ${query}`);
  used.add(candidate.url);
  const temp=new URL(`.${id}.source`,outputDir);
  const output=new URL(`${id}.jpg`,outputDir);
  let exists=false;
  try { await stat(output); exists=true; } catch {}
  if(!exists){
    await run('/usr/bin/curl',[
      '-L','--fail','--silent','--show-error','--retry','5','--retry-all-errors','--retry-delay','1',
      '-A',userAgent,candidate.url,'-o',temp.pathname
    ]);
    await run('/opt/homebrew/bin/magick',[
      temp.pathname,'-auto-orient','-resize','640x640>','-strip','-sampling-factor','4:2:0','-quality','72',output.pathname
    ]);
    await unlink(temp);
  }
  return {...candidate,id,query,file:`assets/locations/${id}.jpg`};
}

await mkdir(outputDir,{recursive:true});
const used=new Set();
const results=[];
const wikiImages=await wikipediaImages();
for(let index=0;index<locations.length;index+=2){
  const batch=locations.slice(index,index+2);
  const built=await Promise.all(batch.map(location=>buildAsset(location,used,wikiImages)));
  results.push(...built);
  process.stdout.write(`Built ${Math.min(index+2,locations.length)}/${locations.length}\n`);
  await pause(350);
}

await writeFile(new URL('manifest.json',outputDir),JSON.stringify(results,null,2)+'\n');
const credits=['# Location image credits','',...results.map(item=>
  `- \`${item.id}.jpg\` — [${item.title}](${item.source}) · ${item.artist} · ${item.license}`
)];
await writeFile(new URL('CREDITS.md',outputDir),credits.join('\n')+'\n');
