import path from 'path'
import { Project, Scope, SourceFile, StructureKind, Writers } from 'ts-morph'
import { entries, groupBy, keys, listToObject, rejectFalsy } from '../fp'
import { OpenAPIV3Spec, RequestMethod } from '../openapi'
import {
  collectAllComplexSubtypeNames,
  extractContentSchema,
  extractResponseType,
  includeOrCreateNamedImport,
  pathArgsToTemplate,
  printStringTemplate,
  sanitizeType,
} from '../utils'
import { callWriter, destructWriter, literalWriter, openAPISpecTreeSpecWriter } from '../writers'

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

const getOrCreateServiceFile = ({
  headers,
  project,
  filePath,
}: {
  headers: string[],
  project: Project,
  filePath: string,
  fileName: string,
}) => {
  return project.getSourceFile(filePath) || project.createSourceFile(filePath, {
    statements: [
      ...headers,
      `import type { Configuration } from '../utils'`,
    ],
  }, {
    overwrite: true,
  })
}

const getOrCreateServiceClass = ({
  fileName,
  serviceFile,
}: {
  fileName: string,
  serviceFile: SourceFile,
}) => {
  return serviceFile.getClass(fileName) || serviceFile.addClass({
    isExported: true,
    name: fileName,
    ctors: [
      {
        kind: StructureKind.Constructor,
        parameters: [
          {
            kind: StructureKind.Parameter,
            name: 'configuration',
            type: 'Configuration',
            scope: Scope.Private,
          },
        ],
      },
    ],
  })
}

const serviceFromPathSpecification = ({
  headers,
  rawPath,
  method,
  pathSpec,
  project,
  rootDir,
}: {
  headers: string[],
  rawPath: string,
  method: Lowercase<RequestMethod>,
  project: Project,
  pathSpec: OpenAPIV3Spec['paths'][string],
  rootDir: string,
}) => {
  const operationSpec = pathSpec[method]!
  const [fileName, methodName] = dataFromOperationId(operationSpec.operationId)
  const filePath = path.join(rootDir, 'services', `${fileName}.ts`)

  const serviceFile = getOrCreateServiceFile({
    headers,
    filePath,
    fileName,
    project,
  })

  const nameSpace = getOrCreateServiceClass({
    fileName,
    serviceFile,
  })

  const returnType = extractResponseType(operationSpec)
  const parametricType = returnType ? openAPISpecTreeSpecWriter(returnType.schema) : literalWriter('void')
  const bodyParams = extractContentSchema('bodyArgs', operationSpec)
  const hasParameters = bodyParams || operationSpec.parameters.length
  const groupedInParams = groupBy((item) => item.in, operationSpec.parameters)

  const potentialImportsToInclude = rejectFalsy([
    bodyParams?.imports,
    ...(returnType ? collectAllComplexSubtypeNames(returnType.schema) : []),
  ])

  if (potentialImportsToInclude.length) {
    includeOrCreateNamedImport({
      inFile: serviceFile,
      fromTargetModule: '../models',
      namedImports: potentialImportsToInclude,
    })
  }

  // Since operation ids are supposed to be unique, I'm not
  // gonna deal with method duplication or replacement here.
  nameSpace.addMethod({
    name: methodName,
    parameters: rejectFalsy([
      hasParameters && {
        kind: StructureKind.Parameter,
        name: 'props',
        type: Writers.objectType({
          properties: rejectFalsy([
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
    statements: rejectFalsy([
      destructWriter({
        multiline: false,
        target: 'this.configuration',
        properties: ['baseUrl', 'adapter'],
      }),
      groupedInParams.path?.length && destructWriter({
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
            queryParams: groupedInParams.query?.length
              ? Writers.object(listToObject(
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

  return serviceFile
}

export const generateServices = ({
  headers,
  rootDir,
  project,
  spec,
}: {
  headers: string[],
  rootDir: string,
  project: Project,
  spec: OpenAPIV3Spec,
}) => {
  entries(spec.paths).forEach(([rawPath, pathSpec]) => {
    const pathSpecMethods = keys(pathSpec)
    const unknownOperations = pathSpecMethods.filter(operation => !knownOperations.includes(operation))

    if (unknownOperations.length) {
      throw new Error(`Unknown operation(s) found for ${rawPath}: ${unknownOperations}`)
    }

    pathSpecMethods.forEach(method =>
      serviceFromPathSpecification({
        headers,
        rawPath,
        pathSpec,
        method,
        project,
        rootDir,
      })
    )
  })
}
