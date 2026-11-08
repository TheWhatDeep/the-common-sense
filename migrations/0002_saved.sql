-- "Save" on a result bookmarks it for the dashboard. NULL = not saved.
ALTER TABLE situations ADD COLUMN saved_at TEXT;
