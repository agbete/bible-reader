// Restaure une sauvegarde dans la base LOCALE : les tables du schéma public sont remplacées
// par celles de la sauvegarde. Le cloud n'est jamais touché.
// Usage : npm run db:restore -- supabase/backups/bible-2026-11-13_21h30.dump
//         npm run db:restore -- --latest
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CONTAINER = 'supabase_db_bible-reader';
const dir = path.resolve('supabase/backups');
let file = process.argv[2];

if (file === '--latest') {
  const dumps = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.dump')).sort() : [];
  if (dumps.length === 0) {
    console.error('Aucune sauvegarde dans supabase/backups.');
    process.exit(1);
  }
  file = path.join(dir, dumps[dumps.length - 1]);
}
if (!file || !fs.existsSync(file)) {
  console.error('Indiquez la sauvegarde à restaurer : npm run db:restore -- <fichier.dump>  (ou --latest)');
  process.exit(1);
}

console.log(`Restauration de ${path.relative(process.cwd(), path.resolve(file))} dans la base locale…`);
const restore = spawn(
  'docker',
  ['exec', '-i', CONTAINER, 'pg_restore', '-U', 'postgres', '-d', 'postgres', '--clean', '--if-exists', '--no-owner', '--role=postgres'],
  { stdio: ['pipe', 'inherit', 'inherit'] }
);
fs.createReadStream(file).pipe(restore.stdin);
restore.on('error', (err) => {
  console.error(`Docker introuvable ou base arrêtée : ${err.message}`);
  process.exit(1);
});
restore.on('close', (code) => {
  // pg_restore renvoie 1 pour de simples avertissements (objets déjà absents) : on le signale sans échouer
  console.log(code === 0 ? 'Restauration terminée.' : `Restauration terminée avec des avertissements (code ${code}).`);
});
