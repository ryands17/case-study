import { z } from 'zod';
import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { defaultEnvVars, sendResponse } from './schemas';
import { product } from './models';

const envSchema = defaultEnvVars.extend({
  TABLE_NAME: z.string(),
});

const products = [
  {
    productName: 'Tank top',
    quantity: 100,
    threshold: 30,
  },
  {
    productName: 'Cardigan',
    quantity: 50,
    threshold: 50,
  },
  {
    productName: 'Tube',
    quantity: 80,
    threshold: 40,
  },
  {
    productName: 'Windcheater',
    quantity: 50,
  },
  {
    productName: 'Saree',
    quantity: 90,
    threshold: 20,
  },
  {
    productName: 'Sheer',
    quantity: 75,
    threshold: 30,
  },
  {
    productName: 'Jumpsuit',
    quantity: 80,
    threshold: 20,
  },
];

export const handler: APIGatewayProxyHandlerV2 = async () => {
  const envs = envSchema.parse(process.env);
  product.setTableName(envs.TABLE_NAME);

  // delete older values
  const items = await product.scan.go();
  await product.delete(items.data).go();

  // add the values
  await product.put(products).go();

  return sendResponse({ message: 'Seeding of data completed!' });
};
