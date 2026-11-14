"""Aligne l'extraction de la concordance (numérotation du site) sur la Louis Segond de la base.

Principe : le site et la base contiennent le même texte Segond 1910 ; seules les limites des chapitres
et des versets diffèrent (suscriptions des Psaumes, Joël 3-4, Malachie 3-4, 2 Corinthiens 13, 3 Jean…).
Chaque mot extrait est donc retrouvé dans le texte LSG de la base (reference_lsg.csv) et reçoit le chapitre
et le verset de la base. Aucune liste de corrections à tenir à jour : tous les livres sont traités.

- Entrée  : extraction_concordance_Sg1910/<Livre>.csv          (produit par extractDataFromConcordance_rapide.py)
- Sortie  : extraction_concordance_Sg1910_lsg/<Livre>.csv      (même format, numérotation de la base)
- Rapport : corrections.csv  (chaque verset du site et le verset de la base où il a été placé)
            correction_bible.log (contrôles : nombre de versets de chaque chapitre, mots non retrouvés)
Les fichiers d'entrée ne sont pas modifiés : le script peut être relancé autant de fois que nécessaire.

La base n'est jamais modifiée ; elle est seulement lue pour créer reference_lsg.csv :
  python correction_bible.py --exporter-reference     (re)crée reference_lsg.csv depuis la base locale
  python correction_bible.py                          aligne tous les livres
  python correction_bible.py Joel Mal                 seulement ces livres
"""
import bisect
import csv
import os
import re
import subprocess
import sys
import unicodedata
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

DOSSIER_ENTREE = 'extraction_concordance_Sg1910'
DOSSIER_SORTIE = 'extraction_concordance_Sg1910_lsg'
FICHIER_REFERENCE = 'reference_lsg.csv'
FICHIER_CORRECTIONS = 'corrections.csv'
FICHIER_LOG = 'correction_bible.log'
CONTENEUR_BASE = 'supabase_db_bible-reader'

OSIS = ('Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song '
        'Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom '
        '1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev').split()


def exporter_reference():
    """Copie le texte Louis Segond de la base locale (lecture seule) dans reference_lsg.csv."""
    requete = ("\\copy (select b.order_index as ordre, b.code as code_base, c.number as chapitre, "
               "v.verse_number as verset, vt.text as texte from books b join chapters c on c.book_id = b.id "
               "join verses v on v.chapter_id = c.id join verse_texts vt on vt.verse_id = v.id "
               "join bible_versions bv on bv.id = vt.version_id and bv.code = 'LSG' order by 1, 3, 4) "
               "to stdout with (format csv, header, delimiter ';')")
    sortie = subprocess.run(['docker', 'exec', CONTENEUR_BASE, 'psql', '-U', 'postgres', '-At', '-c', requete],
                            capture_output=True, text=True, encoding='utf-8')
    if sortie.returncode != 0:
        sys.exit(f"❌ Lecture de la base impossible (Supabase local démarré ?) :\n{sortie.stderr}")
    with open(FICHIER_REFERENCE, 'w', encoding='utf-8-sig', newline='') as f:
        f.write(sortie.stdout)
    print(f"✅ {FICHIER_REFERENCE} : {sortie.stdout.count(chr(10)) - 1} versets")


def cles(texte):
    """Mots comparables : minuscules, sans accents ni ponctuation (œ = oe, « À » = « A », « Jésus-Christ » = « Jésus Christ »)."""
    texte = texte.lower().replace('œ', 'oe').replace('æ', 'ae')
    texte = ''.join(c for c in unicodedata.normalize('NFD', texte) if not unicodedata.combining(c))
    return re.findall(r'[a-z0-9]+', texte)


def lire_reference():
    """{livre OSIS: [(chapitre, verset, texte), …]} dans l'ordre de la base."""
    if not os.path.exists(FICHIER_REFERENCE):
        sys.exit(f"❌ {FICHIER_REFERENCE} introuvable : lancez  python correction_bible.py --exporter-reference")
    reference = defaultdict(list)
    with open(FICHIER_REFERENCE, encoding='utf-8-sig') as f:
        for ligne in csv.DictReader(f, delimiter=';'):
            reference[OSIS[int(ligne['ordre']) - 1]].append((int(ligne['chapitre']), int(ligne['verset']), ligne['texte']))
    return reference


