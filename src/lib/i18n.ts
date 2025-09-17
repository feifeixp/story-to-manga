import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

// Import translation files
import enCommon from "@/locales/en/common.json";
import zhCommon from "@/locales/zh/common.json";

const resources = {
	en: {
		common: enCommon,
	},
	zh: {
		common: zhCommon,
	},
};

export const initI18n = async () => {
	if (!i18n.isInitialized) {
		await i18n
			.use(LanguageDetector)
			.use(initReactI18next)
			.init({
				resources,
				fallbackLng: "en",
				defaultNS: "common",
				ns: ["common"],

				detection: {
					order: ["localStorage", "navigator", "htmlTag"],
					caches: ["localStorage"],
					lookupLocalStorage: "preferred-language",
				},

				interpolation: {
					escapeValue: false,
				},

				react: {
					useSuspense: false,
				},
			});
	}
	return i18n;
};

export default i18n;
