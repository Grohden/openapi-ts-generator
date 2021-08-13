import fs from 'fs'
import path from 'path'
import { entries, inCamelCase, keys, last, rejectFalsy, splitPath } from './fp'
import {
  printConst,
  printFn,
  printFnCall,
  printNamedField,
  printRecord,
  printString,
  printStringTemplate,
  printType,
  printUnion,
} from './printer'

const spec = require('./spec.json')

type JSONContent = {
  'application/json': {
    schema: {
      $ref: string
    }
  }
}

type PathData = {
  operationId: string
  summary: string
  parameters: {
    name: string
    required: boolean
    in: 'path' | 'query'
    schema: {
      type: string
    }
  }[]
  requestBody?: {
    required: boolean
    content: JSONContent
  }
  responses: {
    [status: string]: {
      description: string
      content: JSONContent
    }
  }
}

type SchemaType =
  | {
    type: undefined
    $ref: string
  }
  | {
    type: 'object'
    properties: Record<string, SchemaType>
    required: string[]
  }
  | {
    type: 'string'
    enum?: string[]
  }
  | {
    type: 'array'
    items: SchemaType
  }
  | {
    type: 'number' | 'boolean'
  }

/**
 * Extracts a return type from an OpenApi component schema entry
 */
const extractReturnType = (data: PathData) => {
  const ref = (data.responses['200'] || data.responses['201'])?.content?.[
    'application/json'
  ].schema.$ref

  return (ref && last(splitPath(ref))) || 'void'
}

/**
 * Extracts a content (argument) type from an OpenApi component
 * schema content entry
 */
const extractContent = (
  data: PathData,
): {
  argName: string
  typeName: string
  required: boolean
} | null => {
  const ref = data.requestBody?.content['application/json']?.schema?.$ref
  const typeName = (ref && last(splitPath(ref))) || null

  return typeName
    ? {
      argName: inCamelCase(typeName),
      typeName: typeName,
      required: data.requestBody?.required ?? false,
    }
    : null
}

/**
 * Takes the last operation available at a record
 *
 * FIXME: need to refactor here to support multiple operations
 *  on same endpoint
 */
const parseOperation = (data: Record<string, PathData>) => {
  return last(keys(data)) || null
}

/**
 * Transforms a path arg to a string template ready for args
 *
 * eg: '{foo}' => '${foo}'
 */
const pathArgsToTemplate = (rawPath: string) => {
  return rawPath.replace(/{(?=.*})/gi, '${')
}

/**
 * Recursively prints a tree of types from the schema
 */
const printTreeType = (typeTree: SchemaType): string => {
  if (!typeTree.type) {
    return last(splitPath(typeTree.$ref)) || 'unknown'
  }

  if (typeTree.type === 'object') {
    return printRecord(
      entries(typeTree.properties).map(([name, type]) => {
        return printNamedField({
          name,
          type: printTreeType(type),
          required: typeTree.required.includes(name),
        })
      }),
    )
  }

  if (typeTree.type === 'array') {
    return `${printTreeType(typeTree.items)}[]`
  }

  if (typeTree.type === 'string') {
    if (typeTree.enum) {
      return printUnion(typeTree.enum.map(printString))
    }

    return 'string'
  }

  return typeTree.type
}

const operationsDefinitions = entries(spec.paths).map(([rawPath, pathData]) => {
  const typed = pathData as Record<string, PathData>
  const operation = parseOperation(typed)

  if (!operation) {
    console.warn(
      `[generator] unknown operation (${operation} for path`,
      rawPath,
    )
    return null
  }

  const data = typed[operation]!
  const content = extractContent(data)
  const name = data.operationId
  const hasParams = data.parameters.length || content
  const groupedIn = data.parameters.reduce(
    (acc, param) => {
      // not immutable for micro optimization (but effects are local)
      param.in == 'path' ? acc.path.push(param) : acc.query.push(param)
      return acc
    },
    { path: [] as typeof data.parameters, query: [] as typeof data.parameters },
  )

  return printFn({
    kind: 'method',
    name: name,
    args: rejectFalsy([
      hasParams && printNamedField({
        name: 'params',
        type: printRecord([
          ...data.parameters.map((param) =>
            printNamedField({
              name: param.name,
              required: param.required,
              type: param.schema.type === 'date' ? 'string' : param.schema.type,
            })
          ),
          content && printNamedField({
            name: content.argName,
            type: content.typeName,
            required: content.required,
          }),
        ]),
      }),
    ]),
    // We can print direct a destruct in the arguments
    // but formatters tend to make them ugly, that's
    // why I've opted to print as a body statement
    bodyStmts: [
      groupedIn.path.length && printConst({
        name: printRecord(groupedIn.path.map((param) => param.name)),
        value: 'params',
      }),
      groupedIn.query.length && printConst({
        name: 'queryParams',
        value: printRecord(
          groupedIn.query.map((param) =>
            printNamedField({
              name: param.name,
              type: `params['${param.name}']`,
            })
          ),
        ),
      }),
      content && printConst({
        name: 'bodyArgs',
        value: printRecord([
          printNamedField({
            name: content.argName,
            type: `params['${content.argName}']`,
          }),
        ]),
      }),
    ],
    returnExpr: printFnCall({
      call: 'adapter',
      parametricArg: extractReturnType(data),
      args: [
        printRecord([
          printNamedField({
            name: 'url',
            type: printStringTemplate(
              `\${basePath}${pathArgsToTemplate(rawPath)}`,
            ),
          }),
          printNamedField({
            name: 'method',
            type: printString(operation.toUpperCase()),
          }),
          groupedIn.query.length && 'queryParams',
          content && 'bodyArgs',
        ]),
      ],
    }),
  })
})

const parsedSchemas = entries(spec.components.schemas).map(
  ([typeName, typeTree]) => {
    const typed = typeTree as SchemaType

    return {
      name: typeName,
      body: printTreeType(typed),
    }
  },
)

fs.writeFileSync(
  path.join(__dirname, 'generated.ts'),
  `\
// -- Types
${rejectFalsy(parsedSchemas).map(printType).join('\n\n')}

// --- Operations
type Adapter = <T>(args: {
  url: string
  method: 'POST' | 'GET' | 'PATCH' | 'DELETE' | 'PUT'
  queryParams?: any
  bodyArgs?: any
}) => Promise<T>

${
    printConst({
      name: 'apiClient',
      exported: true,
      value: printFn({
        kind: 'arrow',
        args: [
          printNamedField({
            name: 'basePath',
            type: 'string',
          }),
          printNamedField({
            name: 'adapter',
            type: 'Adapter',
          }),
        ],
        returnExpr: printRecord(operationsDefinitions),
      }),
    })
  }
`,
)
