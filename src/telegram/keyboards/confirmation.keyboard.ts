import { InlineKeyboard } from 'grammy';

export function confirmationKeyboard(draftId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('Подтвердить', `draft:confirm:${draftId}`)
    .text('Отменить', `draft:cancel:${draftId}`);
}
