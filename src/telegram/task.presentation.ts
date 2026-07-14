import { DateTime } from 'luxon';
import { TaskDetails } from '../tasks/tasks.service';

const STATUS_LABEL: Record<string, string> = {
  NEW: 'Новая',
  IN_PROGRESS: 'В работе',
  COMPLETED: 'Выполнена',
  CANCELLED: 'Отменена',
};

const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Низкий',
  NORMAL: 'Обычный',
  HIGH: 'Высокий',
  URGENT: 'Срочный',
};

export function formatTask(task: TaskDetails, timezone: string): string {
  const due = task.dueAt
    ? DateTime.fromJSDate(task.dueAt)
        .setZone(timezone)
        .setLocale('ru')
        .toFormat('dd LLL yyyy, HH:mm')
    : 'Не указан';
  const reminder = task.reminders[0]
    ? DateTime.fromJSDate(task.reminders[0].remindAt)
        .setZone(timezone)
        .setLocale('ru')
        .toFormat('dd LLL yyyy, HH:mm')
    : 'Не установлено';
  const tags = task.tags.length
    ? task.tags.map(({ tag }) => `#${tag.name}`).join(' ')
    : 'Нет';

  return [
    `📌 ${task.title}`,
    '',
    `Проект: ${task.project?.name ?? 'Без проекта'}`,
    `Описание: ${task.description ?? 'Не указано'}`,
    `Срок: ${due}`,
    `Приоритет: ${PRIORITY_LABEL[task.priority] ?? task.priority}`,
    `Статус: ${STATUS_LABEL[task.status] ?? task.status}`,
    `Теги: ${tags}`,
    `Напоминание: ${reminder}`,
  ].join('\n');
}

export function formatTaskChange(
  task: TaskDetails,
  lines: string[],
  timezone: string,
): string {
  return ['Изменение задачи', '', `Задача: ${task.title}`, ...lines, '', formatTask(task, timezone)].join('\n');
}

export function priorityLabel(value: string): string {
  return PRIORITY_LABEL[value] ?? value;
}

export function statusLabel(value: string): string {
  return STATUS_LABEL[value] ?? value;
}
