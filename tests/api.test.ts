import { expect, it } from 'vitest';
import outputs from '../cdk.outputs.json';
import { products } from '../functions/helpers/seed';
import { product } from '../functions/helpers/models';
import { sleep } from '../functions/helpers/schemas';
import { ReceiveMessageCommand, SQSClient } from '@aws-sdk/client-sqs';

const sqsClient = new SQSClient({});
const API_URL = outputs.CaseStudyStack.apiUrl;

it('test response of the seed API', async () => {
  const raw = await fetch(`${API_URL}/seed`, {
    method: 'POST',
  });

  expect(raw.ok).toBeTruthy();
  expect(raw.status).toEqual(200);

  const result = (await raw.json()) as any;
  expect(result.success).toBeTruthy();
});

it('An incorrect body passed to the update API gives an error', async () => {
  const product = products[0];

  const raw = await fetch(`${API_URL}/${product.productId}/quantity`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'subtract', value: product.threshold - 5 }),
  });

  expect(raw.ok).toBeFalsy();
  expect(raw.status).toEqual(400);
});

it('should trigger a dynamodb stream and sqs message', async () => {
  const product = products[0];

  const raw = await fetch(`${API_URL}/${product.productId}/quantity`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'decrement', value: 80 }),
  });

  expect(raw.ok).toBeTruthy();
  expect(raw.status).toEqual(200);
});

it('the quantity of the item in dynamodb should be decreased', async () => {
  product.setTableName(outputs.CaseStudyStack.productsTableName);
  const { productId } = products[0];
  await sleep(5000);

  const { data } = await product.get({ productId }).go();

  expect(data?.quantity).toEqual(20);
});

it('should be successfully processed from the SQS queue', async () => {
  // wait for a minute until the message is processed
  await sleep(60000);

  const command = new ReceiveMessageCommand({
    QueueUrl: outputs.CaseStudyStack.processProductsQueue,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 20,
  });

  const messages = await sqsClient.send(command);
  // no messages should exist in the queue anymore
  expect(messages.Messages).toBeUndefined();
});
