/**
 * @file bigintJSON.js
 * @description Helper functions to safely serialize and deserialize objects containing BigInt
 */

/**
 * JSON stringify with BigInt support
 * @param {object} obj
 * @returns {string} JSON string
 */
const stringify = (obj) =>
  JSON.stringify(obj, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );

/**
 * JSON parse with BigInt support
 * @param {string} json
 * @returns {object} Object with BigInt restored
 */
const parse = (json) =>
  JSON.parse(json, (_, value) => {
    if (typeof value === 'string' && /^\d+$/.test(value)) {
      // convert numeric strings to BigInt
      return BigInt(value);
    }
    return value;
  });

module.exports = { stringify, parse };