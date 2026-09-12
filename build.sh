#!/bin/bash
set -eu

echo "Updating repository..."
git fetch --prune origin
git reset --hard origin/master

echo "Deploying:"
git log -1 --oneline

docker compose up -d --build

echo "Removing unused images..."
docker image prune -af
