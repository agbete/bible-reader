"""Met à jour le texte Darby DBY91 de la base (verse_texts) avec la DarbyR de concordance.bible.

Seuls les versets dont le texte diffère (doc/ecarts_DarbyR_DBY91.csv) sont remplacés, et seulement quand le verset
de la base correspond exactement à un verset du site (mêmes limites, d'après l'alignement de correction_bible.py).
Les autres (versets découpés autrement, versets absents du site) sont listés et laissés tels quels.

Texte du site : celui de la page (appels de note et « ◎ » retirés), écrit comme le reste de DBY91 :
apostrophe droite ('), pas d'espace avant : ; ! ?
Avant la mise à jour, l'ancien texte de tous les versets DBY91 est sauvegardé dans doc/sauvegarde_dby91_avant_darbyr.csv.
Une seule transaction : en cas d'erreur, rien n'est modifié.

Usage (depuis la racine du projet) :
  python scripts/maj_dby91_depuis_darbyr.py            aperçu (rien n'est écrit dans la base)
  python scripts/maj_dby91_depuis_darbyr.py --appliquer
"""
import csv
import io
import os
import re
import subprocess
import sys
from collections import defaultdict, Counter
from concurrent.futures import ThreadPoolExecutor

import requests
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding='utf-8')

CONTENEUR = 'supabase_db_bible-reader'
DOC = 'doc'
OSIS = ('Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song '
        'Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom '
        '1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev').split()
SAUVEGARDE = os.path.join(DOC, 'sauvegarde_dby91_avant_darbyr.csv')
RAPPORT = os.path.join(DOC, 'maj_dby91_depuis_darbyr.csv')


def psql(sql=None, script=None):
    commande = ['docker', 'exec', '-i', CONTENEUR, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At']
    commande += ['-c', sql] if sql else ['-f', '-']
    r = subprocess.run(commande, input=script.encode('utf-8') if script else None, capture_output=True)
    if r.returncode != 0:
        sys.exit(f"❌ Erreur de la base :\n{r.stderr.decode('utf-8')}")
    return r.stdout.decode('utf-8')


def ecrire_comme_la_base(texte):
    t = texte.replace('◎', '').replace('’', "'").replace('‘', "'")
    t = ' '.join(t.split())                       # espaces (insécables compris) normalisées
    t = re.sub(r'\s+([:;!?.,)\]])', r'\1', t)       # pas d'espace avant : ; ! ? . , ) ]
    t = re.sub(r'([(\[])\s+', r'\1', t)
    t = re.sub(r"'\s+", "'", t)
    t = re.sub(r'“\s+', '“', t)
    t = re.sub(r'\s+”', '”', t)
    return t.strip()


def textes_du_site(livre, chapitre):
    url = f'https://concordance.bible/parallelv/DarbyR/{livre}/{chapitre}/'
    for essai in range(5):
        try:
            r = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=60)
            r.raise_for_status()
            break
        except requests.RequestException:
            if essai == 4:
                raise
    if r.url.rstrip('/') != url.rstrip('/'):
        return {}
    textes = {}
    for tr in BeautifulSoup(r.text, 'lxml').find_all('tr'):
        th = tr.find('th', id=lambda x: x and x.startswith('v'))
        td = tr.find('td')
        if th and td:
            for note in td.select('a.note, note'):
                note.decompose()
            textes[int(th.get_text(strip=True))] = ecrire_comme_la_base(td.get_text(' '))
    return textes


def lire_csv(chemin):
    with open(chemin, encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f, delimiter=';'))


