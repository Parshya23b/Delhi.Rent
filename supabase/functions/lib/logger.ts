type LogLevel = "info" | "warn" | "error" | "debug";

function emit(level: LogLevel, fn: string, message: string, extra?: Record<string, unknown>) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    fn,
    message,
    ...extra,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (fn: string, message: string, extra?: Record<string, unknown>) => emit("info", fn, message, extra),
  warn: (fn: string, message: string, extra?: Record<string, unknown>) => emit("warn", fn, message, extra),
  error: (fn: string, message: string, extra?: Record<string, unknown>) => emit("error", fn, message, extra),
  debug: (fn: string, message: string, extra?: Record<string, unknown>) => emit("debug", fn, message, extra),
};
