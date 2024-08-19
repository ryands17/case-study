import { z } from 'zod';

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
