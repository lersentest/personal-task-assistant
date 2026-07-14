import { Keyboard } from 'grammy';

export const MENU_KEYBOARD = new Keyboard()
  .text('Сегодня')
  .text('Просроченные')
  .row()
  .text('Ближайшие')
  .text('Все задачи')
  .row()
  .text('Проекты')
  .text('Теги')
  .row()
  .text('Новая задача')
  .text('Новый проект')
  .row()
  .text('Поиск')
  .text('Отмена')
  .resized()
  .persistent();
