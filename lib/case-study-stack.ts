import * as cdk from 'aws-cdk-lib';
import * as ddb from 'aws-cdk-lib/aws-dynamodb';
import * as apiGw from 'aws-cdk-lib/aws-apigatewayv2';
import * as apiGwInteg from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import { ApplyDestroyPolicyAspect, LambdaFunction } from './utils';

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

    // table to store the product and inventory levels
    const productTable = new ddb.Table(this, 'productTable', {
      partitionKey: { name: 'pk', type: ddb.AttributeType.STRING },
      sortKey: { name: 'sk', type: ddb.AttributeType.STRING },
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
    });

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

    const setInventoryLevel = new LambdaFunction(this, 'setInventoryLevel', {
      environment: { TABLE_NAME: productTable.tableName },
    });

    api.addRoutes({
      path: '/',
      methods: [apiGw.HttpMethod.GET],
      integration: new apiGwInteg.HttpLambdaIntegration(
        'setProductInventoryLevel',
        setInventoryLevel.fn,
      ),
    });

    new cdk.CfnOutput(this, 'apiUrl', { value: api.apiEndpoint });

    // add necessary resource requirements
    if (props?.removeResourcesOnStackDeletion) {
      cdk.Aspects.of(this).add(new ApplyDestroyPolicyAspect());
    }

    // supress API auth warnings
    NagSuppressions.addResourceSuppressionsByPath(
      this,
      '/CaseStudyStack/productsApi',
      [{ id: 'AwsSolutions-APIG4', reason: 'This is a test API' }],
      true,
    );
  }
}
