INSERT INTO verse_texts (version_id, verse_id, text)
SELECT 
    bv.id AS version_id,
    v.id AS verse_id,
    t.text
FROM import_verse_temp t
JOIN bible_versions bv ON bv.code = t.version_code
JOIN verses v ON v.reference_code = t.reference_code
ON CONFLICT (version_id, verse_id) DO UPDATE
SET text = EXCLUDED.text,
    updated_at = CURRENT_TIMESTAMP;
