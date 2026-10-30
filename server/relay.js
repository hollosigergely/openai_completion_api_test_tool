const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function relay({ url, method = 'POST', headers = {}, body }) {
  if (!isHttpUrl(url)) {
    throw Object.assign(new Error('target.url must be an http(s) URL'), { statusCode: 400 });
  }

  const upperMethod = String(method).toUpperCase();
  if (!ALLOWED_METHODS.has(upperMethod)) {
    throw Object.assign(new Error(`Unsupported method: ${method}`), { statusCode: 400 });
  }

  const outgoingHeaders = { ...headers };
  // Drop empty/blank values so an attendee leaving the API key field blank
  // really does send the request with no Authorization header.
  for (const [key, value] of Object.entries(outgoingHeaders)) {
    if (value === '' || value === null || value === undefined) {
      delete outgoingHeaders[key];
    }
  }

  const hasBody = upperMethod !== 'GET' && upperMethod !== 'DELETE' && body !== undefined;

  const response = await fetch(url, {
    method: upperMethod,
    headers: outgoingHeaders,
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  const rawText = await response.text();
  let parsedBody = rawText;
  if (contentType.includes('application/json') && rawText) {
    try {
      parsedBody = JSON.parse(rawText);
    } catch {
      // leave as raw text if the target lied about its content-type
    }
  }

  return {
    status: response.status,
    headers: { 'content-type': contentType },
    body: parsedBody,
  };
}

module.exports = { relay };
