import * as cdk from 'aws-cdk-lib';
import * as ddb from 'aws-cdk-lib/aws-dynamodb';
import * as apiGw from 'aws-cdk-lib/aws-apigatewayv2';
import * as apiGwInteg from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { StartingPosition } from 'aws-cdk-lib/aws-lambda';
import {
  DynamoEventSource,
  SqsEventSource,
} from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import { ApplyDestroyPolicyAspect, LambdaFunction, SQSQueue } from './utils';

interface Props extends cdk.StackProps {
  /**
   * Remove all resources when the stack is deleted. Only to be used on dev and test environments
   * @default false
   */
  removeResourcesOnStackDeletion?: boolean;
}

export class CaseStudyStack extends cdk.Stack {
  apiUrl: string;

  constructor(scope: Construct, id: string, props?: Props) {
    super(scope, id, props);

    // table to store the product and inventory levels
    const productTable = new ddb.Table(this, 'productTable', {
      partitionKey: { name: 'pk', type: ddb.AttributeType.STRING },
      sortKey: { name: 'sk', type: ddb.AttributeType.STRING },
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      stream: ddb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // this is the webhook to send inventory threshold updates to
    const sampleWebhookApi = new LambdaFunction(this, 'sampleWebhookApi');
    const webhookApi = new apiGw.HttpApi(this, 'webhookApi', {
      corsPreflight: {
        allowMethods: [apiGw.CorsHttpMethod.ANY],
        allowOrigins: ['*'],
      },
      createDefaultStage: true,
    });

    webhookApi.addRoutes({
      path: '/webhook',
      methods: [apiGw.HttpMethod.POST],
      integration: new apiGwInteg.HttpLambdaIntegration(
        'webhookHandler',
        sampleWebhookApi.fn,
      ),
    });

    // Queue and DLQ to handle sending notifications to the webhook
    const inventoryThresholdDlq = new SQSQueue(this, 'inventoryThresholdDlq');

    const inventoryThresholdQueue = new SQSQueue(
      this,
      'inventoryThresholdQueue',
      {
        visibilityTimeout: cdk.Duration.minutes(10),
        deadLetterQueue: {
          queue: inventoryThresholdDlq.queue,
          maxReceiveCount: 3,
        },
      },
    );

    // lambda to process queue messages
    const sendProductDetails = new LambdaFunction(this, 'sendProductDetails', {
      timeout: cdk.Duration.minutes(3),
      memorySize: 1024,
      environment: { WEBHOOK_URL: webhookApi.apiEndpoint },
    });

    sendProductDetails.fn.addEventSource(
      new SqsEventSource(inventoryThresholdQueue.queue, {
        batchSize: 20,
        maxBatchingWindow: cdk.Duration.seconds(30),
      }),
    );

    // event source to the table for listening to product quantity changes
    const productTableStream = new DynamoEventSource(productTable, {
      startingPosition: StartingPosition.TRIM_HORIZON,
      retryAttempts: 2,
      batchSize: 50,
      maxBatchingWindow: cdk.Duration.seconds(30),
      bisectBatchOnError: true,
    });

    const lambdaStreamHandler = new LambdaFunction(
      this,
      'lambdaStreamHandler',
      {
        timeout: cdk.Duration.seconds(200),
        memorySize: 1024,
        environment: { QUEUE_URL: inventoryThresholdQueue.queue.queueUrl },
      },
    );
    lambdaStreamHandler.fn.addEventSource(productTableStream);
    inventoryThresholdQueue.queue.grantSendMessages(lambdaStreamHandler.fn);

    // API Gateway logs
    const apiGatewayLogs = new logs.LogGroup(this, 'apiLogs', {
      logGroupName: '/aws/vendedlogs/productsApiLogs',
      retention: logs.RetentionDays.ONE_WEEK,
    });
    apiGatewayLogs.grantWrite(
      new iam.ServicePrincipal('apigateway.amazonaws.com'),
    );
    // HTTP API
    const api = new apiGw.HttpApi(this, 'productsApi', {
      corsPreflight: {
        allowMethods: [apiGw.CorsHttpMethod.ANY],
        allowOrigins: ['*'],
      },
      createDefaultStage: true,
    });

    // enable access logging
    const stage = api.defaultStage!.node.defaultChild as apiGw.CfnStage;
    stage.accessLogSettings = {
      destinationArn: apiGatewayLogs.logGroupArn,
      format: JSON.stringify({
        requestId: '$context.requestId',
        userAgent: '$context.identity.userAgent',
        sourceIp: '$context.identity.sourceIp',
        requestTime: '$context.requestTime',
        httpMethod: '$context.httpMethod',
        path: '$context.path',
        status: '$context.status',
        responseLength: '$context.responseLength',
      }),
    };

    const seedProductsFn = new LambdaFunction(this, 'seedProducts', {
      environment: { TABLE_NAME: productTable.tableName },
    });
    productTable.grantWriteData(seedProductsFn.fn);
    productTable.grantReadData(seedProductsFn.fn);

    api.addRoutes({
      path: '/seed',
      methods: [apiGw.HttpMethod.POST],
      integration: new apiGwInteg.HttpLambdaIntegration(
        'seedProducts',
        seedProductsFn.fn,
      ),
    });

    const setInventoryLevelFn = new LambdaFunction(this, 'setInventoryLevel', {
      environment: { TABLE_NAME: productTable.tableName },
    });
    productTable.grantReadData(setInventoryLevelFn.fn);
    productTable.grantWriteData(setInventoryLevelFn.fn);

    api.addRoutes({
      path: '/{product_id}/quantity',
      methods: [apiGw.HttpMethod.PUT],
      integration: new apiGwInteg.HttpLambdaIntegration(
        'updateProductQuantity',
        setInventoryLevelFn.fn,
      ),
    });

    // a sample simulate endpoint for testing the entire architecture
    const simulateArch = new LambdaFunction(this, 'simulateArch', {
      environment: { TABLE_NAME: productTable.tableName },
    });
    productTable.grantReadData(simulateArch.fn);
    productTable.grantWriteData(simulateArch.fn);

    api.addRoutes({
      path: '/simulate',
      methods: [apiGw.HttpMethod.POST],
      integration: new apiGwInteg.HttpLambdaIntegration(
        'simulate',
        simulateArch.fn,
      ),
    });

    // outputs for cloudformation and testing
    this.apiUrl = api.apiEndpoint;
    new cdk.CfnOutput(this, 'apiUrl', { value: api.apiEndpoint });
    new cdk.CfnOutput(this, 'webhookUrl', { value: webhookApi.apiEndpoint });

    // add necessary resource requirements
    if (props?.removeResourcesOnStackDeletion) {
      cdk.Aspects.of(this).add(new ApplyDestroyPolicyAspect());
    }

    // supress CDK specific warnings
    NagSuppressions.addResourceSuppressions(
      webhookApi,
      [
        { id: 'AwsSolutions-APIG1', reason: 'This is a 3rd party API' },
        { id: 'AwsSolutions-APIG4', reason: 'This is a 3rd party API' },
      ],
      true,
    );
    NagSuppressions.addResourceSuppressions(
      lambdaStreamHandler,
      [{ id: 'AwsSolutions-IAM5', reason: 'CDK connection so is safe to use' }],
      true,
    );
    NagSuppressions.addResourceSuppressions(
      api,
      [{ id: 'AwsSolutions-APIG4', reason: 'This is a test API' }],
      true,
    );
  }
}
