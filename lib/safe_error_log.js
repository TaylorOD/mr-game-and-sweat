'use strict';

// Only log a trusted, static context and a numeric HTTP status.
// Axios errors can contain Authorization headers, client secrets and request bodies.
function logSafeError(context, error) {
  const status = error && error.response && error.response.status;
  const suffix =
    Number.isInteger(status) && status >= 100 && status <= 599
      ? ` (HTTP ${status})`
      : '';

  console.error(`${context}${suffix}`);
}

module.exports = logSafeError;
