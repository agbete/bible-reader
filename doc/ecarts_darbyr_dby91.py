"""Liste exhaustive des versets dont le texte DarbyR (concordance.bible) diffère du texte DBY91 de la base.

Comparaison mot à mot, sans tenir compte des accents, de la casse ni de la ponctuation (même règle que
correction_bible.py). Lit extraction_concordance_DarbyR_dby91/ (texte du site, numérotation de la base) et
reference_dby91.csv (texte de la base). La base n'est pas modifiée.

Écrit ecarts_DarbyR_DBY91.csv : livre;chapitre;verset;mots_retires;mots_ajoutes;texte_site;texte_base
  mots_retires : mots de la base absents du site ; mots_ajoutes : mots du site absents de la base

Usage (depuis le dossier doc) : python ecarts_darbyr_dby91.py
"""
import csv
import difflib
import os
import sys
from collections import defaultdict, Counter

sys.argv = [sys.argv[0], '--version', 'DarbyR']  # configuration DarbyR de correction_bible.py
from correction_bible import cles, OSIS  # noqa: E402

sys.stdout.reconfigure(encoding='utf-8')
DOSSIER = 'extraction_concordance_DarbyR_dby91'
SORTIE = 'ecarts_DarbyR_DBY91.csv'
MARQUEUR = '◎'


def main():
    base = {}
    with open('reference_dby91.csv', encoding='utf-8-sig') as f:
        for r in csv.DictReader(f, delimiter=';'):
            base[(OSIS[int(r['ordre']) - 1], int(r['chapitre']), int(r['verset']))] = r['texte'].strip()
    site = defaultdict(list)
    for livre in OSIS:
        with open(os.path.join(DOSSIER, f'{livre}.csv'), encoding='utf-8-sig') as f:
            for r in csv.DictReader(f, delimiter=';'):
                if r['type_entite'] != 'note' and r['contenu'] != MARQUEUR:
                    site[(livre, int(r['chapitre']), int(r['verset']))].append(r['contenu'].replace(MARQUEUR, ''))

    lignes, stats = [], Counter()
    for cle in base:  # ordre biblique
        texte_base = base[cle]
        texte_site = ' '.join(' '.join(site.get(cle, [])).split())
        a, b = cles(texte_base), cles(texte_site)
        if a == b:
            stats['identiques'] += 1
            continue
        retires, ajoutes = [], []
        for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
            if op in ('replace', 'delete'):
                retires.append(' '.join(a[i1:i2]))
            if op in ('replace', 'insert'):
                ajoutes.append(' '.join(b[j1:j2]))
        stats['différents'] += 1
        stats['absents du site' if not texte_site else 'reformulés'] += 1
        lignes.append([cle[0], cle[1], cle[2], ' | '.join(retires), ' | '.join(ajoutes), texte_site, texte_base])

    with open(SORTIE, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f, delimiter=';')
        w.writerow(['livre', 'chapitre', 'verset', 'mots_retires', 'mots_ajoutes', 'texte_site', 'texte_base'])
        w.writerows(lignes)
    print(f"✅ {len(base):,} versets comparés : {stats['identiques']:,} identiques, {stats['différents']:,} différents "
          f"({stats['reformulés']:,} reformulés, {stats['absents du site']} absents du site) -> {SORTIE}")
    par_livre = Counter(l[0] for l in lignes)
    print('   par livre : ' + ', '.join(f'{k} {v}' for k, v in par_livre.most_common()))


if __name__ == '__main__':
    main()
