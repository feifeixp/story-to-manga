import { GoogleAnalytics } from "@next/third-parties/google";
import type { Metadata } from "next";
import { I18nProvider } from "@/components/I18nProvider";
import { AuthProvider } from "@/components/AuthProvider";
import "../styles/manga-components.css";
import "../styles/manga-theme.css";
import "./globals.css";

export const metadata: Metadata = {
	title: "Story to Manga Machine",
	description:
		"Transform your stories into manga and comic pages using Nano Banana (Gemini 2.5 Flash Image)",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	// 验证GA ID是否有效（不是占位符且存在）
	const gaId = process.env["NEXT_PUBLIC_GA_MEASUREMENT_ID"];
	const isValidGaId = gaId && gaId !== "G-XXXXXXXXXX" && gaId.startsWith("G-");

	return (
		<html lang="en">
			<body suppressHydrationWarning={true}>
				<I18nProvider>
					<AuthProvider>
						{children}
					</AuthProvider>
				</I18nProvider>
				{isValidGaId && (
					<GoogleAnalytics gaId={gaId} />
				)}
			</body>
		</html>
	);
}
