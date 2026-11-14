"""Extraction rapide de la concordance Segond 1910 (concordance.bible), un CSV par livre.

- Liste des chapitres : celle de la Louis Segond de la base (reference_lsg.csv, voir correction_bible.py),
  plus un chapitre de réserve par livre (numérotation hébraïque : Joël 4). Le site redirige un chapitre
  inexistant vers le dernier chapitre du livre (Mal/4 -> Mal/3) : ces doublons sont détectés et ignorés.
- Les numéros de chapitre et de verset sont ceux du SITE ; correction_bible.py les aligne ensuite sur la base.
- Ponctuation rattachée au bon mot et nettoyée (sans retours à la ligne ni espaces superflus) :
    « toi, »  « Éternel ! »  « sainte. »  « -Pause. »  « «Venez »
  une ponctuation fermante va au mot précédent (jamais au ◎), une ponctuation ouvrante au mot suivant.
- Fichiers en UTF-8 avec BOM : les accents s'affichent correctement dans Excel.

Usage (depuis le dossier doc) :
  python extractDataFromConcordance_rapide.py              toute la Bible
  python extractDataFromConcordance_rapide.py Matt Mark    seulement ces livres
"""
import csv
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import local

import requests
from bs4 import BeautifulSoup, NavigableString, Comment
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

sys.stdout.reconfigure(encoding='utf-8')

# --- Configuration ---
versions = ["Sg1910"]
versions_str = "_".join(versions)
TELECHARGEMENTS_SIMULTANES = 8
dossier_sortie = 'extraction_concordance_Sg1910'
fichier_reference = 'reference_lsg.csv'
os.makedirs(dossier_sortie, exist_ok=True)

en_tetes = ['livre_code', 'livre_nom', 'chapitre', 'verset', 'version', 'lang',
            'type_entite', 'data-lm', 'data-pa', 'data-ns', 'contenu']

OSIS = ('Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song '
        'Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom '
        '1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev').split()
NOMS = ('Genèse;Exode;Lévitique;Nombres;Deutéronome;Josué;Juges;Ruth;1 Samuel;2 Samuel;1 Rois;2 Rois;1 Chroniques;'
        '2 Chroniques;Esdras;Néhémie;Esther;Job;Psaumes;Proverbes;Ecclésiaste;Cantique des Cantiques;Ésaïe;Jérémie;'
        'Lamentations;Ézéchiel;Daniel;Osée;Joël;Amos;Abdias;Jonas;Michée;Nahum;Habakuk;Sophonie;Aggée;Zacharie;'
        'Malachie;Matthieu;Marc;Luc;Jean;Actes;Romains;1 Corinthiens;2 Corinthiens;Galates;Éphésiens;Philippiens;'
        'Colossiens;1 Thessaloniciens;2 Thessaloniciens;1 Timothée;2 Timothée;Tite;Philémon;Hébreux;Jacques;1 Pierre;'
        '2 Pierre;1 Jean;2 Jean;3 Jean;Jude;Apocalypse').split(';')

# --- Chapitres : ceux de la base (Louis Segond), plus un de réserve par livre ---
if not os.path.exists(fichier_reference):
    sys.exit(f"❌ {fichier_reference} introuvable : lancez d'abord  python correction_bible.py --exporter-reference")
nb_chapitres = {}
with open(fichier_reference, encoding='utf-8-sig') as f:
    for ligne in csv.DictReader(f, delimiter=';'):
        code = OSIS[int(ligne['ordre']) - 1]
        nb_chapitres[code] = max(nb_chapitres.get(code, 0), int(ligne['chapitre']))
structure_bible = {code: {'nom': NOMS[i], 'chapitres': nb_chapitres[code]} for i, code in enumerate(OSIS)}

livres_demandes = sys.argv[1:]
if livres_demandes:
    inconnus = [code for code in livres_demandes if code not in structure_bible]
    if inconnus:
        sys.exit(f"❌ Livres inconnus : {', '.join(inconnus)} (codes attendus : {', '.join(structure_bible)})")
    structure_bible = {code: info for code, info in structure_bible.items() if code in livres_demandes}

taches = [(code, ch) for code, info in structure_bible.items() for ch in range(1, info['chapitres'] + 2)]
print(f"📚 {len(structure_bible)} livre(s), {len(taches)} pages (dont 1 de réserve par livre), "
      f"{TELECHARGEMENTS_SIMULTANES} téléchargements simultanés")

# --- Téléchargement : une session par fil, nouvelles tentatives automatiques ---
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
sessions = local()


def session():
    if not hasattr(sessions, 's'):
        s = requests.Session()
        retry = Retry(total=4, backoff_factor=1.5, status_forcelist=[429, 500, 502, 503, 504])
        s.mount('https://', HTTPAdapter(max_retries=retry))
        s.headers.update(headers)
        sessions.s = s
    return sessions.s


