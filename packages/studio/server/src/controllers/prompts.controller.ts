import { Request, Response } from 'express';
import { PromptsService } from '../services/prompts.service.js';

export class PromptsController {
  constructor(private readonly promptsService: PromptsService) {}

  public getAllPrompts = async (req: Request, res: Response): Promise<void> => {
    try {
      const prompts = await this.promptsService.listPrompts();
      res.json(prompts);
    } catch (err) {
      res.status(500).json({ error: `Failed to read prompts directory: ${(err as Error).message}` });
    }
  };

  public updatePrompt = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
      const prompt = await this.promptsService.savePrompt(id, req.body);
      res.json({ success: true, prompt });
    } catch (err) {
      res.status(400).json({ error: `Failed to save prompt: ${(err as Error).message}` });
    }
  };
}
