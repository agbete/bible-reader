"""Aligne l'extraction hébraïque WLC / WLCt (numérotation hébraïque du site) sur les versets de la base.

La base suit la numérotation KJV pour l'Ancien Testament. Le site place, au début de chaque verset décalé (ou au
milieu d'un verset coupé), une note « * » dont le contenu donne le verset KJV : « KJV:Num.26.1 ».
Chaque mot prend le verset de la dernière note rencontrée dans son verset ; sans note, il garde le numéro du site.
  Nombres 25:19 + 26:1 -> 26:1   1 Samuel 20:42 + 21:1 -> 20:42   1 Rois 22:43-44 -> 22:43   1 Chroniques 12:4-5 -> 12:4
  Néhémie 7:68 -> 7:68 et 7:69 (coupure aux 435 chameaux)          Ésaïe 63:19 -> 63:19 et 64:1 (« si tu déchirais les cieux »)
Les notes « KJV:… » (correspondance seulement) ne sont pas gardées.

Entrée  : extraction_concordance_<V>/<Livre>.csv
Sorties : extraction_concordance_<V>_kjv/<Livre>.csv   (numérotation de la base, pour strong_code_bible_links)
          textes_<V>.csv                               (livre;chapitre;verset;texte, pour verse_texts)
Contrôles : chaque verset de l'Ancien Testament de la base (reference_lsg.csv) reçoit des mots ; les codes Strong
de chaque verset sont comparés à ceux de la Segond déjà alignée (extraction_concordance_Sg1910_lsg).
La base n'est pas modifiée.

Usage (depuis le dossier doc) : python aligner_hebreu_kjv.py WLC   (ou WLCt)
"""
import csv
import os
import re
import sys
from collections import Counter, defaultdict

sys.stdout.reconfigure(encoding='utf-8')

OT = ('Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song '
      'Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal').split()
MARQUE = re.compile(r'^KJV:(\w+)\.(\d+)\.(\d+)(?:!\w+)?$')  # « !b » : 2e partie d'un verset KJV (1 Rois 22:43)


def lire(chemin):
    with open(chemin, encoding='utf-8-sig', newline='') as f:
        lecteur = csv.reader(f, delimiter=';')
        return next(lecteur), list(lecteur)


def texte_du_verset(mots):
    """Mots -> texte : pas d'espace après le maqaf « ־ » ni le trait d'union de la translittération."""
    texte = ''
    for m in mots:
        texte += m if not texte or texte.endswith(('־', '-')) else ' ' + m
    return ' '.join(texte.split())


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ('WLC', 'WLCt'):
        sys.exit(__doc__)
    version = sys.argv[1]
    entree, sortie = f'extraction_concordance_{version}', f'extraction_concordance_{version}_kjv'
    os.makedirs(sortie, exist_ok=True)

    base = defaultdict(set)  # versets de la base (Ancien Testament)
    with open('reference_lsg.csv', encoding='utf-8-sig') as f:
        for r in csv.DictReader(f, delimiter=';'):
            if int(r['ordre']) <= 39:
                base[OT[int(r['ordre']) - 1]].add((int(r['chapitre']), int(r['verset'])))

    textes, stats, problemes = [], Counter(), []
    for livre in OT:
        sorties = []
        en_tetes, lignes = lire(os.path.join(entree, f'{livre}.csv'))
        # Versets du site, dans l'ordre : [(verset, [(indice, ligne, marque ou None)])]
        versets = []
        for n, l in enumerate(lignes):
            site = (int(l[2]), int(l[3]))
            if not versets or versets[-1][0] != site:
                versets.append((site, []))
            m = MARQUE.match(l[10]) if l[6] == 'note' else None
            if m and m.group(1) != livre:
                problemes.append(f'{livre} {site[0]}:{site[1]} renvoie à un autre livre : {l[10]}')
            versets[-1][1].append((n, l, (int(m.group(2)), int(m.group(3))) if m else None))
        # Verset de la base du début de chaque verset du site (avant sa première marque), de la fin vers le début :
        #  - marque au début : son verset KJV ;
        #  - sans marque, ou marque plus loin : le numéro du site, sauf si le verset suivant commence à un verset
        #    KJV inférieur ou égal (titre de Psaume sur deux versets hébreux, Ps 51:1-2 -> 51:1), ou si la marque
        #    du milieu reprend le numéro du site (1 Rois 18:34 : le début va avec 18:33)
        debuts = [None] * len(versets)
        suivant = None
        for i in range(len(versets) - 1, -1, -1):
            site, mots = versets[i]
            premiere = next((k for k, (_, _, m) in enumerate(mots) if m), None)
            if premiere is not None and all(mots[k][1][6] == 'note' for k in range(premiere)):
                debut = mots[premiere][2]
            else:
                debut = site
                if suivant and suivant[0] == site[0] and suivant[1] <= site[1]:
                    debut = suivant
            debuts[i] = debut
            suivant = debut
        for i, (site, mots) in enumerate(versets):
            cible = debuts[i]
            premiere = next((k for k, (_, _, m) in enumerate(mots) if m), None)
            if (premiere is not None and debuts[i] == site and mots[premiere][2] == site and site[1] > 1
                    and any(mots[k][1][6] != 'note' for k in range(premiere)) and i > 0):
                # début d'un verset dont la marque (au milieu) reprend son propre numéro : verset précédent
                cible = sorties[-1][0] if sorties else site
            for n, l, m in mots:
                if m:
                    cible = m
                    if site != m:
                        stats['marques de renumérotation'] += 1
                    continue
                sorties.append((cible, n, l[:2] + [str(cible[0]), str(cible[1])] + l[4:]))
        ordre = sorted(base[livre])
        rang = {v: i for i, v in enumerate(ordre)}
        inconnus = sorted({c for c, _, _ in sorties if c not in rang})
        for c in inconnus:
            problemes.append(f'{livre} {c[0]}:{c[1]} : verset absent de la base')
        sorties.sort(key=lambda t: (rang.get(t[0], 10 ** 6), t[1]))
        recus = {c for c, _, _ in sorties}
        for c in ordre:
            if c not in recus:
                problemes.append(f'{livre} {c[0]}:{c[1]} : verset de la base sans mot')
        with open(os.path.join(sortie, f'{livre}.csv'), 'w', encoding='utf-8-sig', newline='') as f:
            w = csv.writer(f, delimiter=';')
            w.writerow(en_tetes)
            w.writerows(l for _, _, l in sorties)
        # Texte de chaque verset de la base : mots dans l'ordre, sans les notes
        par_verset = defaultdict(list)
        for c, _, l in sorties:
            if l[6] != 'note' and l[10]:
                par_verset[c].append(l[10])
        for c in ordre:
            textes.append([livre, c[0], c[1], texte_du_verset(par_verset.get(c, []))])
        stats['lignes'] += len(sorties)

    with open(f'textes_{version}.csv', 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f, delimiter=';')
        w.writerow(['livre', 'chapitre', 'verset', 'texte'])
        w.writerows(textes)
    vides = sum(1 for t in textes if not t[3])
    print(f"✅ {version} : {stats['lignes']:,} lignes -> {sortie}/ ; {len(textes):,} versets -> textes_{version}.csv "
          f"({vides} vide(s)) ; {stats['marques de renumérotation']} mots-repères de renumérotation")
    for p in problemes:
        print('   ⚠️ ', p)


if __name__ == '__main__':
    main()
