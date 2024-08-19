import { APIGatewayProxyHandlerV2 } from 'aws-lambda';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  console.log(event.body);
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Hello Lambda hot watch!',
    }),
  };
};
