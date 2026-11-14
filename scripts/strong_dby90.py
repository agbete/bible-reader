"""Codes Strong de la J.N. Darby anglaise (1890, DBY90) à partir de ceux de la King James.

Les deux traductions suivent de près les mêmes textes originaux : pour chaque verset, chaque mot de la Darby
reçoit le code du mot de la KJV qui traduit le même mot hébreu ou grec.
  1. Mots identiques ou de même racine (created / created, saith / says, LORD / Jehovah) : alignement du verset.
  2. Mots différents entre deux mots alignés (« without form, and void » / « waste and empty ») : un dictionnaire
     appris sur toute la Bible (code -> mots Darby, à partir des cas sûrs) choisit le bon mot ; sans indice,
     l'ordre des mots est suivi seulement si le nombre de mots correspond.
  3. Mots entre crochets dans la Darby (« [be] ») : ajoutés par le traducteur, sans code (comme l'italique KJV).
  4. Un mot original = un seul code affiché : si la KJV le répartit sur plusieurs morceaux (« And … said » H559),
     le code va sur le morceau qui porte le sens (« said »).
  5. En cas de doute, pas de code : le code est listé dans le rapport.

Lit la base (lecture seule) et doc/extraction_blb_kjv ; écrit :
  doc/extraction_dby90/<Livre>.csv   même format que la KJV (version DBY90), prêt pour scripts/import_strong_links.py
  doc/rapport_dby90.csv              codes KJV non placés dans la Darby, verset par verset

Usage (depuis la racine du projet) : python scripts/strong_dby90.py
"""
import csv
import io
import os
import re
import subprocess
import sys
from collections import defaultdict, Counter

sys.stdout.reconfigure(encoding='utf-8')

CONTENEUR = 'supabase_db_bible-reader'
DOSSIER_KJV = os.path.join('doc', 'extraction_blb_kjv')
DOSSIER_SORTIE = os.path.join('doc', 'extraction_dby90')
RAPPORT = os.path.join('doc', 'rapport_dby90.csv')
COLONNES = ['livre_code', 'livre_nom', 'chapitre', 'verset', 'version', 'lang',
            'type_entite', 'data_lm', 'data_pa', 'data_ns', 'contenu']
OSIS = ('Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song '
        'Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom '
        '1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev').split()
DB = ('GEN EXO LEV NOM DEU JOS JUG RUT 1SA 2SA 1RO 2RO 1CH 2CH ESD NEH EST JOB PSA PRO ECC CAN ESA JER LAM EZE DAN OSE '
      'JOE AMO ABD JON MIC NAH HAB SOP AGG ZAC MAL MAT MAR LUC JEA ACT ROM 1CO 2CO GAL EPH PHI COL 1TH 2TH 1TI 2TI '
      'TIT PHM HEB JAC 1PE 2PE 1JE 2JE 3JE JUD APO').split()
OSIS_PAR_DB = dict(zip(DB, OSIS))

MOTS_OUTILS = set('''a an the of and to in on upon unto at by for from with into out up as that this these those which who
whom whose what is was were be been are am art being it its he him his she her they them their i me my we us our you
your thou thee thy ye not no nor or but so then there when shall will should would have has had hath did do does doth
also all even if than because over under before after through o oh let'''.split())
# Formes archaïques ou noms rendus autrement par la Darby (clé de comparaison commune)
EQUIVALENTS = {
    'saith': 'says', 'hath': 'has', 'doth': 'does', 'spake': 'spoke', 'shew': 'show', 'shewed': 'showed',
    'shewing': 'showing', 'shewn': 'shown', 'unto': 'to', 'upon': 'on', 'wherefore': 'why', 'whither': 'where',
    'thence': 'there', 'hither': 'here', 'gat': 'got', 'brethren': 'brothers', 'sware': 'swore', 'bare': 'bore',
    'holpen': 'helped', 'wist': 'knew', 'wot': 'know', 'ere': 'before', 'amongst': 'among', 'whilst': 'while',
}
MOT = re.compile(r"[A-Za-z0-9À-ɏ]+(?:['’\-][A-Za-z0-9À-ɏ]+)*")


def cle(mot, kjv=False):
    """Clé de comparaison d'un mot ; « LORD » et « GOD » en capitales de la KJV = « Jehovah » de la Darby."""
    if kjv and mot in ('LORD', 'GOD', "LORD'S", 'LORD’S'):
        return 'jehovah'
    k = re.sub(r"['’]s$", '', mot.lower())
    k = re.sub(r'[^a-z0-9]', '', k)
    return EQUIVALENTS.get(k, k)


