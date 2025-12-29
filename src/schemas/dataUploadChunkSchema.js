module.exports = {
  description: 'Upload file chunk',
  tags: ['file'],
  summary: 'Upload a specific chunk of a file',
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
      numChunks: { type: 'integer' },
      content: { type: 'string' },
      senderServerName: { type: 'string' },
      serviceName: { type: 'string' },
      sha256: { type: 'string' }
    },
    required: ['fileName', 'chunkId', 'numChunks', 'content'],
  },
  response: {
    200: {
      description: 'Chunk successfully uploaded',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
      required: ['success', 'message'],
    },
    400: {
      description: 'Invalid input format',
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
        error: { type: 'string' },
      },
      required: ['error'],
    }
  }
}