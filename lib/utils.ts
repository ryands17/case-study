import { type IAspect, CfnResource, RemovalPolicy } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';
import { z } from 'zod';

export const envs = z
  .object({
    AWS_ACCOUNT_ID: z.string(),
    AWS_REGION: z.string().default('eu-west-1'),
  })
  .parse(process.env);

export class ApplyDestroyPolicyAspect implements IAspect {
  public visit(node: IConstruct): void {
    if (node instanceof CfnResource) {
      node.applyRemovalPolicy(RemovalPolicy.DESTROY);
    }
  }
}
