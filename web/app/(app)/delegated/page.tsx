'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { EmptyState, Page } from '@/components/page';
import { api } from '@/lib/api';
import { DelegatedTask, DelegatedTaskStatus, TaskPriority } from '@/lib/types';

const statusLabel: Record<DelegatedTaskStatus, string> = {
  DRAFT: 'Черновик',
  SENT: 'Отправлена',
  ACCEPTED: 'Принята',
  IN_PROGRESS: 'В работе',
  QUESTION: 'Вопрос',
  WAITING_REVIEW: 'На проверке',
  RETURNED: 'Возвращена',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
};

const emptyForm = {
  title: '',
  description: '',
  executorId: '',
  projectId: '',
  priority: 'NORMAL' as TaskPriority,
  dueAt: '',
};

export default function DelegatedPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ status: '', executorId: '' });
  const [form, setForm] = useState(emptyForm);
  const [reviewMessage, setReviewMessage] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const executors = useQuery({ queryKey: ['executors'], queryFn: api.executors });
  const projects = useQuery({ queryKey: ['projects'], queryFn: api.projects });
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.executorId) params.set('executorId', filters.executorId);
    return params.toString() ? `?${params.toString()}` : '';
  }, [filters]);
  const tasks = useQuery({ queryKey: ['delegated-tasks', query], queryFn: () => api.delegatedTasks(query) });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['delegated-tasks'] });
  };

  const create = useMutation({
    mutationFn: api.createDelegatedTask,
    onMutate: () => setMessage(null),
    onSuccess: async () => {
      setForm(emptyForm);
      setMessage('Делегированная задача создана.');
      await refresh();
    },
  });
  const send = useMutation({
    mutationFn: api.sendDelegatedTask,
    onSuccess: async () => {
      setMessage('Задача отправлена исполнителю.');
      await refresh();
    },
  });
  const remind = useMutation({
    mutationFn: api.remindDelegatedTask,
    onSuccess: async () => {
      setMessage('Напоминание отправлено.');
      await refresh();
    },
  });
  const cancel = useMutation({
    mutationFn: api.cancelDelegatedTask,
    onSuccess: async () => {
      setMessage('Задача отменена.');
      await refresh();
    },
  });
  const accept = useMutation({
    mutationFn: (id: string) => api.acceptDelegatedTask(id, reviewMessage || undefined),
    onSuccess: async () => {
      setMessage('Результат принят.');
      await refresh();
    },
  });
  const returnTask = useMutation({
    mutationFn: (id: string) => api.returnDelegatedTask(id, reviewMessage || 'Нужно доработать.'),
    onSuccess: async () => {
      setMessage('Задача возвращена в работу.');
      await refresh();
    },
  });

  const actionError =
    create.error || send.error || remind.error || cancel.error || accept.error || returnTask.error;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || !form.executorId || create.isPending) return;
    create.mutate({
      title: form.title.trim(),
      description: form.description.trim() || null,
      executorId: form.executorId,
      projectId: form.projectId || null,
      priority: form.priority,
      dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
    });
  }

  return (
    <Page
      title="Делегированные"
      description="Отдельные задачи для исполнителей. Они не смешиваются с личными задачами и Моим днём."
    >
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form onSubmit={submit} className="grid content-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">Новая делегированная задача</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Выбери исполнителя и опиши результат, который нужно получить.
            </p>
          </div>
          <input className="rounded-xl border border-[var(--line)] bg-transparent px-3 py-2" placeholder="Название *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea className="min-h-28 rounded-xl border border-[var(--line)] bg-transparent px-3 py-2" placeholder="Описание" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className="rounded-xl border border-[var(--line)] bg-transparent px-3 py-2" value={form.executorId} onChange={(e) => setForm({ ...form, executorId: e.target.value })}>
            <option value="">Выберите исполнителя</option>
            {executors.data?.map((executor) => <option key={executor.id} value={executor.id}>{executor.fullName}</option>)}
          </select>
          <select className="rounded-xl border border-[var(--line)] bg-transparent px-3 py-2" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
            <option value="">Без проекта</option>
            {projects.data?.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <select className="rounded-xl border border-[var(--line)] bg-transparent px-3 py-2" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}>
            <option value="LOW">Низкий</option>
            <option value="NORMAL">Обычный</option>
            <option value="HIGH">Высокий</option>
            <option value="URGENT">Срочный</option>
          </select>
          <input type="datetime-local" className="rounded-xl border border-[var(--line)] bg-transparent px-3 py-2" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
          <button disabled={create.isPending || !form.executorId || !form.title.trim()} className="btn-base btn-primary">
            {create.isPending ? 'Создаю...' : 'Создать задачу'}
          </button>
          {message ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
          {actionError ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError.message}</p> : null}
        </form>

        <section className="grid content-start gap-4">
          <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3 shadow-sm">
            <select className="rounded-xl border border-[var(--line)] bg-transparent px-3 py-2 text-sm" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">Все статусы</option>
              {Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select className="rounded-xl border border-[var(--line)] bg-transparent px-3 py-2 text-sm" value={filters.executorId} onChange={(e) => setFilters({ ...filters, executorId: e.target.value })}>
              <option value="">Все исполнители</option>
              {executors.data?.map((executor) => <option key={executor.id} value={executor.id}>{executor.fullName}</option>)}
            </select>
          </div>
          <input className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2" placeholder="Комментарий для проверки/возврата" value={reviewMessage} onChange={(e) => setReviewMessage(e.target.value)} />

          {tasks.isLoading ? <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 text-sm text-[var(--muted)]">Загружаю делегированные задачи...</div> : null}
          {tasks.error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">Не удалось загрузить задачи: {tasks.error.message}</div> : null}
          {tasks.data?.length ? tasks.data.map((task) => (
            <DelegatedTaskCard
              key={task.id}
              task={task}
              busyAction={{
                send: send.isPending,
                remind: remind.isPending,
                cancel: cancel.isPending,
                accept: accept.isPending,
                return: returnTask.isPending,
              }}
              onSend={() => send.mutate(task.id)}
              onRemind={() => remind.mutate(task.id)}
              onCancel={() => cancel.mutate(task.id)}
              onAccept={() => accept.mutate(task.id)}
              onReturn={() => returnTask.mutate(task.id)}
            />
          )) : null}
          {!tasks.isLoading && !tasks.error && !tasks.data?.length ? <EmptyState text="Делегированных задач пока нет." /> : null}
        </section>
      </div>
    </Page>
  );
}

function DelegatedTaskCard({
  task,
  busyAction,
  onSend,
  onRemind,
  onCancel,
  onAccept,
  onReturn,
}: {
  task: DelegatedTask;
  busyAction: { send: boolean; remind: boolean; cancel: boolean; accept: boolean; return: boolean };
  onSend: () => void;
  onRemind: () => void;
  onCancel: () => void;
  onAccept: () => void;
  onReturn: () => void;
}) {
  const isClosed = ['COMPLETED', 'CANCELLED'].includes(task.status);

  return (
    <article className="interactive-card rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[var(--accent)]">{statusLabel[task.status]}</span>
            <span className="rounded-full bg-[var(--background)] px-2 py-1">{task.priority}</span>
            <span className="rounded-full bg-[var(--background)] px-2 py-1">{task.executor.fullName}</span>
          </div>
          <h2 className="text-lg font-semibold">{task.title}</h2>
          {task.description ? <p className="mt-2 text-sm text-[var(--muted)]">{task.description}</p> : null}
          <p className="mt-2 text-xs text-[var(--muted)]">
            {task.project ? `Проект: ${task.project.name}` : 'Без проекта'}
            {task.dueAt ? ` · Срок: ${new Date(task.dueAt).toLocaleString('ru-RU')}` : ''}
          </p>
          {task.comments?.length ? (
            <div className="mt-3 rounded-xl bg-[var(--background)] p-3 text-sm">
              <p className="mb-2 font-medium">Комментарии</p>
              {task.comments.slice(-3).map((comment) => (
                <p key={comment.id} className="text-[var(--muted)]">
                  {comment.author}: {comment.message}
                </p>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex min-w-[220px] flex-wrap gap-2 lg:justify-end">
          {task.status === 'DRAFT' ? (
            <button disabled={busyAction.send} onClick={onSend} className="btn-base btn-primary">
              {busyAction.send ? 'Отправляю...' : 'Отправить'}
            </button>
          ) : null}
          {task.status === 'WAITING_REVIEW' ? (
            <>
              <button disabled={busyAction.accept} onClick={onAccept} className="btn-base btn-success">
                {busyAction.accept ? 'Принимаю...' : 'Принять'}
              </button>
              <button disabled={busyAction.return} onClick={onReturn} className="btn-base btn-warning">
                {busyAction.return ? 'Возвращаю...' : 'Вернуть'}
              </button>
            </>
          ) : null}
          {!isClosed ? (
            <button disabled={busyAction.remind} onClick={onRemind} className="btn-base btn-secondary">
              {busyAction.remind ? 'Отправляю...' : 'Напомнить'}
            </button>
          ) : null}
          {!isClosed ? (
            <button disabled={busyAction.cancel} onClick={onCancel} className="btn-base btn-danger">
              {busyAction.cancel ? 'Отменяю...' : 'Отменить'}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
