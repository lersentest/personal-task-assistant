import { Page } from '@/components/page';

export default function SettingsPage() {
  return (
    <Page title="Настройки" description="Основные настройки приложения.">
      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5 text-sm text-[var(--muted)]">
        Светлая, тёмная и системная темы поддерживаются на уровне интерфейса. Push-уведомления пока не включены: Telegram остаётся каналом напоминаний.
      </div>
    </Page>
  );
}

