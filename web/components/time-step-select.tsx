'use client';

const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const minutes = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'));

export function TimeStepSelect({
  value,
  onChange,
  allowEmpty = false,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  allowEmpty?: boolean;
  className?: string;
}) {
  const [rawHour, rawMinute] = value.split(':');
  const hour = rawHour || (allowEmpty ? '' : '09');
  const minute = minutes.includes(rawMinute) ? rawMinute : '00';

  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      <select
        className="h-11 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
        value={hour}
        onChange={(event) => {
          const nextHour = event.target.value;
          onChange(nextHour ? `${nextHour}:${minute}` : '');
        }}
        aria-label="Часы"
      >
        {allowEmpty ? <option value="">--</option> : null}
        {hours.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <select
        className="h-11 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] disabled:opacity-50"
        value={hour ? minute : ''}
        onChange={(event) => onChange(`${hour || '09'}:${event.target.value}`)}
        disabled={allowEmpty && !hour}
        aria-label="Минуты"
      >
        {allowEmpty && !hour ? <option value="">--</option> : null}
        {minutes.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}
