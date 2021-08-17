import path from 'path'
import { Project } from 'ts-morph'

export const generateUtils = ({
  headers,
  rootDir,
  project,
}: {
  headers: string[],
  rootDir: string,
  project: Project,
}) => {
  return project.createSourceFile(path.join(rootDir, 'utils.ts'), {
    // language=TypeScript
    statements: [
      ...headers,
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
}
