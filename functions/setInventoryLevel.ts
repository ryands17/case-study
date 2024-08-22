// this lambda sets the inventory level (quantity) for the given product
import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { z } from 'zod';
import {
  DefaultEnvironmentVariablesSchema,
  logger,
  sendResponse,
} from './helpers/schemas';
import { product } from './helpers/models';

const envSchema = DefaultEnvironmentVariablesSchema.extend({
  TABLE_NAME: z.string(),
});

const eventSchema = z.object({
  body: z
    .string()
    .refine((val) => {
      try {
        JSON.parse(val);
        return true;
      } catch (error) {
        return false;
      }
    })
    .transform((val) => JSON.parse(val))
    .pipe(
      z.object({
        type: z.enum(['increment', 'decrement', 'set']),
        value: z.number(),
      }),
    ),
  pathParameters: z
    .object({
      product_id: z.string(),
    })
    .transform((val) => ({ productId: val.product_id })),
});

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  logger.addContext(context);

  const { success, data: evt, error } = eventSchema.safeParse(event);

  if (!success) {
    return sendResponse({ message: error.errors }, 400);
  }

  const envs = envSchema.parse(process.env);

  product.setTableName(envs.TABLE_NAME);

  const { data } = await product
    .get({ productId: evt.pathParameters.productId })
    .go();
  if (!data) {
    return sendResponse({ message: 'Product not found' }, 404);
  }

  const updateProduct = product.patch({
    productId: evt.pathParameters.productId,
  });

  logger.info(
    `Performing ${evt.body.type} on ${data.productId} for quanity: ${evt.body.value}`,
  );

  switch (evt.body.type) {
    case 'increment':
      await updateProduct.add({ quantity: evt.body.value }).go();
      break;
    case 'decrement':
      await updateProduct.subtract({ quantity: evt.body.value }).go();
      break;
    case 'set':
      await updateProduct.set({ quantity: evt.body.value }).go();
      break;
  }

  return sendResponse({
    message: `Quantity for item ${data.productId} updated successfully!`,
  });
};
