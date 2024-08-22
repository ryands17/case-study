// this is the handler for the external webhook API
import { LambdaFunctionURLHandler } from 'aws-lambda';
import { logger, sendResponse } from './helpers/schemas';

export const handler: LambdaFunctionURLHandler = async (event, context) => {
  logger.addContext(context);

  logger.info(
    'The third party called the webhook will do something with this event',
    { data: JSON.parse(event.body || '{}') },
  );

  return sendResponse({ message: 'Message processed!' });
};
