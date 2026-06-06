#!/bin/sh
export APP_VERSION=$(git describe --tags --always)
echo "Deploying $APP_VERSION..."
docker compose up -d --build
