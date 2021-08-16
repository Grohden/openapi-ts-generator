import path from 'path'
import { Project } from 'ts-morph'
import { generateModels } from './generators/models-file'
import { generateServices } from './generators/services-files'
import { generateUtils } from './generators/utils-file'
import { OpenAPIV3Spec } from './openapi'

const rootDir = path.resolve('generated')
const spec: OpenAPIV3Spec = require('./spec.json')
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