def racine(k):
    for suffixe in ('eth', 'est', 'ing', 'ed', 'es', 's'):
        if k.endswith(suffixe) and len(k) - len(suffixe) >= 4:
            return k[:-len(suffixe)]
    return k


def proches(a, b):
    """Même mot à la forme près : même racine, ou long début commun (spoke / spoken, believeth / believes)."""
    if a['racine'] == b['racine']:
        return True
    x, y = a['cle'], b['cle']
    n = 0
    while n < min(len(x), len(y)) and x[n] == y[n]:
        n += 1
    return n >= 5 and n >= min(len(x), len(y)) - 1


def gain_paire(a, b):
    if a['cle'] == b['cle']:
        return 1 if a['cle'] in MOTS_OUTILS else 3
    return 2 if proches(a, b) else 0


def lire_darby():
    requete = ("\\copy (select b.code, c.number, v.verse_number, vt.text from verse_texts vt "
               "join bible_versions bv on bv.id = vt.version_id join verses v on v.id = vt.verse_id "
               "join chapters c on c.id = v.chapter_id join books b on b.id = c.book_id "
               "where bv.code = 'DBY90' order by b.order_index, c.number, v.verse_number) "
               "to stdout with (format csv, delimiter E'\\t')")
    r = subprocess.run(['docker', 'exec', CONTENEUR, 'psql', '-U', 'postgres', '-c', requete], capture_output=True)
    if r.returncode != 0:
        sys.exit(f"❌ Lecture de la base impossible :\n{r.stderr.decode('utf-8')}")
    textes = {}
    for code, ch, v, texte in csv.reader(io.StringIO(r.stdout.decode('utf-8')), delimiter='\t'):
        textes[(OSIS_PAR_DB[code], int(ch), int(v))] = texte
    return textes


def lire_kjv():
    lignes, noms = defaultdict(list), {}
    for livre in OSIS:
        with open(os.path.join(DOSSIER_KJV, f'{livre}.csv'), encoding='utf-8-sig', newline='') as f:
            for r in csv.DictReader(f, delimiter=';'):
                noms[livre] = r['livre_nom']
                if r['type_entite'] == 'souscription':  # absentes de la Darby
                    continue
                codes = [int(n) for n in re.findall(r'\d+', r['data_ns']) if int(n) > 0]
                lignes[(livre, int(r['chapitre']), int(r['verset']))].append({**r, 'codes': codes})
    return lignes, noms


def mots_darby(texte):
    """Mots du verset avec leur ponctuation (« [ » « ( » vont au mot suivant, le reste au mot précédent)."""
    morceaux = []
    for bloc in texte.split():
        trouves = list(MOT.finditer(bloc))
        if not trouves:  # signe seul (« – », « † ») : avec le mot précédent, ou le suivant en début de verset
            morceaux.append((bloc, None))
            continue
        debut = 0
        for n, m in enumerate(trouves):
            fin = trouves[n + 1].start() if n + 1 < len(trouves) else len(bloc)
            # « word.–word » : la ponctuation entre deux mots va au premier, sauf une ouvrante
            suite = bloc[m.end():fin]
            ouvrante = re.search(r'[\[(“"‘]+$', suite)
            coupe = m.end() + (ouvrante.start() if ouvrante else len(suite))
            morceaux.append((bloc[debut:coupe], m.group(0)))
            debut = coupe
    mots, en_attente, crochet = [], '', False
    for texte_mot, mot in morceaux:
        if mot is None:
            if mots:
                mots[-1]['texte'] += texte_mot
            else:
                en_attente += texte_mot
            continue
        avant_mot = texte_mot[:texte_mot.find(mot)]
        if '[' in avant_mot:
            crochet = True
        mots.append({'texte': en_attente + texte_mot, 'cle': cle(mot), 'racine': racine(cle(mot)), 'ajoute': crochet})
        en_attente = ''
        if ']' in texte_mot[texte_mot.find(mot) + len(mot):]:
            crochet = False
    return mots


def mots_kjv(lignes):
    mots = []
    for i, ligne in enumerate(lignes):
        for m in MOT.finditer(ligne['contenu']):
            k = cle(m.group(0), kjv=True)
            mots.append({'ligne': i, 'cle': k, 'racine': racine(k)})
    return mots


