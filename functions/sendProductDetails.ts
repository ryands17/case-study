import { SQSHandler } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { defaultEnvVars, logger } from './helpers/schemas';
import { z } from 'zod';

const envSchema = defaultEnvVars.extend({
  WEBHOOK_URL: z.string(),
});

export const handler: SQSHandler = async (event, context) => {
  logger.addContext(context);

  const envs = envSchema.parse(process.env);

  const records = event.Records.map((record) => {
    const data = JSON.parse(record.body);
    const { streamId, ...rest } = data;

    const product = unmarshall(rest);

    return Object.assign(product, { messageId: record.messageId });
  });

  logger.info(`Sending ${records.length} items to the webhook`);

  const results = await Promise.allSettled(
    records.map(async ({ messageId, ...rest }) => {
      console.log('sending record');
      const raw = await fetch(`${envs.WEBHOOK_URL}/webhook`, {
        method: 'POST',
        body: JSON.stringify(rest),
        headers: { 'Content-type': 'application/json' },
      });

      if (!raw.ok) {
        throw new Error('Response error from webhook');
      }

      return raw.json();
    }),
  );

  const failedItems = results
    .map((result, index) => {
      if (result.status === 'rejected') {
        return { itemIdentifier: records[index].messageId };
      }
      return;
    })
    .filter((res) => res !== undefined);

  if (failedItems.length > 0) {
    logger.error(
      `Failed responses: ${failedItems.length}. These will be processed again or sent to the DLQ`,
    );
  }
  return { batchItemFailures: failedItems };
};
