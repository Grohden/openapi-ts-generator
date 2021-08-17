import fetch from 'node-fetch'
import path from 'path'
import { Project } from 'ts-morph'
import { generateModels } from './generators/models-file'
import { generateServices } from './generators/services-files'
import { generateUtils } from './generators/utils-file'
import { rejectFalsy } from './fp'
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
  tsDisable,
}: {
  specLocation: string,
  outputDir: string,
  tsDisable: boolean,
}) => {
  const rootDir = path.resolve(outputDir)
  const spec = await resolveSpec(specLocation)
  const project = new Project()
  const headers = rejectFalsy([
    '// @ts-nocheck',
    tsDisable && '/* eslint-disable */',
  ])

  generateUtils({
    headers,
    rootDir,
    project,
  })
  console.info('[openapi-ts-codegen] utils generated')

  generateModels({
    headers,
    rootDir,
    project,
    spec,
  })
  console.info('[openapi-ts-codegen] models generated')

  generateServices({
    headers,
    rootDir,
    project,
    spec,
  })
  console.info('[openapi-ts-codegen] services generated')

  console.info('[openapi-ts-codegen] writing files')
  project.saveSync()
  console.info('[openapi-ts-codegen] files writen, generation finished!')
}
