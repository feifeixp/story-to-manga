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
				className="flex items-center gap-2 px-3 py-2 rounded-lg border border-manga-medium-gray/30 hover:border-manga-medium-gray/50 transition-all duration-200 bg-white hover:bg-manga-off-white shadow-sm hover:shadow-md"
				aria-label={t("languageSelector")}
				title={t("languageSelector")}
			>
				<Globe className="w-4 h-4 text-manga-medium-gray" />
				<span className="text-sm font-medium text-manga-black">
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
					<div className="absolute top-full mt-2 right-0 bg-white border border-manga-medium-gray/20 rounded-lg shadow-comic z-20 min-w-[140px] overflow-hidden">
						{languages.map((language) => (
							<button
								type="button"
								key={language.code}
								onClick={() => handleLanguageChange(language.code)}
								className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-manga-off-white transition-all duration-200 ${
									language.code === locale
										? "bg-manga-info/10 text-manga-info border-l-2 border-manga-info"
										: "text-manga-black hover:text-manga-info"
								}`}
							>
								<span className="text-lg">{language.flag}</span>
								<span className="text-sm font-medium">{language.name}</span>
								{language.code === locale && (
									<span className="ml-auto text-manga-info font-bold">✓</span>
								)}
							</button>
						))}
					</div>
				</>
			)}
		</div>
	);
}