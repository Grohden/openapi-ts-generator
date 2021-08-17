import path from 'path'
import { Project, StatementStructures, StructureKind } from 'ts-morph'
import { entries } from '../fp'
import { OpenAPIV3Spec } from '../openapi'
import { openAPISpecTreeSpecWriter } from '../writers'

export const generateModels = ({
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
  return project.createSourceFile(path.join(rootDir, 'models.ts'), {
    statements: [
      ...headers,
      ...entries(spec.components.schemas).map<StatementStructures>(
        ([typeName, typeSpec]) => ({
          kind: StructureKind.TypeAlias,
          isExported: true,
          name: typeName,
          type: openAPISpecTreeSpecWriter(typeSpec),
        }),
      ),
    ],
  }, {
    overwrite: true,
  })
}
