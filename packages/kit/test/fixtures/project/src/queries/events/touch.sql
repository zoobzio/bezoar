UPDATE events SET title = title WHERE id = ANY(:ids);
