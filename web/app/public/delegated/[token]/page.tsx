'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock3, Download, FileUp, MessageSquare, Play, Send, UploadCloud } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Attachment } from '@/lib/types';

const statusLabel: Record<string, string> = {
  DRAFT: 'Черновик',
  SENT: 'Ожидает исполнителя',
  ACCEPTED: 'В работе',
  IN_PROGRESS: 'В работе',
  QUESTION: 'Есть вопрос',
  WAITING_REVIEW: 'На проверке',
  RETURNED: 'В работе',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
};

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

export default function PublicDelegatedTaskPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const task = useQuery({
    queryKey: ['public-delegated-task', token],
    queryFn: () => api.publicDelegatedTask(token),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['public-delegated-task', token] });
  };

  const action = useMutation({
    mutationFn: (input: { action: 'accept' | 'start' | 'question' | 'done'; message?: string | null }) =>
      api.publicDelegatedTaskAction(token, input),
    onSuccess: async () => {
      setNotice('Готово, статус обновлён.');
      setResultMessage('');
      await refresh();
    },
  });

  const comment = useMutation({
    mutationFn: (text: string) => api.publicDelegatedTaskComment(token, text),
    onSuccess: async () => {
      setNotice('Комментарий отправлен.');
      setMessage('');
      await refresh();
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Файл слишком большой. Максимум 10 МБ.');
      }
      return api.publicDelegatedTaskAttachment(token, {
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataBase64: await fileToBase64(file),
      });
    },
    onSuccess: async () => {
      setNotice('Файл загружен.');
      if (fileRef.current) fileRef.current.value = '';
      await refresh();
    },
  });

  async function download(attachment: Attachment) {
    const blob = await api.publicDelegatedTaskDownloadAttachment(token, attachment.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  const data = task.data;
  const isClosed = data ? ['COMPLETED', 'CANCELLED'].includes(data.status) : false;

  return (
    <main className="min-h-screen bg-[var(--background)] px-3 py-4 text-[var(--foreground)] sm:px-4 sm:py-6">
      <div className="mx-auto grid max-w-3xl gap-4">
        <header className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">Personal Tasks</p>
          <h1 className="mt-2 text-2xl font-semibold">Задача исполнителя</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Здесь можно посмотреть детали, оставить комментарий, загрузить файлы и обновить статус.</p>
        </header>

        {task.isLoading ? (
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--muted)]">
            Загружаю задачу...
          </section>
        ) : null}

        {task.error ? (
          <section className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
            Ссылка недоступна или задача закрыта.
          </section>
        ) : null}

        {data ? (
          <>
            <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm sm:p-5">
              <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-start sm:justify-between">
                <div>
                  <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-sm font-medium text-[var(--accent)]">
                    {statusLabel[data.status] ?? data.status}
                  </span>
                  <h2 className="mt-4 text-2xl font-semibold">{data.title}</h2>
                </div>
                <span className="rounded-full bg-[var(--background)] px-3 py-1 text-sm">{data.priority}</span>
              </div>
              {data.description ? <p className="mt-4 whitespace-pre-wrap leading-7">{data.description}</p> : null}
              <div className="mt-5 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2">
                <p>Проект: {data.project?.name ?? 'Без проекта'}</p>
                <p>Срок: {data.dueAt ? new Date(data.dueAt).toLocaleString('ru-RU') : 'Не указан'}</p>
                <p>Исполнитель: {data.executor.fullName}</p>
                <p>Создана: {new Date(data.createdAt).toLocaleDateString('ru-RU')}</p>
              </div>
            </section>

            {!isClosed ? (
              <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm sm:p-5">
                <h3 className="font-semibold">Действия</h3>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {['SENT', 'RETURNED'].includes(data.status) ? (
                    <button className="btn-base btn-secondary w-full" disabled={action.isPending} onClick={() => action.mutate({ action: 'accept' })}>
                      <CheckCircle2 size={17} /> Принять
                    </button>
                  ) : null}
                  {['SENT', 'ACCEPTED', 'RETURNED'].includes(data.status) ? (
                    <button className="btn-base btn-secondary w-full" disabled={action.isPending} onClick={() => action.mutate({ action: 'start' })}>
                      <Play size={17} /> Начать
                    </button>
                  ) : null}
                  <button className="btn-base btn-warning w-full" disabled={action.isPending} onClick={() => action.mutate({ action: 'question', message: resultMessage || null })}>
                    <MessageSquare size={17} /> Задать вопрос
                  </button>
                  <button className="btn-base btn-success w-full" disabled={action.isPending} onClick={() => action.mutate({ action: 'done', message: resultMessage || null })}>
                    <CheckCircle2 size={17} /> Выполнено
                  </button>
                </div>
                <textarea
                  className="mt-4 min-h-24 w-full rounded-2xl border border-[var(--line)] bg-transparent p-3"
                  placeholder="Комментарий к действию или результат работы"
                  value={resultMessage}
                  onChange={(event) => setResultMessage(event.target.value)}
                />
              </section>
            ) : null}

            <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm sm:p-5">
              <h3 className="font-semibold">Комментарии</h3>
              <div className="mt-4 grid gap-3">
                {data.comments?.length ? data.comments.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-[var(--background)] p-3">
                    <p className="text-xs text-[var(--muted)]">{item.author} · {new Date(item.createdAt).toLocaleString('ru-RU')}</p>
                    <p className="mt-1 whitespace-pre-wrap">{item.message}</p>
                  </div>
                )) : <p className="text-sm text-[var(--muted)]">Комментариев пока нет.</p>}
              </div>
              <div className="mt-4 grid gap-2">
                <textarea
                  className="min-h-24 rounded-2xl border border-[var(--line)] bg-transparent p-3"
                  placeholder="Напишите комментарий владельцу задачи"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
                <button className="btn-base btn-primary w-full" disabled={comment.isPending || !message.trim()} onClick={() => comment.mutate(message)}>
                  <Send size={17} /> Отправить комментарий
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm sm:p-5">
              <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold">Файлы</h3>
                  <p className="text-sm text-[var(--muted)]">Можно приложить PDF, изображения и другие файлы до 10 МБ.</p>
                </div>
                <label className="btn-base btn-primary w-full cursor-pointer sm:w-auto">
                  <UploadCloud size={17} /> Загрузить
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) upload.mutate(file);
                    }}
                  />
                </label>
              </div>
              {upload.isPending ? <p className="mt-3 text-sm text-[var(--muted)]">Загружаю файл...</p> : null}
              <div className="mt-4 grid gap-2">
                {data.attachments?.length ? data.attachments.map((attachment) => (
                  <div key={attachment.id} className="interactive-card grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--background)] p-3 sm:flex sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <FileUp size={18} className="text-[var(--accent)]" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{attachment.fileName}</p>
                        <p className="text-sm text-[var(--muted)]">{formatSize(attachment.sizeBytes)}</p>
                      </div>
                    </div>
                    <button className="btn-base btn-secondary w-full sm:w-auto" onClick={() => download(attachment)}>
                      <Download size={16} /> Скачать
                    </button>
                  </div>
                )) : <p className="text-sm text-[var(--muted)]">Файлов пока нет.</p>}
              </div>
            </section>

            {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div> : null}
            {(action.error || comment.error || upload.error) ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {(action.error || comment.error || upload.error)?.message}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}

