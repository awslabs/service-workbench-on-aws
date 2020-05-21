const xml = require('xml');

/**
 * Generates an XML document containing AWS tags.
 *
 * @example
 *
 * ```javascript
 * buildTaggingXml(
 *   {
 *     UploadedBy: "me,theuser",
 *     Comment: "<!ENTITY xxe SYSTEM \"file:///etc/passwd\" >]><foo>&xxe;</foo>",
 *   },
 *   true, // pretty print
 * );
 * ```
 *
 * @param {Object<string, any>=} tags
 * @param {boolean=} pretty
 * @returns {string} an xml tagging configuration document
 */
const buildTaggingXml = (tags = {}, pretty = false) =>
  xml(
    {
      Tagging: [
        {
          TagSet: Object.entries(tags).map(([Key, Value]) => ({ Tag: [{ Key }, { Value }] })),
        },
      ],
    },
    { indent: pretty ? '  ' : undefined },
  );

module.exports = {
  buildTaggingXml,
};
