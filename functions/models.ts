import { Entity } from 'electrodb';
import { nanoid } from 'nanoid';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient();

export const product = new Entity(
  {
    model: { entity: 'product', version: '1', service: 'app' },
    attributes: {
      productId: {
        type: 'string',
        required: true,
        default: () => `prd_${nanoid(10)}`,
      },
      productName: { type: 'string', required: true },
      quantity: { type: 'number', default: 0 },
      threshold: { type: 'number', default: 20 },
    },
    indexes: {
      products: {
        pk: { field: 'pk', composite: ['productId'], casing: 'none' },
        sk: { field: 'sk', composite: ['productId'], casing: 'none' },
      },
    },
  },
  { client },
);
