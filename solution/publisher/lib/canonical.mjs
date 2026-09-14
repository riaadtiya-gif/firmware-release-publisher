/**
 * Serializes data into a canonical UTF-8 JSON string with
 * lexicographically sorted keys and no unnecessary whitespace.
 *
 * @param {unknown} payload - Data structure or primitive to encode.
 * @returns {string} Deterministic canonical JSON string.
 */
export function serializeCanonicalDescriptor(payload) {
  if (Array.isArray(payload)) {
    return '[' + payload.map(serializeCanonicalDescriptor).join(',') + ']';
  }

  if (payload !== null && typeof payload === 'object') {
    const sortedKeys = Object.keys(payload).sort();
    const formattedPairs = sortedKeys.map(
      (propertyKey) => JSON.stringify(propertyKey) + ':' + serializeCanonicalDescriptor(payload[propertyKey])
    );
    return '{' + formattedPairs.join(',') + '}';
  }

  return JSON.stringify(payload);
}
