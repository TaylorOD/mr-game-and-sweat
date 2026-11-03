'use strict';

// Only log a trusted, static context and a numeric HTTP status.
// Axios errors can contain Authorization headers, client secrets and request bodies.
function logSafeError(context, error) {
  // Axios errors have error.response.status, Anthropic SDK errors have error.status
  const status = error && (error.response ? error.response.status : error.status);
  const suffix =
    Number.isInteger(status) && status >= 100 && status <= 599
      ? ` (HTTP ${status})`
      : '';

  console.error(`${context}${suffix}`);
}

module.exports = logSafeError;
