"""Extraction complète d'un dictionnaire biblique de levangile.com (Westphal, Bost, Calmet, Lelievre)
dans doc/Dictionnaires/<Nom>/<nom>.csv.

1. Liste des mots : pages Liste-Definitions-<Nom>.php?page=1, 2, … jusqu'à une page vide.
2. Page de chaque mot, téléchargée en parallèle (8 connexions), avec nouvelles tentatives en cas d'erreur.
   Les pages sont gardées dans doc/Dictionnaires/<Nom>/.cache_<nom>/ : une relance reprend là où elle s'est arrêtée.
3. Pour chaque mot, le contenu tel qu'il est sur le site :
     contenu               le bloc <div id="logos">…</div> exact (HTML d'origine, &nbsp; compris)
     autres_dictionnaires  liens du titre vers le même mot dans Bost / Calmet / Lelièvre (JSON)
     atlas                 lieux de la carte « Atlas biblique » : titre, adresse (HTML), lat, lng (JSON)
     numerisation          mention « Numérisation : … » en bas de page
Aucun mot n'est sauté : si une page reste introuvable, rien n'est écrit et les pages en échec sont listées.
La base de données n'est pas modifiée.

Usage (depuis la racine du projet) :
  python doc/Dictionnaires/extractDictionnaire.py Westphal      (ou Bost, Calmet, Lelievre)
"""
import csv
import html
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

sys.stdout.reconfigure(encoding='utf-8')

DICTIONNAIRES = ('Westphal', 'Bost', 'Calmet', 'Lelievre')
if len(sys.argv) != 2 or sys.argv[1].capitalize() not in DICTIONNAIRES:
    sys.exit(__doc__)
NOM = sys.argv[1].capitalize()
SITE = 'https://www.levangile.com'
LISTE = SITE + f'/Dictionnaire-Biblique/Liste-Definitions-{NOM}.php?page={{}}'
LIEN_MOT = re.compile(rf'<a href="(/dictionnaire-biblique/definition-{NOM.lower()}-(\d+)-?[^"]*)"[^>]*>(.*?)</a>',
                      re.S | re.I)
DOSSIER = os.path.join(os.path.dirname(os.path.abspath(__file__)), NOM)
CACHE = os.path.join(DOSSIER, f'.cache_{NOM.lower()}')
SORTIE = os.path.join(DOSSIER, f'{NOM.lower()}.csv')
CONNEXIONS = 8
ENTETES = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) bible-reader'}

session = requests.Session()
session.headers.update(ENTETES)
adapter = requests.adapters.HTTPAdapter(pool_connections=CONNEXIONS, pool_maxsize=CONNEXIONS)
session.mount('https://', adapter)


def telecharger(url, essais=6):
    for n in range(essais):
        try:
            r = session.get(url, timeout=90)
            if r.status_code == 200 and r.content:
                # Le site coupe parfois un caractère accentué dans <meta description> (en-tête) : décodage
                # tolérant ; la définition elle-même est contrôlée ensuite (aucun caractère remplacé).
                return r.content.decode('utf-8', errors='replace')
            erreur = f'HTTP {r.status_code}'
        except requests.RequestException as e:
            erreur = str(e)
        time.sleep(2 ** n)
    raise RuntimeError(f'{url} : {erreur}')


def liste_des_mots():
    mots, page = [], 1
    while True:
        t = telecharger(LISTE.format(page))
        debut = t.find('list-group-flush')
        bloc = t[debut:t.find('</ul>', debut)]
        trouves = LIEN_MOT.findall(bloc)
        if not trouves:
            break
        for chemin, site_id, nom in trouves:
            mots.append({'ordre': len(mots) + 1, 'site_id': int(site_id), 'url': SITE + chemin,
                         'nom_liste': html.unescape(nom.strip())})
        page += 1
    print(f'  {NOM} : {page - 1} pages de liste, {len(mots)} mots', flush=True)
    return mots


def page_du_mot(mot):
    chemin = os.path.join(CACHE, f"{mot['site_id']}.html")
    if os.path.exists(chemin):
        with open(chemin, encoding='utf-8') as f:
            return f.read()
    t = telecharger(mot['url'])
    if '<div id="logos">' not in t:
        raise RuntimeError(f"{mot['url']} : pas de définition dans la page")
    with open(chemin + '.tmp', 'w', encoding='utf-8') as f:
        f.write(t)
    os.replace(chemin + '.tmp', chemin)
    return t


def bloc_div(t, debut):
    """Le <div …> qui commence à `debut`, jusqu'à son </div> fermant (divs imbriqués compris), tel quel."""
    profondeur = 0
    for m in re.finditer(r'<div\b|</div>', t[debut:]):
        profondeur += 1 if m.group(0) == '<div' else -1
        if profondeur == 0:
            return t[debut:debut + m.end()]
    raise ValueError('div non fermé')


