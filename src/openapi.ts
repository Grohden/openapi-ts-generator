export type RequestMethod = 'POST' | 'GET' | 'PATCH' | 'DELETE' | 'PUT'

export type OpenAPIV3SpecSchemaType =
  | {
    type: undefined,
    $ref: string,
  }
  | {
    type: 'object',
    properties?: Record<string, OpenAPIV3SpecSchemaType>,
    required?: string[],
  }
  | {
    type: 'string',
    enum?: string[],
  }
  | {
    type: 'array',
    items: OpenAPIV3SpecSchemaType,
  }
  | {
    type: 'number' | 'boolean',
  }

export type OpenAPIV3SpecContent = {
  'application/json'?: {
    'schema': OpenAPIV3SpecSchemaType,
  },
}

export type OpenAPIV3SpecPathParam = {
  name: string,
  required: boolean,
  in: 'path' | 'query',
  schema: {
    type: string,
  },
}

export type OpenAPIV3SpecPathValue = {
  operationId?: string,
  summary: string,
  parameters: OpenAPIV3SpecPathParam[],
  requestBody?: {
    required: boolean,
    content: OpenAPIV3SpecContent,
  },
  responses: {
    [statusCode: string]: {
      description: string,
      content: OpenAPIV3SpecContent,
    },
  },
  tags: string[],
}

export type OpenAPIV3Spec = {
  openapi: string,
  info: {
    title: string,
    description: string,
    version: string,
    contact: unknown,
  },
  tags: unknown[],
  servers: unknown[],
  components: {
    securitySchemes: {
      [scheme: string]: {
        scheme: string,
        bearerFormat: string,
        type: string,
      },
    },
    schemas: {
      [scheme: string]: OpenAPIV3SpecSchemaType,
    },
  },
  paths: {
    [path: string]: {
      [requestMethod in Lowercase<RequestMethod>]?: OpenAPIV3SpecPathValue
    },
  },
}
