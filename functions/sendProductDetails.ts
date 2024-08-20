import { SQSHandler } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { logger } from './schemas';

export const handler: SQSHandler = async (event, context) => {
  logger.addContext(context);

  const records = event.Records.map((record) => {
    const data = JSON.parse(record.body);
    const { streamId, ...rest } = data;

    const product = unmarshall(rest);

    return Object.assign(product, { messageId: record.messageId });
  });

  logger.info('Records', { data: records });
  return { batchItemFailures: [] };
};
