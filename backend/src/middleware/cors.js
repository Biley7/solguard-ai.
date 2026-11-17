const VERCEL_PREVIEW_ORIGIN = /^https:\/\/solguard-[a-z0-9-]+\.vercel\.app$/;

export function createCorsMiddleware({ allowedOrigins, allowVercelPreviews }) {
  const allowed = new Set(allowedOrigins);

  function isAllowed(origin) {
    return allowed.has(origin) || (allowVercelPreviews && VERCEL_PREVIEW_ORIGIN.test(origin));
  }

  return function cors(request, response, next) {
    const origin = request.get('origin');
    response.setHeader('Vary', 'Origin');

    if (origin) {
      if (!isAllowed(origin)) {
        response.status(403).json({
          error: {
            code: 'ORIGIN_NOT_ALLOWED',
            message: 'This origin is not allowed to call the API.',
            requestId: response.locals.requestId,
          },
        });
        return;
      }

      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'content-type');
      response.setHeader('Access-Control-Max-Age', '600');
    }

    if (request.method === 'OPTIONS') {
      response.status(204).end();
      return;
    }

    next();
  };
}
