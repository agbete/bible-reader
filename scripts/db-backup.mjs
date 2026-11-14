// Sauvegarde de la base locale (schéma public : tables, données, règles d'accès) dans
// supabase/backups/bible-AAAA-MM-JJ_HHhMM.dump (format compressé de pg_dump).
// Usage : npm run db:backup
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CONTAINER = 'supabase_db_bible-reader';
const dir = path.resolve('supabase/backups');
fs.mkdirSync(dir, { recursive: true });

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const name = `bible-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}h${pad(now.getMinutes())}.dump`;
const file = path.join(dir, name);

console.log(`Sauvegarde de la base locale vers ${path.relative(process.cwd(), file)}…`);
const out = fs.createWriteStream(file);
const dump = spawn('docker', ['exec', CONTAINER, 'pg_dump', '-U', 'postgres', '-d', 'postgres', '--schema=public', '-Fc'], { stdio: ['ignore', 'pipe', 'inherit'] });
dump.stdout.pipe(out);
dump.on('error', (err) => {
  console.error(`Docker introuvable ou base arrêtée : ${err.message}`);
  process.exit(1);
});
dump.on('close', (code) => {
  out.close(() => {
    if (code !== 0) {
      fs.rmSync(file, { force: true });
      console.error('Échec de la sauvegarde : Docker Desktop et la base locale (npm run db:start) sont-ils démarrés ?');
      process.exit(code ?? 1);
    }
    const size = (fs.statSync(file).size / 1024 / 1024).toFixed(1);
    console.log(`Sauvegarde terminée : ${name} (${size} Mo)`);
  });
});
