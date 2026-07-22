'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Link as LinkIcon, MessageSquare, Send, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate, priorityLabel } from '@/lib/labels';
import { DelegatedTask, DelegatedTaskStatus } from '@/lib/types';
import { AttachmentPanel } from './attachment-panel';
import { EntityDrawer } from './ui-kit';

const delegatedStatusLabel: Record<DelegatedTaskStatus, string> = {
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

export function DelegatedTaskModalLink({
  task,
  taskId,
  children,
  className,
  title,
}: {
  task?: DelegatedTask;
  taskId?: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = task?.id ?? taskId;

  if (!id) return <>{children}</>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        title={title ?? 'Открыть делегированную задачу'}
      >
        {children}
      </button>
      <DelegatedTaskDetailsModal
        taskId={id}
        initialTask={task}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export function DelegatedTaskDetailsModal({
  taskId,
  initialTask,
  open,
  onClose,
}: {
  taskId: string;
  initialTask?: DelegatedTask;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const task = useQuery({
    queryKey: ['delegated-task', taskId],
    queryFn: () => api.delegatedTask(taskId),
    enabled: open,
    initialData: initialTask,
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['delegated-task', taskId] }),
      queryClient.invalidateQueries({ queryKey: ['delegated-tasks'] }),
      queryClient.invalidateQueries({ queryKey: ['global-search'] }),
    ]);
  };

  const send = useMutation({
    mutationFn: () => api.sendDelegatedTask(taskId),
    onSuccess: async () => {
      setMessage('Задача отправлена исполнителю.');
      await invalidate();
    },
  });
  const remind = useMutation({
    mutationFn: () => api.remindDelegatedTask(taskId),
    onSuccess: async () => {
      setMessage('Напоминание отправлено.');
      await invalidate();
    },
  });
  const cancel = useMutation({
    mutationFn: () => api.cancelDelegatedTask(taskId),
    onSuccess: async () => {
      setMessage('Задача отменена.');
      await invalidate();
    },
  });
  const accept = useMutation({
    mutationFn: () => api.acceptDelegatedTask(taskId, reviewText || undefined),
    onSuccess: async () => {
      setMessage('Результат принят.');
      setReviewText('');
      await invalidate();
    },
  });
  const returnTask = useMutation({
    mutationFn: () => api.returnDelegatedTask(taskId, reviewText || 'Нужно доработать.'),
    onSuccess: async () => {
      setMessage('Задача возвращена в работу.');
      setReviewText('');
      await invalidate();
    },
  });
  const comment = useMutation({
    mutationFn: () => api.commentDelegatedTask(taskId, commentText.trim()),
    onSuccess: async () => {
      setMessage('Комментарий добавлен.');
      setCommentText('');
      await invalidate();
    },
  });
  const copyLink = useMutation({
    mutationFn: () => api.delegatedTaskPublicLink(taskId),
    onSuccess: async (link) => {
      await navigator.clipboard?.writeText(link.url);
      setMessage('Новая ссылка исполнителя скопирована.');
      await invalidate();
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
    if (!open) {
      setCommentText('');
      setReviewText('');
      setMessage(null);
    }
  }, [open]);

  if (!open) return null;

  const data = task.data;
  const isClosed = data ? ['COMPLETED', 'CANCELLED'].includes(data.status) : false;
  const actionError =
    send.error || remind.error || cancel.error || accept.error || returnTask.error || comment.error || copyLink.error;

  return (
    <EntityDrawer
      open={open}
      onClose={onClose}
      width="max-w-6xl"
      eyebrow={
        <>
              <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 font-medium text-[var(--accent)]">
                Делегированная
              </span>
              {data ? <span>{delegatedStatusLabel[data.status]}</span> : null}
              {data?.executor ? <span>{data.executor.fullName}</span> : null}
        </>
      }
      title={data?.title ?? 'Загружаю делегированную задачу...'}
      subtitle="Работа с исполнителем, комментариями, файлами и публичной ссылкой."
      actions={
            <Link href="/delegated" className="btn-base btn-secondary" onClick={onClose}>
              <ExternalLink size={16} />
              Раздел
            </Link>
      }
    >
          {task.error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Не удалось загрузить задачу: {task.error.message}
            </div>
          ) : null}

          {data ? (
            <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
              <div className="grid content-start gap-5">
                <section className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-5">
                  <p className="whitespace-pre-wrap text-[var(--muted)]">
                    {data.description ?? 'Описание не указано.'}
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-[var(--panel)] p-3">
                      <p className="text-xs text-[var(--muted)]">Статус</p>
                      <p className="mt-1 font-medium">{delegatedStatusLabel[data.status]}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--panel)] p-3">
                      <p className="text-xs text-[var(--muted)]">Приоритет</p>
                      <p className="mt-1 font-medium">{priorityLabel[data.priority]}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--panel)] p-3">
                      <p className="text-xs text-[var(--muted)]">Срок</p>
                      <p className="mt-1 font-medium">{formatDate(data.dueAt)}</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <MessageSquare size={18} />
                    <h3 className="font-semibold">Комментарии</h3>
                  </div>
                  <div className="grid max-h-80 gap-2 overflow-auto">
                    {data.comments?.length ? (
                      data.comments.map((item) => (
                        <div key={item.id} className="rounded-xl bg-[var(--panel)] p-3 text-sm">
                          <p className="text-xs text-[var(--muted)]">
                            {item.author} · {new Date(item.createdAt).toLocaleString('ru-RU')}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap">{item.message}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--muted)]">Комментариев пока нет.</p>
                    )}
                  </div>
                  {!isClosed ? (
                    <div className="mt-4 grid gap-2">
                      <textarea
                        className="min-h-24 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 text-sm outline-none focus:border-[var(--accent)]"
                        placeholder="Комментарий исполнителю"
                        value={commentText}
                        onChange={(event) => setCommentText(event.target.value)}
                      />
                      <button
                        type="button"
                        disabled={!commentText.trim() || comment.isPending}
                        onClick={() => comment.mutate()}
                        className="btn-base btn-primary justify-self-start"
                      >
                        <Send size={16} />
                        {comment.isPending ? 'Отправляю...' : 'Добавить комментарий'}
                      </button>
                    </div>
                  ) : null}
                </section>
              </div>

              <aside className="grid content-start gap-5">
                <section className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-5">
                  <h3 className="font-semibold">Действия</h3>
                  <div className="mt-4 grid gap-2">
                    <button
                      type="button"
                      className="btn-base btn-secondary w-full justify-center"
                      disabled={copyLink.isPending}
                      onClick={() => copyLink.mutate()}
                    >
                      <LinkIcon size={16} />
                      {copyLink.isPending ? 'Генерирую...' : 'Скопировать ссылку'}
                    </button>
                    {data.status === 'DRAFT' ? (
                      <button disabled={send.isPending} onClick={() => send.mutate()} className="btn-base btn-primary w-full justify-center">
                        {send.isPending ? 'Отправляю...' : 'Отправить'}
                      </button>
                    ) : null}
                    {data.status === 'WAITING_REVIEW' ? (
                      <>
                        <textarea
                          className="min-h-20 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 text-sm outline-none focus:border-[var(--accent)]"
                          placeholder="Комментарий к проверке/возврату"
                          value={reviewText}
                          onChange={(event) => setReviewText(event.target.value)}
                        />
                        <button disabled={accept.isPending} onClick={() => accept.mutate()} className="btn-base btn-success w-full justify-center">
                          {accept.isPending ? 'Принимаю...' : 'Принять результат'}
                        </button>
                        <button disabled={returnTask.isPending} onClick={() => returnTask.mutate()} className="btn-base btn-warning w-full justify-center">
                          {returnTask.isPending ? 'Возвращаю...' : 'Вернуть в работу'}
                        </button>
                      </>
                    ) : null}
                    {!isClosed ? (
                      <button disabled={remind.isPending} onClick={() => remind.mutate()} className="btn-base btn-secondary w-full justify-center">
                        {remind.isPending ? 'Отправляю...' : 'Напомнить'}
                      </button>
                    ) : null}
                    {!isClosed ? (
                      <button disabled={cancel.isPending} onClick={() => cancel.mutate()} className="btn-base btn-danger w-full justify-center">
                        {cancel.isPending ? 'Отменяю...' : 'Отменить'}
                      </button>
                    ) : null}
                  </div>
                  {message ? (
                    <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      {message}
                    </p>
                  ) : null}
                  {actionError ? (
                    <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {actionError.message}
                    </p>
                  ) : null}
                </section>

                <AttachmentPanel delegatedTaskId={taskId} title="Файлы делегированной задачи" />
              </aside>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">Загружаю задачу...</p>
          )}
    </EntityDrawer>
  );
}