def chaine_js(s):
    """Chaîne JavaScript entre apostrophes -> texte."""
    return re.sub(r"\\(.)", r'\1', s)


def analyser(mot, t):
    h1 = re.search(r'<h1>(.*?)</h1>', t, re.S).group(1)
    nom = html.unescape(re.sub(r'<[^>]+>', '', h1.split('<br', 1)[0])).strip()
    autres = [{'dictionnaire': html.unescape(x), 'url': SITE + u if u.startswith('/') else u}
              for u, x in re.findall(r'<a href="([^"]+)" class="btn[^"]*">([^<]+)</a>', h1)]
    contenu = bloc_div(t, t.find('<div id="logos">'))
    # Texte déjà abîmé sur le site (ex. « Deuil et rites funéraires ») : gardé tel quel, mais signalé
    abime = '�' in h1 + contenu
    atlas = []
    m = re.search(r'var markers\s*=\s*\[(.*?)\];', t, re.S)
    if m:
        for o in re.finditer(r"\{\s*title:\s*'((?:[^'\\]|\\.)*)',\s*adresse:\s*'((?:[^'\\]|\\.)*)',"
                             r"\s*lng:\s*(-?[\d.]+),\s*lat:\s*(-?[\d.]+)\s*\}", m.group(1)):
            atlas.append({'titre': chaine_js(o.group(1)), 'adresse': chaine_js(o.group(2)),
                          'lat': float(o.group(4)), 'lng': float(o.group(3))})
        if not atlas and m.group(1).strip():
            raise ValueError(f"{mot['url']} : atlas non reconnu")
    copie = re.search(r'<div id="copy"[^>]*>(.*?)</div>', t, re.S)
    numerisation = html.unescape(re.sub(r'<[^>]+>', '', copie.group(1))).strip() if copie else ''
    return {**mot, 'entry_name': nom, 'autres_dictionnaires': json.dumps(autres, ensure_ascii=False) if autres else '',
            'content': contenu, 'atlas': json.dumps(atlas, ensure_ascii=False) if atlas else '',
            'numerisation': numerisation, 'abime': abime}


def main():
    os.makedirs(CACHE, exist_ok=True)
    print('1. Liste des mots…')
    mots = liste_des_mots()
    ids = [m['site_id'] for m in mots]
    if len(set(ids)) != len(ids):
        print(f'   ⚠️  {len(ids) - len(set(ids))} mot(s) listé(s) deux fois sur le site (gardés une fois)')
        vus = set()
        mots = [m for m in mots if not (m['site_id'] in vus or vus.add(m['site_id']))]
    print(f'2. Pages des mots ({CONNEXIONS} connexions)…')
    pages, echecs, debut = {}, [], time.time()
    with ThreadPoolExecutor(CONNEXIONS) as pool:
        futurs = {pool.submit(page_du_mot, m): m for m in mots}
        for n, f in enumerate(as_completed(futurs), 1):
            m = futurs[f]
            try:
                pages[m['site_id']] = f.result()
            except Exception as e:
                echecs.append(str(e))
            if n % 500 == 0 or n == len(mots):
                print(f'   {n}/{len(mots)} ({time.time() - debut:.0f} s)', flush=True)
    if echecs:
        print(f'❌ {len(echecs)} page(s) en échec, rien n’est écrit (relancez : les pages déjà reçues sont gardées) :')
        for e in echecs:
            print('   ', e)
        sys.exit(1)

    print('3. Analyse des pages…')
    lignes = [analyser(m, pages[m['site_id']]) for m in mots]
    colonnes = ['ordre', 'site_id', 'entry_name', 'url', 'autres_dictionnaires', 'content', 'atlas', 'numerisation']
    try:
        f = open(SORTIE, 'w', encoding='utf-8-sig', newline='')
    except PermissionError:
        f = open(SORTIE.replace('.csv', '.nouveau.csv'), 'w', encoding='utf-8-sig', newline='')
    with f:
        w = csv.DictWriter(f, fieldnames=colonnes, delimiter=';', extrasaction='ignore')
        w.writeheader()
        w.writerows(lignes)
    for l in lignes:
        if l['abime']:
            print(f"   ⚠️  texte déjà abîmé sur le site : {l['entry_name']} ({l['url']})")
    differents = [l for l in lignes if l['entry_name'] != l['nom_liste']]
    print(f"✅ {len(lignes)} définitions -> {f.name}")
    print(f"   avec atlas : {sum(1 for l in lignes if l['atlas'])}, "
          f"avec liens vers d'autres dictionnaires : {sum(1 for l in lignes if l['autres_dictionnaires'])}")
    if differents:
        print(f"   {len(differents)} titre(s) de page différent(s) du nom dans la liste, ex. "
              + ', '.join(f"{l['nom_liste']} / {l['entry_name']}" for l in differents[:5]))


if __name__ == '__main__':
    main()
