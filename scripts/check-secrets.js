'use strict';
const fs=require('node:fs'),{execFileSync}=require('node:child_process');
const rules=[['Google API credential',/AIza[0-9A-Za-z_-]{35}/],['GitHub credential',/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})/],['Private key',/-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],['Hardcoded provider secret',/(?:GEMINI_API_KEY|OPENAQ_API_KEY|UPSTASH_REDIS_REST_TOKEN|KV_REST_API_TOKEN|VAPID_PRIVATE_KEY|CRON_SECRET)\s*[:=]\s*['"][A-Za-z0-9_\-+/=]{25,}['"]/]];
const paths=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);let n=0,failures=0;
for(const p of paths){if(p==='scripts/check-secrets.js')continue;if(/(^|\/)\.env(?:\.|$)/.test(p)&&!p.endsWith('.env.example')){console.error('Tracked environment file: '+p);failures++;}
 if(!/\.(?:js|mjs|cjs|json|html|css|md|ya?ml|txt|sh|toml|env|example|pem|key|conf)$/i.test(p)&&!/(^|\/)(Dockerfile|\.gitignore)$/.test(p))continue;
 const s=fs.readFileSync(p,'utf8');n++;for(const [name,pattern] of rules)if(pattern.test(s)){console.error(name+' pattern in '+p);failures++;}
}
console.log('Current tracked text secret scan: '+n+' files, '+failures+' potential findings (pattern-based, not history scan)');if(failures)process.exitCode=1;
