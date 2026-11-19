"use client";

import { useFormStatus } from "react-dom";
import { btn } from "./ui";

export function SubmitButton({
  children,
  variant = "primary",
  confirm,
  name,
  value,
  className,
}: {
  children: React.ReactNode;
  variant?: keyof typeof btn;
  confirm?: string;
  name?: string;
  value?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={`${btn[variant]} ${className ?? ""}`}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? "กำลังบันทึก…" : children}
    </button>
  );
}
