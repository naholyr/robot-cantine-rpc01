'use strict'

// Used as CLI: worker'use strict';
if (!module.parent) {
  const request = require('request')

  const buffers = []
  process.stdin.on('data', buff => buffers.push(buff))
  process.stdin.on('end', () => {
    const options = JSON.parse(Buffer.concat(buffers));
    request(options, (err, res) => {
      if (!err && res.statusCode !== 200) {
        err = new Error('Invalid status: ' + res.statusCode)
        err.code = 'E_HTTP_STATUS'
      }
      if (err) {
        process.stderr.write(JSON.stringify({ message: err.message, code: err.code }), () => process.exit(1));
      } else {
        process.stdout.write(res.body, () => process.exit(0));
      }
    })
  })
} // eslint-disable-line brace-style

// Used as module: call worker
else {
  const { spawnSync } = require('child_process')

  module.exports = options => {
    const res = spawnSync(process.execPath, [__filename], { input: JSON.stringify(options) + '\r\n' })
    if (res.status !== 0) {
      let err = null
      try {
        const out = JSON.parse(res.stderr)
        err = new Error(out.message)
        err.code = out.code
      } catch (e) {
        // Not valid JSON: use stderr as-is
        err = new Error(String(res.stderr))
      }
      throw err
    }
    if (res.error) {
      const err = res.error === 'string' ? new Error(res.error) : err
      throw err
    }
    return res.stdout
  }
}
