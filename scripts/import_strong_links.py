"""Importe un dossier de CSV de liens mot <-> code Strong dans la table strong_code_bible_links (base locale).

Un CSV par livre (Gen.csv … Rev.csv), séparateur « ; », colonnes :
  livre_code;livre_nom;chapitre;verset;version;lang;type_entite;data-lm (ou data_lm);data-pa;data-ns;contenu
Les livres sont importés dans l'ordre biblique et les lignes dans l'ordre du fichier : les identifiants
(générés par la base) suivent donc l'ordre des mots, sur lequel s'appuie l'application.
Tout se fait en une seule transaction : en cas d'erreur, la table n'est pas modifiée.

Usage (depuis la racine du projet) :
  python scripts/import_strong_links.py doc/extraction_concordance_Sg1910_lsg
  python scripts/import_strong_links.py doc/extraction_blb_kjv --remplacer   remplace les lignes déjà présentes de ces livres
  python scripts/import_strong_links.py doc/extraction_blb_kjv --sauf Gen    tous les livres sauf la Genèse
Seuls les livres importés sont contrôlés (ou remplacés) : les autres lignes de la table ne sont pas touchées.
"""
import csv
import io
import os
import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')

CONTENEUR = 'supabase_db_bible-reader'
OSIS = ('Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song '
        'Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom '
        '1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev').split()
COLONNES = ['livre_code', 'livre_nom', 'chapitre', 'verset', 'version', 'lang',
            'type_entite', 'data_lm', 'data_pa', 'data_ns', 'contenu']


def psql(sql=None, script=None):
    """Une requête (sql), ou un script complet lu sur l'entrée standard (script)."""
    commande = ['docker', 'exec', '-i', CONTENEUR, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At']
    commande += ['-c', sql] if sql else ['-f', '-']
    r = subprocess.run(commande, input=script, capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0:
        sys.exit(f"❌ Erreur de la base :\n{r.stderr}")
    return r.stdout.strip()


def main():
    argv = sys.argv[1:]
    sauf = set()
    if '--sauf' in argv:
        i = argv.index('--sauf')
        if i + 1 >= len(argv):
            sys.exit('❌ --sauf : indiquez les livres à exclure, ex. --sauf Gen,Exod')
        sauf = {c.strip() for c in argv[i + 1].split(',') if c.strip()}
        del argv[i:i + 2]
        inconnus = sauf - set(OSIS)
        if inconnus:
            sys.exit(f"❌ --sauf : livres inconnus {', '.join(sorted(inconnus))}")
    args = [a for a in argv if not a.startswith('-')]
    if len(args) != 1 or not os.path.isdir(args[0]):
        sys.exit(__doc__)
    dossier, remplacer = args[0], '--remplacer' in argv

    # Lecture et contrôle des fichiers, dans l'ordre biblique
    sortie = io.StringIO()
    writer = csv.writer(sortie, delimiter=';', lineterminator='\n')
    versions, total, codes_livres = set(), 0, []
    for code in OSIS:
        chemin = os.path.join(dossier, f'{code}.csv')
        if code in sauf or not os.path.exists(chemin):
            continue
        with open(chemin, encoding='utf-8-sig', newline='') as f:
            lecteur = csv.reader(f, delimiter=';')
            en_tetes = [h.strip().replace('-', '_') for h in next(lecteur)]
            if en_tetes != COLONNES:
                sys.exit(f"❌ {chemin} : colonnes inattendues {en_tetes}")
            for n, ligne in enumerate(lecteur, 2):
                # Aucune ligne n'est ignorée : une ligne vide ou incomplète arrête l'import
                if len(ligne) != len(COLONNES) or ligne[0] != code or not ligne[2].isdigit() or not ligne[3].isdigit():
                    sys.exit(f"❌ {chemin} ligne {n} invalide : {ligne}")
                versions.add(ligne[4])
                writer.writerow(ligne)
                total += 1
        codes_livres.append(code)
    if not total:
        sys.exit(f"❌ Aucun fichier de livre dans {dossier}")
    liste = ', '.join(f"'{v}'" for v in sorted(versions))
    filtre = f"version in ({liste}) and livre_code in ({', '.join(repr(c) for c in codes_livres)})"
    print(f"📚 {len(codes_livres)} livre(s), {total:,} lignes, version(s) {liste}"
          + (f", sauf {', '.join(sorted(sauf))}" if sauf else ''))

    deja = int(psql(f"select count(*) from strong_code_bible_links where {filtre}"))
    if deja and not remplacer:
        sys.exit(f"❌ {deja:,} lignes de ces livres et de cette version sont déjà dans la table. "
                 f"Relancez avec --remplacer pour les remplacer.")
    avant = int(psql("select count(*) from strong_code_bible_links"))

    # Une seule transaction : suppression éventuelle puis chargement
    suppression = f"delete from strong_code_bible_links where {filtre};\n" if remplacer else ''
    psql(script=f"begin;\n{suppression}"
                f"copy strong_code_bible_links ({', '.join(COLONNES)}) from stdin with (format csv, delimiter ';');\n"
                f"{sortie.getvalue()}\\.\ncommit;\n")

    importees = int(psql(f"select count(*) from strong_code_bible_links where {filtre}"))
    apres = int(psql("select count(*) from strong_code_bible_links"))
    print(f"✅ {importees:,} lignes importées" + (f" ({deja:,} remplacées)" if deja else '')
          + f" ; table : {avant:,} -> {apres:,} lignes")
    if importees != total or apres != avant - (deja if remplacer else 0) + total:
        sys.exit(f"⚠️  {total:,} lignes lues mais {importees:,} dans la table")


if __name__ == '__main__':
    main()
