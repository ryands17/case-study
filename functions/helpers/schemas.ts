import { z } from 'zod';
import { Logger, LogLevel } from '@aws-lambda-powertools/logger';

export const defaultEnvVars = z.object({
  AWS_REGION: z.string().default('eu-west-1'),
});

export const sendResponse = (data: any, statusCode: number = 200) => {
  const body = { ...data, success: statusCode >= 200 && statusCode < 400 };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
};

export const logger = new Logger({
  serviceName: 'case-study',
  logLevel: LogLevel.INFO,
});

/**
 * Pauses the execution of code for a specified amount of time.
 *
 * @param {number} [ms=1000] - The number of milliseconds to sleep (default is 1000ms or 1 second).
 * @returns {Promise<void>} A promise that resolves after the specified time has passed.
 *
 * @example
 * await sleep(2000);
 */
export const sleep = (ms: number = 1000) =>
  new Promise((resolve) => setTimeout(resolve, ms));
