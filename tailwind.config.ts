import type { Config } from "tailwindcss";

const config: Config = {
	content: [
		"./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/components/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/app/**/*.{js,ts,jsx,tsx,mdx}",
	],
	theme: {
		extend: {
			// Use RGB/HSL colors instead of lab()/oklch() to avoid parsing issues
			colors: {
				border: "hsl(214.3 31.8% 91.4%)",
				input: "hsl(214.3 31.8% 91.4%)",
				ring: "hsl(222.2 84% 4.9%)",
				background: "hsl(0 0% 100%)",
				foreground: "hsl(222.2 84% 4.9%)",
				primary: {
					DEFAULT: "hsl(222.2 47.4% 11.2%)",
					foreground: "hsl(210 40% 98%)",
				},
				secondary: {
					DEFAULT: "hsl(210 40% 96%)",
					foreground: "hsl(222.2 84% 4.9%)",
				},
				destructive: {
					DEFAULT: "hsl(0 84.2% 60.2%)",
					foreground: "hsl(210 40% 98%)",
				},
				muted: {
					DEFAULT: "hsl(210 40% 96%)",
					foreground: "hsl(215.4 16.3% 46.9%)",
				},
				accent: {
					DEFAULT: "hsl(210 40% 96%)",
					foreground: "hsl(222.2 84% 4.9%)",
				},
				popover: {
					DEFAULT: "hsl(0 0% 100%)",
					foreground: "hsl(222.2 84% 4.9%)",
				},
				card: {
					DEFAULT: "hsl(0 0% 100%)",
					foreground: "hsl(222.2 84% 4.9%)",
				},
				manga: {
					white: "#FFFFFF",
					"off-white": "#FAFAFA",
					"light-gray": "#F5F5F5",
					gray: "#E0E0E0",
					"medium-gray": "#9E9E9E",
					"dark-gray": "#424242",
					charcoal: "#2E2E2E",
					black: "#000000",
					success: "#2E7D32",
					warning: "#F57C00",
					danger: "#C62828",
					info: "#1976D2",
					"accent-red": "#D32F2F",
					"accent-gold": "#FF8F00",
				},
			},
			borderRadius: {
				lg: "0.5rem",
				md: "calc(0.5rem - 2px)",
				sm: "calc(0.5rem - 4px)",
			},
			fontFamily: {
				// 中文优化字体配置
				chinese: [
					'"Noto Sans SC"',
					'"PingFang SC"',
					'"Microsoft YaHei"',
					'"Hiragino Sans GB"',
					"sans-serif",
				],
				"chinese-serif": [
					'"Noto Serif SC"',
					'"Source Han Serif SC"',
					'"STSong"',
					"serif",
				],
				// 日文字体（用于漫画风格）
				japanese: [
					'"M PLUS 1"',
					'"Sawarabi Gothic"',
					'"Noto Sans JP"',
					"sans-serif",
				],
				"japanese-serif": ['"Zen Old Mincho"', '"Noto Serif JP"', "serif"],
				// 英文字体
				comic: ['"Comfortaa"', '"Bangers"', "sans-serif"],
				handwriting: ['"Permanent Marker"', "cursive"],
			},
		},
	},
	// Force Tailwind to use hex/rgb colors instead of modern color functions
	future: {
		hoverOnlyWhenSupported: true,
	},
	plugins: [],
};

export default config;
