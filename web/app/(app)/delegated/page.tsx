'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Download, FileUp, Link as LinkIcon, Send, UploadCloud } from 'lucide-react';
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
      <div className="grid gap-4 xl:grid-cols-[420px_1fr] xl:gap-5">
        <form onSubmit={submit} className="grid content-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm sm:p-5">
          <div>
            <h2 className="text-lg font-semibold">Новая делегированная задача</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Выбери исполнителя и опиши результат, который нужно получить.
            </p>
          </div>
          <input className="h-11 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 py-2" placeholder="Название *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea className="min-h-28 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 py-2" placeholder="Описание" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className="h-11 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 py-2" value={form.executorId} onChange={(e) => setForm({ ...form, executorId: e.target.value })}>
            <option value="">Выберите исполнителя</option>
            {executors.data?.map((executor) => <option key={executor.id} value={executor.id}>{executor.fullName}</option>)}
          </select>
          <select className="h-11 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 py-2" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
            <option value="">Без проекта</option>
            {projects.data?.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <select className="h-11 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 py-2" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}>
            <option value="LOW">Низкий</option>
            <option value="NORMAL">Обычный</option>
            <option value="HIGH">Высокий</option>
            <option value="URGENT">Срочный</option>
          </select>
          <input type="datetime-local" className="h-11 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 py-2" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
          <button disabled={create.isPending || !form.executorId || !form.title.trim()} className="btn-base btn-primary w-full">
            {create.isPending ? 'Создаю...' : 'Создать задачу'}
          </button>
          {message ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
          {actionError ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError.message}</p> : null}
        </form>

        <section className="grid content-start gap-4">
          <div className="grid gap-2 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3 shadow-sm sm:grid-cols-2">
            <select className="h-11 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 py-2 text-sm" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">Все статусы</option>
              {Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select className="h-11 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 py-2 text-sm" value={filters.executorId} onChange={(e) => setFilters({ ...filters, executorId: e.target.value })}>
              <option value="">Все исполнители</option>
              {executors.data?.map((executor) => <option key={executor.id} value={executor.id}>{executor.fullName}</option>)}
            </select>
          </div>
          <input className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2" placeholder="Комментарий для проверки/возврата" value={reviewMessage} onChange={(e) => setReviewMessage(e.target.value)} />

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
  const queryClient = useQueryClient();
  const [ownerComment, setOwnerComment] = useState('');
  const [cardMessage, setCardMessage] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const isClosed = ['COMPLETED', 'CANCELLED'].includes(task.status);
  const publicUrl =
    typeof window === 'undefined'
      ? ''
      : `${window.location.origin}/public/delegated/${task.publicAccessToken}`;

  const comment = useMutation({
    mutationFn: (message: string) => api.commentDelegatedTask(task.id, message),
    onSuccess: async () => {
      setOwnerComment('');
      setCardMessage('Комментарий отправлен исполнителю.');
      await queryClient.invalidateQueries({ queryKey: ['delegated-tasks'] });
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Файл слишком большой. Максимум 10 МБ.');
      }
      return api.createAttachment({
        delegatedTaskId: task.id,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataBase64: await fileToBase64(file),
      });
    },
    onSuccess: async () => {
      setCardMessage('Файл добавлен.');
      await queryClient.invalidateQueries({ queryKey: ['delegated-tasks'] });
    },
  });

  async function downloadAttachment(id: string, fileName: string) {
    const blob = await api.downloadAttachment(id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <article className={`interactive-card overflow-hidden rounded-2xl border bg-[var(--panel)] shadow-sm transition-all ${isExpanded ? 'border-[var(--accent)] shadow-md' : 'border-[var(--line)]'}`}>
      <button
        type="button"
        className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--accent-soft)] active:scale-[0.995] sm:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] sm:gap-3 sm:px-4"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((value) => !value)}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--background)] text-[var(--muted)] transition-colors group-hover:text-[var(--accent)]">
          {isExpanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold sm:text-base">{task.title}</span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-[var(--muted)] sm:hidden">
            <span className="truncate">{task.executor.fullName}</span>
            {task.dueAt ? <span className="shrink-0">· {new Date(task.dueAt).toLocaleDateString('ru-RU')}</span> : null}
          </span>
        </span>
        <span className="hidden min-w-0 truncate text-xs text-[var(--muted)] sm:block">{task.executor.fullName}</span>
        <span className="hidden min-w-0 truncate text-xs text-[var(--muted)] sm:block">
          {task.project?.name ?? 'Без проекта'}
          {task.dueAt ? ` · ${new Date(task.dueAt).toLocaleDateString('ru-RU')}` : ''}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="hidden rounded-full bg-[var(--background)] px-2 py-1 text-xs text-[var(--muted)] sm:inline-flex">{task.priority}</span>
          <span className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-xs text-[var(--accent)]">{statusLabel[task.status]}</span>
        </span>
      </button>

      {isExpanded ? (
        <div className="border-t border-[var(--line)] p-4 sm:p-5">
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
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:min-w-[220px] lg:justify-end">
          <button
            type="button"
            className="btn-base btn-secondary w-full sm:w-auto"
            onClick={() => {
              navigator.clipboard?.writeText(publicUrl);
              setCardMessage('Ссылка исполнителя скопирована.');
            }}
          >
            <LinkIcon size={16} /> Ссылка
          </button>
          {task.status === 'DRAFT' ? (
            <button disabled={busyAction.send} onClick={onSend} className="btn-base btn-primary w-full sm:w-auto">
              {busyAction.send ? 'Отправляю...' : 'Отправить'}
            </button>
          ) : null}
          {task.status === 'WAITING_REVIEW' ? (
            <>
              <button disabled={busyAction.accept} onClick={onAccept} className="btn-base btn-success w-full sm:w-auto">
                {busyAction.accept ? 'Принимаю...' : 'Принять'}
              </button>
              <button disabled={busyAction.return} onClick={onReturn} className="btn-base btn-warning w-full sm:w-auto">
                {busyAction.return ? 'Возвращаю...' : 'Вернуть'}
              </button>
            </>
          ) : null}
          {!isClosed ? (
            <button disabled={busyAction.remind} onClick={onRemind} className="btn-base btn-secondary w-full sm:w-auto">
              {busyAction.remind ? 'Отправляю...' : 'Напомнить'}
            </button>
          ) : null}
          {!isClosed ? (
            <button disabled={busyAction.cancel} onClick={onCancel} className="btn-base btn-danger w-full sm:w-auto">
              {busyAction.cancel ? 'Отменяю...' : 'Отменить'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-4 border-t border-[var(--line)] pt-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-[var(--background)] p-3 sm:p-4">
          <h3 className="font-semibold">Комментарии</h3>
          <div className="mt-3 grid max-h-56 gap-2 overflow-auto">
            {task.comments?.length ? task.comments.map((item) => (
              <div key={item.id} className="rounded-xl bg-[var(--panel)] p-3 text-sm">
                <p className="text-xs text-[var(--muted)]">{item.author} · {new Date(item.createdAt).toLocaleString('ru-RU')}</p>
                <p className="mt-1 whitespace-pre-wrap">{item.message}</p>
              </div>
            )) : <p className="text-sm text-[var(--muted)]">Комментариев пока нет.</p>}
          </div>
          {!isClosed ? (
            <div className="mt-3 grid gap-2">
              <textarea
                className="min-h-20 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 text-sm"
                placeholder="Ответить исполнителю"
                value={ownerComment}
                onChange={(event) => setOwnerComment(event.target.value)}
              />
              <button className="btn-base btn-primary w-full" disabled={comment.isPending || !ownerComment.trim()} onClick={() => comment.mutate(ownerComment)}>
                <Send size={16} /> Ответить
              </button>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl bg-[var(--background)] p-3 sm:p-4">
          <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
            <h3 className="font-semibold">Файлы</h3>
            {!isClosed ? (
              <label className="btn-base btn-secondary min-h-0 w-full cursor-pointer px-3 py-2 sm:w-auto sm:py-1">
                <UploadCloud size={16} /> Загрузить
                <input
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
          <div className="mt-3 grid gap-2">
            {task.attachments?.length ? task.attachments.map((file) => (
              <div key={file.id} className="interactive-card grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 text-sm sm:flex sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <FileUp size={16} className="text-[var(--accent)]" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{file.fileName}</p>
                    <p className="text-xs text-[var(--muted)]">{formatSize(file.sizeBytes)}</p>
                  </div>
                </div>
                <button className="btn-base btn-secondary min-h-0 w-full px-3 py-2 sm:w-auto sm:py-1" onClick={() => downloadAttachment(file.id, file.fileName)}>
                  <Download size={15} /> Скачать
                </button>
              </div>
            )) : <p className="text-sm text-[var(--muted)]">Файлов пока нет.</p>}
          </div>
        </section>
      </div>

      {cardMessage ? <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{cardMessage}</p> : null}
      {(comment.error || upload.error) ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{(comment.error || upload.error)?.message}</p> : null}
        </div>
      ) : null}
    </article>
  );
}
