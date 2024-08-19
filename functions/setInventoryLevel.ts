import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { z } from 'zod';
import { defaultEnvVars, sendResponse } from './schemas';
import { product } from './models';

const envSchema = defaultEnvVars.extend({
  TABLE_NAME: z.string(),
});

const paramsSchema = z
  .object({
    product_id: z.string(),
  })
  .transform((val) => ({ productId: val.product_id }));

const bodySchema = z.object({
  type: z.enum(['increment', 'decrement', 'set']),
  value: z.number(),
});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const {
    success: pathSuccess,
    data: params,
    error: pathError,
  } = paramsSchema.safeParse(event.pathParameters);

  if (!pathSuccess) {
    return sendResponse({ message: pathError.errors }, 400);
  }

  const {
    success: bodySuccess,
    data: body,
    error: bodyError,
  } = bodySchema.safeParse(JSON.parse(event.body || '{}'));

  if (!bodySuccess) {
    return sendResponse({ message: bodyError.errors }, 400);
  }

  const envs = envSchema.parse(process.env);

  product.setTableName(envs.TABLE_NAME);

  const { data } = await product.get({ productId: params.productId }).go();
  if (!data) {
    return sendResponse({ message: 'Product not found' }, 404);
  }

  const updateProduct = product.patch({ productId: params.productId });

  switch (body.type) {
    case 'increment':
      await updateProduct.add({ quantity: body.value }).go();
      break;
    case 'decrement':
      await updateProduct.subtract({ quantity: body.value }).go();
      break;
    case 'set':
      await updateProduct.set({ quantity: body.value }).go();
      break;
  }

  return sendResponse({
    message: `Item ${data.productId} updated successfully!`,
  });
};
