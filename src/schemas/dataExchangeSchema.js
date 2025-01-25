module.exports = {
  description: 'Sign string',
  tags: ['sign'],
  summary: 'Sign string',
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
      queries: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            directory: { type: 'string' },
            pattern: { type: 'string' },
          },
          required: ['directory', 'pattern'], // Указываем обязательные поля
        },
      },
    },
    required: ['queries'], // Поле queries обязательно в теле запроса
  },
  response: {
    201: {
      description: 'Successful response',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        results: { type: 'array' },
      },
      required: ['success'],
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
