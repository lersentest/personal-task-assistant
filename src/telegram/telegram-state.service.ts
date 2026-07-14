import { Injectable } from '@nestjs/common';

export type TelegramInputMode =
  | 'CREATE_PROJECT'
  | 'CREATE_TASK'
  | 'EDIT_TASK'
  | 'SEARCH_TASKS';

interface TelegramInputState {
  mode: TelegramInputMode;
  expiresAt: number;
  taskId?: string;
}

const INPUT_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class TelegramStateService {
  private readonly states = new Map<string, TelegramInputState>();

  set(telegramId: string, mode: TelegramInputMode, taskId?: string): void {
    this.states.set(telegramId, {
      mode,
      expiresAt: Date.now() + INPUT_TTL_MS,
      ...(taskId ? { taskId } : {}),
    });
  }

  taskId(telegramId: string): string | undefined {
    const mode = this.get(telegramId);
    if (!mode) return undefined;
    return this.states.get(telegramId)?.taskId;
  }

  get(telegramId: string): TelegramInputMode | undefined {
    const state = this.states.get(telegramId);
    if (!state) return undefined;
    if (state.expiresAt <= Date.now()) {
      this.states.delete(telegramId);
      return undefined;
    }
    return state.mode;
  }

  clear(telegramId: string): void {
    this.states.delete(telegramId);
  }
}
