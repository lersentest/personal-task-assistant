import { ProjectStatus, TaskKind, TaskPriority, TaskStatus } from './types';

export const statusLabel: Record<TaskStatus, string> = {
  NEW: 'Новая',
  IN_PROGRESS: 'В работе',
  COMPLETED: 'Выполнена',
  CANCELLED: 'Отменена',
};

export const priorityLabel: Record<TaskPriority, string> = {
  LOW: 'Низкий',
  NORMAL: 'Обычный',
  HIGH: 'Высокий',
  URGENT: 'Срочный',
};

export const taskKindLabel: Record<TaskKind, string> = {
  TASK: 'Задача',
  CALL: 'Звонок',
  MEETING: 'Встреча',
  IDEA: 'Идея',
  NOTE: 'Заметка',
};

export const projectStatusLabel: Record<ProjectStatus, string> = {
  ACTIVE: 'Активный',
  ON_HOLD: 'На паузе',
  COMPLETED: 'Завершён',
  ARCHIVED: 'Архив',
};

export function formatDate(value: string | null | undefined) {
  if (!value) return 'Без срока';
  return new Intl.DateTimeFormat('ru', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export type DueDateType = 'ON_DATE' | 'BEFORE_DATE' | 'EXACT_TIME' | null | undefined;

export function formatDueDate(value: string | null | undefined, dueDateType?: DueDateType) {
  if (!value) return 'Без срока';
  const date = new Date(value);
  const dateOnly = new Intl.DateTimeFormat('ru', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
  const dateTime = new Intl.DateTimeFormat('ru', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

  if (dueDateType === 'ON_DATE') return dateOnly;
  if (dueDateType === 'BEFORE_DATE') {
    const isEndOfDay = date.getHours() === 23 && date.getMinutes() >= 55;
    return isEndOfDay ? `До конца дня · ${dateOnly}` : `До ${dateTime}`;
  }
  if (dueDateType === 'EXACT_TIME') return dateTime;
  return dateTime;
}

export function dueModeLabel(dueDateType?: DueDateType) {
  if (dueDateType === 'ON_DATE') return 'В день';
  if (dueDateType === 'BEFORE_DATE') return 'До дедлайна';
  if (dueDateType === 'EXACT_TIME') return 'Точное время';
  return 'Без срока';
}
