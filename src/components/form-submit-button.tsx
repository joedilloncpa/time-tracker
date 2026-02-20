"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

type FormSubmitButtonProps = {
  children: string;
  className?: string;
  pendingText?: string;
  successText?: string;
  type?: "submit" | "button";
};

export function FormSubmitButton({
  children,
  className = "button",
  pendingText = "Saving...",
  successText = "Saved",
  type = "submit"
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();
  const [showSuccess, setShowSuccess] = useState(false);
  const [wasPending, setWasPending] = useState(false);

  useEffect(() => {
    if (pending) {
      setWasPending(true);
      setShowSuccess(false);
      return;
    }
    if (wasPending) {
      setShowSuccess(true);
      setWasPending(false);
      const timeout = setTimeout(() => setShowSuccess(false), 1600);
      return () => clearTimeout(timeout);
    }
  }, [pending, wasPending]);

  return (
    <button className={className} disabled={pending} type={type}>
      {pending ? pendingText : showSuccess ? `✓ ${successText}` : children}
    </button>
  );
}
