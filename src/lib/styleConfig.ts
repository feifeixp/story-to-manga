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
			zh: "中国武侠修仙画风，古风水墨意境，飘逸流畅线条，写意构图，灵动氛围",
			en: "Chinese wuxia painting style, ancient ink aesthetics, flowing expressive lines, poetic composition, ethereal atmosphere"
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
			zh: "治愈系动漫画风，温暖柔和色彩，轻快线条，柔和光影，温馨氛围",
			en: "Healing anime style, warm soft colors, gentle lines, soft lighting, cozy atmosphere"
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
			zh: "韩国网络漫画画风，现代感强烈，精致数字绘制，时尚色彩搭配，流畅构图",
			en: "Korean webtoon style, strong modern aesthetic, refined digital painting, stylish color palette, smooth composition"
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
			zh: "电影级画风，写实主义，电影摄影构图，专业光影，景深控制，电影级色彩分级",
			en: "Cinematic style, photorealism, cinematographic composition, professional lighting, depth of field, cinematic color grading"
		},
		characterPrompt: {
			zh: "角色参考图：电影级写实风格，逼真的人物造型，专业的光影处理，电影级质感，细节丰富，中文标注",
			en: "Character reference sheet: Cinematic photorealistic style, realistic character modeling, professional lighting, cinematic texture, rich details, English annotations"
		},
		panelPrompt: {
			zh: "漫画面板：电影级视觉效果，写实场景，专业摄影构图，戏剧性光影，电影级质感，景深效果",
			en: "Comic panel: Cinematic visual effects, realistic scenes, professional photography composition, dramatic lighting, cinematic texture, depth of field effects"
		}
	},
	shojo: {
		name: "少女漫画",
		description: "梦幻唯美的少女漫画风格",
		promptPrefix: {
			zh: "少女漫画风格，梦幻唯美，纤细的线条，使用中文文字和对话框，保持角色外观一致性，浪漫氛围，花瓣/星光等点缀元素，柔和色调或黑白精致描绘，情感细腻",
			en: "Shojo manga style, dreamy and romantic, delicate line art, using English text and speech bubbles, maintain character appearance consistency, romantic atmosphere, decorative elements like petals/stars, soft tones or refined black-and-white, emotional delicacy"
		},
		characterPrompt: {
			zh: "角色参考图：少女漫画风格，梦幻唯美，纤细线条，浪漫氛围，花瓣星光点缀，柔和色调，情感细腻，中文标注",
			en: "Character reference sheet: Shojo manga style, dreamy and romantic, delicate line art, romantic atmosphere, decorative elements like petals/stars, soft tones, emotional delicacy, English annotations"
		},
		panelPrompt: {
			zh: "漫画面板：少女漫画风格，梦幻浪漫，纤细线条，花瓣星光装饰，柔和色调，情感细腻表达",
			en: "Comic panel: Shojo manga style, dreamy and romantic, delicate line art, decorative elements like petals/stars, soft tones, delicate emotional expression"
		}
	},
	seinen: {
		name: "青年漫画",
		description: "写实硬朗的青年向漫画风格",
		promptPrefix: {
			zh: "青年漫画风格，写实硬朗，细致的线条与光影，使用中文文字和对话框，保持角色外观一致性，成熟主题，复杂场景，强烈的氛围张力",
			en: "Seinen manga style, realistic and gritty, detailed linework and shading, using English text and speech bubbles, maintain character appearance consistency, mature themes, complex settings, strong atmospheric tension"
		},
		characterPrompt: {
			zh: "角色参考图：青年漫画风格，写实硬朗，细致线条光影，成熟主题，复杂设定，强烈氛围张力，中文标注",
			en: "Character reference sheet: Seinen manga style, realistic and gritty, detailed linework and shading, mature themes, complex settings, strong atmospheric tension, English annotations"
		},
		panelPrompt: {
			zh: "漫画面板：青年漫画风格，写实硬朗，细致光影，成熟主题，复杂场景，强烈氛围张力",
			en: "Comic panel: Seinen manga style, realistic and gritty, detailed linework and shading, mature themes, complex settings, strong atmospheric tension"
		}
	},
	chibi: {
		name: "Q版漫画",
		description: "夸张可爱的Q版超变形风格",
		promptPrefix: {
			zh: "Q版漫画风格，夸张可爱，圆润的线条，使用中文文字和对话框，保持角色外观一致性，表情夸张化，卡通感强烈，轻松幽默氛围",
			en: "Chibi comic style, exaggeratedly cute, rounded line art, using English text and speech bubbles, maintain character appearance consistency, over-expressive faces, strong cartoonish feel, light and humorous tone"
		},
		characterPrompt: {
			zh: "角色参考图：Q版漫画风格，夸张可爱，圆润线条，表情夸张，卡通感强烈，轻松幽默，中文标注",
			en: "Character reference sheet: Chibi comic style, exaggeratedly cute, rounded line art, over-expressive faces, strong cartoonish feel, light and humorous tone, English annotations"
		},
		panelPrompt: {
			zh: "漫画面板：Q版漫画风格，夸张可爱，圆润线条，表情夸张，卡通感强烈，轻松幽默氛围",
			en: "Comic panel: Chibi comic style, exaggeratedly cute, rounded line art, over-expressive faces, strong cartoonish feel, light and humorous atmosphere"
		}
	},
	fantasy: {
		name: "奇幻史诗",
		description: "宏大背景的奇幻史诗风格",
		promptPrefix: {
			zh: "奇幻史诗风格，宏大背景设定，华丽的服饰与道具，使用中文文字和对话框，保持角色外观一致性，史诗感构图，神秘光影，魔法元素点缀",
			en: "Fantasy epic style, grand backgrounds, elaborate costumes and props, using English text and speech bubbles, maintain character appearance consistency, epic compositions, mystical lighting, magical elements"
		},
		characterPrompt: {
			zh: "角色参考图：奇幻史诗风格，宏大背景，华丽服饰道具，史诗感构图，神秘光影，魔法元素，中文标注",
			en: "Character reference sheet: Fantasy epic style, grand backgrounds, elaborate costumes and props, epic compositions, mystical lighting, magical elements, English annotations"
		},
		panelPrompt: {
			zh: "漫画面板：奇幻史诗风格，宏大背景，华丽服饰道具，史诗感构图，神秘光影，魔法元素点缀",
			en: "Comic panel: Fantasy epic style, grand backgrounds, elaborate costumes and props, epic compositions, mystical lighting, magical elements"
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