# --- Analyse d'un verset ---
ESPACES = re.compile(r'[\s   ​]+')
# Ponctuation ouvrante en fin de texte : se rattache au mot suivant
#   « ( [ “ (suivis ou non d'une espace), ou tiret précédé d'une espace et collé au mot suivant (« ! -Pause »)
OUVRANTE = re.compile(r'(?:^|\s)([«(\[“‹]+)\s*$|\s([-–—]+)$')


def parcourir(element, sortie):
    """Aplatit le verset dans l'ordre du document : ('mot', w) / ('cercle', w|seg) / ('texte', str) / ('note', str)."""
    for enfant in element.children:
        if isinstance(enfant, Comment):
            continue
        if isinstance(enfant, NavigableString):
            sortie.append(('texte', str(enfant)))
        elif enfant.name == 'w':
            sortie.append(('cercle' if enfant.get_text(strip=True) in ('', '◎') else 'mot', enfant))
        elif enfant.name == 'seg' and enfant.get('data-ns'):
            sortie.append(('cercle', enfant))
        elif enfant.name == 'note':
            texte = ESPACES.sub(' ', enfant.get_text()).strip()
            if texte:
                sortie.append(('note', texte))
        else:  # span.strong-untranslated, hi, seg sans code… : on descend
            parcourir(enfant, sortie)
    return sortie


def entite(element, contenu):
    data_lm = element.get('data-lm') or None
    data_pa = element.get('data-pa') or None
    data_ns = element.get('data-ns') or None
    if element.name == 'seg':
        type_entite = 'code_strong'
    elif data_pa and data_ns:
        type_entite = 'reference'
    elif data_lm:
        type_entite = 'lemme'
    else:
        type_entite = 'mot_outil'
    return {'type_entite': type_entite, 'data_lm': data_lm, 'data_pa': data_pa, 'data_ns': data_ns, 'contenu': contenu}


def elements_du_verset(td):
    """Mots du verset avec leur ponctuation, prêts à écrire."""
    resultats, prefixe = [], ''
    dernier_mot = None  # dernier vrai mot (pas un ◎), qui reçoit la ponctuation fermante
    for genre, valeur in parcourir(td, []):
        if genre == 'mot':
            mot = ESPACES.sub(' ', valeur.get_text()).strip()
            dernier_mot = entite(valeur, prefixe + mot)
            resultats.append(dernier_mot)
            prefixe = ''
        elif genre == 'cercle':
            resultats.append(entite(valeur, '◎'))
        elif genre == 'note':
            resultats.append({'type_entite': 'note', 'data_lm': None, 'data_pa': None, 'data_ns': None, 'contenu': valeur})
        else:
            texte = ESPACES.sub(' ', valeur)
            if not texte.strip():
                continue
            ouvrante = ''
            m = OUVRANTE.search(texte)
            if m:
                ouvrante = (m.group(1) or m.group(2)).strip()
                texte = texte[:m.start()]
            fermante = texte.rstrip()
            if fermante.strip():
                if dernier_mot is not None and not prefixe:
                    # « toi » + « , » -> « toi, » ; « Éternel » + « ! » -> « Éternel ! » (espaces du site conservées)
                    dernier_mot['contenu'] += fermante if not fermante[0].isspace() else ' ' + fermante.strip()
                else:
                    prefixe += fermante.strip() + ' '  # ponctuation en début de verset : va au premier mot
            prefixe += ouvrante
    if prefixe.strip():  # ponctuation seule en fin de verset, sans mot pour la porter
        resultats.append({'type_entite': 'texte_brut', 'data_lm': None, 'data_pa': None, 'data_ns': None,
                          'contenu': prefixe.strip()})
    return resultats


def traiter_chapitre(livre_code, chapitre):
    """Télécharge et analyse un chapitre ; renvoie (lignes CSV, versets, erreur, texte du chapitre, redirigé)."""
    livre_nom = structure_bible[livre_code]['nom']
    url = f"https://concordance.bible/parallelv/{versions_str}/{livre_code}/{chapitre}/"
    try:
        reponse = session().get(url, timeout=60)
        reponse.raise_for_status()
    except Exception as e:
        return [], 0, str(e), '', False
    # Chapitre inexistant : le site renvoie un autre chapitre (ex. Mal/4 -> Mal/3)
    redirige = reponse.url.rstrip('/') != url.rstrip('/')
    soup = BeautifulSoup(reponse.text, 'lxml')
    lignes, compteur, textes = [], 0, []
    for tr in soup.find_all('tr'):
        th = tr.find('th', id=lambda x: x and x.startswith('v'))
        if not th:
            continue
        num_verset = th.get_text(strip=True)
        compteur += 1
        for td in tr.find_all('td'):
            version = td.get('data-bible', 'inconnue')
            lang = td.get('lang', 'inconnu')
            textes.append(ESPACES.sub('', td.get_text()))
            for el in elements_du_verset(td):
                lignes.append([livre_code, livre_nom, chapitre, num_verset, version, lang, el['type_entite'],
                               el['data_lm'], el['data_pa'], el['data_ns'], el['contenu']])
    return lignes, compteur, None, ''.join(textes), redirige


