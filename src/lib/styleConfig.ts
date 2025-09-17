import type { ComicStyle } from "@/types";

export interface StyleConfig {
	name: string;
	description: string;
	promptPrefix: {
		zh: string;
		en: string;
	};
	characterPrompt: {
		zh: string;
		en: string;
	};
	panelPrompt: {
		zh: string;
		en: string;
	};
}

export const STYLE_CONFIGS: Record<ComicStyle, StyleConfig> = {
	manga: {
		name: "日式漫画",
		description: "传统日本漫画风格，黑白配网点",
		promptPrefix: {
			zh: "日式漫画风格（黑白配网点），使用中文文字和对话框，保持角色外观一致性，细腻的线条艺术，经典的网点阴影技法，动态的分镜构图",
			en: "Japanese manga style (black and white with screentones), using English text and speech bubbles, maintain character appearance consistency, detailed line art, classic screentone shading techniques, dynamic panel composition"
		},
		characterPrompt: {
			zh: "角色参考图：日式漫画风格，黑白线稿，详细的角色设计，清晰的线条艺术，完整的网点处理，中文标注",
			en: "Character reference sheet: Japanese manga style, black and white line art, detailed character design, clean line art, complete screentone processing, English annotations"
		},
		panelPrompt: {
			zh: "漫画面板：日式漫画风格，黑白配网点，动态构图，情感表达丰富，背景细节精致，符合漫画分镜语言",
			en: "Manga panel: Japanese manga style, black and white with screentones, dynamic composition, rich emotional expression, detailed backgrounds, following manga panel language"
		}
	},
	comic: {
		name: "美式漫画",
		description: "美式超级英雄漫画风格，全彩色",
		promptPrefix: {
			zh: "美式漫画风格，全彩色，清晰线条艺术，使用中文文字和对话框，保持角色外观一致性，鲜艳的色彩，戏剧性的光影效果，英雄主义构图",
			en: "American comic book style, full color, clean line art, using English text and speech bubbles, maintain character appearance consistency, vibrant colors, dramatic lighting effects, heroic composition"
		},
		characterPrompt: {
			zh: "角色参考图：美式漫画风格，全彩色，肌肉线条分明，英雄主义设计，戏剧性姿态，中文标注",
			en: "Character reference sheet: American comic book style, full color, defined muscle lines, heroic design, dramatic poses, English annotations"
		},
		panelPrompt: {
			zh: "漫画面板：美式漫画风格，全彩色，戏剧性构图，动作场面震撼，色彩对比强烈，符合超级英雄漫画语言",
			en: "Comic panel: American comic book style, full color, dramatic composition, spectacular action scenes, strong color contrast, following superhero comic language"
		}
	},
	wuxia: {
		name: "武侠修仙",
		description: "中国武侠修仙风格，古风意境",
		promptPrefix: {
			zh: "中国武侠修仙风格，古风水墨意境，飘逸的服饰，仙气缭绕，山水背景，使用中文文字和对话框，保持角色外观一致性，传统中国画技法，意境深远的构图，灵气氛围",
			en: "Chinese wuxia cultivation style, ancient ink painting atmosphere, flowing robes, ethereal aura, landscape backgrounds, using English text and speech bubbles, maintain character appearance consistency, traditional Chinese painting techniques, profound artistic composition, spiritual atmosphere"
		},
		characterPrompt: {
			zh: "角色参考图：中国武侠修仙风格，古装服饰，飘逸长发，仙风道骨，灵气环绕，传统中国画风格，中文标注",
			en: "Character reference sheet: Chinese wuxia cultivation style, ancient costume, flowing long hair, immortal bearing, spiritual aura, traditional Chinese painting style, English annotations"
		},
		panelPrompt: {
			zh: "漫画面板：中国武侠修仙风格，古风意境，山水背景，灵气特效，飞行场面，传统构图美学，诗意氛围",
			en: "Comic panel: Chinese wuxia cultivation style, ancient atmosphere, landscape backgrounds, spiritual effects, flying scenes, traditional compositional aesthetics, poetic atmosphere"
		}
	},
	healing: {
		name: "治愈系日漫",
		description: "温暖治愈的日本动漫风格",
		promptPrefix: {
			zh: "治愈系日本动漫风格，温暖柔和的色彩，可爱的角色设计，使用中文文字和对话框，保持角色外观一致性，柔和的光线，温馨的氛围，细腻的情感表达，日常生活场景",
			en: "Healing Japanese anime style, warm and soft colors, cute character design, using English text and speech bubbles, maintain character appearance consistency, soft lighting, cozy atmosphere, delicate emotional expression, daily life scenes"
		},
		characterPrompt: {
			zh: "角色参考图：治愈系日本动漫风格，可爱的角色设计，温暖的色彩，柔和的线条，亲和力强的表情，中文标注",
			en: "Character reference sheet: Healing Japanese anime style, cute character design, warm colors, soft lines, friendly expressions, English annotations"
		},
		panelPrompt: {
			zh: "漫画面板：治愈系日本动漫风格，温馨的场景，柔和的光线，日常生活细节，情感细腻，氛围温暖",
			en: "Comic panel: Healing Japanese anime style, cozy scenes, soft lighting, daily life details, delicate emotions, warm atmosphere"
		}
	},
	manhwa: {
		name: "韩漫风格",
		description: "韩国网络漫画风格，现代都市",
		promptPrefix: {
			zh: "韩国网络漫画风格，现代都市背景，时尚的角色设计，使用中文文字和对话框，保持角色外观一致性，精致的数字绘画技法，现代感强烈，都市生活场景，流行文化元素",
			en: "Korean webtoon style, modern urban background, fashionable character design, using English text and speech bubbles, maintain character appearance consistency, refined digital painting techniques, strong modern feel, urban life scenes, pop culture elements"
		},
		characterPrompt: {
			zh: "角色参考图：韩国网络漫画风格，时尚现代的角色设计，精致的面部特征，都市风格服装，数字绘画技法，中文标注",
			en: "Character reference sheet: Korean webtoon style, fashionable modern character design, refined facial features, urban style clothing, digital painting techniques, English annotations"
		},
		panelPrompt: {
			zh: "漫画面板：韩国网络漫画风格，现代都市场景，时尚元素，精致的数字绘画，现代生活氛围，流行文化背景",
			en: "Comic panel: Korean webtoon style, modern urban scenes, fashion elements, refined digital painting, modern life atmosphere, pop culture background"
		}
	},
	cinematic: {
		name: "电影风格",
		description: "电影级视觉效果，写实风格",
		promptPrefix: {
			zh: "电影级视觉风格，写实主义，电影摄影构图，使用中文文字和对话框，保持角色外观一致性，专业的光影效果，景深控制，电影级色彩分级，戏剧性的视角",
			en: "Cinematic visual style, photorealism, cinematographic composition, using English text and speech bubbles, maintain character appearance consistency, professional lighting effects, depth of field control, cinematic color grading, dramatic perspectives"
		},
		characterPrompt: {
			zh: "角色参考图：电影级写实风格，逼真的人物造型，专业的光影处理，电影级质感，细节丰富，中文标注",
			en: "Character reference sheet: Cinematic photorealistic style, realistic character modeling, professional lighting, cinematic texture, rich details, English annotations"
		},
		panelPrompt: {
			zh: "漫画面板：电影级视觉效果，写实场景，专业摄影构图，戏剧性光影，电影级质感，景深效果",
			en: "Comic panel: Cinematic visual effects, realistic scenes, professional photography composition, dramatic lighting, cinematic texture, depth of field effects"
		}
	}
};

export function getStyleConfig(style: ComicStyle): StyleConfig {
	return STYLE_CONFIGS[style];
}

export function getStylePrompt(style: ComicStyle, type: 'prefix' | 'character' | 'panel', language: 'zh' | 'en'): string {
	const config = getStyleConfig(style);
	switch (type) {
		case 'prefix':
			return config.promptPrefix[language];
		case 'character':
			return config.characterPrompt[language];
		case 'panel':
			return config.panelPrompt[language];
		default:
			return config.promptPrefix[language];
	}
}
