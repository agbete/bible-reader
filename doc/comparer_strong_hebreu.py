"""Compare le lexique hébreu extrait de levangile.com (doc/strong_hebreu_levangile.csv) à la table strong_codes.

Écrit doc/comparaison_strong_hebreu.csv : code;champ;base;site  (une ligne par champ différent)
La base n'est pas modifiée.

Usage (depuis la racine du projet) : python doc/comparer_strong_hebreu.py
"""
import csv
import io
import subprocess
import sys
from collections import Counter

sys.stdout.reconfigure(encoding='utf-8')
csv.field_size_limit(10 ** 9)

CHAMPS = ['mot_original', 'origine_mot', 'mot_translitere', 'type_mot', 'traduction_generale', 'content']
SORTIE = 'doc/comparaison_strong_hebreu.csv'


def main():
    with open('doc/strong_hebreu_levangile.csv', encoding='utf-8-sig', newline='') as f:
        site = {r['code']: r for r in csv.DictReader(f, delimiter=';')}
    requete = (r"\copy (select code, " + ', '.join(f"coalesce({c}, '')" for c in CHAMPS) +
               r" from strong_codes where serie = 'H') to stdout with (format csv)")
    sortie = subprocess.run(['docker', 'exec', 'supabase_db_bible-reader', 'psql', '-U', 'postgres', '-c', requete],
                            capture_output=True).stdout.decode('utf-8')
    base = {r[0]: dict(zip(CHAMPS, r[1:])) for r in csv.reader(io.StringIO(sortie))}

    diffs, stats = [], Counter()
    for code in sorted(set(site) | set(base), key=int):
        if code not in site:
            stats['seulement dans la base'] += 1
            continue
        if code not in base:
            stats['seulement sur le site'] += 1
            diffs.append([code, '(absent de la base)', '', ''])
            continue
        identique = True
        for c in CHAMPS:
            if base[code][c] != site[code][c]:
                identique = False
                stats[c] += 1
                diffs.append([code, c, base[code][c], site[code][c]])
        stats['codes identiques' if identique else 'codes différents'] += 1

    with open(SORTIE, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f, delimiter=';')
        w.writerow(['code', 'champ', 'base', 'site'])
        w.writerows(diffs)
    print(f"✅ {len(site)} codes du site comparés à {len(base)} codes de la base -> {SORTIE}")
    for k, v in stats.most_common():
        print(f'   {k} : {v}')


if __name__ == '__main__':
    main()