# --- Extraction en parallèle ---
debut = time.time()
resultats = {}
erreurs = []
with ThreadPoolExecutor(max_workers=TELECHARGEMENTS_SIMULTANES) as pool:
    futures = {pool.submit(traiter_chapitre, code, ch): (code, ch) for code, ch in taches}
    for fait, future in enumerate(as_completed(futures), 1):
        code, ch = futures[future]
        lignes, compteur, erreur, texte, redirige = future.result()
        resultats[(code, ch)] = (lignes, compteur, texte, redirige)
        if erreur:
            erreurs.append(f"ERREUR - {code} ch.{ch}: {erreur}")
        if fait % 25 == 0 or fait == len(taches):
            ecoule = time.time() - debut
            print(f"  {fait}/{len(taches)} pages ({ecoule:.0f} s, reste ~{ecoule / fait * (len(taches) - fait):.0f} s)", flush=True)

# --- Un CSV par livre ; journal ---
fichier_log = os.path.join(dossier_sortie, 'journal_extraction.txt')
total = 0
with open(fichier_log, 'w', encoding='utf-8-sig') as log:
    log.write("JOURNAL D'EXTRACTION DE LA CONCORDANCE BIBLIQUE (version rapide)\n")
    log.write(f"Date : {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
    log.write(f"Versions : {', '.join(versions)}\nChapitres : {fichier_reference} (+1 de réserve par livre)\n")
    log.write("Numérotation : celle du site (alignement sur la base : correction_bible.py)\n")
    log.write("=" * 60 + "\n\n")
    for ligne in erreurs:
        log.write(ligne + "\n")
    for code, info in structure_bible.items():
        donnees, versets, chapitres, vus = [], 0, 0, {}
        for ch in range(1, info['chapitres'] + 2):
            lignes, compteur, texte, redirige = resultats.get((code, ch), ([], 0, '', False))
            if not lignes:
                continue
            if redirige or texte in vus:
                log.write(f"IGNORÉ  - {code} ch.{ch}: page inexistante sur le site "
                          f"(le site renvoie le chapitre {vus.get(texte, '?')})\n")
                continue
            vus[texte] = ch
            donnees.extend(lignes)
            versets += compteur
            chapitres += 1
        if not donnees:
            log.write(f"{code:6s} ({info['nom']:25s}): AUCUNE DONNÉE\n")
            continue
        nom_fichier = f"{code}.csv"
        try:
            f = open(os.path.join(dossier_sortie, nom_fichier), 'w', newline='', encoding='utf-8-sig')
        except PermissionError:  # fichier ouvert dans Excel : on écrit à côté plutôt que de tout perdre
            nom_fichier = f"{code}.nouveau.csv"
            f = open(os.path.join(dossier_sortie, nom_fichier), 'w', newline='', encoding='utf-8-sig')
            print(f"⚠️  {code}.csv est ouvert (Excel ?) : résultat écrit dans {nom_fichier}")
            log.write(f"ATTENTION - {code}.csv ouvert dans un autre programme : résultat écrit dans {nom_fichier}\n")
        with f:
            writer = csv.writer(f, delimiter=';')
            writer.writerow(en_tetes)
            writer.writerows(donnees)
        codes_strong = sum(1 for r in donnees if r[9])
        cercles = sum(1 for r in donnees if r[10] == '◎')
        total += len(donnees)
        log.write(f"{code:6s} ({info['nom']:25s}): {chapitres:3d} chapitres sur le site (base : {info['chapitres']}), "
                  f"{versets:5d} versets, {len(donnees):8,d} entrées, {codes_strong} codes Strong, {cercles} ◎ -> {nom_fichier}\n")
    log.write(f"\nEntrées totales : {total:,}\nErreurs de téléchargement : {len(erreurs)}\n")
    log.write(f"Durée : {time.time() - debut:.0f} s\n")

print(f"\n✅ Terminé en {time.time() - debut:.0f} s : {total:,} entrées, {len(erreurs)} erreur(s) de téléchargement")
print(f"📁 Résultats : {dossier_sortie}/  —  journal : {fichier_log}")
print("➡️  Étape suivante : python correction_bible.py")
