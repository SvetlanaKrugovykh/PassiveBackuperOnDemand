module.exports = {
  description: 'Fetch file chunk',
  tags: ['file'],
  summary: 'Fetch a specific chunk of a file',
  headers: {
    type: 'object',
    properties: {
      Authorization: { type: 'string' },
    },
    required: ['Authorization'],
  },
  body: {
    type: 'object',
    properties: {
      fileName: { type: 'string' },
      chunkId: { type: 'integer' },
    },
    required: ['fileName', 'chunkId'],
  },
  response: {
    200: {
      description: 'Chunk successfully retrieved',
      type: 'object',
      properties: {
        fileName: { type: 'string' },
        chunkId: { type: 'integer' },
        content: { type: 'string' },
      },
      required: ['fileName', 'chunkId', 'content'],
    },
    400: {
      description: 'Invalid input format',
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
      required: ['error'],
    },
    404: {
      description: 'Chunk not found',
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
      required: ['error'],
    },
    500: {
      description: 'Internal server error',
      type: 'object',
      properties: {
        statusCode: { type: 'integer' },
        error: { type: 'string' },
        message: { type: 'string' },
      },
      required: ['statusCode', 'error', 'message'],
    },
  },
}
