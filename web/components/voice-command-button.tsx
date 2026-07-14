'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Mic, Square, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { VoiceDraft } from '@/lib/types';

type VoiceState =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'review'
  | 'analyzing'
  | 'ready'
  | 'confirming'
  | 'error';

const MAX_DURATION_MS = 5 * 60 * 1000;
const WARNING_DURATION_MS = 4 * 60 * 1000;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const MIN_DURATION_MS = 500;

export function selectSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  return (
    [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
    ].find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
  );
}

function formatTimer(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function isTextInput(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.isContentEditable;
}

export function VoiceCommandButton() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<VoiceState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [draft, setDraft] = useState<VoiceDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const autoStopRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.key.toLowerCase() !== 'v' || isTextInput(event.target)) return;
      event.preventDefault();
      if (state === 'recording') {
        stopRecording();
      } else {
        startRecording();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => () => cleanupMedia(), []);

  async function startRecording() {
    setOpen(true);
    setError(null);
    setTranscript('');
    setDraft(null);
    setElapsedMs(0);
    chunksRef.current = [];

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setState('error');
      setError('Ваш браузер не поддерживает голосовую запись. Используйте актуальную версию Chrome, Safari, Edge или Firefox.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      streamRef.current = stream;
      const mimeType = selectSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => void handleRecordingStop();
      startedAtRef.current = Date.now();
      recorder.start();
      startLevelMeter(stream);
      timerRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 250);
      autoStopRef.current = window.setTimeout(() => {
        if (recorderRef.current?.state === 'recording') stopRecording();
      }, MAX_DURATION_MS);
      setState('recording');
    } catch (err) {
      cleanupMedia();
      setState('error');
      setError(microphoneErrorMessage(err));
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    } else {
      cleanupMedia();
    }
  }

  async function handleRecordingStop() {
    const durationMs = Date.now() - startedAtRef.current;
    cleanupMedia();
    setElapsedMs(durationMs);
    if (durationMs < MIN_DURATION_MS || chunksRef.current.length === 0) {
      setState('error');
      setError('Запись слишком короткая. Попробуйте ещё раз.');
      return;
    }
    const mimeType = recorderRef.current?.mimeType || chunksRef.current[0]?.type || 'audio/webm';
    const blob = new Blob(chunksRef.current, { type: mimeType });
    if (blob.size > MAX_AUDIO_BYTES) {
      setState('error');
      setError('Запись слишком большая. Максимальный размер — 20 MB.');
      return;
    }
    try {
      setState('transcribing');
      const result = await api.transcribeVoice({ audio: blob, mimeType, durationMs });
      setTranscript(result.transcript);
      setState('review');
      await analyzeTranscript(result.transcript);
    } catch (err) {
      setState('error');
      setError(userError(err, 'Не удалось распознать запись.'));
    }
  }

  async function analyzeTranscript(text = transcript) {
    if (!text.trim()) {
      setState('error');
      setError('Текст команды пустой.');
      return;
    }
    try {
      setState('analyzing');
      const result = await api.interpretVoice(text);
      setTranscript(result.transcript);
      setDraft(result.draft);
      setState('ready');
    } catch (err) {
      setState('review');
      setDraft(null);
      setError(userError(err, 'Не удалось разобрать команду.'));
    }
  }

  async function confirmDraft() {
    if (!draft) return;
    try {
      setState('confirming');
      await api.confirmVoiceDraft(draft.draftId);
      queryClient.invalidateQueries();
      closeModal();
    } catch (err) {
      setState('ready');
      setError(userError(err, 'Не удалось подтвердить действие.'));
    }
  }

  async function cancelDraft() {
    if (draft) {
      try {
        await api.cancelVoiceDraft(draft.draftId);
      } catch {
        // Draft may already be expired or processed; closing the UI is still safe.
      }
    }
    closeModal();
  }

  function closeModal() {
    cleanupMedia();
    setOpen(false);
    setState('idle');
    setElapsedMs(0);
    setLevel(0);
    setTranscript('');
    setDraft(null);
    setError(null);
    chunksRef.current = [];
  }

  function retryRecording() {
    cleanupMedia();
    void startRecording();
  }

  function cleanupMedia() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (autoStopRef.current) window.clearTimeout(autoStopRef.current);
    if (animationRef.current) window.cancelAnimationFrame(animationRef.current);
    timerRef.current = null;
    autoStopRef.current = null;
    animationRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioContextRef.current?.state !== 'closed') {
      void audioContextRef.current?.close();
    }
    audioContextRef.current = null;
  }

  function startLevelMeter(stream: MediaStream) {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;
    const context = new AudioContextCtor();
    audioContextRef.current = context;
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const average = data.reduce((sum, value) => sum + value, 0) / data.length;
      setLevel(Math.min(100, Math.round((average / 128) * 100)));
      animationRef.current = window.requestAnimationFrame(tick);
    };
    tick();
  }

  return (
    <>
      <button
        onClick={() => startRecording()}
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--foreground)] text-[var(--background)] shadow-lg transition hover:scale-105 lg:bottom-auto lg:top-5"
        title="Голосовая команда (Alt+V)"
        aria-label="Голосовая команда"
      >
        <Mic size={22} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
          <section className="max-h-[92vh] w-full overflow-auto rounded-t-2xl border border-[var(--line)] bg-[var(--background)] p-5 shadow-2xl sm:max-w-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Голосовая команда</h2>
                <p className="text-sm text-[var(--muted)]">Alt+V — начать или завершить запись.</p>
              </div>
              <button onClick={cancelDraft} className="rounded-md p-2 hover:bg-[var(--panel)]">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-[var(--muted)]">
                    {state === 'recording'
                      ? 'Слушаю...'
                      : state === 'transcribing'
                        ? 'Распознаю голос...'
                        : state === 'analyzing'
                          ? 'Анализирую команду...'
                          : state === 'confirming'
                            ? 'Подтверждаю...'
                            : 'Готово'}
                  </p>
                  <p className="mt-1 text-2xl font-semibold">{formatTimer(elapsedMs)}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                  {state === 'recording' ? <span className="h-3 w-3 animate-pulse rounded-full bg-red-600" /> : <Mic size={20} />}
                </div>
              </div>
              {state === 'recording' ? (
                <>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--line)]">
                    <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${level}%` }} />
                  </div>
                  {elapsedMs > WARNING_DURATION_MS ? (
                    <p className="mt-2 text-sm text-amber-600">Скоро достигнем лимита 5 минут.</p>
                  ) : null}
                </>
              ) : null}
            </div>

            {transcript ? (
              <div className="mt-4">
                <label className="text-sm font-medium">Распознанный текст</label>
                <textarea
                  value={transcript}
                  onChange={(event) => {
                    setTranscript(event.target.value);
                    setDraft(null);
                  }}
                  className="mt-2 min-h-28 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 outline-none focus:border-[var(--accent)]"
                />
                <button
                  onClick={() => analyzeTranscript()}
                  disabled={state === 'analyzing' || state === 'confirming'}
                  className="mt-2 rounded-lg border border-[var(--line)] px-3 py-2 text-sm disabled:opacity-50"
                >
                  Проанализировать заново
                </button>
              </div>
            ) : null}

            {draft ? (
              <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
                <p className="text-sm text-[var(--muted)]">{draft.kind}</p>
                <h3 className="mt-1 font-semibold">{draft.title}</h3>
                <dl className="mt-3 grid gap-2 text-sm">
                  {draft.fields.map((field) => (
                    <div key={`${field.label}:${field.value}`} className="grid grid-cols-[120px_1fr] gap-3">
                      <dt className="text-[var(--muted)]">{field.label}</dt>
                      <dd>{field.value}</dd>
                    </div>
                  ))}
                </dl>
                {draft.affectedTasks?.length ? (
                  <div className="mt-3 text-sm">
                    <p className="text-[var(--muted)]">Затронутые задачи</p>
                    <ul className="mt-1 list-inside list-disc">
                      {draft.affectedTasks.map((task) => (
                        <li key={task}>{task}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

            <div className="mt-5 flex flex-wrap gap-2">
              {state === 'recording' ? (
                <button
                  onClick={stopRecording}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm text-[var(--background)]"
                >
                  <Square size={16} /> Завершить
                </button>
              ) : null}
              {draft ? (
                <button
                  onClick={confirmDraft}
                  disabled={state === 'confirming'}
                  className="rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm text-[var(--background)] disabled:opacity-50"
                >
                  Подтвердить
                </button>
              ) : null}
              <button
                onClick={retryRecording}
                disabled={state === 'recording' || state === 'transcribing' || state === 'analyzing' || state === 'confirming'}
                className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm disabled:opacity-50"
              >
                Записать заново
              </button>
              <button
                onClick={cancelDraft}
                className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm"
              >
                Отмена
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function microphoneErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return 'Нет доступа к микрофону. Разрешите использование микрофона в настройках браузера и попробуйте снова.';
    }
    if (error.name === 'NotFoundError') return 'Микрофон не найден.';
    if (error.name === 'NotReadableError') {
      return 'Микрофон занят другим приложением или недоступен.';
    }
  }
  return 'Не удалось начать запись.';
}

function userError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    try {
      const parsed = JSON.parse(error.message) as { message?: string | string[] };
      if (Array.isArray(parsed.message)) return parsed.message.join('\n');
      if (parsed.message) return parsed.message;
    } catch {
      return error.message;
    }
  }
  return fallback;
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
