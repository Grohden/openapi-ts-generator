#!/usr/bin/env node

import { Command } from 'commander'
import { generator } from './generator'

const program = new Command()

program.requiredOption('--spec <string>', 'URL or path to the OpenApi v3 spec')
program.requiredOption('--output <string>', 'output dir path')
program.option('--no-ts-disable', 'do not use disable-ts on headers')

program.parse(process.argv)

const opts = program.opts<{
  spec: string,
  output: string,
  tsDisable: boolean,
}>()

generator({
  outputDir: opts.output,
  specLocation: opts.spec,
  tsDisable: opts.tsDisable,
})
