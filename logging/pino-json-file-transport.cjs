'use strict';

/**
 * Pino transport: pretty-printed JSON objects to a rotating file (pino-roll).
 * Each log entry is written as indented JSON + blank line for readable file viewing.
 */
const build = require('pino-abstract-transport');
const roll = require('pino-roll');

/**
 * @param {{
 *   file: string;
 *   frequency?: string | number;
 *   size?: string | number;
 *   limit?: number;
 *   dateFormat?: string;
 *   mkdir?: boolean;
 * }} opts
 */
module.exports = async function pinoJsonFileTransport(opts) {
  const file = opts.file;
  if (!file || typeof file !== 'string') {
    throw new Error('pino-json-file-transport: options.file is required');
  }

  const stream = await roll({
    file,
    frequency: opts.frequency ?? 'daily',
    size: opts.size ?? '20m',
    mkdir: opts.mkdir !== false,
    symlink: true,
    dateFormat: opts.dateFormat ?? 'yyyy-MM-dd',
    limit: {
      count: typeof opts.limit === 'number' ? opts.limit : 14,
      removeOtherLogFiles: true,
    },
  });

  return build(
    async function (source) {
      for await (const obj of source) {
        try {
          stream.write(`${JSON.stringify(obj, null, 2)}\n\n`);
        } catch {
          // ignore write errors to avoid crashing the app from logging
        }
      }
    },
    {
      async close() {
        await new Promise((resolve) => {
          stream.end();
          stream.on('close', resolve);
          stream.on('finish', resolve);
          setTimeout(resolve, 500);
        });
      },
    },
  );
};
