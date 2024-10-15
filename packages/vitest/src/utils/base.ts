export { notNullish, getCallLastIndex, nanoid } from '@vitest/utils'

export function groupBy<T, K extends string | number | symbol>(
  collection: T[],
  iteratee: (item: T) => K,
) {
  return collection.reduce((acc, item) => {
    const key = iteratee(item)
    acc[key] ||= []
    acc[key].push(item)
    return acc
  }, {} as Record<K, T[]>)
}

export function stdout(): NodeJS.WriteStream {
  // @ts-expect-error Node.js maps process.stdout to console._stdout
  // eslint-disable-next-line no-console
  return console._stdout || process.stdout
}

export function escapeRegExp(s: string) {
  // From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // $& means the whole matched string
}

export function wildcardPatternToRegExp(pattern: string): RegExp {
  return new RegExp(
    `^${pattern.split('*').map(escapeRegExp).join('.*')}$`,
    'i',
  )
}
