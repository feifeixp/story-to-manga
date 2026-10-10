"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";
export function StudioDialog({
	title,
	children,
	onClose,
	className = "",
}: {
	title: string;
	children: ReactNode;
	onClose: () => void;
	className?: string;
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
	return (
		<dialog
			ref={ref}
			aria-labelledby={heading}
			className={`studio-dialog ${className}`}
			onCancel={(event) => {
				event.preventDefault();
				onClose();
			}}
		>
			<div className="dialog-heading">
				<h2 id={heading}>{title}</h2>
				<button
					type="button"
					className="studio-icon"
					aria-label="关闭 / Close"
					onClick={onClose}
				>
					<X size={20} />
				</button>
			</div>
			{children}
		</dialog>
	);
}
