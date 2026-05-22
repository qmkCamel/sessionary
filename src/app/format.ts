import type { Translator } from "../i18n";

export function secondsLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function compactNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { notation: value >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

export function costLabel(value: number | null | undefined): string {
  if (value == null) return "n/a";
  return `$${value.toFixed(value >= 10 ? 2 : 4)}`;
}

export function percentLabel(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function timeLabel(iso: string | null, t?: Translator): string {
  if (!iso) return t ? t("common.open") : "open";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function byteLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
