import csv
import requests
from bs4 import BeautifulSoup
import time
import os
import re

# --- Configuration ---
versions = ["Sg1910"]

versions_str = "_".join(versions)

# Créer un dossier pour les fichiers CSV
dossier_sortie = 'extraction_concordance_Sg1910'
if not os.path.exists(dossier_sortie):
    os.makedirs(dossier_sortie)
    print(f"📁 Dossier créé : {dossier_sortie}")

# En-têtes pour le fichier CSV
en_tetes = ['livre_code', 'livre_nom', 'chapitre', 'verset', 'version', 'lang', 
            'type_entite', 'data-lm', 'data-pa', 'data-ns', 'contenu']

print(f"📚 Versions demandées : {', '.join(versions)}")

# --- Lecture du fichier de structure des chapitres ---
fichier_structure = "liste de versets par chapitre et par livre.csv"
structure_bible = {}

print(f"\n📖 Lecture de la structure des chapitres depuis : {fichier_structure}")

try:
    with open(fichier_structure, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f, delimiter=';')
        en_tete = next(reader, None)
        
        for ligne in reader:
            if len(ligne) >= 4:
                code_livre = ligne[0].strip()
                nom_livre = ligne[1].strip()
                try:
                    chapitre = int(ligne[2])
                    nb_versets = int(ligne[3])
                    
                    if code_livre not in structure_bible:
                        structure_bible[code_livre] = {
                            'nom': nom_livre,
                            'chapitres': {}
                        }
                    
                    structure_bible[code_livre]['chapitres'][chapitre] = nb_versets
                except ValueError:
                    print(f"  ⚠️ Ligne ignorée (valeurs non numériques) : {ligne}")
    
    print(f"✅ Structure chargée : {len(structure_bible)} livres trouvés")
    
    total_chapitres = sum(len(data['chapitres']) for data in structure_bible.values())
    total_versets = sum(sum(data['chapitres'].values()) for data in structure_bible.values())
    print(f"   Total chapitres : {total_chapitres}")
    print(f"   Total versets : {total_versets}")
    
except FileNotFoundError:
    print(f"❌ Fichier non trouvé : {fichier_structure}")
    print("   Veuillez vérifier que le fichier est présent dans le répertoire courant.")
    exit(1)
except Exception as e:
    print(f"❌ Erreur lors de la lecture du fichier : {e}")
    exit(1)

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

stats_globales = {
    'livres_traites': 0,
    'chapitres_traites': 0,
    'entrees_total': 0
}