def aligner(d, k):
    """Alignement monotone de poids maximal (mots identiques ou de même racine)."""
    n, m = len(d), len(k)
    score = [[0.0] * (m + 1) for _ in range(n + 1)]
    for i in range(n - 1, -1, -1):
        for j in range(m - 1, -1, -1):
            best = max(score[i + 1][j], score[i][j + 1])
            gain = gain_paire(d[i], k[j])
            if gain:
                best = max(best, score[i + 1][j + 1] + gain)
            score[i][j] = best
    paires, i, j = {}, 0, 0
    while i < n and j < m:
        gain = gain_paire(d[i], k[j])
        if gain and score[i][j] == score[i + 1][j + 1] + gain:
            paires[i] = j
            i, j = i + 1, j + 1
        elif score[i][j] == score[i + 1][j]:
            i += 1
        else:
            j += 1
    return paires


def poids(dico, totaux, cle_mot, codes):
    return max((dico[c].get(cle_mot, 0) / totaux[c] for c in codes if totaux[c]), default=0.0)


SEUIL = 0.03  # part minimale d'un mot parmi les traductions Darby d'un code pour compter comme indice


def indice(t, ligne_i, lignes, kjv_trou, dico, totaux):
    """Force du lien entre un mot Darby et une ligne KJV : dictionnaire appris, ou mot proche dans la ligne."""
    ligne = lignes[ligne_i]
    w = poids(dico, totaux, t['cle'], ligne['codes']) if ligne['codes'] else 0
    if any(x['ligne'] == ligne_i and proches(x, t) for x in kjv_trou):
        w += 1
    return w if w >= SEUIL else 0


def par_indices(trou_d, trou_k, d, k, lignes, dico, totaux, forts):
    """Étape A : mots Darby du trou rattachés, dans l'ordre, aux lignes KJV pour lesquelles il y a un indice.
    À indice égal, une ligne pas encore placée passe avant (« Curse, curse » = « curse ye bitterly »)."""
    candidats = sorted({k[j]['ligne'] for j in trou_k})
    kjv_trou = [k[j] for j in trou_k]
    nT, nC = len(trou_d), len(candidats)
    if not nT or not nC:
        return {}
    w = [[indice(d[i], c, lignes, kjv_trou, dico, totaux) * (0.98 if c in forts else 1) for c in candidats]
         for i in trou_d]
    # dp[x][y] : meilleur score pour les x premiers mots, avec une dernière ligne utilisée < y
    dp = [[0.0] * (nC + 1) for _ in range(nT + 1)]
    for x in range(nT - 1, -1, -1):
        for y in range(nC, -1, -1):
            best = dp[x + 1][y]  # mot non rattaché
            for z in range(y, nC):
                if w[x][z]:
                    best = max(best, w[x][z] + dp[x + 1][z])  # même ligne possible pour le mot suivant
            dp[x][y] = best
    res, y = {}, 0
    for x in range(nT):
        if dp[x][y] == dp[x + 1][y]:
            continue
        # à égalité, une nouvelle ligne plutôt que la même (« Curse, curse » : deux mots originaux)
        ordre = list(range(y + 1, nC)) + [y] if x > 0 and res else list(range(y, nC))
        for z in ordre:
            if w[x][z] and abs(dp[x][y] - (w[x][z] + dp[x + 1][z])) < 1e-9:
                res[trou_d[x]] = candidats[z]
                y = z
                break
    return res


