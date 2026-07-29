'use strict';

/**
 * Pino transport: pretty-printed JSON objects to a rotating file (pino-roll).
 * Each log entry is written as indented JSON + blank line for readable file viewing.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const build = require('pino-abstract-transport');
const roll = require('pino-roll');

/**
 * Probes whether the current process/user can actually create filesystem
 * symlinks (Windows requires admin rights or Developer Mode; without either,
 * pino-roll's symlinkSync throws EPERM and crashes the transport). Cached
 * since the privilege can't change during the process lifetime.
 */
let cachedSymlinkSupport;
function canCreateSymlinks() {
  if (cachedSymlinkSupport !== undefined) return cachedSymlinkSupport;

  const target = path.join(os.tmpdir(), `.symlink-probe-target-${process.pid}`);
  const link = path.join(os.tmpdir(), `.symlink-probe-link-${process.pid}`);
  try {
    fs.writeFileSync(target, '');
    fs.symlinkSync(target, link, 'file');
    cachedSymlinkSupport = true;
  } catch {
    cachedSymlinkSupport = false;
  } finally {
    fs.rm(link, { force: true }, () => {});
    fs.rm(target, { force: true }, () => {});
  }
  return cachedSymlinkSupport;
}

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
    symlink: canCreateSymlinks(),
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
