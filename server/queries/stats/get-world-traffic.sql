SELECT
    day, sum_visits, SUM (sum_visits) OVER (ORDER BY day) AS cumul_visits, (100*(sum_visits-(LAG(sum_visits, 1) OVER (ORDER BY t.day ASC)))/(LAG(sum_visits, 1) OVER (ORDER BY t.day ASC))):: float as growth
FROM
    (select
    day, sum (visits) as sum_visits
    FROM
    traffic
    GROUP BY
    day
    ORDER BY
    day ASC) as t