import { DynamoDBStreamHandler, StreamRecord } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { z } from 'zod';
import { defaultEnvVars, logger } from './schemas';

const envSchema = defaultEnvVars.extend({
  QUEUE_URL: z.string(),
});

const client = new SQSClient();

type Image = StreamRecord['NewImage'] & {
  streamId: string;
};

export const handler: DynamoDBStreamHandler = async (event) => {
  const records = event.Records.map((record) => {
    // check for modified events
    if (record.eventName === 'MODIFY') {
      if (!record.dynamodb) return;

      const { NewImage, SequenceNumber } = record.dynamodb;
      if (!NewImage || !SequenceNumber) return;

      return Object.assign(NewImage, { streamId: SequenceNumber });
    }
    return;
  }).filter((value): value is NonNullable<Image> =>
    checkForProductThreshold(value),
  );

  const failedItems = await sendForProcessing(records);

  return { batchItemFailures: failedItems };
};

type FailedItem = { itemIdentifier: string };

const sendForProcessing = async (
  records: NonNullable<Image[]>,
): Promise<FailedItem[]> => {
  const envs = envSchema.parse(process.env);
  logger.info('Sending records to SQS for processing');

  const results = await Promise.allSettled(
    records.map((message) => {
      const command = new SendMessageCommand({
        QueueUrl: envs.QUEUE_URL,
        MessageBody: JSON.stringify(message),
      });

      return client.send(command);
    }),
  );

  return results
    .map((result, index) => {
      if (result.status === 'rejected') {
        return { itemIdentifier: records[index].streamId };
      }
      return;
    })
    .filter((x) => x !== undefined);
};

const checkForProductThreshold = (newImage?: Image) => {
  if (!newImage) return false;

  const valueBelowThreshold =
    parseInt(newImage.quantity.N!) <= parseInt(newImage.threshold.N!);

  return valueBelowThreshold;
};
