"""Import des codes Strong grecs (série G) dans la table strong_codes de la base LOCALE.

Fusionne les deux fichiers de doc/ (même numéro Strong sur chaque ligne) :
  strong_grec.csv              Code Strong ; Mot translitéré ; Mot original ; Traduit par
  strong_grec_definitions.csv  Strong numéro ; Mot grec original ; Origine du mot ;
                               D'origine hébraïque ; Mot grec (translittéré) ; Type de mot ; Définition

Les codes G existants sont remplacés (relancer le script ne crée pas de doublons).
Usage : python scripts/import_strong_grec.py
"""
import csv
import io
import subprocess
import sys

CONTAINER = 'supabase_db_bible-reader'
COLUMNS = ['serie', 'code', 'content', 'mot_original', 'origine_mot', 'mot_translitere', 'type_mot', 'traduction_generale']


def read(path):
    with open(path, encoding='utf-8-sig', newline='') as f:
        rows = list(csv.reader(f, delimiter=';'))
    return {row[0].strip(): [cell.strip() for cell in row] for row in rows[1:] if row and row[0].strip()}


def main():
    words = read('doc/strong_grec.csv')
    definitions = read('doc/strong_grec_definitions.csv')
    if set(words) != set(definitions):
        sys.exit(f'Les deux fichiers ne contiennent pas les mêmes codes : '
                 f'{sorted(set(words) ^ set(definitions))[:10]}')

    out = io.StringIO()
    writer = csv.writer(out, lineterminator='\n')
    for code in sorted(words, key=int):
        _, translit, original, translated = words[code]
        _, original_def, origin, _hebrew_code, translit_def, word_type, definition = definitions[code]
        writer.writerow([
            'G',
            str(int(code)),
            definition,
            original or original_def or None,
            origin or None,
            # « a (al’-fah) » : translittération et prononciation, comme pour l'hébreu
            translit_def or translit or None,
            word_type or None,
            translated or None,
        ])

    script = (
        'begin;\n'
        "delete from public.strong_codes where serie = 'G';\n"
        f'copy public.strong_codes ({", ".join(COLUMNS)}) from stdin with (format csv);\n'
        + out.getvalue() + '\\.\n'
        'commit;\n'
    )
    result = subprocess.run(
        ['docker', 'exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'],
        input=script.encode('utf-8'),
    )
    if result.returncode != 0:
        sys.exit('Échec de l’import (rien n’a été modifié).')
    print(f'{len(words)} codes grecs importés dans la base locale.')


if __name__ == '__main__':
    main()
