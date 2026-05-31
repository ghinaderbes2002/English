#!/bin/sh
set -e

echo "🔄 Waiting for database..."
until nc -z postgres 5432; do
  sleep 1
done
echo "✅ Database is ready"

mkdir -p uploads/pdfs uploads/images uploads/audio

echo "🔄 Pushing Prisma schema..."
npx prisma db push --accept-data-loss --skip-generate

# Seed يشتغل بس لو RUN_SEED=true
if [ "$RUN_SEED" = "true" ]; then
  echo "🌱 Running seed..."
  node prisma/seed.js || echo "⚠️ Seed failed (might already be seeded)"
fi

echo "🚀 Starting server..."
exec "$@"
