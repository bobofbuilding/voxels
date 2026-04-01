SELECT t.parcel_id AS id,
       serie       AS d,
       t.visits::text AS sum_visits, SUM(t.visits) OVER (PARTITION BY t.parcel_id ORDER BY t.day ASC) AS cumul_visits, serie AS series,
       serie AS day,
    to_timestamp((serie + 72125) * 6 * 3600) AS dt
FROM generate_series($2, $3, 1) AS serie
    LEFT JOIN traffic AS t
ON t."day" = serie AND t.parcel_id = $1
ORDER BY d ASC
