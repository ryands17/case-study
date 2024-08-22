import * as path from 'path';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Runtime, Architecture } from 'aws-cdk-lib/aws-lambda';
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
    ENV: z.enum(['dev', 'test', 'prod']).default('dev'),
  })
  .parse(process.env);

export const STACK_NAME = `CaseStudy-${envs.ENV}`;

export class ApplyDestroyPolicyAspect implements IAspect {
  public visit(node: IConstruct): void {
    if (node instanceof CfnResource) {
      node.applyRemovalPolicy(RemovalPolicy.DESTROY);
    }
  }
}

/**
 * Creates an SQS Queue with SSL enforced for message encryption in transit.
 */
export class SQSQueue extends Construct {
  queue: sqs.Queue;

  constructor(scope: Construct, id: string, props?: sqs.QueueProps) {
    super(scope, id);

    this.queue = new sqs.Queue(this, 'Queue', { ...props, enforceSSL: true });
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

    const name = `${STACK_NAME}-${id}`;

    // The lambda function's log group
    const logGroup = new logs.LogGroup(this, `${name}LogGroup`, {
      logGroupName: `/aws/lambda/${name}`,
      retention: logs.RetentionDays.ONE_WEEK,
    });

    // The Lambda function's role with logging permissions
    const lambdaRole = new iam.Role(this, `${name}Role`, {
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

    this.fn = new lambdaNodejs.NodejsFunction(this, `${name}Lambda`, {
      entry: path.join(import.meta.dirname, '..', 'functions', `${id}.ts`),
      role: lambdaRole,
      logGroup,
      timeout: Duration.seconds(30),
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      bundling: {
        format: lambdaNodejs.OutputFormat.ESM,
        platform: 'node',
        banner: `const require = (await import('node:module')).createRequire(import.meta.url);`,
      },
      environment: {
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        ...props?.environment,
      },
      ...props,
    });
  }
}