def aligner(source, cible, fenetre=400, k=3):
    """Associe chaque mot de `source` à un mot identique de `cible` (ou None), dans l'ordre.

    Les deux textes sont presque identiques : on avance mot à mot et, à la première différence,
    on cherche la reprise la plus proche (k mots identiques) dans une fenêtre de quelques centaines de mots.
    """
    positions = defaultdict(list)
    for j in range(len(cible) - k + 1):
        positions[tuple(cible[j:j + k])].append(j)
    correspondance = [None] * len(source)
    i = j = 0
    while i < len(source) and j < len(cible):
        if source[i] == cible[j]:
            correspondance[i] = j
            i += 1
            j += 1
            continue
        meilleur = None
        for a in range(min(fenetre, len(source) - i)):
            if meilleur and a >= meilleur[0] + meilleur[1]:
                break
            liste = positions.get(tuple(source[i + a:i + a + k]), [])
            p = bisect.bisect_left(liste, j)
            if p < len(liste) and liste[p] - j <= fenetre:
                b = liste[p] - j
                if not meilleur or a + b < meilleur[0] + meilleur[1]:
                    meilleur = (a, b)
        if not meilleur:  # pas de reprise : ce mot n'existe pas dans la base
            i += 1
            continue
        i += meilleur[0]
        j += meilleur[1]
    return correspondance


def corriger_livre(livre, reference, log, rapport):
    chemin = os.path.join(DOSSIER_ENTREE, f'{livre}.csv')
    if not os.path.exists(chemin):
        log.write(f'{livre:6s}: fichier {chemin} absent\n')
        return None
    with open(chemin, encoding='utf-8-sig') as f:
        lecteur = csv.reader(f, delimiter=';')
        en_tetes = next(lecteur)
        lignes = [l for l in lecteur if l]

    # Mots de la base, chacun avec l'indice de son verset
    versets = reference[livre]
    mots_base, verset_du_mot = [], []
    for n, (_, _, texte) in enumerate(versets):
        for mot in cles(texte):
            mots_base.append(mot)
            verset_du_mot.append(n)

    # Mots de l'extraction, chacun rattaché à sa ligne
    mots_source, ligne_du_mot = [], []
    for n, l in enumerate(lignes):
        for mot in cles(l[10]):
            mots_source.append(mot)
            ligne_du_mot.append(n)
    correspondance = aligner(mots_source, mots_base)

    # Verset de la base de chaque ligne : celui de son premier mot retrouvé
    verset_ligne = [None] * len(lignes)
    for m, j in enumerate(correspondance):
        if j is not None and verset_ligne[ligne_du_mot[m]] is None:
            verset_ligne[ligne_du_mot[m]] = verset_du_mot[j]
    # Lignes sans mot retrouvé (◎, mot absent de la base) : verset du mot voisin dans le même verset du site
    site = [(l[2], l[3]) for l in lignes]
    for n in range(len(lignes)):
        if verset_ligne[n] is None:
            avant = next((verset_ligne[p] for p in range(n - 1, -1, -1)
                          if site[p] == site[n] and verset_ligne[p] is not None), None)
            apres = next((verset_ligne[p] for p in range(n + 1, len(lignes))
                          if site[p] == site[n] and verset_ligne[p] is not None), None)
            verset_ligne[n] = avant if avant is not None else apres
    for n in range(len(lignes)):  # verset du site sans aucun mot retrouvé : suit la ligne précédente
        if verset_ligne[n] is None:
            verset_ligne[n] = verset_ligne[n - 1] if n else 0

    # Mots du site absents de la base (signalés)
    non_trouves = [m for m, j in enumerate(correspondance) if j is None]
    if non_trouves:
        groupes, debut = [], non_trouves[0]
        for a, b in zip(non_trouves, non_trouves[1:] + [None]):
            if b != a + 1:
                groupes.append((debut, a))
                debut = b
        for d, f in groupes:
            l = lignes[ligne_du_mot[d]]
            log.write(f'   mot(s) du site absent(s) de la base, {livre} {l[2]}:{l[3]} : '
                      f'{" ".join(mots_source[d:f + 1])[:150]}\n')

    # Nouvelle numérotation, lignes rangées dans l'ordre de la base (ordre du site conservé dans un verset)
    sortie = []
    for n, l in enumerate(lignes):
        ch, v, _ = versets[verset_ligne[n]]
        if (int(l[2]), int(l[3])) != (ch, v):
            cle = (livre, l[2], l[3], ch, v)
            rapport[cle] = rapport.get(cle, 0) + 1
        sortie.append((verset_ligne[n], n, l[:2] + [str(ch), str(v)] + l[4:]))
    sortie.sort(key=lambda t: (t[0], t[1]))

    os.makedirs(DOSSIER_SORTIE, exist_ok=True)
    nom_fichier = f'{livre}.csv'
    try:
        f = open(os.path.join(DOSSIER_SORTIE, nom_fichier), 'w', encoding='utf-8-sig', newline='')
    except PermissionError:  # fichier ouvert dans Excel : on écrit à côté
        nom_fichier = f'{livre}.nouveau.csv'
        f = open(os.path.join(DOSSIER_SORTIE, nom_fichier), 'w', encoding='utf-8-sig', newline='')
        print(f'\n⚠️  {livre}.csv est ouvert (Excel ?) : résultat écrit dans {nom_fichier}')
        log.write(f'ATTENTION - {livre}.csv ouvert dans un autre programme : résultat écrit dans {nom_fichier}\n')
    with f:
        writer = csv.writer(f, delimiter=';')
        writer.writerow(en_tetes)
        writer.writerows(t[2] for t in sortie)

    # Contrôle : chaque verset de la base a des lignes, et aucun autre
    presents = {t[0] for t in sortie}
    manquants = [f'{versets[n][0]}:{versets[n][1]}' for n in range(len(versets)) if n not in presents]
    taux = 100 * (len(mots_source) - len(non_trouves)) / max(len(mots_source), 1)
    log.write(f'{livre:6s}: {len(lignes):7d} lignes, {len(versets):5d} versets dans la base, '
              f'{taux:6.2f} % des mots retrouvés, {len(non_trouves)} non retrouvé(s)'
              + (f', VERSETS SANS LIGNE : {" ".join(manquants)}' if manquants else '') + '\n')
    return len(manquants), len(non_trouves)