def main():
    appliquer = '--appliquer' in sys.argv
    ecarts = lire_csv(os.path.join(DOC, 'ecarts_DarbyR_DBY91.csv'))
    a_corriger = {(e['livre'], int(e['chapitre']), int(e['verset'])) for e in ecarts}

    # Limites des versets : lignes de chaque verset du site, et où l'alignement les a placées
    total_site = Counter()
    for livre in OSIS:
        for r in lire_csv(os.path.join(DOC, 'extraction_concordance_DarbyR', f'{livre}.csv')):
            total_site[(livre, int(r['chapitre']), int(r['verset']))] += 1
    deplacees = defaultdict(Counter)  # verset du site -> {verset de la base: lignes}
    for r in lire_csv(os.path.join(DOC, 'corrections_DarbyR.csv')):
        site = (r['livre'], int(r['chapitre_site']), int(r['verset_site']))
        deplacees[site][(r['livre'], int(r['chapitre_lsg']), int(r['verset_lsg']))] += int(r['nb_lignes'])
    recues = defaultdict(Counter)  # verset de la base -> {verset du site: lignes}
    for site, n in total_site.items():
        restent = n - sum(deplacees[site].values())
        if restent:
            recues[site][site] += restent
        for base, k in deplacees[site].items():
            recues[base][site] += k

    # Texte de la base (ids des lignes à mettre à jour)
    sortie = psql(sql="\\copy (select vt.id, b.order_index, c.number, v.verse_number, vt.text from verse_texts vt "
                      "join bible_versions bv on bv.id = vt.version_id and bv.code = 'DBY91' "
                      "join verses v on v.id = vt.verse_id join chapters c on c.id = v.chapter_id "
                      "join books b on b.id = c.book_id order by 2, 3, 4) to stdout with (format csv)")
    base = {}
    for vt_id, ordre, ch, v, texte in csv.reader(io.StringIO(sortie)):
        base[(OSIS[int(ordre) - 1], int(ch), int(v))] = (int(vt_id), texte)

    # Pages du site pour les chapitres concernés
    chapitres = sorted({(l, ch) for l, ch, _ in a_corriger}, key=lambda x: (OSIS.index(x[0]), x[1]))
    besoin = set(chapitres)
    for cle in a_corriger:  # chapitres des versets du site correspondants
        for site in recues.get(cle, {}):
            besoin.add((site[0], site[1]))
    print(f'Lecture de {len(besoin)} chapitre(s) DarbyR sur concordance.bible…')
    with ThreadPoolExecutor(8) as pool:
        pages = dict(zip(besoin, pool.map(lambda lc: textes_du_site(*lc), besoin)))

    maj, ecartes = [], []
    for cle in sorted(a_corriger, key=lambda x: (OSIS.index(x[0]), x[1], x[2])):
        vt_id, ancien = base[cle]
        sources = recues.get(cle, Counter())
        if len(sources) != 1:
            ecartes.append((cle, 'absent du site' if not sources else 'plusieurs versets du site', ancien, ''))
            continue
        site = next(iter(sources))
        if sum(deplacees[site].values()) and set(recues_de(site, recues)) != {cle}:
            ecartes.append((cle, f'verset du site {site[1]}:{site[2]} réparti sur plusieurs versets', ancien, ''))
            continue
        nouveau = pages.get((site[0], site[1]), {}).get(site[2], '')
        if not nouveau:
            ecartes.append((cle, 'texte du site introuvable', ancien, ''))
            continue
        if nouveau != ancien:
            maj.append((vt_id, cle, ancien, nouveau))

    with open(RAPPORT, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f, delimiter=';')
        w.writerow(['livre', 'chapitre', 'verset', 'decision', 'ancien_texte', 'nouveau_texte'])
        for _, (l, c, v), ancien, nouveau in maj:
            w.writerow([l, c, v, 'mis à jour', ancien, nouveau])
        for (l, c, v), raison, ancien, _ in ecartes:
            w.writerow([l, c, v, f'non modifié : {raison}', ancien, ''])
    print(f'{len(maj):,} verset(s) à mettre à jour, {len(ecartes)} laissé(s) tel(s) quel(s) -> {RAPPORT}')
    for (l, c, v), raison, _, _ in ecartes:
        print(f'   {l} {c}:{v} : {raison}')
    if not appliquer:
        print('Aperçu seulement : relancez avec --appliquer pour écrire dans la base.')
        return

    # Sauvegarde de tout DBY91, puis mise à jour en une transaction
    with open(SAUVEGARDE, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f, delimiter=';')
        w.writerow(['verse_text_id', 'livre', 'chapitre', 'verset', 'texte'])
        for (l, c, v), (vt_id, texte) in base.items():
            w.writerow([vt_id, l, c, v, texte])
    donnees = io.StringIO()
    csv.writer(donnees, lineterminator='\n').writerows((vt_id, nouveau) for vt_id, _, _, nouveau in maj)
    psql(script="begin;\ncreate temp table maj_dby91 (id integer primary key, text text);\n"
                "copy maj_dby91 from stdin with (format csv);\n" + donnees.getvalue() + "\\.\n"
                "update verse_texts vt set text = m.text from maj_dby91 m where vt.id = m.id;\ncommit;\n")
    verifies = int(psql(sql="select count(*) from verse_texts vt join bible_versions bv on bv.id = vt.version_id "
                            "and bv.code = 'DBY91' where vt.id in (" + ','.join(str(m[0]) for m in maj) + ")"
                            " and vt.updated_at > now() - interval '5 minutes'").strip() or 0) if maj else 0
    print(f'✅ {len(maj):,} verset(s) DBY91 mis à jour ({verifies:,} vérifiés) ; sauvegarde : {SAUVEGARDE}')


def recues_de(site, recues):
    """Versets de la base qui ont reçu des lignes de ce verset du site."""
    return [b for b, sources in recues.items() if site in sources]


if __name__ == '__main__':
    main()
