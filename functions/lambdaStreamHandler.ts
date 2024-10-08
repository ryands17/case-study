// this lambda handles the events from the DynamoDB stream and sends them to SQS for further processing
import { DynamoDBStreamHandler, StreamRecord } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { z } from 'zod';
import { DefaultEnvironmentVariablesSchema, logger } from './helpers/schemas';

const EnvironmentVariablesSchema = DefaultEnvironmentVariablesSchema.extend({
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

      // add sequence number to return failed items if there are any
      return Object.assign(NewImage, { streamId: SequenceNumber });
    }
    return;
  }).filter((value): value is NonNullable<Image> =>
    checkForProductThreshold(value),
  );

  const failedItems = await sendForProcessing(records);
  if (failedItems.length > 0) {
    logger.error(
      `Failed to send ${failedItems.length} items to the queue. Will try again via the stream`,
    );
  }

  return { batchItemFailures: failedItems };
};

type FailedItem = { itemIdentifier: string };

const sendForProcessing = async (
  records: NonNullable<Image[]>,
): Promise<FailedItem[]> => {
  const envs = EnvironmentVariablesSchema.parse(process.env);
  logger.info(`Sending ${records.length} records to SQS for processing`);

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
