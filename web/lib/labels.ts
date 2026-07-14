import { ProjectStatus, TaskPriority, TaskStatus } from './types';

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

