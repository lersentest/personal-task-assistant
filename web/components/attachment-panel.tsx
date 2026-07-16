'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Attachment } from '@/lib/types';
import { FileModalLink } from './file-detail-modal';

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
  delegatedTaskId,
  title = 'Файлы',
}: {
  taskId?: string;
  projectId?: string;
  delegatedTaskId?: string;
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
      : delegatedTaskId
        ? `?delegatedTaskId=${delegatedTaskId}`
        : '';

  const attachments = useQuery({
    queryKey: ['attachments', taskId ?? null, projectId ?? null, delegatedTaskId ?? null],
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
        delegatedTaskId: delegatedTaskId ?? null,
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
    <section className="rounded-3xl border border-[var(--focus-border,var(--line))] bg-[var(--focus-surface,var(--panel))] p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-[var(--muted)]">
            PDF, документы, изображения и другие вложения до 10 МБ.
          </p>
        </div>
        {taskId || projectId || delegatedTaskId ? (
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

      <div className="mt-4">
        {attachments.data?.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="focus-table w-full text-sm">
                <thead>
                  <tr>
                    <th className="p-3">Имя</th>
                    <th className="p-3">Связь</th>
                    <th className="p-3">Тип</th>
                    <th className="p-3">Размер</th>
                    <th className="p-3">Дата</th>
                    <th className="p-3 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {attachments.data.map((attachment) => (
                    <tr key={attachment.id} className="task-row">
                      <td className="min-w-[240px] p-3">
                        <FileModalLink attachment={attachment} className="inline-flex items-center gap-2 text-left font-semibold hover:text-[var(--accent)]">
                          <FileText size={16} className="text-[var(--accent)]" />
                          {attachment.fileName}
                        </FileModalLink>
                      </td>
                      <td className="p-3 text-[var(--muted)]">
                        {attachment.task?.title ?? attachment.delegatedTask?.title ?? attachment.project?.name ?? 'Без связи'}
                      </td>
                      <td className="p-3 text-[var(--muted)]">{attachment.mimeType}</td>
                      <td className="whitespace-nowrap p-3 text-[var(--muted)]">{formatSize(attachment.sizeBytes)}</td>
                      <td className="whitespace-nowrap p-3 text-[var(--muted)]">{new Date(attachment.createdAt).toLocaleDateString('ru-RU')}</td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <FileModalLink attachment={attachment} className="btn-base btn-secondary min-h-0 px-3 py-1">Просмотр</FileModalLink>
                          <button onClick={() => downloadAttachment(attachment)} className="btn-base btn-secondary min-h-0 px-3 py-1">Скачать</button>
                          <button onClick={() => remove.mutate(attachment.id)} className="btn-base btn-danger min-h-0 px-3 py-1">Удалить</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-2 md:hidden">
              {attachments.data.map((attachment) => (
                <div key={attachment.id} className="rounded-2xl border border-[var(--focus-border-soft,var(--line))] bg-[var(--focus-surface-secondary,var(--background))] p-3 text-sm">
                  <FileModalLink attachment={attachment} className="font-semibold hover:text-[var(--accent)]">{attachment.fileName}</FileModalLink>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {formatSize(attachment.sizeBytes)} · {attachment.task?.title ?? attachment.delegatedTask?.title ?? attachment.project?.name ?? 'Без связи'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => downloadAttachment(attachment)} className="btn-base btn-secondary min-h-0 px-3 py-1">Скачать</button>
                    <button onClick={() => remove.mutate(attachment.id)} className="btn-base btn-danger min-h-0 px-3 py-1">Удалить</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
        {attachments.data?.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Файлов пока нет.</p>
        ) : null}
      </div>

      {preview ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 p-0 sm:items-center sm:p-6"
          onClick={closePreview}
        >
          <div
            className="flex h-full w-full max-w-5xl flex-col overflow-hidden border border-[var(--line)] bg-[var(--background)] shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="grid gap-3 border-b border-[var(--line)] p-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:p-4">
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{preview.attachment.fileName}</h3>
                <p className="text-sm text-[var(--muted)]">
                  {preview.attachment.mimeType} ·{' '}
                  {formatSize(preview.attachment.sizeBytes)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
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
            <div className="min-h-0 flex-1 overflow-auto bg-black/5 p-2 sm:p-3">
              {preview.type === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.url}
                  alt={preview.attachment.fileName}
                  className="mx-auto max-h-[82vh] max-w-full rounded-lg object-contain sm:max-h-[75vh]"
                />
              ) : (
                <iframe
                  src={preview.url}
                  title={preview.attachment.fileName}
                  className="h-[82vh] w-full rounded-lg bg-white sm:h-[75vh]"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
