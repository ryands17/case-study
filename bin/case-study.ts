#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { environmentVariables } from '../lib/utils';
import { CaseStudyStack } from '../lib/case-study-stack';

const app = new cdk.App();
new CaseStudyStack(app, 'CaseStudyStack', {
  env: {
    account: environmentVariables.AWS_ACCOUNT_ID,
    region: environmentVariables.AWS_REGION,
  },
  removeResourcesOnStackDeletion: true,
});

// Add the cdk-nag AwsSolutions Pack with extra verbose logging enabled.
cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
// project specific tags (will also help consolidate CloudWatch logs)
cdk.Tags.of(app).add('environment', environmentVariables.ENV);
