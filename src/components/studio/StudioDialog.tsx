"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export function StudioDialog({
  title,
  children,
  onClose
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return <dialog ref={ref} aria-labelledby={heading} className="studio-dialog" onCancel={event => {
    event.preventDefault();
    onClose();
  }}>
		<div className="dialog-heading"><h2 id={heading}>{title}</h2><button type="button" className="studio-icon" aria-label="关闭 / Close" onClick={onClose}><X size={20} /></button></div>
		{children}
	</dialog>;
}
