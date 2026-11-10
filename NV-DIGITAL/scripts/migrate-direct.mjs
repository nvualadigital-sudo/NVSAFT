import {spawnSync} from 'node:child_process';
try {process.loadEnvFile('.env');}catch(e){if(e.code!=='ENOENT')throw e;}
const runtime=process.env.DATABASE_URL;
const selected=process.env.DATABASE_URL_UNPOOLED || runtime;
if(!selected)throw new Error('Configure a ligação à base de dados nos Secrets.');
const direct=new URL(selected);
const normalize=host=>host.replace(/-pooler(?=\.)/,'');
if(direct.hostname.includes('-pooler')){
 if(!direct.hostname.endsWith('.neon.tech'))throw new Error('Configure DATABASE_URL_UNPOOLED com a ligação directa deste fornecedor.');
 direct.hostname=normalize(direct.hostname);
}
if(runtime){const active=new URL(runtime);if(normalize(active.hostname)!==direct.hostname||active.pathname!==direct.pathname)throw new Error('As ligações normal e directa apontam para bases diferentes. Reveja os Secrets antes de migrar.');}
const result=spawnSync(process.execPath,['scripts/migrate.mjs'],{stdio:'inherit',env:{...process.env,DATABASE_URL_UNPOOLED:direct.toString()}});
if(result.error)throw result.error;
process.exitCode=result.status??1;
