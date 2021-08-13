import { Falsy, rejectFalsy } from './fp'

type FnKind = 'arrow' | 'method' | 'function'

const exportsStmt = (exports: boolean | undefined) => exports ? 'export ' : ''

const parametricExpr = (expr: string | undefined) => (expr ? `<${expr}>` : '')

const printFnHeader = ({
  name = '',
  args,
  parametricArg,
  returnType,
  kind = 'arrow',
}: {
  name?: string
  args: (string | Falsy)[]
  returnType?: string
  parametricArg?: string
  kind?: FnKind
}) => {
  const returnStr = returnType ? `: ${returnType}` : ''
  const argsStr = rejectFalsy(args).join(', ')
  const parametric = parametricExpr(parametricArg)

  switch (kind) {
    case 'arrow':
      return `${name}${parametric}(${argsStr})${returnStr} =>`
    case 'method':
      return `${name}${parametric}(${argsStr})${returnStr}`
    case 'function':
      return `function ${name}${parametric}(${argsStr})${returnStr}`
  }
}

export const printFn = (data: {
  name?: string
  args: (string | Falsy)[]
  parametricArg?: string
  returnType?: string
  returnExpr?: string
  bodyStmts?: (string | Falsy)[]
  exported?: boolean
  kind?: FnKind
}) => {
  return `\
  ${exportsStmt(data.exported)}${printFnHeader(data)} {
    ${
    rejectFalsy([
      ...(data.bodyStmts || []),
      data.returnExpr ? `return ${data.returnExpr}` : null,
    ]).join('\n')
  }
  }`
}

export const printStringTemplate = (str: string) => `\`${str}\``

export const printString = (str: string) => `'${str}'`

export const printUnion = (sums: string[]) => `| ${sums.join('\n| ')}`

export const printType = ({
  name,
  body,
  exported = false,
}: {
  name: string
  body: string
  exported?: boolean
}) => {
  return `${exportsStmt(exported)}type ${name} = ${body}`
}

export const printRecord = (entries: (string | Falsy)[]) =>
  `{
  ${rejectFalsy(entries).join(',\n')}
}`

export const printConst = ({
  name,
  value,
  exported = false,
}: {
  name: string
  value: string
  exported?: boolean
}) => `${exportsStmt(exported)}const ${name} = ${value}`

export const printFnCall = ({
  call,
  parametricArg,
  args,
}: {
  call: string
  parametricArg?: string
  args: (string | Falsy)[]
}) => {
  const parametric = parametricExpr(parametricArg)

  return `${call}${parametric}(${rejectFalsy(args).join(',')});`
}

export const printNamedField = ({
  name,
  type,
  required = true,
}: {
  name: string
  type: string
  required?: boolean
}) => `${name}${required ? '' : '?'}: ${type}`
