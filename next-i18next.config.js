module.exports = {
	i18n: {
		defaultLocale: "en",
		locales: ["en", "zh"],
		localeDetection: true,
	},
	fallbackLng: {
		default: ["en"],
		zh: ["zh", "en"],
	},
	defaultNS: "common",
	ns: ["common"],
	reloadOnPrerender: process.env.NODE_ENV === "development",
	localePath: "./public/locales",
	interpolation: {
		escapeValue: false,
	},
	react: {
		useSuspense: false,
	},
};
