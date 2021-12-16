import * as matcherUtils from './jest-matcher-utils'

import {
  equals,
  isA,
} from './jest-utils'
import type {
  MatcherState,
  ChaiPlugin,
} from './types'

export interface AsymmetricMatcherInterface {
  asymmetricMatch(other: unknown): boolean
  toString(): string
  getExpectedType?(): string
  toAsymmetricMatcher?(): string
}

export abstract class AsymmetricMatcher<
  T,
  State extends MatcherState = MatcherState,
> implements AsymmetricMatcherInterface {
  constructor(protected sample: T, protected inverse = false) {}

  protected getMatcherContext(): State {
    return {
      equals,
      isNot: this.inverse,
      utils: matcherUtils,
    } as any
  }

  abstract asymmetricMatch(other: unknown): boolean
  abstract toString(): string
  getExpectedType?(): string
  toAsymmetricMatcher?(): string
}

export class StringContaining extends AsymmetricMatcher<string> {
  constructor(sample: string, inverse = false) {
    if (!isA('String', sample))
      throw new Error('Expected is not a string')

    super(sample, inverse)
  }

  asymmetricMatch(other: string) {
    const result = isA('String', other) && other.includes(this.sample)

    return this.inverse ? !result : result
  }

  toString() {
    return `String${this.inverse ? 'Not' : ''}Containing`
  }

  getExpectedType() {
    return 'string'
  }
}

export class Anything extends AsymmetricMatcher<void>{
  asymmetricMatch(other: unknown) {
    return other !== void 0 && other !== null;
  }

  toString() {
    return 'Anything';
  }

  toAsymmetricMatcher() {
    return 'Anything';
  }
}

export class ArrayContaining extends AsymmetricMatcher<Array<unknown>> {
  constructor(sample: Array<unknown>, inverse = false) {
    super(sample, inverse);
  }

  asymmetricMatch(other: Array<unknown>) {
    if (!Array.isArray(this.sample)) {
      throw new Error(
        `You must provide an array to ${this.toString()}, not '` +
          typeof this.sample +
          "'.",
      );
    }

    const result =
      this.sample.length === 0 ||
      (Array.isArray(other) &&
        this.sample.every(item =>
          other.some(another => equals(item, another)),
        ));

    return this.inverse ? !result : result;
  }

  toString() {
    return `Array${this.inverse ? 'Not' : ''}Containing`;
  }

  getExpectedType() {
    return 'array';
  }
}


export const JestAsymmetricMatchers: ChaiPlugin = (chai, utils) => {
  utils.addMethod(
    chai.expect,
    'stringContaining',
    (expected: string) => new StringContaining(expected),
  )

  utils.addMethod(
    chai.expect,
    'anything',
    () => {
      return new Anything()
    },
  )

  utils.addMethod(
    chai.expect,
    'arrayContaining',
    (expected: any) => {
      return new ArrayContaining(expected)
    },
  )

}
