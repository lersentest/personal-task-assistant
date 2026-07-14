import { BadRequestException, Injectable } from '@nestjs/common';

export interface ParsedProjectInput {
  kind: 'PROJECT';
  name: string;
  description?: string;
}

export interface ParsedTaskInput {
  kind: 'TASK';
  title: string;
  projectName?: string;
  description?: string | null;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  dueAt?: Date | null;
  dueDateType?: 'ON_DATE' | 'BEFORE_DATE' | 'EXACT_TIME' | null;
  remindAt?: Date | null;
  tags?: string[];
  sourceType?: 'TEXT' | 'VOICE' | 'FORWARDED_MESSAGE';
  originalText: string;
}

export type ParsedTextCommand = ParsedProjectInput | ParsedTaskInput;

@Injectable()
export class TextCommandParserService {
  parseDirectCommand(text: string): ParsedTextCommand | null {
    const projectMatch = text.match(
      /^(?:проект\s*:|создай\s+(?:новый\s+)?проект\s+)(.+)$/iu,
    );
    if (projectMatch) return this.parseProjectInput(projectMatch[1]);

    const taskMatch = text.match(
      /^(?:задача\s*:|создай\s+(?:новую\s+)?задачу\s+)(.+)$/iu,
    );
    if (taskMatch) return this.parseTaskInput(taskMatch[1]);

    return null;
  }

  parseProjectInput(text: string): ParsedProjectInput {
    const [rawName, ...descriptionParts] = text.split('|');
    const name = rawName.trim();
    if (!name) {
      throw new BadRequestException('Укажите название проекта.');
    }
    if (name.length > 200) {
      throw new BadRequestException(
        'Название проекта не должно превышать 200 символов.',
      );
    }

    const description = descriptionParts.join('|').trim();
    return {
      kind: 'PROJECT',
      name,
      ...(description ? { description } : {}),
    };
  }

  parseTaskInput(text: string): ParsedTaskInput {
    const [rawTitle, ...projectParts] = text.split('|');
    const title = rawTitle.trim();
    if (!title) {
      throw new BadRequestException('Укажите название задачи.');
    }
    if (title.length > 500) {
      throw new BadRequestException(
        'Название задачи не должно превышать 500 символов.',
      );
    }

    const projectName = projectParts.join('|').trim();
    return {
      kind: 'TASK',
      title,
      ...(projectName ? { projectName } : {}),
      originalText: text.trim(),
    };
  }
}
