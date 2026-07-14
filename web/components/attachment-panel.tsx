'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Attachment } from '@/lib/types';

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
    onError: (err) => setError(err instanceof Error ? err.message : 'Ошибка загрузки'),
  });
  const remove = useMutation({
    mutationFn: api.deleteAttachment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attachments'] }),
  });

  async function downloadAttachment(attachment: Attachment) {
    const blob = await api.downloadAttachment(attachment.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-[var(--muted)]">PDF, документы, изображения и другие вложения до 10 МБ.</p>
        </div>
        {taskId || projectId ? (
          <label className="cursor-pointer rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm text-[var(--background)]">
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
      {upload.isPending ? <p className="mt-3 text-sm text-[var(--muted)]">Загружаю файл…</p> : null}
      {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
      <div className="mt-4 grid gap-2">
        {(attachments.data ?? []).map((attachment) => (
          <div key={attachment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--background)] p-3 text-sm">
            <div>
              <p className="font-medium">{attachment.fileName}</p>
              <p className="text-[var(--muted)]">
                {formatSize(attachment.sizeBytes)}
                {attachment.project ? ` · ${attachment.project.name}` : ''}
                {attachment.task ? ` · ${attachment.task.title}` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => downloadAttachment(attachment)} className="rounded-md border border-[var(--line)] px-3 py-1">Скачать</button>
              <button onClick={() => remove.mutate(attachment.id)} className="rounded-md border border-[var(--line)] px-3 py-1">Удалить</button>
            </div>
          </div>
        ))}
        {attachments.data?.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Файлов пока нет.</p>
        ) : null}
      </div>
    </section>
  );
}
