import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { z } from 'zod';
import { defaultEnvVars, logger, sendResponse, sleep } from './helpers/schemas';
import { product } from './helpers/models';

const envSchema = defaultEnvVars.extend({
  TABLE_NAME: z.string(),
});

export const handler: APIGatewayProxyHandlerV2 = async (_, context) => {
  logger.addContext(context);
  const envs = envSchema.parse(process.env);

  product.setTableName(envs.TABLE_NAME);

  logger.info(`Adding a test item to the table`);
  let { data: testProduct } = await product
    .create({
      productName: 'test-item',
      quantity: 40,
      threshold: 20,
    })
    .go();

  logger.info(`Created product ${testProduct.productId}`);

  const valueBelowThreshold = 10;
  logger.info(
    `Setting the product value below the threshold to ${valueBelowThreshold}`,
  );

  await product
    .patch({ productId: testProduct.productId })
    .set({ quantity: valueBelowThreshold })
    .go();

  logger.info(
    `Value set below threshold. This will trigger the stream to send this to the SQS queue which in turn calls the external webhook to notify. View the logs for event processing in realtime`,
  );

  await sleep(3000);

  logger.info(`Deleting the test item to prevent polluting the DB`);
  await product.delete({ productId: testProduct.productId }).go();

  return sendResponse({
    message:
      'Endpoint simulated! You can watch live logs from the terminal if on watch mode in development',
  });
};
