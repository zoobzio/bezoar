-- Retitles an event and sets its weeks, or clears them.

UPDATE events SET title = :title, weeks = :weeks WHERE id = :id;
