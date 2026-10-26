"use client";

import { useActionState } from "react";
import { login, type LoginState } from "../actions";

type Labels = { email: string; password: string; submit: string };

export function LoginForm({
  lang,
  labels,
  errors,
  initialError,
}: {
  lang: string;
  labels: Labels;
  errors: Record<"invalid" | "tooMany" | "forbidden", string>;
  initialError?: "forbidden";
}) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login.bind(null, lang), undefined);
  const error = state?.error ?? initialError;

  return (
    <form action={action} className="space-y-4" noValidate>
      {error && (
        <p role="alert" className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm">
          {errors[error]}
        </p>
      )}
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          {labels.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="w-full rounded-lg border border-border bg-surface px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          {labels.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-border bg-surface px-3 py-2"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-brand-fg disabled:opacity-60"
      >
        {labels.submit}
      </button>
    </form>
  );
}
