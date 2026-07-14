import { EmptyState, Page } from '@/components/page';

export default function FilesPage() {
  return (
    <Page title="Файлы" description="Раздел подготовлен для Supabase Storage.">
      <EmptyState text="Файлы будут добавлены после безопасной metadata-модели и API загрузки." />
    </Page>
  );
}

