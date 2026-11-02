"use client";

import { startTransition, type FormEvent } from "react";

/**
 * Sends a form to a server action without React's automatic form reset, so
 * controlled fields (selects especially) keep what the person entered when
 * the action returns an error.
 */
export function submitWithoutReset(dispatch: (form: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => dispatch(form));
  };
}
