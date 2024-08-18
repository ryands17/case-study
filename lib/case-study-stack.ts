import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApplyDestroyPolicyAspect } from './utils';

interface Props extends cdk.StackProps {
  /**
   * Remove all resources when the stack is deleted. Only to be used on dev and test environments
   * @default false
   */
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
