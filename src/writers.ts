import { PropertySignatureStructure, StructureKind, WriterFunction, Writers } from 'ts-morph'
import { entries } from './fp'
import { OpenAPIV3SpecSchemaType } from './openapi'
import { resolveSchemaType } from './utils'

export const literalWriter = (literal: string): WriterFunction => (writer) => writer.write(literal)

export const callWriter = (props: {
  callName: string,
  parametricType?: WriterFunction,
  params?: WriterFunction[],
}): WriterFunction =>
  writer => {
    writer.write(props.callName)
    if (props.parametricType) {
      writer.write('<')
      props.parametricType(writer)
      writer.write('>')
    }
    writer.write('(')
    props.params?.forEach(content => {
      content(writer)
    })
    writer.write(')')
  }

export const destructWriter = (props: {
  multiline?: boolean,
  target: string,
  properties: string[],
}): WriterFunction =>
  (writer) => {
    writer.write('const { ')
    writer.write(props.properties.join(', '))
    writer.write(` } = ${props.target};`)
  }

/**
 * Given a open api spec schema create writers for
 * all types recursively contained in it
 */
export const openAPISpecTreeSpecWriter = (typeSpec: OpenAPIV3SpecSchemaType): WriterFunction => {
  if (typeSpec.type === 'array') {
    return (writer) => {
      openAPISpecTreeSpecWriter(typeSpec.items)(writer)
      writer.write('[]')
    }
  }

  if (typeSpec.type == 'object') {
    if (!typeSpec.properties) {
      return literalWriter('Record<string, unknown>')
    }

    return Writers.objectType({
      properties: entries(typeSpec.properties).map<PropertySignatureStructure>(([key, spec]) => ({
        kind: StructureKind.PropertySignature,
        name: key,
        hasQuestionToken: !(typeSpec.required || []).includes(key),
        type: openAPISpecTreeSpecWriter(spec),
      })),
    })
  }

  if (typeSpec.type === 'string' && typeSpec.enum?.length) {
    const values = typeSpec.enum.map(entry => `'${entry}'`)

    if (values.length === 1) {
      return literalWriter(values[0]!)
    }

    const [a, b, ...rest] = values

    return Writers.unionType(a!, b!, ...rest)
  }

  if (!typeSpec.type) {
    return literalWriter(resolveSchemaType(typeSpec.$ref) || 'unknown')
  }

  return literalWriter(typeSpec.type)
}
