import path from 'path'
import {
  OptionalKind,
  ParameterDeclarationStructure,
  Project,
  PropertySignatureStructure,
  Scope,
  StatementStructures,
  StructureKind,
  WriterFunction,
  Writers,
} from 'ts-morph'
import { entries, keys, mapObject, rejectFalsy } from './fp'
import { OpenAPIV3Spec, OpenAPIV3SpecPathParam } from './openapi'
import { extractContent, extractResponseType, pathArgsToTemplate, printStringTemplate, sanitizeType } from './utils'
import { callWriter, destructWriter, literalWriter, openAPISpecTreeSpecWriter } from './writers'

const rootDir = path.resolve('generated')
const spec: OpenAPIV3Spec = require('./spec.json')
const project = new Project()

const utils = project.createSourceFile(path.join(rootDir, 'utils.ts'), {
  // language=TypeScript
  statements: [
    `\
export type Adapter = <T>(args: {
  url: string
  method: 'POST' | 'GET' | 'PATCH' | 'DELETE' | 'PUT'
  queryParams?: any
  bodyArgs?: any
}) => Promise<T>

export type Configuration = {
  baseUrl: string
  adapter: Adapter
}`,
  ],
}, {
  overwrite: true,
})

const models = project.createSourceFile(path.join(rootDir, 'models.ts'), {
  statements: entries(spec.components.schemas).map(
    ([typeName, typeSpec]) => ({
      kind: StructureKind.TypeAlias,
      isExported: true,
      name: typeName,
      type: openAPISpecTreeSpecWriter(typeSpec),
    }),
  ),
}, {
  overwrite: true,
})

const knownOperations = ['post', 'get', 'patch', 'delete', 'put']

const dataFromOperationId = (operationId: string | undefined): [string, string] => {
  const name = operationId?.split('_') || []

  if (name.length !== 2) {
    return ['Service', 'unknownName']
  }

  const [serviceName, methodName] = name

  // Highly opinionated for NestJS.
  return [
    serviceName!.replace(/Controller/, 'Service'),
    methodName!,
  ]
}

entries(spec.paths).forEach(([rawPath, pathSpec]) => {
  const pathSpecMethods = keys(pathSpec)
  const unknownOperations = pathSpecMethods.filter(operation => !knownOperations.includes(operation))

  if (unknownOperations.length) {
    throw new Error(`Unknown operation(s) found for ${rawPath}: ${unknownOperations}`)
  }

  pathSpecMethods.forEach(method => {
    const operationSpec = pathSpec[method]!
    const [fileName, methodName] = dataFromOperationId(operationSpec.operationId)
    const filePath = path.join(rootDir, 'services', `${fileName}.ts`)
    const serviceFile = project.getSourceFile(filePath) || project.createSourceFile(filePath, {
      statements: [`import type { Configuration } from '../utils'`],
    }, {
      overwrite: true,
    })

    const nameSpace = serviceFile.getClass(fileName) || serviceFile.addClass({
      isExported: true,
      name: fileName,
      ctors: [
        {
          kind: StructureKind.Constructor,
          parameters: [
            {
              kind: StructureKind.Parameter,
              name: 'configuration',
              type: utils.getTypeAliasOrThrow('Configuration').getName(),
              scope: Scope.Private,
            },
          ],
        },
      ],
    })

    const returnType = extractResponseType(operationSpec)
    const parametricType = returnType ? openAPISpecTreeSpecWriter(returnType.schema) : literalWriter('void')
    const bodyParams = extractContent('bodyArgs', operationSpec)
    const hasParameters = bodyParams || operationSpec.parameters.length
    const groupedInParams = operationSpec.parameters.reduce(
      (acc, param) => {
        // not immutable for micro optimization (but effects are local)
        param.in == 'path' ? acc.path.push(param) : acc.query.push(param)
        return acc
      },
      {
        path: [] as OpenAPIV3SpecPathParam[],
        query: [] as OpenAPIV3SpecPathParam[],
      },
    )

    if (bodyParams?.imports) {
      const specifier = serviceFile.getRelativePathAsModuleSpecifierTo(models.getFilePath())
      const declaration = serviceFile.getImportDeclaration(specifier) || serviceFile.addImportDeclaration({
        isTypeOnly: true,
        namedImports: [bodyParams.imports],
        moduleSpecifier: specifier,
      })

      const namedImport = declaration.getNamedImports().find(named => named.getName() === bodyParams.imports)

      if (!namedImport) {
        declaration.addNamedImport(bodyParams.imports)
      }
    }

    if (returnType?.typeName) {
      const specifier = serviceFile.getRelativePathAsModuleSpecifierTo(models.getFilePath())
      const declaration = serviceFile.getImportDeclaration(specifier) || serviceFile.addImportDeclaration({
        isTypeOnly: true,
        namedImports: [returnType.typeName],
        moduleSpecifier: specifier,
      })

      const namedImport = declaration.getNamedImports().find(named => named.getName() === returnType.typeName)

      if (!namedImport) {
        declaration.addNamedImport(returnType.typeName)
      }
    }

    // Since operation ids are supposed to be unique, I'm not
    // gonna deal with method duplication or replacement here.
    nameSpace.addMethod({
      name: methodName,
      parameters: rejectFalsy<OptionalKind<ParameterDeclarationStructure>>([
        hasParameters && {
          kind: StructureKind.Parameter,
          name: 'props',
          type: Writers.objectType({
            properties: rejectFalsy<OptionalKind<PropertySignatureStructure>>([
              bodyParams && {
                name: bodyParams.contentName,
                type: openAPISpecTreeSpecWriter(bodyParams.schema),
                hasQuestionToken: !bodyParams.required,
              },
              ...operationSpec.parameters.map(prop => ({
                name: prop.name,
                type: sanitizeType(prop.schema.type),
                hasQuestionToken: !prop.required,
              })),
            ]),
          }),
        },
      ]),
      statements: rejectFalsy<string | WriterFunction | StatementStructures>([
        destructWriter({
          multiline: false,
          target: 'this.configuration',
          properties: ['baseUrl', 'adapter'],
        }),
        groupedInParams.path.length && destructWriter({
          multiline: true,
          target: 'props',
          properties: groupedInParams.path.map(param => param.name),
        }),
        writer => writer.newLine(),
        Writers.returnStatement(callWriter({
          callName: 'adapter',
          parametricType,
          params: [
            Writers.object({
              url: printStringTemplate(
                `\${baseUrl}${pathArgsToTemplate(rawPath)}`,
              ),
              method: `'${method.toUpperCase()}'`,
              queryParams: groupedInParams.query.length
                ? Writers.object(mapObject(
                  groupedInParams.query,
                  item => [item.name, `props['${item.name}']`],
                ))
                : 'undefined',
              bodyArgs: bodyParams
                ? `props['${bodyParams.contentName}']`
                : 'undefined',
            }),
          ],
        })),
      ]),
    })
  })
})

project.saveSync()
