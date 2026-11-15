"""Ajoute le texte d'une version dans verse_texts (base locale), depuis un CSV livre;chapitre;verset;texte (OSIS).

Un verset vide reçoit la mention utilisée ailleurs dans la base : « [Ce verset n'existe pas dans cette version.] ».
Refuse si la version a déjà des textes (rien n'est remplacé). Une seule transaction.

Usage (depuis la racine du projet) :
  python scripts/import_textes_version.py WLC doc/textes_WLC.csv
"""
import csv
import io
import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')

CONTENEUR = 'supabase_db_bible-reader'
ABSENT = "[Ce verset n'existe pas dans cette version.]"
OSIS = ('Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song '
        'Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom '
        '1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev').split()


def psql(sql=None, script=None):
    commande = ['docker', 'exec', '-i', CONTENEUR, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At']
    commande += ['-c', sql] if sql else ['-f', '-']
    r = subprocess.run(commande, input=script.encode('utf-8') if script else None, capture_output=True)
    if r.returncode != 0:
        sys.exit(f"❌ Erreur de la base :\n{r.stderr.decode('utf-8')}")
    return r.stdout.decode('utf-8').strip()


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    code, chemin = sys.argv[1].upper(), sys.argv[2]
    version_id = psql(f"select id from bible_versions where upper(code) = '{code}'")
    if not version_id:
        sys.exit(f'❌ Version {code} absente de bible_versions')
    deja = int(psql(f'select count(*) from verse_texts where version_id = {version_id}'))
    if deja:
        sys.exit(f'❌ {deja:,} textes existent déjà pour {code} : rien n’est modifié')

    versets = {}
    for ordre, ch, v, verse_id in (l.split('|') for l in psql(
            "select b.order_index, c.number, v.verse_number, v.id from verses v join chapters c on c.id = v.chapter_id "
            "join books b on b.id = c.book_id").splitlines()):
        versets[(OSIS[int(ordre) - 1], int(ch), int(v))] = verse_id

    with open(chemin, encoding='utf-8-sig', newline='') as f:
        lignes = list(csv.DictReader(f, delimiter=';'))
    donnees, absents = io.StringIO(), []
    w = csv.writer(donnees, lineterminator='\n')
    for l in lignes:
        cle = (l['livre'], int(l['chapitre']), int(l['verset']))
        if cle not in versets:
            sys.exit(f'❌ Verset {cle} absent de la table verses')
        texte = l['texte'].strip()
        if not texte:
            absents.append(cle)
            texte = ABSENT
        w.writerow([version_id, versets[cle], texte])
    psql(script="begin;\ncopy verse_texts (version_id, verse_id, text) from stdin with (format csv);\n"
                + donnees.getvalue() + "\\.\ncommit;\n")
    total = int(psql(f'select count(*) from verse_texts where version_id = {version_id}'))
    print(f'✅ {code} (id {version_id}) : {total:,} versets dans verse_texts ({len(lignes):,} lus)'
          + (f" ; « {ABSENT} » pour {', '.join(f'{a[0]} {a[1]}:{a[2]}' for a in absents)}" if absents else ''))
    if total != len(lignes):
        sys.exit('⚠️  nombre de versets différent')


if __name__ == '__main__':
    main()
