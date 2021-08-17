import { SourceFile } from 'ts-morph'
import { inCamelCase, last, values } from './fp'
import { OpenAPIV3SpecPathValue, OpenAPIV3SpecSchemaType } from './openapi'

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
export const extractContentSchema = (fallbackName: string, data: OpenAPIV3SpecPathValue) => {
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

/**
 * Includes or creates import named declarations in the `inFile`
 * importing from the `fromTargetFile`
 */
export const includeOrCreateNamedImport = ({
  inFile,
  fromTargetModule,
  namedImports,
}: {
  inFile: SourceFile,
  // Resolving a target module
  // using getRelativePathAsModuleSpecifierTo
  // takes too much time, so, if we already know
  // the specifier, we just use it.
  fromTargetModule: string,
  namedImports: string[],
}) => {
  for (const importName of namedImports) {
    const declaration = inFile.getImportDeclaration(fromTargetModule) || inFile.addImportDeclaration({
      isTypeOnly: true,
      namedImports: [importName],
      moduleSpecifier: fromTargetModule,
    })

    const namedImport = declaration.getNamedImports().find(named => named.getName() === importName)

    if (!namedImport) {
      declaration.addNamedImport(importName)
    }
  }
}

/**
 * Recursively collects all possible complex names (type aliases, interfaces, classes)
 */
export const collectAllComplexSubtypeNames = (typeSpec: OpenAPIV3SpecSchemaType): string[] => {
  if (!typeSpec.type) {
    return [resolveSchemaType(typeSpec.$ref) || 'unknown']
  }

  if (typeSpec.type === 'array') {
    return collectAllComplexSubtypeNames(typeSpec.items)
  }

  if (typeSpec.type === 'object') {
    if (!typeSpec.properties) {
      return []
    }

    return values(typeSpec.properties).reduce((last, propSpec) => {
      return [...last, ...collectAllComplexSubtypeNames(propSpec)]
    }, [])
  }

  return []
}
