'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const logSafeError = require('../lib/safe_error_log');

function loggedArguments(context, error) {
  const original = console.error;
  const calls = [];
  console.error = (...args) => calls.push(args);
  try {
    logSafeError(context, error);
    return calls;
  } finally {
    console.error = original;
  }
}

const secret = 'SECRET_SENTINEL_DO_NOT_LOG';
const error = new Error(`Request failed: ${secret}`);
error.config = {
  headers: { Authorization: `Bearer ${secret}` },
  params: { client_secret: secret },
  data: secret,
};
error.response = {
  status: 401,
  data: { error_description: secret },
};

assert.deepStrictEqual(
  loggedArguments('Error generating review content', error),
  [['Error generating review content (HTTP 401)']]
);
assert.deepStrictEqual(
  loggedArguments('Error getting access token', error),
  [['Error getting access token (HTTP 401)']]
);
assert.deepStrictEqual(
  loggedArguments('Error fetching top games', new Error(secret)),
  [['Error fetching top games']]
);
assert.deepStrictEqual(
  loggedArguments('Error checking if game has been reviewed', null),
  [['Error checking if game has been reviewed']]
);
assert.deepStrictEqual(
  loggedArguments('Error generating review content', { response: { status: `401 ${secret}` } }),
  [['Error generating review content']]
);
assert.deepStrictEqual(
  loggedArguments('Unhandled error', { response: { status: 999 } }),
  [['Unhandled error']]
);

// Check every live console.error in the entrypoint uses the safe logger.
// This catches regressions where a future catch block prints an Axios error directly.
const source = fs.readFileSync(path.join(__dirname, '..', 'generate_reviews.js'), 'utf8');
const rawLogLines = source.split('\n').filter((line) =>
  /console\.error\s*\(/.test(line) && !line.trim().startsWith('//')
);
assert.deepStrictEqual(rawLogLines, [], 'The review generator must not log raw error objects');

console.log('Security log-redaction tests passed');
