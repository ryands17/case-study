import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApplyDestroyPolicyAspect } from './utils';

interface Props extends cdk.StackProps {
  removeResourcesOnStackDeletion?: boolean;
}

export class CaseStudyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: Props) {
    super(scope, id, props);

    // add necessary resource requirements
    if (props?.removeResourcesOnStackDeletion) {
      cdk.Aspects.of(this).add(new ApplyDestroyPolicyAspect());
    }
  }
}
