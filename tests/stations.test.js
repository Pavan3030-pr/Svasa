const http=require('http'),assert=require('assert');
let calls=0,mode='latlon',seen={};
const loc=(id,lat,lon,params)=>({id,name:'Station '+id,coordinates:{latitude:lat,longitude:lon},sensors:params.map((p,i)=>({id:id*10+i,name:p+' µg/m³',parameter:{id:i,name:p,units:'µg/m³'}}))});
const mock=http.createServer((q,r)=>{calls++;seen.key=q.headers['x-api-key'];const u=new URL(q.url,'http://x');r.setHeader('content-type','application/json');
  if(u.pathname==='/v3/locations'){const c=u.searchParams.get('coordinates').split(',').map(Number);const want=mode==='latlon'?[17.4,78.5]:[78.5,17.4];
    if(Math.abs(c[0]-want[0])>.2||Math.abs(c[1]-want[1])>.2)return r.end(JSON.stringify({results:[]}));
    return r.end(JSON.stringify({results:[loc(1,17.41,78.52,['no2','o3']),loc(2,17.45,78.55,['pm25','pm10']),loc(3,40,-70,['pm25'])]}))}
  if(u.pathname==='/v3/locations/2/latest')return r.end(JSON.stringify({results:[{datetime:{utc:new Date(Date.now()-2*3600e3).toISOString()},value:42.5,sensorsId:20},{datetime:{utc:new Date().toISOString()},value:-999,sensorsId:21}]}));
  r.statusCode=404;r.end('{}')});
mock.listen(0,async()=>{
  process.env.OPENAQ_BASE='http://127.0.0.1:'+mock.address().port;
  const stations=require('../backend/routes/stations'),health=require('../backend/routes/health');
  const call=q=>stations({method:'GET',query:q,headers:{},ip:'9.9.9.'+Math.floor(Math.random()*250)});
  delete process.env.OPENAQ_API_KEY;
  assert.equal((await call({lat:'17.4',lon:'78.5'})).status,503);assert.equal(health().body.stations,false);console.log('ok - 503 without key');
  process.env.OPENAQ_API_KEY='testkey';assert.equal(health().body.stations,true);
  assert.equal((await call({lat:'abc',lon:'1'})).status,400);assert.equal((await call({lat:'95',lon:'1'})).status,400);assert.equal((await stations({method:'POST',query:{},headers:{},ip:'1'})).status,405);console.log('ok - input validation');
  let r=await call({lat:'17.4',lon:'78.5'});
  assert.equal(r.status,200);assert.equal(r.body.station.id,2);assert.equal(r.body.station.pm25,42.5);assert.equal(r.body.station.latitude,17.45);assert.equal(r.body.station.longitude,78.55);assert.equal(r.body.station.pm10,null);assert.ok(r.body.station.distanceKm<10);assert.ok(r.body.station.ageHours>=1.9&&r.body.station.ageHours<2.5);assert.equal(seen.key,'testkey');
  console.log('ok - nearest station with PM2.5; skips stations without it; ignores -999; sends key header');
  const before=calls;await call({lat:'17.4',lon:'78.5'});assert.equal(calls,before);console.log('ok - result cached');
  mode='lonlat';r=await call({lat:'17.42',lon:'78.51'}); // different cache key (rounded .4/.5) -> same? ensure new key
  r=await call({lat:'17.37',lon:'78.46'});assert.equal(r.status,200);assert.ok(r.body.station,'lon,lat fallback should find station');console.log('ok - falls back to lon,lat order');
  r=await call({lat:'28.6',lon:'77.2'});assert.equal(r.status,200);assert.equal(r.body.station,null);console.log('ok - no station nearby returns null');
  process.env.OPENAQ_BASE='http://127.0.0.1:1';r=await call({lat:'10.1',lon:'20.1'});assert.equal(r.status,502);console.log('ok - upstream failure returns 502');
  console.log('stations tests passed');mock.close();process.exit(0)});
