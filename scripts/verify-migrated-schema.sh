set -e
echo "Verifying migrated schema..."
for t in typeorm_migrations search_history crawler_result search_history_results search_jobs search_job_histories crawl_site_attempts investigation_cases; do
  exists=$(psql -h postgres -U crawler -d search_crawler -Atc "SELECT to_regclass('public.${t}')")
  if [ -z "$exists" ]; then
    echo "MISSING TABLE: $t"
    exit 1
  fi
  echo "OK $t"
done
count=$(psql -h postgres -U crawler -d search_crawler -Atc "SELECT COUNT(*) FROM typeorm_migrations")
echo "typeorm_migrations rows=$count"
if [ "$count" -lt 1 ]; then
  echo "No migrations recorded"
  exit 1
fi
echo "Migration empty-volume test PASSED"
