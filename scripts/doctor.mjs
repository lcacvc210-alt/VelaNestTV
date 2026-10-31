import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseEnv} from 'node:util';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
try {
  const core=parseEnv(fs.readFileSync(path.join(root,'backend/.env.local'),'utf8'));
  const companion=parseEnv(fs.readFileSync(path.join(root,'companion/.env'),'utf8'));
  if(!core.PASSWORD || core.PASSWORD==='replace-with-your-own-password')throw Error('Set your own backend PASSWORD');
  if(core.PASSWORD!==companion.PASSWORD)throw Error('Backend and companion PASSWORD must match');
  for(const key of ['DEFAULT_SOURCES','DEFAULT_LIVE_SOURCES']){
    const values=JSON.parse(core[key]||'[]');
    if(!Array.isArray(values))throw Error(key+' must be a JSON array');
    for(const value of values){
      if(!value.name?.trim())throw Error(key+': name is required');
      const url=new URL(value.url);
      if(!['http:','https:'].includes(url.protocol)||url.hostname.endsWith('.invalid'))throw Error(key+': replace placeholder with your own HTTP(S) endpoint');
    }
    console.log(key+': '+values.length+' configured');
  }
  const base=(companion.CORE_URL||'http://127.0.0.1:8080').replace(/\/+$/,'');
  if(process.argv.includes('--config-only')){console.log('Configuration OK; no credentials or provider URLs printed.');process.exit(0);}
  const auth=await fetch(base+'/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:core.PASSWORD}),signal:AbortSignal.timeout(6000)});
  if(!auth.ok)throw Error('Backend login failed: '+auth.status);
  const cookie=auth.headers.get('set-cookie')?.split(';')[0];
  if(!cookie)throw Error('Backend did not return a session cookie');
  const port=companion.COMPANION_PORT||8090;
  const health=await fetch('http://127.0.0.1:'+port+'/health',{signal:AbortSignal.timeout(6000)});
  if(!health.ok||(await health.json()).service!=='private-cinema-tv')throw Error('Companion health check failed');
  const nas=await fetch('http://127.0.0.1:'+port+'/tv/nas',{headers:{cookie},signal:AbortSignal.timeout(6000)});
  if(!nas.ok)throw Error('Companion authentication/NAS listing failed: '+nas.status);
  console.log('Backend login, companion health and authenticated NAS listing OK. Source playback must be checked separately.');
} catch(error){console.error('CHECK FAILED: '+error.message);process.exitCode=1;}
