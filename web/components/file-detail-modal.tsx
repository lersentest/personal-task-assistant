'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Eye, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Attachment } from '@/lib/types';
import { EntityDrawer } from './ui-kit';

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function previewType(mimeType: string): 'image' | 'pdf' | null {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  return null;
}

export function FileModalLink({
  attachment,
  children,
  className,
}: {
  attachment: Attachment;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <FileDetailsModal
        attachment={attachment}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export function FileDetailsModal({
  attachment,
  open,
  onClose,
}: {
  attachment: Attachment;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const type = previewType(attachment.mimeType);

  const remove = useMutation({
    mutationFn: () => api.deleteAttachment(attachment.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['attachments'] });
      await queryClient.invalidateQueries({ queryKey: ['global-search'] });
      onClose();
    },
  });

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open || !type) return;
    let cancelled = false;
    api
      .downloadAttachment(attachment.id)
      .then((blob) => {
        if (cancelled) return;
        setObjectUrl(URL.createObjectURL(blob));
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось открыть файл'));
    return () => {
      cancelled = true;
    };
  }, [attachment.id, open, type]);

  useEffect(() => {
    if (!objectUrl) return;
    return () => URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  if (!open) return null;

  async function downloadAttachment() {
    const blob = await api.downloadAttachment(attachment.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <EntityDrawer
      open={open}
      onClose={onClose}
      width="max-w-5xl"
      eyebrow={
        <>
              <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 font-medium text-[var(--accent)]">
                Файл
              </span>
              <span>{attachment.mimeType}</span>
              <span>{formatSize(attachment.sizeBytes)}</span>
        </>
      }
      title={attachment.fileName}
      subtitle={attachment.task?.title ?? attachment.delegatedTask?.title ?? attachment.project?.name ?? 'Без связи'}
      actions={
        <>
            <button onClick={downloadAttachment} className="btn-base btn-secondary">
              <Download size={16} />
              Скачать
            </button>
            <button onClick={() => remove.mutate()} className="btn-base btn-danger" disabled={remove.isPending}>
              <Trash2 size={16} />
              Удалить
            </button>
        </>
      }
    >
        <div className="-m-4 min-h-[calc(100vh-160px)] overflow-auto bg-black/5 p-3 sm:-m-6">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
          ) : null}
          {!type ? (
            <div className="grid min-h-[340px] place-items-center rounded-2xl border border-dashed border-[var(--line)] bg-[var(--panel)] p-8 text-center text-[var(--muted)]">
              <div>
                <Eye className="mx-auto mb-3" />
                <p className="font-medium">Предпросмотр недоступен</p>
                <p className="mt-1 text-sm">Для этого типа файла доступно скачивание.</p>
              </div>
            </div>
          ) : !objectUrl ? (
            <p className="p-6 text-sm text-[var(--muted)]">Открываю предпросмотр...</p>
          ) : type === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={objectUrl}
              alt={attachment.fileName}
              className="mx-auto max-h-[78vh] max-w-full rounded-2xl object-contain"
            />
          ) : (
            <iframe
              src={objectUrl}
              title={attachment.fileName}
              className="h-[78vh] w-full rounded-2xl bg-white"
            />
          )}
        </div>
    </EntityDrawer>
  );
}
