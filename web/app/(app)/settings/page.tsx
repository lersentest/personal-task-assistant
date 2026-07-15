import { InterfaceSettings } from '@/components/interface-settings';
import { Page } from '@/components/page';

export default function SettingsPage() {
  return (
    <Page title="Настройки" description="Основные настройки приложения.">
      <InterfaceSettings />
    </Page>
  );
}
