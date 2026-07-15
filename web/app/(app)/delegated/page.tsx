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

export default function DelegatedPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ status: '', executorId: '' });
  const [form, setForm] = useState({ title: '', description: '', executorId: '', projectId: '', priority: 'NORMAL' as TaskPriority, dueAt: '' });
  const [reviewMessage, setReviewMessage] = useState('');
  const executors = useQuery({ queryKey: ['executors'], queryFn: api.executors });
  const projects = useQuery({ queryKey: ['projects'], queryFn: api.projects });
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.executorId) params.set('executorId', filters.executorId);
    return params.toString() ? `?${params.toString()}` : '';
  }, [filters]);
  const tasks = useQuery({ queryKey: ['delegated-tasks', query], queryFn: () => api.delegatedTasks(query) });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['delegated-tasks'] });
  const create = useMutation({
    mutationFn: api.createDelegatedTask,
    onSuccess: () => {
      setForm({ title: '', description: '', executorId: '', projectId: '', priority: 'NORMAL', dueAt: '' });
      refresh();
    },
  });
  const send = useMutation({ mutationFn: api.sendDelegatedTask, onSuccess: refresh });
  const remind = useMutation({ mutationFn: api.remindDelegatedTask, onSuccess: refresh });
  const cancel = useMutation({ mutationFn: api.cancelDelegatedTask, onSuccess: refresh });
  const accept = useMutation({ mutationFn: (id: string) => api.acceptDelegatedTask(id, reviewMessage || undefined), onSuccess: refresh });
  const returnTask = useMutation({ mutationFn: (id: string) => api.returnDelegatedTask(id, reviewMessage || 'Нужно доработать.'), onSuccess: refresh });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    create.mutate({
      title: form.title,
      description: form.description || null,
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
          <h2 className="text-lg font-semibold">Новая делегированная задача</h2>
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
          <button disabled={create.isPending || !form.executorId} className="rounded-xl bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] disabled:opacity-50">
            Создать
          </button>
          {create.error ? <p className="text-sm text-red-600">{create.error.message}</p> : null}
        </form>

        <section className="grid content-start gap-4">
          <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
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
          {tasks.data?.length ? tasks.data.map((task) => (
            <DelegatedTaskCard
              key={task.id}
              task={task}
              onSend={() => send.mutate(task.id)}
              onRemind={() => remind.mutate(task.id)}
              onCancel={() => cancel.mutate(task.id)}
              onAccept={() => accept.mutate(task.id)}
              onReturn={() => returnTask.mutate(task.id)}
            />
          )) : <EmptyState text="Делегированных задач пока нет." />}
        </section>
      </div>
    </Page>
  );
}

function DelegatedTaskCard({
  task,
  onSend,
  onRemind,
  onCancel,
  onAccept,
  onReturn,
}: {
  task: DelegatedTask;
  onSend: () => void;
  onRemind: () => void;
  onCancel: () => void;
  onAccept: () => void;
  onReturn: () => void;
}) {
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
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
          {task.status === 'DRAFT' ? <button onClick={onSend} className="rounded-xl bg-blue-600 px-3 py-2 text-sm text-white">Отправить</button> : null}
          {task.status === 'WAITING_REVIEW' ? (
            <>
              <button onClick={onAccept} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm text-white">Принять</button>
              <button onClick={onReturn} className="rounded-xl border border-orange-200 px-3 py-2 text-sm text-orange-700">Вернуть</button>
            </>
          ) : null}
          {!['COMPLETED', 'CANCELLED'].includes(task.status) ? <button onClick={onRemind} className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm">Напомнить</button> : null}
          {!['COMPLETED', 'CANCELLED'].includes(task.status) ? <button onClick={onCancel} className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-600">Отменить</button> : null}
        </div>
      </div>
    </article>
  );
}
