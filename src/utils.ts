import { inCamelCase, last } from './fp'
import { OpenAPIV3SpecPathValue } from './openapi'

/**
 * Splits a schema ref and returns the last name contained in it
 *
 * for example, #/components/schemas/Foo
 * will return Foo
 *
 * This function does not validates if the ref is actually contained in a schema.
 */
export const resolveSchemaType = (ref: string) => {
  return last(ref.split('/'))
}

/**
 * Transforms a path arg to a string template ready for args
 *
 * eg: '{foo}' => '${foo}'
 */
export const pathArgsToTemplate = (rawPath: string) => {
  return rawPath.replace(/{(?=.*})/gi, '${')
}

/**
 * Extracts a content (argument) type from an OpenApi component
 * schema content entry
 */
export const extractContent = (fallbackName: string, data: OpenAPIV3SpecPathValue) => {
  const body = data.requestBody
  const schema = body?.content['application/json']?.schema || null
  const typeName = schema && !schema.type ? resolveSchemaType(schema.$ref) : null

  return schema
    ? {
      imports: typeName,
      contentName: typeName ? inCamelCase(typeName) : fallbackName,
      schema: schema,
      required: body!.required ?? true,
    }
    : null
}

/**
 * Extracts a return type from an OpenApi component schema entry
 */
export const extractResponseType = (data: OpenAPIV3SpecPathValue) => {
  const schema = (data.responses['200'] || data.responses['201'])?.content?.[
    'application/json'
  ]?.schema

  return schema
    ? {
      schema,
      typeName: !schema.type ? resolveSchemaType(schema.$ref) : null,
    }
    : null
}

/**
 * Assures that a type has the correct name
 */
export const sanitizeType = (type: string) => {
  return type === 'date' ? 'string' : type
}

/**
 * Wraps a string in a string template **without escaping it**
 */
export const printStringTemplate = (str: string) => `\`${str}\``
