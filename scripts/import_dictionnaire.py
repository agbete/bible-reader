"""Remplace les définitions d'un dictionnaire dans dictionary_entries (base locale) par un CSV d'extraction.

CSV (séparateur « ; ») : ordre;site_id;entry_name;url;autres_dictionnaires;content;atlas;numerisation
Les lignes sont importées dans l'ordre du fichier (ordre du site). Les liens relatifs du site dans la
définition (href="/…", src="/…") deviennent des adresses complètes, sinon ils pointeraient vers l'application.
Tout se fait en une seule transaction : en cas d'erreur, la table n'est pas modifiée.

Usage (depuis la racine du projet) :
  python scripts/import_dictionnaire.py WESTPHAL doc/Dictionnaires/Westphal/westphal.csv
"""
import csv
import io
import json
import re
import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
csv.field_size_limit(10 ** 9)

CONTENEUR = 'supabase_db_bible-reader'
SITE = 'https://www.levangile.com'
COLONNES_CSV = ['ordre', 'site_id', 'entry_name', 'url', 'autres_dictionnaires', 'content', 'atlas', 'numerisation']
COLONNES_TABLE = ['dictionary_id', 'site_id', 'entry_name', 'url', 'autres_dictionnaires', 'content', 'atlas',
                  'numerisation']


def psql(sql=None, script=None):
    commande = ['docker', 'exec', '-i', CONTENEUR, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At']
    commande += ['-c', sql] if sql else ['-f', '-']
    r = subprocess.run(commande, input=script.encode('utf-8') if script else None, capture_output=True)
    if r.returncode != 0:
        sys.exit(f"❌ Erreur de la base :\n{r.stderr.decode('utf-8')}")
    return r.stdout.decode('utf-8').strip()


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    code, chemin = sys.argv[1].upper(), sys.argv[2]
    dico_id = psql(f"select id from dictionaries where code = '{code}'")
    if not dico_id:
        sys.exit(f"❌ Dictionnaire {code} inconnu (table dictionaries)")

    with open(chemin, encoding='utf-8-sig', newline='') as f:
        lecteur = csv.DictReader(f, delimiter=';')
        if lecteur.fieldnames != COLONNES_CSV:
            sys.exit(f"❌ Colonnes inattendues : {lecteur.fieldnames}")
        lignes = list(lecteur)
    sortie = io.StringIO()
    w = csv.writer(sortie, delimiter=';', lineterminator='\n')
    liens = 0
    for n, l in enumerate(lignes, 2):
        if not l['site_id'].isdigit() or not l['entry_name'] or not l['content'].startswith('<div id="logos">'):
            sys.exit(f"❌ Ligne {n} invalide : {l['entry_name']!r}")
        for champ in ('autres_dictionnaires', 'atlas'):
            if l[champ]:
                json.loads(l[champ])
        contenu, k = re.subn(r'(\b(?:href|src)=")/(?!/)', rf'\1{SITE}/', l['content'])
        liens += k
        w.writerow([dico_id, l['site_id'], l['entry_name'], l['url'], l['autres_dictionnaires'], contenu,
                    l['atlas'], l['numerisation']])

    avant = int(psql(f"select count(*) from dictionary_entries where dictionary_id = {dico_id}"))
    print(f"📚 {code} : {len(lignes):,} définitions à importer ({liens} lien(s) rendu(s) absolu(s)), "
          f"{avant:,} actuellement dans la table")
    psql(script=f"begin;\ndelete from dictionary_entries where dictionary_id = {dico_id};\n"
                f"copy dictionary_entries ({', '.join(COLONNES_TABLE)}) from stdin "
                f"with (format csv, delimiter ';', null '');\n{sortie.getvalue()}\\.\ncommit;\n")
    apres = int(psql(f"select count(*) from dictionary_entries where dictionary_id = {dico_id}"))
    print(f"✅ {apres:,} définitions dans la table ({avant:,} remplacées)")
    if apres != len(lignes):
        sys.exit(f"⚠️  {len(lignes):,} lignes lues mais {apres:,} dans la table")


if __name__ == '__main__':
    main()
