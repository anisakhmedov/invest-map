"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMedia } from "../cms-actions";

export function DeleteMediaButton({
  lang,
  id,
  label,
  confirmMessage,
  errors,
}: {
  lang: string;
  id: string;
  label: string;
  confirmMessage: string;
  errors: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(confirmMessage)) return;
          setError(null);
          startTransition(async () => {
            const res = await deleteMedia(lang, id);
            if (!res.ok) return setError(errors[res.error] ?? errors.invalid);
            router.refresh();
          });
        }}
        className="text-red-600 underline underline-offset-4 disabled:opacity-60 dark:text-red-400"
      >
        {label}
      </button>
      {error && (
        <span role="alert" className="mt-1 block text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </span>
  );
}
