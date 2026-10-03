#!/usr/bin/env bash
# Deploys the backend to AWS Lambda + API Gateway using the local AWS credentials.
# Usage: npm run deploy            (default AWS profile)
#        AWS_PROFILE=other npm run deploy
# Secrets (DB_URL, GOOGLE_CLIENT_ID, DB_NAME) are read from backend/.env or the environment.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a; . ./.env; set +a
fi
: "${DB_URL:?DB_URL is required (backend/.env or environment)}"
: "${GOOGLE_CLIENT_ID:?GOOGLE_CLIENT_ID is required (backend/.env or environment)}"

ORG="neerajvishwakarma"
APP="Billing"
STACK_NAME="${STACK_NAME:-billing-backend}"
REGION="${AWS_REGION:-$(aws configure get region || true)}"
REGION="${REGION:-us-east-1}"

aws sts get-caller-identity --query Arn --output text

node scripts/build-lambda.mjs

sam deploy \
  --template-file template.yaml \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --tags "ORG=$ORG" "APP=$APP" \
  --parameter-overrides \
    "DbUrl=$DB_URL" \
    "DbName=${DB_NAME:-nv_billings}" \
    "GoogleClientId=$GOOGLE_CLIENT_ID" \
    "Org=$ORG" \
    "App=$APP"

aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text