def attribuer(d, k, lignes, dico, totaux):
    """Ligne KJV de chaque mot Darby (ou absent si aucun lien sûr)."""
    paires = aligner(d, k)
    attrib = {i: k[j]['ligne'] for i, j in paires.items()}
    alignes_k = set(paires.values())
    # Lignes KJV rattachées à un mot de sens de la Darby : elles ne sont plus à placer
    forts = {k[j]['ligne'] for i, j in paires.items() if d[i]['cle'] not in MOTS_OUTILS}
    bornes = [(-1, -1)] + sorted(paires.items()) + [(len(d), len(k))]
    trous = []
    for (i0, j0), (i1, j1) in zip(bornes, bornes[1:]):
        trou_d = [i for i in range(i0 + 1, i1) if not d[i]['ajoute']]
        trou_k = [j for j in range(j0 + 1, j1) if j not in alignes_k]
        if not trou_d:
            continue
        if not trou_k:
            # Mot Darby en plus, au milieu d'une même ligne KJV (« of the great deep ») : il la rejoint
            if 0 <= j0 and j1 < len(k) and k[j0]['ligne'] == k[j1]['ligne']:
                for i in trou_d:
                    attrib[i] = k[j0]['ligne']
            continue
        # A. indices (dictionnaire, mot proche)
        res = par_indices(trou_d, trou_k, d, k, lignes, dico, totaux, forts)
        attrib.update(res)
        forts.update(res.values())
        trous.append((i0, j0, i1, j1, trou_d, trou_k))

    # C. mots déplacés (« everlasting life » / « life eternal ») : rattachés sur indice fort, hors de l'ordre
    pa_forts = {lignes[c]['data_pa'] for c in forts if lignes[c]['data_pa']}
    restes = [i for i in range(len(d)) if i not in attrib and not d[i]['ajoute'] and d[i]['cle'] not in MOTS_OUTILS]
    orphelines = [c for c, l in enumerate(lignes)
                  if l['codes'] and c not in forts and not (l['data_pa'] and l['data_pa'] in pa_forts)]
    paires_c = sorted(((poids(dico, totaux, d[i]['cle'], lignes[c]['codes']), i, c)
                       for i in restes for c in orphelines), reverse=True)
    pris_i = set()
    for w, i, c in paires_c:
        if w < 0.1:
            break
        if i not in pris_i and c not in forts:
            attrib[i] = c
            pris_i.add(i)
            forts.add(c)

    for i0, j0, i1, j1, trou_d, trou_k in trous:
        # B. mots restants, par sous-trous bornés des deux côtés (jamais au bord du verset, sans preuve)
        pos_k = {}  # ligne KJV -> positions de ses mots dans le trou
        for j in trou_k:
            pos_k.setdefault(k[j]['ligne'], []).append(j)
        x = 0
        while x < len(trou_d):
            if trou_d[x] in attrib:
                x += 1
                continue
            y = x
            while y < len(trou_d) and trou_d[y] not in attrib:
                y += 1
            run = trou_d[x:y]
            # bornes côté KJV
            if x > 0:
                gauche = max(pos_k.get(attrib[trou_d[x - 1]], [j0]))
            else:
                gauche = j0 if i0 >= 0 else None
            if y < len(trou_d):
                droite = min(pos_k.get(attrib[trou_d[y]], [j1]))
            else:
                droite = j1 if i1 < len(d) else None
            x = y
            if gauche is None or droite is None:
                continue
            lignes_run = []
            for j in trou_k:
                if gauche < j < droite and k[j]['ligne'] not in lignes_run:
                    lignes_run.append(k[j]['ligne'])
            codees = [c for c in lignes_run if lignes[c]['codes'] and c not in forts]
            lignes_run = [c for c in lignes_run if c not in forts]
            contenus = [i for i in run if d[i]['cle'] not in MOTS_OUTILS]
            if len(codees) == 1 and contenus:
                for i in run:
                    attrib[i] = codees[0]
            elif len(codees) == 1 and len(lignes_run) == 1 and all(
                    k[j]['cle'] in MOTS_OUTILS for j in pos_k[codees[0]]):
                for i in run:  # mot outil pour mot outil (« on » / « upon »)
                    attrib[i] = codees[0]
            elif len(codees) > 1 and len(codees) == len(contenus):
                n = 0
                for i in run:  # un mot de sens par ligne, les mots outils vont avec le mot qui les suit
                    attrib[i] = codees[min(n, len(codees) - 1)]
                    if d[i]['cle'] not in MOTS_OUTILS:
                        n += 1

    # D. ligne KJV retrouvée seulement par ses petits mots, sans son dernier mot (« of our » / « of the ») :
    # le mot original n'est sans doute pas traduit par la Darby -> pas de code
    par_ligne = defaultdict(list)
    for i, c in attrib.items():
        par_ligne[c].append(i)
    fin_ligne = {}
    for j, mot in enumerate(k):
        fin_ligne[mot['ligne']] = j
    for c, mots_d in par_ligne.items():
        if (lignes[c]['codes'] and fin_ligne.get(c) not in alignes_k and any(i in paires for i in mots_d)
                and all(d[i]['cle'] in MOTS_OUTILS for i in mots_d)):
            for i in mots_d:
                del attrib[i]
    return attrib


def apprendre(dico, d, attrib, lignes):
    for i, c in attrib.items():
        for code in lignes[c]['codes']:
            dico[code][d[i]['cle']] += 1


