'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Attachment } from '@/lib/types';

interface PreviewState {
  attachment: Attachment;
  url: string;
  type: 'image' | 'pdf';
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const value = String(reader.result ?? '');
      resolve(value.includes(',') ? value.split(',')[1] : value);
    };
    reader.readAsDataURL(file);
  });
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function previewType(mimeType: string): PreviewState['type'] | null {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  return null;
}

export function AttachmentPanel({
  taskId,
  projectId,
  title = 'Файлы',
}: {
  taskId?: string;
  projectId?: string;
  title?: string;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const query = taskId
    ? `?taskId=${taskId}`
    : projectId
      ? `?projectId=${projectId}`
      : '';

  const attachments = useQuery({
    queryKey: ['attachments', taskId ?? null, projectId ?? null],
    queryFn: () => api.attachments(query),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Файл слишком большой. Максимум 10 МБ.');
      }
      return api.createAttachment({
        taskId: taskId ?? null,
        projectId: projectId ?? null,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataBase64: await fileToBase64(file),
      });
    },
    onSuccess: () => {
      setError(null);
      if (inputRef.current) inputRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ['attachments'] });
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : 'Ошибка загрузки'),
  });

  const remove = useMutation({
    mutationFn: api.deleteAttachment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attachments'] }),
  });

  useEffect(() => {
    if (!preview) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePreview();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  function closePreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  async function downloadAttachment(attachment: Attachment) {
    const blob = await api.downloadAttachment(attachment.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function openPreview(attachment: Attachment) {
    const type = previewType(attachment.mimeType);
    if (!type) {
      setError('Предпросмотр для этого типа файла недоступен.');
      return;
    }
    const blob = await api.downloadAttachment(attachment.id);
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview({
      attachment,
      type,
      url: URL.createObjectURL(blob),
    });
    setError(null);
  }

  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-[var(--muted)]">
            PDF, документы, изображения и другие вложения до 10 МБ.
          </p>
        </div>
        {taskId || projectId ? (
          <label className="btn-base btn-primary cursor-pointer">
            Загрузить
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload.mutate(file);
              }}
            />
          </label>
        ) : null}
      </div>

      {upload.isPending ? (
        <p className="mt-3 text-sm text-[var(--muted)]">Загружаю файл…</p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}

      <div className="mt-4 grid gap-2">
        {(attachments.data ?? []).map((attachment) => {
          const canPreview = Boolean(previewType(attachment.mimeType));
          return (
            <div
              key={attachment.id}
              className="interactive-card flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--background)] p-3 text-sm"
            >
              <div>
                <p className="font-medium">{attachment.fileName}</p>
                <p className="text-[var(--muted)]">
                  {formatSize(attachment.sizeBytes)}
                  {attachment.project ? ` · ${attachment.project.name}` : ''}
                  {attachment.task ? ` · ${attachment.task.title}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={!canPreview}
                  onClick={() => openPreview(attachment)}
                  className="btn-base btn-secondary min-h-0 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-45"
                  title={
                    canPreview
                      ? 'Открыть предпросмотр'
                      : 'Предпросмотр доступен только для изображений и PDF'
                  }
                >
                  Просмотр
                </button>
                <button
                  onClick={() => downloadAttachment(attachment)}
                  className="btn-base btn-secondary min-h-0 px-3 py-1"
                >
                  Скачать
                </button>
                <button
                  onClick={() => remove.mutate(attachment.id)}
                  className="btn-base btn-danger min-h-0 px-3 py-1"
                >
                  Удалить
                </button>
              </div>
            </div>
          );
        })}
        {attachments.data?.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Файлов пока нет.</p>
        ) : null}
      </div>

      {preview ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6"
          onClick={closePreview}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--background)] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] p-4">
              <div>
                <h3 className="font-semibold">{preview.attachment.fileName}</h3>
                <p className="text-sm text-[var(--muted)]">
                  {preview.attachment.mimeType} ·{' '}
                  {formatSize(preview.attachment.sizeBytes)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadAttachment(preview.attachment)}
                  className="btn-base btn-secondary"
                >
                  Скачать
                </button>
                <button
                  onClick={closePreview}
                  className="btn-base btn-primary"
                >
                  Закрыть
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-black/5 p-3">
              {preview.type === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.url}
                  alt={preview.attachment.fileName}
                  className="mx-auto max-h-[75vh] max-w-full rounded-lg object-contain"
                />
              ) : (
                <iframe
                  src={preview.url}
                  title={preview.attachment.fileName}
                  className="h-[75vh] w-full rounded-lg bg-white"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
