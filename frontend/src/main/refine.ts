// Text cleanup step. Phase 1 returns the transcription unchanged (ADR-05); Phase 2 plugs an LLM in here.

export interface Refiner {
  refine(text: string): Promise<string>;
}

export class IdentityRefiner implements Refiner {
  async refine(text: string): Promise<string> {
    return text;
  }
}
