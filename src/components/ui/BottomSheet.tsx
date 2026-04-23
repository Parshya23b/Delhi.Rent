"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  tall,
  variant = "default",
  disableHandleClose = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  tall?: boolean;
  /** Map-style: centered card on wide screens, dark chrome, Google Maps–like place sheet */
  variant?: "default" | "mapPlace";
  /** When true, the top drag handle does not close the sheet (e.g. during submit). */
  disableHandleClose?: boolean;
}) {
  if (!open) return null;

  const isMap = variant === "mapPlace";

  return (
    <div
      className={clsx(
        "fixed inset-0 flex flex-col justify-end",
        isMap ? "z-50 items-stretch sm:items-center" : "z-40",
      )}
    >
      <button
        type="button"
        className={clsx(
          "absolute inset-0",
          isMap
            ? "bg-black/50 backdrop-blur-[1px]"
            : "bg-black/35 backdrop-blur-[2px]",
        )}
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={clsx(
          "relative z-10 flex max-h-[88vh] flex-col shadow-2xl",
          isMap
            ? clsx(
                "w-full max-h-[min(78vh,560px)] rounded-t-[28px] border border-white/10 bg-zinc-950 text-zinc-50 shadow-black/50 sm:mb-4 sm:max-w-lg sm:rounded-3xl",
                tall ? "min-h-[48vh]" : "",
              )
            : clsx(
                "rounded-t-2xl bg-white dark:bg-zinc-900 dark:text-zinc-100",
                tall ? "min-h-[55vh]" : "max-h-[78vh]",
              ),
        )}
      >
        <button
          type="button"
          onClick={disableHandleClose ? undefined : onClose}
          disabled={disableHandleClose}
          aria-label={disableHandleClose ? "Close sheet (disabled while saving)" : "Close sheet"}
          title={disableHandleClose ? undefined : "Close"}
          className={clsx(
            "flex min-h-[44px] w-full shrink-0 touch-manipulation flex-col items-center justify-center gap-1.5 border-0 bg-transparent px-4 pt-2 pb-1 outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent active:bg-black/5 dark:active:bg-white/5",
            isMap ? "pb-1.5 active:bg-white/5" : "",
            disableHandleClose && "cursor-not-allowed opacity-50",
          )}
        >
          <span
            aria-hidden
            className={clsx(
              "pointer-events-none h-1.5 rounded-full",
              isMap ? "w-12 bg-zinc-600" : "w-10 bg-zinc-200 dark:bg-zinc-600",
            )}
          />
        </button>
        {title ? (
          <div
            className={clsx(
              "px-4 pb-3 pt-1",
              isMap ? "border-b border-white/10" : "border-b border-zinc-100 dark:border-zinc-800",
            )}
          >
            <h2
              className={clsx(
                "text-base font-semibold",
                isMap ? "text-zinc-100" : "text-zinc-900 dark:text-zinc-100",
              )}
            >
              {title}
            </h2>
          </div>
        ) : null}
        <div
          className={clsx(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3",
            isMap && "pb-2",
          )}
        >
          {children}
        </div>
        {footer ? (
          <div
            className={clsx(
              "px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
              isMap ? "border-t border-white/10" : "border-t border-zinc-100 dark:border-zinc-800",
            )}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
