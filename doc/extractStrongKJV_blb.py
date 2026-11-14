"""Codes Strong de la King James (KJV) depuis Blue Letter Bible, un CSV par livre.

Source : https://www.blueletterbible.org/kjv/<livre>/<chapitre>/1/ss1/  (une page = un chapitre, codes Strong affichés)
Le site demande une seconde entre deux pages (robots.txt : Crawl-Delay: 1) : le script s'y tient,
d'où environ 30 à 40 minutes pour toute la Bible. Il peut être interrompu et relancé : les livres déjà
écrits sont conservés (option --tout pour tout refaire).

Mêmes colonnes que l'extraction Segond 1910 :
  livre_code   code OSIS (Gen, Exod… Matt… Rev), comme strong_code_bible_links
  livre_nom    nom français du livre
  chapitre, verset  numérotation KJV (celle de la base)
  version, lang     KJV, en
  type_entite  reference    groupe de mots portant un code Strong
               mot_ajoute   mots en italique de la KJV, ajoutés par les traducteurs (sans code)
               souscription fin des épîtres « Written from Rome… » (avec codes)
               mot_outil    autre groupe sans code
  data_lm      morphologie du mot original (ex. « Noun: Common Masculine Plural Absolute »)
  data_pa      position du mot original dans le verset / code (ex. « 3/h0430 ») : même data_pa = même mot original
  data_ns      code(s) Strong (ex. « 430 » ou « 3739, 1437 »)
  contenu      groupe de mots tel qu'affiché, avec sa ponctuation (ex. « In the beginning », « the earth. »)

Usage (depuis le dossier doc) :
  python extractStrongKJV_blb.py              toute la Bible (reprend où elle s'était arrêtée)
  python extractStrongKJV_blb.py Gen Matt     seulement ces livres
  python extractStrongKJV_blb.py --tout       tout retélécharger
"""
import csv
import os
import re
import sys
import time

import requests
from bs4 import BeautifulSoup, NavigableString, Comment
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

sys.stdout.reconfigure(encoding='utf-8')

DOSSIER_SORTIE = 'extraction_blb_kjv'
FICHIER_REFERENCE = 'reference_lsg.csv'  # nombre de chapitres de chaque livre (même structure que la KJV de la base)
DELAI = 1.0  # secondes entre deux pages (Crawl-Delay du site)

EN_TETES = ['livre_code', 'livre_nom', 'chapitre', 'verset', 'version', 'lang',
            'type_entite', 'data_lm', 'data_pa', 'data_ns', 'contenu']

OSIS = ('Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song '
        'Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom '
        '1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev').split()
BLB = ('gen exo lev num deu jos jdg rth 1sa 2sa 1ki 2ki 1ch 2ch ezr neh est job psa pro ecc sng '
       'isa jer lam eze dan hos joe amo oba jon mic nah hab zep hag zec mal mat mar luk jhn act rom '
       '1co 2co gal eph phl col 1th 2th 1ti 2ti tit phm heb jas 1pe 2pe 1jo 2jo 3jo jde rev').split()
NOMS = ('Genèse;Exode;Lévitique;Nombres;Deutéronome;Josué;Juges;Ruth;1 Samuel;2 Samuel;1 Rois;2 Rois;1 Chroniques;'
        '2 Chroniques;Esdras;Néhémie;Esther;Job;Psaumes;Proverbes;Ecclésiaste;Cantique des Cantiques;Ésaïe;Jérémie;'
        'Lamentations;Ézéchiel;Daniel;Osée;Joël;Amos;Abdias;Jonas;Michée;Nahum;Habakuk;Sophonie;Aggée;Zacharie;'
        'Malachie;Matthieu;Marc;Luc;Jean;Actes;Romains;1 Corinthiens;2 Corinthiens;Galates;Éphésiens;Philippiens;'
        'Colossiens;1 Thessaloniciens;2 Thessaloniciens;1 Timothée;2 Timothée;Tite;Philémon;Hébreux;Jacques;1 Pierre;'
        '2 Pierre;1 Jean;2 Jean;3 Jean;Jude;Apocalypse').split(';')

ESPACES = re.compile(r'[\s   ​]+')
# Ponctuation ouvrante en fin de texte libre : va au groupe suivant (« [[A Psalm », « (for »)
OUVRANTE = re.compile(r'(?:^|\s)([\[(«“‘]+)\s*$')
MORPHO = ['data-speech', 'data-code-one', 'data-code-two', 'data-code-three', 'data-tense', 'data-voice',
          'data-mood', 'data-person', 'data-case', 'data-gender', 'data-number', 'data-degree']


# --- Téléchargement : une page à la fois, une seconde d'écart, nouvelles tentatives ---
session = requests.Session()
session.mount('https://', HTTPAdapter(max_retries=Retry(total=5, backoff_factor=3,
                                                         status_forcelist=[429, 500, 502, 503, 504])))
