/**
 * Serializes a JavaScript value into a canonical UTF-8 JSON string with
 * lexicographically sorted keys and no insignificant whitespace.
 *
 * @param {any} value - Object, array, or primitive to encode.
 * @returns {string} Canonical JSON representation.
 */
export function canonicalEncode(value) {
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalEncode).join(',') + ']';
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const entries = keys.map((k) => JSON.stringify(k) + ':' + canonicalEncode(value[k]));
    return '{' + entries.join(',') + '}';
  }
  return JSON.stringify(value);
}
