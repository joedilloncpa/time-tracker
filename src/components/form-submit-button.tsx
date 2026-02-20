"use client";

import { useEffect, useRef, useState } from "react";
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
  const wasPendingRef = useRef(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    if (pending) {
      setShowSuccess(false);
      wasPendingRef.current = true;
    } else if (wasPendingRef.current) {
      setShowSuccess(true);
      timeout = setTimeout(() => setShowSuccess(false), 1000);
      wasPendingRef.current = false;
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [pending]);

  return (
    <button className={className} disabled={pending} type={type}>
      {pending ? pendingText : showSuccess ? `✓ ${successText}` : children}
    </button>
  );
}
