module.exports = {
  description: 'Sign string',
  tags: ['sign'],
  summary: 'Sign string',
  headers: {
    type: 'object',
    properties: {
      Authorization: { type: 'string' }
    },
    required: ['Authorization']
  },
  body: {
    type: 'object',
    properties: {
      queries: {
        type: 'array',
        items: { type: 'string' }
      }
    },
    required: ['queries']
  },
  response: {
    201: {
      description: 'Successful response',
      type: 'object',
      properties: {
        success: { type: 'boolean' }
      },
      required: ['success']
    },
    500: {
      description: 'Internal server error',
      type: 'object',
      properties: {
        statusCode: { type: 'integer' },
        error: { type: 'string' },
        message: { type: 'string' }
      },
      required: ['statusCode', 'error', 'message'] // Добавлено для уточнения структуры ошибки
    }
  }
}
