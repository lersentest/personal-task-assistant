import { InlineKeyboard } from 'grammy';

export function taskKeyboard(taskId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Выполнено', `task:status:${taskId}:COMPLETED`)
    .text('▶️ В работе', `task:status:${taskId}:IN_PROGRESS`)
    .row()
    .text('✏️ Изменить', `task:edit:${taskId}`)
    .text('⚡ Приоритет', `task:prioritymenu:${taskId}`)
    .row()
    .text('⏰ Через час', `task:snooze:${taskId}`)
    .text('🗑 В корзину', `task:delete:${taskId}`);
}

export function priorityKeyboard(taskId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('Низкий', `task:priority:${taskId}:LOW`)
    .text('Обычный', `task:priority:${taskId}:NORMAL`)
    .row()
    .text('Высокий', `task:priority:${taskId}:HIGH`)
    .text('Срочный', `task:priority:${taskId}:URGENT`)
    .row()
    .text('Назад', `task:open:${taskId}`);
}

export function deletedTaskKeyboard(taskId: string): InlineKeyboard {
  return new InlineKeyboard().text(
    '♻️ Восстановить',
    `task:restore:${taskId}`,
  );
}
