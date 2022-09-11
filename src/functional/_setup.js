/* istanbul ignore file */

export var root = typeof self == 'object' && self.self === self && self ||
    typeof global == 'object' && global.global === global && global ||
    Function('return this')() ||
    {};

export const MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