fichier_log = os.path.join(dossier_sortie, 'journal_extraction.txt')
with open(fichier_log, 'w', encoding='utf-8') as log:
    log.write(f"JOURNAL D'EXTRACTION DE LA CONCORDANCE BIBLIQUE\n")
    log.write(f"Date : {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
    log.write(f"Versions : {', '.join(versions)}\n")
    log.write(f"Structure utilisée : {fichier_structure}\n")
    log.write("="*60 + "\n\n")

def extraire_tous_les_elements_recursif(element, resultats, ponctuation_attendre=False):
    """
    Parcourt récursivement TOUS les éléments HTML pour extraire
    chaque mot, chaque code Strong, et attacher la ponctuation
    """
    
    for enfant in element.children:
        if enfant.name == 'w':
            # Balise w - mot avec attributs Strong
            contenu = enfant.get_text(strip=False)
            data_lm = enfant.get('data-lm')
            data_pa = enfant.get('data-pa')
            data_ns = enfant.get('data-ns')
            
            # Déterminer le type
            if data_pa and data_ns:
                type_entite = 'reference'
            elif data_lm:
                type_entite = 'lemme'
            else:
                type_entite = 'mot_outil'
            
            resultats.append({
                'contenu': contenu,
                'type_entite': type_entite,
                'data_lm': data_lm,
                'data_pa': data_pa,
                'data_ns': data_ns
            })
            ponctuation_attendre = True
            
        elif enfant.name == 'seg':
            # Balise seg - peut contenir des codes Strong ou de la ponctuation
            contenu = enfant.get_text(strip=False)
            data_ns = enfant.get('data-ns')
            
            # Vérifier si c'est un code Strong (souvent avec data-ns)
            if data_ns:
                # C'est un code Strong (peut être un ◎ ou autre)
                resultats.append({
                    'contenu': contenu if contenu.strip() else '◎',
                    'type_entite': 'code_strong',
                    'data_lm': None,
                    'data_pa': None,
                    'data_ns': data_ns
                })
                ponctuation_attendre = False
            elif contenu.strip():
                # C'est de la ponctuation ou du texte simple
                if ponctuation_attendre and resultats:
                    # Attacher au dernier élément
                    resultats[-1]['contenu'] += contenu
                else:
                    # Ajouter comme élément séparé
                    resultats.append({
                        'contenu': contenu,
                        'type_entite': 'ponctuation',
                        'data_lm': None,
                        'data_pa': None,
                        'data_ns': None
                    })
                ponctuation_attendre = False
                
        elif enfant.name == 'hi':
            # Balise hi (italique, gras, etc.) - extraire son contenu
            extraire_tous_les_elements_recursif(enfant, resultats, ponctuation_attendre)
            
        elif enfant.name == 'note':
            # Balise note - souvent des références
            contenu = enfant.get_text(strip=True)
            if contenu:
                resultats.append({
                    'contenu': contenu,
                    'type_entite': 'note',
                    'data_lm': None,
                    'data_pa': None,
                    'data_ns': None
                })
                
        elif isinstance(enfant, str):
            # Texte direct (souvent espaces ou ponctuation)
            texte = enfant
            if texte.strip():
                # Ponctuation ou espace significatif
                if ponctuation_attendre and resultats:
                    resultats[-1]['contenu'] += texte
                else:
                    resultats.append({
                        'contenu': texte,
                        'type_entite': 'texte_brut',
                        'data_lm': None,
                        'data_pa': None,
                        'data_ns': None
                    })
            elif ' ' in texte and resultats:
                # Espaces - les ignorer ou les attacher
                pass
                
        elif enfant.name:
            # Autres balises - traiter récursivement
            extraire_tous_les_elements_recursif(enfant, resultats, ponctuation_attendre)
    
    return resultats

# Boucle sur tous les livres de la structure
for index_livre, (livre_code, livre_info) in enumerate(structure_bible.items(), 1):
    livre_nom = livre_info['nom']
    chapitres = livre_info['chapitres']
    
    print(f"\n{'='*60}")
    print(f"📖 Livre {index_livre}/{len(structure_bible)} : {livre_nom} ({livre_code})")
    print(f"   {len(chapitres)} chapitres à traiter")
    print(f"{'='*60}")
    
    donnees_livre = []
    chapitres_traites = 0
    versets_attendus = sum(chapitres.values())
    versets_trouves = 0
    
    for chapitre in sorted(chapitres.keys()):
        nb_versets_attendu = chapitres[chapitre]
        url = f"https://concordance.bible/parallelv/{versions_str}/{livre_code}/{chapitre}/"
        
        print(f"\n  🌐 Traitement du chapitre {chapitre}/{max(chapitres.keys())} ({nb_versets_attendu} versets attendus)...")
        
        try:
            reponse = requests.get(url, headers=headers, timeout=30)
            reponse.raise_for_status()
            print(f"  ✅ Téléchargement réussi")
            
        except Exception as e:
            print(f"  ❌ Erreur pour {livre_code} chapitre {chapitre} : {e}")
            with open(fichier_log, 'a', encoding='utf-8') as log:
                log.write(f"ERREUR - {livre_code} ch.{chapitre}: {e}\n")
            continue
        
        soup = BeautifulSoup(reponse.text, 'html.parser')
        balises_tr = soup.find_all('tr')
        print(f"  🔍 {len(balises_tr)} lignes trouvées dans le HTML")
        
        compteur_versets = 0
        
        for tr in balises_tr:
            th = tr.find('th', id=lambda x: x and x.startswith('v'))
            if not th:
                continue
            
            num_verset = th.get_text(strip=True)
            compteur_versets += 1
            
            balises_td = tr.find_all('td')
            
            for td in balises_td:
                version = td.get('data-bible', 'inconnue')
                lang = td.get('lang', 'inconnu')
                
                # Extraire TOUS les éléments récursivement
                elements = []
                extraire_tous_les_elements_recursif(td, elements, False)
                
                if elements:
                    for element in elements:
                        # S'assurer que le contenu n'est pas vide
                        contenu = element['contenu'].strip()
                        if contenu or element['type_entite'] == 'code_strong':
                            donnees_livre.append([livre_code, livre_nom, chapitre, num_verset, 
                                                version, lang, element['type_entite'], 
                                                element['data_lm'], element['data_pa'], 
                                                element['data_ns'], 
                                                element['contenu'] if element['contenu'] else '◎'])
                else:
                    # Fallback: texte brut
                    contenu_brut = td.get_text(strip=True)
                    if contenu_brut:
                        donnees_livre.append([livre_code, livre_nom, chapitre, num_verset, 
                                            version, lang, 'texte_brut', 
                                            None, None, None, contenu_brut])
        
        versets_trouves += compteur_versets
        chapitres_traites += 1
        stats_globales['chapitres_traites'] += 1
        
        print(f"  ✅ Chapitre {chapitre} : {compteur_versets}/{nb_versets_attendu} versets trouvés")
        
        if compteur_versets != nb_versets_attendu:
            print(f"  ⚠️  Attention : Nombre de versets différent de l'attendu ({nb_versets_attendu})")
            with open(fichier_log, 'a', encoding='utf-8') as log:
                log.write(f"ATTENTION - {livre_code} ch.{chapitre}: {compteur_versets} versets trouvés au lieu de {nb_versets_attendu}\n")
        
        time.sleep(1)
    
    if donnees_livre:
        nom_fichier = f"{livre_code}.csv"
        chemin_fichier = os.path.join(dossier_sortie, nom_fichier)
        
        with open(chemin_fichier, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f, delimiter=';')
            writer.writerow(en_tetes)
            writer.writerows(donnees_livre)
        
        nb_entrees = len(donnees_livre)
        stats_globales['entrees_total'] += nb_entrees
        stats_globales['livres_traites'] += 1
        
        print(f"\n  💾 Fichier sauvegardé : {nom_fichier}")
        print(f"     {nb_entrees:,} entrées sur {chapitres_traites}/{len(chapitres)} chapitres")
        print(f"     {versets_trouves}/{versets_attendus} versets trouvés")
        
        # Afficher des statistiques détaillées
        codes_strong = [row for row in donnees_livre if row[9] and row[9].strip()]
        cercles = [row for row in donnees_livre if row[10] == '◎' or (row[9] and not row[10].strip())]
        
        print(f"\n  📊 Statistiques du livre {livre_code}:")
        print(f"     - Total entrées: {nb_entrees}")
        print(f"     - Entrées avec codes Strong (data-ns): {len(codes_strong)}")
        print(f"     - ◎ (cercles): {len(cercles)}")
        
        # Afficher les 10 premiers codes Strong uniques
        if codes_strong:
            codes_vus = set()
            print(f"     - Exemples de codes Strong trouvés:")
            for row in codes_strong[:20]:
                code = row[9]
                if code not in codes_vus:
                    codes_vus.add(code)
                    contenu = row[10] if row[10] else '◎'
                    print(f"       * Code {code}: '{contenu}'")
        
        with open(fichier_log, 'a', encoding='utf-8') as log:
            log.write(f"{livre_code:6s} ({livre_nom:25s}): {chapitres_traites:3d}/{len(chapitres):3d} chapitres, ")
            log.write(f"{versets_trouves:4d}/{versets_attendus:4d} versets, {nb_entrees:8,d} entrées, ")
            log.write(f"{len(codes_strong)} codes Strong, {len(cercles)} ◎ -> {nom_fichier}\n")
    else:
        print(f"\n  ⚠️  Aucune donnée extraite pour {livre_code}")
        with open(fichier_log, 'a', encoding='utf-8') as log:
            log.write(f"{livre_code:6s} ({livre_nom:25s}): AUCUNE DONNÉE\n")
    
    time.sleep(2)

print(f"\n{'='*60}")
print("📊 RÉSULTATS FINAUX")
print(f"{'='*60}")

print(f"\n📊 STATISTIQUES GLOBALES :")
print(f"  Livres dans la structure : {len(structure_bible)}")
print(f"  Livres traités avec données : {stats_globales['livres_traites']}")
print(f"  Chapitres traités : {stats_globales['chapitres_traites']}")
print(f"  Entrées totales : {stats_globales['entrees_total']:,}")
print(f"  Dossier de sortie : {dossier_sortie}/")

# Analyse détaillée de tous les fichiers
total_codes_strong = 0
total_cercles = 0
tous_les_codes = set()

for fichier in os.listdir(dossier_sortie):
    if fichier.endswith('.csv') and fichier != 'journal_extraction.txt':
        chemin = os.path.join(dossier_sortie, fichier)
        with open(chemin, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f, delimiter=';')
            next(reader)  # Skip header
            for row in reader:
                if len(row) > 9 and row[9] and row[9].strip():
                    total_codes_strong += 1
                    tous_les_codes.add(row[9])
                    if row[10] == '◎' or not row[10].strip():
                        total_cercles += 1

print(f"  Total codes Strong (data-ns) : {total_codes_strong}")
print(f"  Dont ◎ (cercles) : {total_cercles}")
print(f"  Codes Strong uniques : {len(tous_les_codes)}")
print(f"  Exemples de codes Strong: {', '.join(list(tous_les_codes)[:20])}")

with open(fichier_log, 'a', encoding='utf-8') as log:
    log.write("\n" + "="*60 + "\n")
    log.write("RÉSUMÉ GLOBAL\n")
    log.write("="*60 + "\n")
    log.write(f"Livres dans la structure : {len(structure_bible)}\n")
    log.write(f"Livres traités avec données : {stats_globales['livres_traites']}\n")
    log.write(f"Chapitres traités : {stats_globales['chapitres_traites']}\n")
    log.write(f"Entrées totales : {stats_globales['entrees_total']:,}\n")
    log.write(f"Total codes Strong (data-ns) : {total_codes_strong}\n")
    log.write(f"Dont ◎ (cercles) : {total_cercles}\n")
    log.write(f"Codes Strong uniques : {len(tous_les_codes)}\n")
    log.write(f"Liste des codes: {', '.join(sorted(tous_les_codes))}\n")
    log.write(f"Date de fin : {time.strftime('%Y-%m-%d %H:%M:%S')}\n")

print(f"\n📁 Fichiers créés dans {dossier_sortie}/ :")
fichiers_csv = [f for f in os.listdir(dossier_sortie) if f.endswith('.csv') and f != 'journal_extraction.txt']
for fichier in sorted(fichiers_csv):
    chemin = os.path.join(dossier_sortie, fichier)
    taille = os.path.getsize(chemin)
    print(f"  - {fichier:10s} ({taille:>8,} octets)")

print(f"\n📋 Journal d'extraction : {fichier_log}")
print(f"\n{'='*60}")
print("✅ EXTRACTION TERMINÉE")
print(f"{'='*60}")