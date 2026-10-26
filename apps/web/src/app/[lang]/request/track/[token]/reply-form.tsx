"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { replyToRequest, type ReplyState } from "../../actions";
import { ErrorNote, Field, PrimaryButton, SavedNote } from "@/components/admin-ui";
import { textareaClass } from "@/components/form-controls";

export function ReplyForm({
  lang,
  token,
  labels,
  errors,
}: {
  lang: string;
  token: string;
  labels: { replyLabel: string; send: string; sent: string };
  errors: Record<string, string>;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ReplyState, FormData>(replyToRequest.bind(null, lang, token), undefined);

  useEffect(() => {
    if (state?.saved) {
      formRef.current?.reset();
      router.refresh(); // show the new message in the thread
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={action} className="max-w-2xl space-y-4">
      {state?.error && <ErrorNote>{errors[state.error] ?? errors.invalid}</ErrorNote>}
      {state?.saved && <SavedNote>{labels.sent}</SavedNote>}
      <div aria-hidden="true" className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden">
        <label htmlFor="reply-website">Website</label>
        <input id="reply-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <Field id="reply-body" label={labels.replyLabel}>
        <textarea id="reply-body" name="body" required maxLength={5000} rows={5} className={textareaClass} />
      </Field>
      <PrimaryButton pending={pending}>{labels.send}</PrimaryButton>
    </form>
  );
}