session.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
dernier_appel = [0.0]


def telecharger(url):
    attente = DELAI - (time.time() - dernier_appel[0])
    if attente > 0:
        time.sleep(attente)
    try:
        reponse = session.get(url, timeout=90)
    finally:
        dernier_appel[0] = time.time()
    reponse.raise_for_status()
    return reponse


# --- Analyse d'un verset ---
def morphologie(span):
    parties = []
    for a in MORPHO:
        v = span.get(a)
        if v and v not in parties:
            parties.append(v)
    return ' ; '.join(parties) or None


def texte_du_groupe(span):
    """Texte affiché du groupe, sans les codes (sup) ni les flèches."""
    morceaux = []
    for enfant in span.children:
        if isinstance(enfant, Comment):
            continue
        if isinstance(enfant, NavigableString):
            morceaux.append(str(enfant))
        elif enfant.name == 'sup' or 'strongs-additional' in (enfant.get('class') or []):
            continue
        else:
            morceaux.append(enfant.get_text())
    return ESPACES.sub(' ', ''.join(morceaux)).strip()


def parcourir(element, sortie, souscription=False):
    """Aplatit le verset : ('groupe', span, souscription) / ('texte', str) / ('note', str)."""
    for enfant in element.children:
        if isinstance(enfant, Comment):
            continue
        if isinstance(enfant, NavigableString):
            sortie.append(('texte', str(enfant)))
            continue
        classes = enfant.get('class') or []
        if enfant.name in ('img', 'sup') or 'hide-for-tablet' in classes or 'ftnt' in classes:
            continue  # case à cocher, référence « Gen 1:1 », séparateur « - », appel de note « [fn] »
        if 'see-footnotes' in classes:
            sortie.append(('note', ESPACES.sub(' ', enfant.get_text()).strip()))
        elif 'word-phrase' in classes:
            sortie.append(('groupe', enfant, souscription))
        else:  # valediction (souscription), span.rl…
            parcourir(enfant, sortie, souscription or enfant.name == 'valediction')
    return sortie


def elements_du_verset(div):
    elements, prefixe, dernier = [], '', None
    groupes = [v for v in parcourir(div, []) if v[0] == 'groupe']
    # Position du mot original dans le verset : rang de son identifiant (ordre du texte hébreu ou grec)
    ids = sorted({int(g[1].get('data-related-language-id')) for g in groupes
                  if (g[1].get('data-related-language-id') or '').isdigit() and g[1].get('data-strongs')})
    rang = {i: n for n, i in enumerate(ids, 1)}
    for valeur in parcourir(div, []):
        if valeur[0] == 'groupe':
            span, souscription = valeur[1], valeur[2]
            texte = texte_du_groupe(span)
            codes = [span.get('data-strongs')] if span.get('data-strongs') else []
            codes += [a.get_text(strip=True)[1:] for a in span.select('span.strongs-additional a')]
            codes = [c for c in codes if c]
            langue = (span.get('data-language') or '').lower()
            prefixe_code = 'h' if langue == 'hebrew' or any(
                a.get_text(strip=True).startswith('H') for a in span.select('sup.strongs a')) else 'g'
            if codes:
                type_entite = 'souscription' if souscription else 'reference'
                rid = span.get('data-related-language-id') or ''
                position = rang.get(int(rid)) if rid.isdigit() else None
                data_pa = f"{position}/{prefixe_code}{int(codes[0]):04d}" if position and codes[0].isdigit() else None
            else:
                type_entite = 'mot_ajoute' if span.find('em') else ('souscription' if souscription else 'mot_outil')
                data_pa = None
            if not texte:
                continue
            dernier = {'type_entite': type_entite, 'data_lm': morphologie(span) if codes else None,
                       'data_pa': data_pa, 'data_ns': ', '.join(codes) or None, 'contenu': prefixe + texte}
            elements.append(dernier)
            prefixe = ''
        elif valeur[0] == 'note':
            elements.append({'type_entite': 'note', 'data_lm': None, 'data_pa': None, 'data_ns': None,
                             'contenu': valeur[1]})
        else:
            texte = ESPACES.sub(' ', valeur[1])
            if not texte.strip():
                continue
            ouvrante = ''
            m = OUVRANTE.search(texte)
            if m:
                ouvrante, texte = m.group(1), texte[:m.start()]
            if texte.strip():
                if dernier is not None and not prefixe:
                    dernier['contenu'] += texte.rstrip() if not texte[0].isspace() else ' ' + texte.strip()
                else:
                    prefixe += texte.strip() + ' '
            prefixe += ouvrante
    if prefixe.strip():
        elements.append({'type_entite': 'texte_brut', 'data_lm': None, 'data_pa': None, 'data_ns': None,
                         'contenu': prefixe.strip()})
    return elements


