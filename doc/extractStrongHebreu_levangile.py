"""Lexique hébreu Strong de levangile.com (lexique-hebreu-<n>-…) -> doc/strong_hebreu_levangile.csv

Même source et même format que les codes H1 à H5652 déjà dans strong_codes :
  mot_original, origine_mot, mot_translitere, type_mot, traduction_generale (« … est traduit dans la Louis Segond par »),
  content (définition : la ligne <tr> du site, comme dans la base)
Le texte de chaque case est pris comme dans la base : morceaux de texte collés, espaces autour des balises retirés
(« Vient de’elowahh, rarement raccourci ’eloahh0433 », « ’elohiym(el-o-heem’) »).
La base n'est pas modifiée.

Usage (depuis la racine du projet) :
  python doc/extractStrongHebreu_levangile.py                codes 5653 à 8674 (ceux qui manquent)
  python doc/extractStrongHebreu_levangile.py 1 8674         autre plage
"""
import csv
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding='utf-8')

URL = 'https://www.levangile.com/lexique-hebreu-{}-x'  # le nom après le numéro n'est pas vérifié par le site
SORTIE = os.path.join('doc', 'strong_hebreu_levangile.csv')
COLONNES = ['code', 'mot_original', 'origine_mot', 'mot_translitere', 'type_mot', 'traduction_generale', 'content']
CONNEXIONS = 16
session = requests.Session()
session.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) bible-reader'
session.mount('https://', requests.adapters.HTTPAdapter(pool_maxsize=CONNEXIONS))


def telecharger(code, essais=6):
    for n in range(essais):
        try:
            r = session.get(URL.format(code), timeout=60)
            if r.status_code == 200:
                return r.content.decode('utf-8', errors='replace')
            if r.status_code == 404:
                return None
        except requests.RequestException:
            pass
        time.sleep(2 ** n)
    raise RuntimeError(f'H{code} : page introuvable après {essais} essais')


def analyser(code, page):
    s = BeautifulSoup(page, 'lxml')
    hebreu = s.find('td', class_='hebreu')
    if hebreu is None:
        return None  # page sans fiche (code inexistant)
    numero = s.find('td', class_='demistrong').get_text(strip=True)
    if not numero.endswith(f' {code}') and not numero.endswith(f' : {code}') and str(code) not in numero.split():
        if numero.split(':')[-1].strip() != str(code):
            raise ValueError(f'H{code} : la page affiche « {numero} »')
    ligne = hebreu.find_parent('tr')
    origine = ligne.find_all('td')[1]
    cases = ligne.find_next_sibling('tr').find_next_sibling('tr').find_all('td')
    for svg in cases[0].find_all('svg'):
        svg.decompose()
    traduction, definition = '', ''
    for titre in s.find_all('td', class_='pleine'):
        texte = titre.get_text()
        if 'est traduit' in texte and not traduction:
            traduction = titre.find_parent('tr').find_next_sibling('tr').get_text(strip=True)
        elif texte.strip().startswith('Définition') and not definition:
            # Comme content dans la base : la ligne <tr> de la définition, sur une ligne, entre guillemets
            definition = '"' + re.sub(r'\s*\n\s*', ' ', str(titre.find_parent('tr').find_next_sibling('tr'))) + '"'
    return [code, hebreu.get_text(strip=True), origine.get_text(strip=True), cases[0].get_text(strip=True),
            cases[1].get_text(strip=True), traduction, definition]


def main():
    debut, fin = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) >= 3 else (5653, 8674)
    codes = list(range(debut, fin + 1))
    print(f'Codes H{debut} à H{fin} ({len(codes)} pages, {CONNEXIONS} connexions)…', flush=True)
    lignes, absents, t0 = {}, [], time.time()
    with ThreadPoolExecutor(CONNEXIONS) as pool:
        futurs = {pool.submit(telecharger, c): c for c in codes}
        for n, f in enumerate(as_completed(futurs), 1):
            c = futurs[f]
            page = f.result()
            ligne = analyser(c, page) if page else None
            if ligne:
                lignes[c] = ligne
            else:
                absents.append(c)
            if n % 500 == 0 or n == len(codes):
                print(f'   {n}/{len(codes)} ({time.time() - t0:.0f} s)', flush=True)
    sortie = sys.argv[3] if len(sys.argv) > 3 else SORTIE
    with open(sortie, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f, delimiter=';')
        w.writerow(COLONNES)
        w.writerows(lignes[c] for c in sorted(lignes))
    print(f'✅ {len(lignes)} codes -> {sortie} ({time.time() - t0:.0f} s)')
    if absents:
        print(f'   ⚠️  {len(absents)} code(s) sans fiche sur le site : {sorted(absents)[:20]}')


if __name__ == '__main__':
    main()
