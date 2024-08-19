import * as path from 'path';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import {
  type IAspect,
  CfnResource,
  RemovalPolicy,
  Duration,
} from 'aws-cdk-lib';
import { IConstruct, Construct } from 'constructs';
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

/**
 * Creates a NodeJs lambda function with a default log group and IAM role
 * This class also has sensible defaults for the Node runtime, function timeout, and ESBuild options.
 */
export class LambdaFunction extends Construct {
  readonly fn: lambdaNodejs.NodejsFunction;

  constructor(
    scope: Construct,
    id: string,
    props?: lambdaNodejs.NodejsFunctionProps,
  ) {
    super(scope, id);

    // The lambda function's log group
    const logGroup = new logs.LogGroup(this, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${id}`,
      retention: logs.RetentionDays.ONE_WEEK,
    });

    // The Lambda function's role with logging permissions
    const lambdaRole = new iam.Role(this, `${id}Role`, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        logging: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              resources: [logGroup.logGroupArn],
            }),
          ],
        }),
      },
    });

    this.fn = new lambdaNodejs.NodejsFunction(this, `${id}Lambda`, {
      entry: path.join(import.meta.dirname, '..', 'functions', `${id}.ts`),
      role: lambdaRole,
      logGroup,
      timeout: Duration.seconds(30),
      runtime: Runtime.NODEJS_20_X,
      bundling: {
        format: lambdaNodejs.OutputFormat.ESM,
        nodeModules: ['zod', '@aws-sdk/client-dynamodb', 'electrodb'],
      },
      environment: {
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        ...props?.environment,
      },
      ...props,
    });
  }
}
