"use client";

import { useRouter } from "next/router";
import { useEffect } from "react";

/**
 * Hook to manage language preference storage and detection
 */
export function useLanguagePreference() {
	const router = useRouter();

	useEffect(() => {
		// Only run on client side
		if (typeof window === "undefined") return;

		const storedLanguage = localStorage.getItem("preferred-language");
		const currentLocale = router.locale;
		const defaultLocale = router.defaultLocale;

		// If user has a stored preference and it's different from current locale
		if (storedLanguage && storedLanguage !== currentLocale) {
			const { pathname, asPath, query } = router;
			router.push({ pathname, query }, asPath, { locale: storedLanguage });
		} else if (!storedLanguage && currentLocale) {
			// Store current locale as preference if none exists
			localStorage.setItem("preferred-language", currentLocale);
		}
	}, [router]);

	const setLanguagePreference = (locale: string) => {
		localStorage.setItem("preferred-language", locale);
	};

	const getLanguagePreference = (): string | null => {
		if (typeof window === "undefined") return null;
		return localStorage.getItem("preferred-language");
	};

	const clearLanguagePreference = () => {
		if (typeof window === "undefined") return;
		localStorage.removeItem("preferred-language");
	};

	return {
		setLanguagePreference,
		getLanguagePreference,
		clearLanguagePreference,
		currentLocale: router.locale,
		defaultLocale: router.defaultLocale,
	};
}
