#!/bin/bash

pnpm run cdk deploy --require-approval=never --outputs-file cdk.outputs.json
pnpm vitest --run

if [[ "$1" == "destroy" ]]; then
  pnpm run cdk destroy --force
fi