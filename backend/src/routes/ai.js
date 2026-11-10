import { Router } from 'express';
import { aiInterpretRateLimit } from '../middleware/ai-rate-limit.js';
import { interpretNaturalLanguage } from '../services/gemini/intent-interpreter.js';

const MAX_PROMPT_BYTES = 1_800;

export function createAiRouter({ interpret = interpretNaturalLanguage } = {}) {
  const router = Router();

  router.post('/interpret', aiInterpretRateLimit, async (request, response, next) => {
    const body = request.body;
    if (
      !body
      || typeof body !== 'object'
      || Array.isArray(body)
      || Object.keys(body).length !== 1
      || typeof body.prompt !== 'string'
      || !body.prompt.trim()
      || Buffer.byteLength(body.prompt, 'utf8') > MAX_PROMPT_BYTES
    ) {
      response.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Provide only a non-empty prompt of at most 1,800 UTF-8 bytes.',
          details: [{ field: 'prompt', reason: 'invalid_prompt' }],
          requestId: response.locals.requestId,
        },
      });
      return;
    }

    try {
      const result = await interpret(body.prompt.trim());
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
