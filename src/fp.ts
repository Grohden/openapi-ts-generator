// -- Base functions

export type Falsy = null | undefined | 0 | ''

export type NonFalsy<T> = T extends Falsy ? never : T

export const isFalsy = <T>(
  value: T | null | undefined | false | number,
): value is NonFalsy<T> => !!value

export const last = <T>(list: T[]) => list[list.length - 1]

export const first = <T>(list: T[]) => list[0]

export const tail = <T>([_, ...tail]: T[]) => tail

export const keys = <T extends Record<string, unknown>>(data: T) => Object.keys(data) as (keyof T)[]

export const entries = <
  T extends Record<string, unknown>,
  K extends keyof T = keyof T,
>(
  data: T,
) => Object.entries(data) as [string, T[K]][]

// We can't use properly currying here due to TS limitations for
// predicate safe guards
export const filter = <T, S extends T>(
  predicate: (item: T) => item is S,
  list: T[],
) => list.filter(predicate)

export const split = (separator: string) => (string: string) => string.split(separator)

// -- Specialized functions

// Rejects anything that coerces to false
export const rejectFalsy = <T>(list: T[]) => filter(isFalsy, list)

export const splitPath = split('/')

export const inCamelCase = ([...str]: string): string => first(str)!.toUpperCase() + tail(str).join('')