def segments(d, attrib, lignes):
    """Morceaux de la Darby : mots consécutifs de la même ligne KJV (ou sans code)."""
    segs = []
    for i, mot in enumerate(d):
        ligne = None if mot['ajoute'] else attrib.get(i)
        cle_seg = ('ajoute',) if mot['ajoute'] else ('ligne', ligne)
        if segs and segs[-1]['cle'] == cle_seg:
            segs[-1]['mots'].append(mot)
        else:
            segs.append({'cle': cle_seg, 'ligne': ligne, 'ajoute': mot['ajoute'], 'mots': [mot]})
    # Un mot original = un code : morceaux d'une même ligne KJV ou d'une même position (data_pa)
    par_mot_original = defaultdict(list)
    for s in segs:
        if s['ligne'] is not None and lignes[s['ligne']]['codes']:
            pa = lignes[s['ligne']]['data_pa'] or f"ligne{s['ligne']}"
            par_mot_original[pa].append(s)
    for groupe in par_mot_original.values():
        if len(groupe) < 2:
            continue
        porteurs = [s for s in groupe if any(m['cle'] not in MOTS_OUTILS for m in s['mots'])] or groupe
        garde = porteurs[-1]
        for s in groupe:
            if s is not garde:
                s['ligne_sans_code'] = True
    return segs


def main():
    print('Lecture de la Darby 1890 (base, lecture seule) et de la KJV (doc/extraction_blb_kjv)…')
    darby = lire_darby()
    kjv, noms = lire_kjv()
    versets = [cle_v for cle_v in darby]
    prep = {}
    for cle_v in versets:
        lignes = kjv.get(cle_v, [])
        prep[cle_v] = (mots_darby(darby[cle_v]), mots_kjv(lignes), lignes)

    # Passe 1 : dictionnaire code -> mots Darby, appris sur les cas sûrs
    dico = defaultdict(Counter)
    vide = defaultdict(Counter)
    totaux_vides = Counter()
    for d, k, lignes in prep.values():
        apprendre(dico, d, attribuer(d, k, lignes, vide, totaux_vides), lignes)
    totaux = Counter({c: sum(v.values()) for c, v in dico.items()})

    # Passe 2 : attribution finale
    os.makedirs(DOSSIER_SORTIE, exist_ok=True)
    rapport = []
    stats = Counter()
    sorties = defaultdict(list)
    for (livre, ch, v), (d, k, lignes) in prep.items():
        attrib = attribuer(d, k, lignes, dico, totaux)
        segs = segments(d, attrib, lignes)
        places = set()
        for s in segs:
            contenu = ' '.join(m['texte'] for m in s['mots'])
            ligne = lignes[s['ligne']] if s['ligne'] is not None else None
            if s['ajoute']:
                sorties[livre].append([livre, noms[livre], ch, v, 'DBY90', 'en', 'mot_ajoute', '', '', '', contenu])
            elif ligne and ligne['codes'] and not s.get('ligne_sans_code'):
                places.add(s['ligne'])
                sorties[livre].append([livre, noms[livre], ch, v, 'DBY90', 'en', 'reference',
                                       ligne['data_lm'], ligne['data_pa'], ligne['data_ns'], contenu])
            else:
                sorties[livre].append([livre, noms[livre], ch, v, 'DBY90', 'en', 'texte_brut', '', '', '', contenu])
        # Codes KJV non placés (par mot original)
        positions_placees = {lignes[i]['data_pa'] or i for i in places}
        for i, ligne in enumerate(lignes):
            if not ligne['codes']:
                continue
            stats['codes kjv'] += 1
            if i in places or (ligne['data_pa'] or i) in positions_placees:
                stats['placés'] += 1
            else:
                rapport.append([livre, ch, v, ligne['data_ns'], ligne['contenu'], darby[(livre, ch, v)].strip()])
        if not d:
            stats['versets vides'] += 1

    for livre in OSIS:
        chemin = os.path.join(DOSSIER_SORTIE, f'{livre}.csv')
        try:
            f = open(chemin, 'w', encoding='utf-8-sig', newline='')
        except PermissionError:
            chemin = os.path.join(DOSSIER_SORTIE, f'{livre}.nouveau.csv')
            f = open(chemin, 'w', encoding='utf-8-sig', newline='')
        with f:
            w = csv.writer(f, delimiter=';')
            w.writerow(COLONNES)
            w.writerows(sorties[livre])
    with open(RAPPORT, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f, delimiter=';')
        w.writerow(['livre', 'chapitre', 'verset', 'code', 'mot_kjv', 'texte_darby'])
        w.writerows(rapport)
    total_lignes = sum(len(x) for x in sorties.values())
    print(f"✅ {len(versets):,} versets, {total_lignes:,} lignes écrites dans {DOSSIER_SORTIE}")
    print(f"   codes KJV placés : {stats['placés']:,} / {stats['codes kjv']:,} "
          f"({100 * stats['placés'] / max(stats['codes kjv'], 1):.2f} %) ; non placés -> {RAPPORT}")
    if stats['versets vides']:
        print(f"   ⚠️  {stats['versets vides']} verset(s) Darby vide(s)")


if __name__ == '__main__':
    main()