def main():
    if '--exporter-reference' in sys.argv:
        exporter_reference()
        return
    reference = lire_reference()
    livres = [a for a in sys.argv[1:] if not a.startswith('-')] or OSIS
    inconnus = [l for l in livres if l not in OSIS]
    if inconnus:
        sys.exit(f"❌ Livres inconnus : {', '.join(inconnus)}")

    rapport, sans_ligne, non_trouves, traites = {}, 0, 0, 0
    with open(FICHIER_LOG, 'w', encoding='utf-8-sig') as log:
        log.write(f'Alignement de {DOSSIER_ENTREE}/ sur {FICHIER_REFERENCE} -> {DOSSIER_SORTIE}/\n\n')
        for livre in livres:
            resultat = corriger_livre(livre, reference, log, rapport)
            if resultat:
                traites += 1
                sans_ligne += resultat[0]
                non_trouves += resultat[1]
            print(f'  {livre}', end='', flush=True)
        log.write(f'\n{traites} livre(s), {len(rapport)} déplacement(s), {sans_ligne} verset(s) de la base sans ligne, '
                  f'{non_trouves} mot(s) du site non retrouvé(s)\n')

    # Rapport : un verset du site (ou une partie) et le verset de la base où il a été placé
    with open(FICHIER_CORRECTIONS, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f, delimiter=';')
        writer.writerow(['livre', 'chapitre_site', 'verset_site', 'chapitre_lsg', 'verset_lsg', 'nb_lignes'])
        for (livre, ch, v, ch2, v2), n in sorted(rapport.items(), key=lambda kv: (
                OSIS.index(kv[0][0]), int(kv[0][1]), int(kv[0][2]), kv[0][3], kv[0][4])):
            writer.writerow([livre, ch, v, ch2, v2, n])

    print(f'\n\n✅ {traites} livre(s) alignés dans {DOSSIER_SORTIE}/')
    print(f'   {len(rapport)} verset(s) du site renumérotés (détail : {FICHIER_CORRECTIONS})')
    print(f'   {sans_ligne} verset(s) de la base sans ligne, {non_trouves} mot(s) du site non retrouvé(s) '
          f'(détail : {FICHIER_LOG})')


if __name__ == '__main__':
    main()
