"use client";

import { Globe } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";

interface LanguageOption {
	code: string;
	name: string;
	flag: string;
}

const languages: LanguageOption[] = [
	{ code: "en", name: "English", flag: "🇺🇸" },
	{ code: "zh", name: "中文", flag: "🇨🇳" },
];

export default function LanguageSwitcher() {
	const { t, locale, setLocale } = useI18n();
	const [isOpen, setIsOpen] = useState(false);

	const currentLanguage =
		languages.find((lang) => lang.code === locale) || languages[0];

	const handleLanguageChange = (langCode: string) => {
		setLocale(langCode);
		setIsOpen(false);
	};

	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors bg-white"
				aria-label={t("languageSelector")}
			>
				<Globe className="w-4 h-4 text-gray-600" />
				<span className="text-sm font-medium text-gray-700">
					{currentLanguage?.flag} {currentLanguage?.name}
				</span>
			</button>

			{isOpen && (
				<>
					{/* Backdrop */}
							<button
								type="button"
								className="fixed inset-0 z-10 bg-transparent border-0 cursor-default"
								onClick={() => setIsOpen(false)}
								onKeyDown={(e) => {
									if (e.key === 'Escape') {
										setIsOpen(false);
									}
								}}
								aria-label="Close language selector"
							/>

					{/* Dropdown */}
					<div className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[140px]">
						{languages.map((language) => (
							<button
								type="button"
								key={language.code}
								onClick={() => handleLanguageChange(language.code)}
								className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg ${
									language.code === locale
										? "bg-blue-50 text-blue-700"
										: "text-gray-700"
								}`}
							>
								<span className="text-lg">{language.flag}</span>
								<span className="text-sm font-medium">{language.name}</span>
								{language.code === locale && (
									<span className="ml-auto text-blue-600">✓</span>
								)}
							</button>
						))}
					</div>
				</>
			)}
		</div>
	);
}