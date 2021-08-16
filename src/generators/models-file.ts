import path from 'path'
import { Project, StructureKind } from 'ts-morph'
import { entries } from '../fp'
import { OpenAPIV3Spec } from '../openapi'
import { openAPISpecTreeSpecWriter } from '../writers'

export const generateModels = ({
  rootDir,
  project,
  spec,
}: {
  rootDir: string,
  project: Project,
  spec: OpenAPIV3Spec,
}) => {
  return project.createSourceFile(path.join(rootDir, 'models.ts'), {
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
}
