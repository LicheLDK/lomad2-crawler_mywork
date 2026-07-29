'use strict';

/**
 * Pino transport: write each log as JSON to stdout.
 * Default: indented (pretty) JSON + blank line — same shape as file logs.
 * options.compact=true → single-line NDJSON.
 */
const build = require('pino-abstract-transport');

/**
 * @param {{ compact?: boolean }} opts
 */
module.exports = async function pinoJsonStdoutTransport(opts = {}) {
  const compact = opts.compact === true;

  return build(async function (source) {
    for await (const obj of source) {
      try {
        const text = compact
          ? `${JSON.stringify(obj)}\n`
          : `${JSON.stringify(obj, null, 2)}\n\n`;
        process.stdout.write(text);
      } catch {
        // ignore write errors
      }
    }
  });
};
