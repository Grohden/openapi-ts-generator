import fetch from 'node-fetch'
import path from 'path'
import { Project } from 'ts-morph'
import { generateModels } from './generators/models-file'
import { generateServices } from './generators/services-files'
import { generateUtils } from './generators/utils-file'
import { OpenAPIV3Spec } from './openapi'

const resolveSpec = (location: string): Promise<OpenAPIV3Spec> => {
  if ((/^https?:\/\//).test(location)) {
    return fetch(location, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    }).then(response => response.json() as Promise<OpenAPIV3Spec>)
  } else {
    return Promise.resolve(require(location))
  }
}

export const generator = async ({
  specLocation,
  outputDir,
}: {
  specLocation: string,
  outputDir: string,
}) => {
  const rootDir = path.resolve(outputDir)
  const spec = await resolveSpec(specLocation)
  const project = new Project()

  const utils = generateUtils({
    rootDir,
    project,
  })

  const models = generateModels({ rootDir, project, spec })

  generateServices({
    rootDir,
    project,
    spec,
    models,
    utils,
  })

  project.saveSync()
}
