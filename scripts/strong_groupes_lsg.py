"""Codes Strong répétés sur des mots consécutifs de la Louis Segond : un seul code à l'affichage.

Dans la Segond 1910, un mot hébreu ou grec est souvent rendu par une locution (« jusqu'à ce que » = H5704) :
chaque mot de la locution porte alors le même code. La King James montre comment ce mot original est rendu
en anglais (« till ») : une seule unité de sens, donc un seul code, placé après la locution française entière.

Ce script lit la base (lecture seule, rien n'est modifié) et écrit :
  public/data/strong-groupes-lsg.json   lu par l'application (page Lecture) pour n'afficher qu'un code par groupe
  doc/groupes_codes_lsg_kjv.csv         chaque groupe, les mots KJV du même code et la décision (à relire)

Règles (pour chaque suite de mots consécutifs d'un verset portant exactement le(s) même(s) code(s)) :
  1. Les mots qui traduisent le même mot original (même position dans data_pa) forment une locution.
  2. Un « ◎ » (mot original non traduit) rejoint la locution voisine : « ◎ mourras » (mourir, tu mourras),
     comme la KJV « thou shalt surely die » ne forme qu'une idée en français.
  3. Deux locutions restent séparées (deux codes) seulement si le texte français les sépare par une ponctuation
     et que la KJV porte aussi ce code sur plusieurs mots distincts du verset : « Irad, Irad » / « Irad: and Irad ».
  4. Une locution sans ponctuation interne s'affiche comme un tout : le code après le dernier mot, et le survol
     met en valeur toute la locution (« profond sommeil », « parce que »). Avec une ponctuation interne,
     seul le dernier mot garde le code.

Usage (depuis la racine du projet) : python scripts/strong_groupes_lsg.py
"""
import csv
import io
import json
import os
import re
import subprocess
import sys
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

CONTENEUR = 'supabase_db_bible-reader'
SORTIE_JSON = os.path.join('public', 'data', 'strong-groupes-lsg.json')
SORTIE_CSV = os.path.join('doc', 'groupes_codes_lsg_kjv.csv')
MARQUEUR = '◎'
PONCTUATION_FIN = re.compile(r'[,;:.!?»)\]]\s*$')


def lire(version, avec_codes_seulement=False):
    filtre = " and data_ns is not null and data_ns <> ''" if avec_codes_seulement else ''
    requete = (f"\\copy (select livre_code, chapitre, verset, contenu, data_pa, data_ns from strong_code_bible_links "
               f"where version = '{version}'{filtre} order by id) to stdout with (format csv, delimiter E'\\t')")
    r = subprocess.run(['docker', 'exec', CONTENEUR, 'psql', '-U', 'postgres', '-c', requete],
                       capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0:
        sys.exit(f"❌ Lecture de la base impossible :\n{r.stderr}")
    return list(csv.reader(io.StringIO(r.stdout), delimiter='\t'))


def codes(raw):
    return tuple(sorted({int(n) for n in re.findall(r'\d+', raw or '') if int(n) > 0}))


def position(data_pa):
    return (data_pa or '').split('/')[0]


def main():
    print('Lecture de la Segond 1910 et de la KJV (lecture seule)…')
    lsg = lire('Sg1910')
    kjv = lire('KJV', avec_codes_seulement=True)

    # KJV : mots portant chaque code, par verset
    kjv_mots = defaultdict(list)
    for livre, ch, v, contenu, _pa, ns in kjv:
        for c in codes(ns):
            kjv_mots[(livre, ch, v, c)].append(contenu)

    # Segond : mots de chaque verset, dans l'ordre (comme l'application : lignes sans contenu ignorées)
    versets = defaultdict(list)
    for livre, ch, v, contenu, pa, ns in lsg:
        if contenu:
            versets[(livre, ch, v)].append((contenu, position(pa), codes(ns)))

    groupes_json = {}
    rapport = []
    stats = defaultdict(int)
    for (livre, ch, v), mots in versets.items():
        i = 0
        while i < len(mots):
            c = mots[i][2]
            j = i + 1
            if c:
                while j < len(mots) and mots[j][2] == c:
                    j += 1
            if j - i < 2:
                i = j
                continue
            # Locutions : mots consécutifs de même position ; un « ◎ » rejoint la locution voisine
            locutions = []
            for k in range(i, j):
                texte, pos, _ = mots[k]
                if locutions and (pos == mots[locutions[-1][-1]][1] or texte == MARQUEUR
                                  or all(mots[x][0] == MARQUEUR for x in locutions[-1])):
                    locutions[-1].append(k)
                else:
                    locutions.append([k])
            # Règle 3 : locutions séparées seulement par une ponctuation française ET plusieurs mots KJV
            n_kjv = sum(len(kjv_mots.get((livre, ch, v, code), [])) for code in c) // max(len(c), 1)
            unites = [locutions[0]]
            for loc in locutions[1:]:
                precedent = mots[unites[-1][-1]][0]
                if PONCTUATION_FIN.search(precedent) and n_kjv >= len(locutions):
                    unites.append(loc)
                else:
                    unites[-1].extend(loc)
            cle = f"{livre}.{ch}.{v}"
            decisions = []
            for u in unites:
                if len(u) < 2:
                    decisions.append(mots[u[0]][0])
                    continue
                interne = any(PONCTUATION_FIN.search(mots[k][0]) for k in u[:-1] if mots[k][0] != MARQUEUR)
                if interne:
                    groupes_json.setdefault(cle, []).append([u[0], u[-1], 1])  # code sur le dernier mot seulement
                    stats['dernier mot'] += 1
                else:
                    groupes_json.setdefault(cle, []).append([u[0], u[-1]])  # locution entière
                    stats['locution'] += 1
                decisions.append(' '.join(mots[k][0] for k in u if mots[k][0] != MARQUEUR) or MARQUEUR)
            stats['groupes'] += 1
            if len(unites) > 1:
                stats['codes gardés séparés'] += 1
            serie = 'G' if livre in NT else 'H'
            rapport.append([livre, ch, v, ', '.join(f'{serie}{x}' for x in c), ' | '.join(m[0] for m in mots[i:j]),
                            ' | '.join(kjv_mots.get((livre, ch, v, c[0]), [])),
                            len(unites), ' ‖ '.join(f'{d}' for d in decisions)])
            i = j

    os.makedirs(os.path.dirname(SORTIE_JSON), exist_ok=True)
    with open(SORTIE_JSON, 'w', encoding='utf-8') as f:
        json.dump(groupes_json, f, ensure_ascii=False, separators=(',', ':'))
    with open(SORTIE_CSV, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f, delimiter=';')
        w.writerow(['livre', 'chapitre', 'verset', 'code', 'mots_segond', 'mots_kjv_meme_code',
                    'codes_affiches', 'affichage (code après chaque partie)'])
        w.writerows(rapport)
    print(f"✅ {stats['groupes']} groupes : {stats['locution']} locution(s) entière(s), "
          f"{stats['dernier mot']} avec code sur le dernier mot, {stats['codes gardés séparés']} groupe(s) gardant plusieurs codes")
    print(f"   {SORTIE_JSON} ({os.path.getsize(SORTIE_JSON) // 1024} Ko), rapport : {SORTIE_CSV}")


NT = set('Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas '
         '1Pet 2Pet 1John 2John 3John Jude Rev'.split())

if __name__ == '__main__':
    main()
