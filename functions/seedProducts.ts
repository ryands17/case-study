// this lambda seeds initial products that can be used for testing purposes
import { z } from 'zod';
import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  DefaultEnvironmentVariablesSchema,
  logger,
  sendResponse,
} from './helpers/schemas';
import { product } from './helpers/models';
import { products } from './helpers/seed';

const envSchema = DefaultEnvironmentVariablesSchema.extend({
  TABLE_NAME: z.string(),
});

export const handler: APIGatewayProxyHandlerV2 = async (_event, context) => {
  logger.addContext(context);

  const envs = envSchema.parse(process.env);
  product.setTableName(envs.TABLE_NAME);

  // delete older values
  const items = await product.scan.go();
  await product.delete(items.data).go();

  // add the values
  await product.put(products).go();

  return sendResponse({ message: 'Seeding of data completed!' });
};