def extraire_chapitre(n_livre, chapitre):
    url = f"https://www.blueletterbible.org/kjv/{BLB[n_livre]}/{chapitre}/1/ss1/"
    reponse = telecharger(url)
    if f"/kjv/{BLB[n_livre]}/{chapitre}/" not in reponse.url:
        raise ValueError(f"page redirigée vers {reponse.url}")
    soup = BeautifulSoup(reponse.text, 'lxml')
    lignes, versets, notes = [], 0, []
    for div in soup.select('div.EngBibleText[data-print-verse-prefix]'):
        verset = div['data-print-verse-prefix']
        elements = elements_du_verset(div)
        if not any(e['type_entite'] != 'note' for e in elements):
            notes.append(f"{verset} ({' '.join(e['contenu'] for e in elements) or 'vide'})")
            continue  # verset sans texte (ex. 3 Jean 1:15 « See Footnote ») : ignoré
        versets += 1
        for e in elements:
            lignes.append([OSIS[n_livre], NOMS[n_livre], chapitre, verset, 'KJV', 'en', e['type_entite'],
                           e['data_lm'], e['data_pa'], e['data_ns'], e['contenu']])
    return lignes, versets, notes


def main():
    if not os.path.exists(FICHIER_REFERENCE):
        sys.exit(f"❌ {FICHIER_REFERENCE} introuvable : lancez  python correction_bible.py --exporter-reference")
    attendus = {}
    with open(FICHIER_REFERENCE, encoding='utf-8-sig') as f:
        for l in csv.DictReader(f, delimiter=';'):
            cle = (int(l['ordre']) - 1, int(l['chapitre']))
            attendus[cle] = attendus.get(cle, 0) + 1
    os.makedirs(DOSSIER_SORTIE, exist_ok=True)
    tout = '--tout' in sys.argv
    demandes = [a for a in sys.argv[1:] if not a.startswith('-')]
    inconnus = [a for a in demandes if a not in OSIS]
    if inconnus:
        sys.exit(f"❌ Livres inconnus : {', '.join(inconnus)} (codes : {', '.join(OSIS)})")
    livres = [OSIS.index(a) for a in demandes] if demandes else range(len(OSIS))

    debut = time.time()
    journal = open(os.path.join(DOSSIER_SORTIE, 'journal_extraction.txt'), 'a', encoding='utf-8-sig')
    journal.write(f"\n=== {time.strftime('%Y-%m-%d %H:%M:%S')} : {len(livres)} livre(s)\n")
    for n in livres:
        fichier = os.path.join(DOSSIER_SORTIE, f'{OSIS[n]}.csv')
        if os.path.exists(fichier) and not tout and not demandes:
            print(f"  {OSIS[n]} déjà extrait, ignoré")
            continue
        chapitres = sorted(c for (l, c) in attendus if l == n)
        donnees, ecarts, erreurs = [], [], []
        for ch in chapitres:
            try:
                lignes, versets, notes = extraire_chapitre(n, ch)
            except Exception as e:
                erreurs.append(f"ERREUR - {OSIS[n]} {ch}: {e}")
                continue
            donnees.extend(lignes)
            if versets != attendus[(n, ch)]:
                ecarts.append(f"ATTENTION - {OSIS[n]} {ch}: {versets} versets au lieu de {attendus[(n, ch)]}")
            for note in notes:
                ecarts.append(f"VERSET SANS TEXTE - {OSIS[n]} {ch}:{note}")
        for ligne in erreurs + ecarts:
            journal.write(ligne + '\n')
        if erreurs:  # livre incomplet : on ne l'écrit pas, il sera repris au prochain lancement
            print(f"  ❌ {OSIS[n]} : {len(erreurs)} chapitre(s) en erreur, livre non écrit (relancez le script)")
            journal.flush()
            continue
        try:
            f = open(fichier, 'w', newline='', encoding='utf-8-sig')
        except PermissionError:
            fichier = fichier[:-4] + '.nouveau.csv'
            f = open(fichier, 'w', newline='', encoding='utf-8-sig')
        with f:
            w = csv.writer(f, delimiter=';')
            w.writerow(EN_TETES)
            w.writerows(donnees)
        codes = sum(1 for d in donnees if d[9])
        message = (f"{OSIS[n]:6s} ({NOMS[n]:25s}): {len(chapitres):3d} chapitres, {len(donnees):6d} lignes, "
                   f"{codes} avec code Strong -> {os.path.basename(fichier)}")
        journal.write(message + '\n')
        journal.flush()
        print(f"  ✅ {message}  ({time.time() - debut:.0f} s)", flush=True)
    journal.close()
    print(f"\n✅ Terminé en {time.time() - debut:.0f} s — résultats dans {DOSSIER_SORTIE}/")


if __name__ == '__main__':
    main()
