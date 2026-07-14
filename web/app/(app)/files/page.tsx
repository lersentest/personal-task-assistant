'use client';

import { AttachmentPanel } from '@/components/attachment-panel';
import { Page } from '@/components/page';

export default function FilesPage() {
  return (
    <Page title="Файлы" description="Все вложения, прикреплённые к задачам и проектам.">
      <AttachmentPanel title="Все файлы" />
    </Page>
  );
}
