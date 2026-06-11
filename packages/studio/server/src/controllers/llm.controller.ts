import { Request, Response } from 'express';
import { LlmService } from '../services/llm.service.js';

export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  public runPlayground = async (req: Request, res: Response): Promise<void> => {
    const apiKey = req.headers['x-api-key'] as string;
    const { provider, model, messages, parameters } = req.body;

    if (!apiKey) {
      res.status(400).json({ error: 'Missing x-api-key header' });
      return;
    }

    if (!provider || !model || !messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Missing or invalid parameters in request body' });
      return;
    }

    const temperature = parameters?.temperature;
    const maxTokens = parameters?.maxTokens;

    try {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      await this.llmService.streamCompletion(
        {
          provider,
          apiKey,
          model,
          messages,
          temperature: typeof temperature === 'number' ? temperature : undefined,
          maxTokens: typeof maxTokens === 'number' ? maxTokens : undefined,
        },
        (chunk) => {
          res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        }
      );

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(400).json({ error: err.message || 'Failed to stream completion' });
      } else {
        res.write(`data: ${JSON.stringify({ error: err.message || 'Failed to stream completion' })}\n\n`);
        res.end();
      }
    }
  };
}
