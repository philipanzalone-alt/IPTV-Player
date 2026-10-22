import { clsx, type ClassValue } from 'clsx';

/**
 * Combine multiple class names conditionally using clsx
 */
export function cn(...classes: ClassValue[]): string {
  return clsx(classes);
}

/**
 * Formats a duration in seconds to HH:MM:SS or MM:SS format
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

/**
 * Formats an ISO date or timestamp into a readable date string
 */
export function formatDate(isoString: string | undefined | null): string {
  if (!isoString) return 'Never';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return isoString;
  }
}

/**
 * Computes the 0-100 percentage progress of an EPG program based on start and end time
 */
export function getEpgProgress(startTime: string, endTime: string): number {
  try {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const now = Date.now();

    if (isNaN(start) || isNaN(end) || end <= start) return 0;
    if (now <= start) return 0;
    if (now >= end) return 100;

    const progress = ((now - start) / (end - start)) * 100;
    return Math.min(100, Math.max(0, Math.round(progress)));
  } catch {
    return 0;
  }
}

/**
 * Truncates text to a specified maximum length with ellipsis
 */
export function truncateText(text: string | undefined | null, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

/**
 * Formats start and end times into a readable range (e.g., "20:00 - 21:00")
 */
export function formatTimeRange(start: string, end: string): string {
  try {
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return `${start} - ${end}`;
    }

    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    };

    const startFormatted = new Intl.DateTimeFormat(undefined, timeOptions).format(startDate);
    const endFormatted = new Intl.DateTimeFormat(undefined, timeOptions).format(endDate);

    return `${startFormatted} - ${endFormatted}`;
  } catch {
    return `${start} - ${end}`;
  }
}

/**
 * Formats a timestamp into HH:MM
 */
export function formatTime(time: string | Date | number): string {
  try {
    const date = typeof time === 'string' || typeof time === 'number' ? new Date(time) : time;
    if (isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return '';
  }
}
