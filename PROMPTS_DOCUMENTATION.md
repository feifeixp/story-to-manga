# Story to Manga Enhanced - 提示词文档 v2.2.1

本文档详细说明了Story to Manga Enhanced项目中使用的所有AI提示词，包括参数、格式和生成逻辑。

**更新日期**: 2024-12-17
**版本**: v2.2.1
**支持的AI模型**: Google Gemini 2.5 Flash, VolcEngine Doubao
**支持的漫画风格**: 10种（manga, comic, wuxia, healing, manhwa, cinematic, shojo, seinen, chibi, fantasy）
**语言支持**: 中文、英文完整本地化

## 目录

1. [故事分析 (Story Analysis)](#1-故事分析-story-analysis)
2. [故事分解 (Story Chunking)](#2-故事分解-story-chunking)
3. [角色参考生成 (Character Reference Generation)](#3-角色参考生成-character-reference-generation)
4. [漫画面板生成 (Panel Generation)](#4-漫画面板生成-panel-generation)
5. [图像重绘 (Image Redraw)](#5-图像重绘-image-redraw)
6. [风格配置系统 (Style Configuration)](#6-风格配置系统-style-configuration)
7. [AI模型选择逻辑](#7-ai模型选择逻辑)
8. [语言本地化系统](#8-语言本地化系统)

---

## 1. 故事分析 (Story Analysis)

### API端点

`POST /api/analyze-story`

### 功能

分析用户输入的故事，提取主要角色、全局设定和具体场景信息，支持中英文双语。

### 输入参数

```json
{
  "story": "用户输入的故事文本",
  "style": "manga | comic | wuxia | healing | manhwa | cinematic | shojo | seinen | chibi | fantasy",
  "language": "zh | en" // 语言选择，默认为 "en"
}
```

### 支持的风格类型

- **manga**: 日式漫画风格（黑白配网点，细腻线条）
- **comic**: 美式漫画风格（全彩色，清晰线条）
- **wuxia**: 武侠修仙风格（古风水墨意境，飘逸流畅）
- **healing**: 治愈系动漫风格（温暖柔和色彩，轻快线条）
- **manhwa**: 韩国网络漫画风格（现代感强烈，精致数字绘制）
- **cinematic**: 电影级风格（写实主义，专业光影）
- **shojo**: 少女漫画风格（梦幻唯美，纤细线条）
- **seinen**: 青年漫画风格（写实硬朗，细致光影）
- **chibi**: Q版漫画风格（夸张可爱，圆润线条）
- **fantasy**: 奇幻史诗风格（宏大背景，华丽服饰）

### 提示词模板

#### 中文提示词

```
分析这个故事并提取主要角色、设定和具体场景：

故事："${story}"

风格：${style}

请提供：
1. 这个故事的标题（如果没有明确提到，请创建一个吸引人的、合适的标题）

2. 主要角色列表（最多1-4个，根据故事复杂性选择）包含：
   - 姓名
   - 外貌描述（年龄、体型、头发、服装、显著特征）
   - 性格特征
   - 在故事中的角色

3. 全局设定描述（时代背景、大致地点、整体氛围）

4. 具体场景列表（2-8个场景，根据故事需要）每个场景包含：
   - 场景名称
   - 具体位置
   - 场景描述
   - 一天中的时间
   - 场景氛围
   - 关键视觉元素

请用中文回答所有内容。确保角色描述详细且适合${style}风格的视觉表现。
```

#### 英文提示词

```
Analyze this story and extract the main characters, setting, and specific scenes:

Story: "${story}"

Style: ${style}

Please provide:
1. A title for this story (create a catchy, appropriate title if one isn't explicitly mentioned)

2. A list of main characters (1-4 maximum, choose based on story complexity) with:
   - Name
   - Physical description (age, build, hair, clothing, distinctive features)
   - Personality traits
   - Role in the story

3. Global setting description (time period, general location, overall mood)

4. Specific scenes list (2-8 scenes based on story needs) each containing:
   - Scene name
   - Specific location
   - Scene description
   - Time of day
   - Scene mood
   - Key visual elements

Focus on identifying distinct locations where story events occur to ensure visual consistency across panels.
Provide all content in English and ensure character descriptions are detailed and suitable for ${style} style visual representation.
```

### 输出格式

```json
{
  "success": true,
  "analysis": {
    "title": "故事标题",
    "characters": [
      {
        "name": "角色名称",
        "physicalDescription": "外貌描述",
        "personality": "性格特征",
        "role": "在故事中的角色"
      }
    ],
    "setting": {
      "timePeriod": "时间背景",
      "location": "地点",
      "mood": "氛围"
    }
  },
  "wordCount": 123
}
```

### 限制

- 故事最大500词
- 最多提取4个主要角色
- 使用Gemini 2.5 Flash模型
- 结构化JSON输出

---

## 2. 故事分解 (Story Chunking)

### API端点

`POST /api/chunk-story`

### 功能

将故事分解为2-50个漫画面板，每个面板包含详细的视觉描述，支持场景一致性和风格特定的布局指导。

### 输入参数

```json
{
  "story": "故事文本",
  "characters": [角色数组],
  "setting": {
    "location": "全局位置",
    "timePeriod": "时代背景",
    "mood": "整体氛围"
  },
  "scenes": [
    {
      "id": "scene1",
      "name": "场景名称",
      "description": "场景描述",
      "location": "具体位置",
      "timeOfDay": "时间",
      "mood": "氛围",
      "visualElements": ["视觉元素1", "视觉元素2"]
    }
  ],
  "style": "manga | comic | wuxia | healing | manhwa | cinematic | shojo | seinen | chibi | fantasy",
  "language": "zh | en"
}
```

### 风格特定的布局指导

每种风格都有专门的面板布局指导：

#### Manga 风格

- 动态面板形状和尺寸
- 戏剧性时刻的垂直强调
- 运动的动作线和运动模糊
- 情感节拍的特写
- 建立场景的远景
- 戏剧性角度和透视

#### Comic 风格

- 一致边框的矩形面板
- 宽建立镜头
- 对话的中景
- 戏剧性时刻的特写
- 清洁、结构化的构图
- 大胆、清晰的视觉叙事

#### Wuxia 风格

- 跟随自然元素的流动、有机面板形状
- 飞行和上升场景的垂直面板
- 冥想和精神时刻的圆形或弯曲面板
- 山水和自然场景的宽景观面板
- 带有空灵光效的特写
- 传统卷轴式构图
- 强调运动和能量流动

#### 其他风格

- **Healing**: 柔和圆润的面板边框，温馨舒适的构图
- **Manhwa**: 现代矩形面板，垂直滚动友好的布局
- **Cinematic**: 电影般的宽高比（16:9, 2.35:1），专业摄影角度
- **Shojo**: 高瘦面板，装饰性边框（蕾丝、花朵、闪光）
- **Seinen**: 现实比例和结构化面板，重阴影和对比
- **Chibi**: 小圆润面板，夸张表情，游戏化布局
- **Fantasy**: 大型全景面板，垂直面板用于高塔/森林，强调规模和宏伟

### 提示词模板

#### 中文提示词

```
将这个故事分解为单独的漫画面板，并提供详细描述。

故事："${story}"
角色：${characterNames}
全局设定：${setting.location}，${setting.timePeriod}，氛围：${setting.mood}

可用场景：
${sceneInfo}

风格：${style}

${layoutGuidance}

根据故事的复杂性和节奏需要创建2-50个面板。选择最佳的面板数量来有效地讲述这个故事 - 简单的故事可能需要较少的面板（2-8个），而复杂的叙述可能需要更多（10-50个）。对于很长的故事，将其分解为逻辑段落并创建详细的面板序列。

重要：对于每个面板，您必须通过其ID（scene1、scene2等）引用可用场景之一，以确保视觉一致性。根据故事中动作发生的地点选择最合适的场景。

对于每个面板，请描述：
- 出现的角色
- 场景ID（必须匹配上述可用场景之一）
- 动作/场景描述（应与引用的场景一致）
- 对话（如果有）
- 镜头角度（特写、中景、远景等）
- 视觉氛围/气氛（应与场景的氛围相辅相成）

请用中文描述所有内容，并返回具有连续面板编号的平面面板数组。
```

#### 英文提示词

```
Break down this story into individual comic panels with detailed descriptions.

Story: "${story}"
Characters: ${characterNames}
Global Setting: ${setting.location}, ${setting.timePeriod}, ${setting.mood}

Available Scenes:
${sceneInfo}

Style: ${style}

${layoutGuidance}

Create 2-50 panels based on the story's complexity and pacing needs. Choose the optimal number of panels to tell this story effectively - simple stories may need fewer panels (2-8), while complex narratives may require more (10-50). For very long stories, break them into logical segments and create detailed panel sequences.

IMPORTANT: For each panel, you MUST reference one of the available scenes by its ID (scene1, scene2, etc.) to ensure visual consistency. Choose the most appropriate scene based on where the action takes place in the story.

For each panel, describe:
- Characters present
- Scene ID (must match one of the available scenes above)
- Action/scene description (should be consistent with the referenced scene)
- Dialogue (if any)
- Camera angle (close-up, medium shot, wide shot, etc.)
- Visual mood/atmosphere (should complement the scene's mood)

Provide all content in English and return as a flat array of panels with sequential panel numbers.
```

### 布局指导 (Layout Guidance)

#### Manga风格

```
Manga panel guidelines:
- Dynamic panel shapes and sizes
- Vertical emphasis for dramatic moments
- Action lines and motion blur for movement
- Close-ups for emotional beats
- Wide shots for establishing scenes
- Dramatic angles and perspectives
```

#### American Comic风格

```
American comic panel guidelines:
- Rectangular panels with consistent borders
- Wide establishing shots
- Medium shots for dialogue
- Close-ups for dramatic moments
- Clean, structured compositions
- Bold, clear visual storytelling
```

#### Wuxia风格

```
Wuxia cultivation panel guidelines:
- Flowing, organic panel shapes that follow natural elements
- Vertical panels for flying and ascending scenes
- Circular or curved panels for meditation and spiritual moments
- Wide landscape panels for mountain and nature scenes
- Close-ups with ethereal lighting effects
- Traditional scroll-like compositions
- Emphasis on movement and energy flow
```

#### Healing风格

```
Healing anime panel guidelines:
- Soft, rounded panel borders
- Warm, cozy framing for intimate moments
- Small panels for detailed emotional expressions
- Wide panels for peaceful daily life scenes
- Gentle transitions between panels
- Focus on character interactions and emotions
- Comfortable, non-threatening compositions
```

#### Manhwa风格

```
Korean manhwa panel guidelines:
- Clean, modern rectangular panels
- Vertical scrolling-friendly layouts
- Wide panels for urban landscapes
- Medium shots for character interactions
- Close-ups with detailed facial expressions
- Contemporary, stylish compositions
- Digital-native panel arrangements
```

#### Cinematic风格

```
Cinematic panel guidelines:
- Film-like aspect ratios (16:9, 2.35:1)
- Professional camera angles and shots
- Establishing shots, medium shots, close-ups sequence
- Dramatic lighting and composition
- Depth of field effects in panel design
- Movie storyboard-style layouts
- Professional cinematography principles
```

#### Shojo风格

```
Shojo manga panel guidelines:
- Tall, slender panels for elegant flow
- Decorative panel borders (lace, flowers, sparkles)
- Focus on close-ups of eyes and expressions
- Diagonal or floating layouts for romance
- Emphasis on emotional atmosphere over action
- Light, airy compositions with layered tones
```

#### Seinen风格

```
Seinen manga panel guidelines:
- Realistic proportions and structured panels
- Heavy shading and contrast
- Wide shots for urban/realistic settings
- Cinematic close-ups for psychological intensity
- Panel pacing reflects tension and realism
- Mature, grounded compositions
```

#### Chibi风格

```
Chibi panel guidelines:
- Small, rounded panels
- Exaggerated facial expressions and actions
- Minimalistic backgrounds
- Bold sound effects and motion cues
- Playful panel layouts (heart shapes, bubbles)
- Comedic timing in panel sequence
```

#### Fantasy风格

```
Fantasy epic panel guidelines:
- Large, sweeping landscape panels
- Vertical panels for towering castles/forests
- Dynamic diagonal layouts for battles
- Glow and aura effects in panel design
- Emphasis on scale and grandeur
- Heroic and mythical framing
```

### 输出格式

```json
{
  "success": true,
  "storyBreakdown": {
    "panels": [
      {
        "panelNumber": 1,
        "characters": ["角色名称"],
        "sceneDescription": "场景描述",
        "dialogue": "对话内容",
        "cameraAngle": "镜头角度",
        "visualMood": "视觉氛围"
      }
    ]
  }
}
```

### 特性

- 使用thinkingBudget: 8192给模型更多思考时间
- 根据故事复杂度动态调整面板数量
- 支持不同风格的布局指导

---

## 3. 角色参考生成 (Character Reference Generation)

### API端点

`POST /api/generate-character-refs`

### 功能

为每个角色生成参考图像，用于保持后续面板中的角色一致性。

### 输入参数

```json
{
  "characters": [角色数组],
  "setting": {设定对象},
  "style": "manga | comic | wuxia | healing | manhwa | cinematic | shojo | seinen | chibi | fantasy",
  "uploadedCharacterReferences": [用户上传的参考图片]
}
```

### 提示词模板

```
Character reference sheet in ${stylePrefix}. 

Full body character design showing front view of ${character.name}:
- Physical appearance: ${character.physicalDescription}
- Personality: ${character.personality}
- Role: ${character.role}
- Setting context: ${setting.timePeriod}, ${setting.location}

[如果有匹配的上传参考图片]
IMPORTANT: Use the provided reference images as inspiration for this character's design. The reference images show visual elements that should be incorporated while adapting them to the ${stylePrefix} aesthetic. Maintain the essence and key visual features shown in the references.

[如果有其他参考图片]
Note: Reference images are provided, but use them as general style inspiration for this character design.

The character should be drawn in a neutral pose against a plain background, showing their full design clearly for reference purposes. This is a character reference sheet that will be used to maintain consistency across multiple comic panels.
```

### 风格前缀 (Style Prefix)

#### Manga风格

```
Japanese manga style, black and white, detailed character design with clean line art and screentones, English text only
```

#### Comic风格

```
American comic book style, colorful superhero art with bold colors and clean line art
```

#### Wuxia风格

```
Chinese wuxia cultivation style, ancient costume, flowing long hair, immortal bearing, spiritual aura, traditional Chinese painting style, English annotations
```

#### Healing风格

```
Healing Japanese anime style, cute character design, warm colors, soft lines, friendly expressions, English annotations
```

#### Manhwa风格

```
Korean webtoon style, fashionable modern character design, refined facial features, urban style clothing, digital painting techniques, English annotations
```

#### Cinematic风格

```
Cinematic photorealistic style, realistic character modeling, professional lighting, cinematic texture, rich details, English annotations
```

### 输出格式

```json
{
  "success": true,
  "characterReferences": [
    {
      "name": "角色名称",
      "image": "data:image/jpeg;base64,...", // base64图像数据
      "description": "角色描述"
    }
  ]
}
```

### 特性

- 使用Gemini 2.5 Flash Image Preview模型
- 支持用户上传的参考图片
- 智能匹配角色名称与上传图片
- 生成全身角色设计图

---

## 4. 图像重绘 (Image Redraw)

### API端点

`POST /api/redraw-image`

### 功能

重新生成已有的面板或角色图像，支持修改提示词、风格、参考图片等参数，保持视觉一致性。

### 输入参数

```json
{
  "imageType": "panel | character",
  "imageId": "图像ID",
  "originalPrompt": "原始提示词",
  "newPrompt": "新提示词（可选）",
  "style": "漫画风格",
  "language": "zh | en",
  "referenceImages": ["参考图片数组"],
  "imageSize": "图像尺寸配置"
}
```

### 关键特性

#### 风格一致性保护

- 使用 `promptPrefix` 而不是 `panelPrompt` 确保风格准确性
- 避免"创建一个漫画面板"导致的黑白色偏见
- 改用"创建一个图像"保持风格中性

#### 对话清理机制

- 自动清理提示词中的角色名字，防止文字出现在图像中
- 支持多种对话格式的清理：
  - `角色名: "对话内容"` → `"对话内容"`
  - `Dialogue: "角色名: '对话内容'"` → `Dialogue: "对话内容"`
  - 中文冒号格式：`角色名：'对话内容'` → `"对话内容"`

#### 动态角色匹配

- 根据面板内容自动选择正确的角色参考图片
- 支持用户手动选择角色参考
- 前端自动预选相关角色参考

### 提示词构建逻辑

#### Panel 类型重绘

```javascript
// 中文版本
const panelInstructions = language === 'zh'
  ? `创建一个图像，风格：${stylePrefix}。

面板详情：${finalPrompt}

重要：使用提供的角色参考图片保持视觉一致性。每个角色都应该与参考图片中的外观完全匹配。`

// 英文版本
  : `Create an image in ${stylePrefix}.

Panel Details: ${finalPrompt}

IMPORTANT: Use the provided character reference images to maintain visual consistency. Each character should match their appearance from the reference images exactly.`;
```

#### Character 类型重绘

```javascript
// 直接使用风格前缀和清理后的提示词
finalPrompt = `Character reference sheet: ${stylePrefix}. ${cleanedPrompt}`;
```

### 错误处理

- 支持多AI模型自动切换
- 详细的调试日志记录
- 超时控制和重试机制
- 图像格式验证和转换

---

## 5. 漫画面板生成 (Panel Generation)

### API端点

`POST /api/generate-panel`

### 功能

生成单个漫画面板，支持多种AI模型和语言。

### 输入参数

```json
{
  "panel": {面板对象},
  "characterReferences": [角色参考数组],
  "setting": {设定对象},
  "style": "manga | comic | wuxia | healing | manhwa | cinematic | shojo | seinen | chibi | fantasy",
  "uploadedSettingReferences": [场景参考图片],
  "language": "en | zh",
  "aiModel": "auto | nanobanana | volcengine"
}
```

### 基础提示词模板

```
Create a single comic panel in ${stylePrefix}.

Setting: ${setting.location}, ${setting.timePeriod}, mood: ${setting.mood}

Panel Details:
Panel ${panel.panelNumber}: ${panel.cameraAngle} shot of ${charactersInPanel}. Scene: ${panel.sceneDescription}. ${panel.dialogue ? `Dialogue: "${panel.dialogue}"` : "No dialogue."}. Mood: ${panel.visualMood}.

IMPORTANT: Use the character reference images provided to maintain visual consistency. Each character should match their appearance from the reference images exactly.

[如果有场景参考图片]
IMPORTANT: Use the provided setting/environment reference images to guide the visual style, atmosphere, and environmental details of this panel. Incorporate the visual elements, lighting, and mood shown in the setting references while adapting them to the ${stylePrefix} aesthetic.

The panel should include:
- Clear panel border
- Speech bubbles with dialogue text (if any) - IMPORTANT: If dialogue includes character attribution like "Character: 'text'", only put the spoken text in the speech bubble, NOT the character name
- Thought bubbles if needed
- Sound effects where appropriate
- Consistent character designs matching the references

Generate a single comic panel image with proper framing and composition.
```

### 风格前缀 (Style Prefix)

#### 中文 + Manga

```
日式漫画风格（黑白配网点），使用中文文字和对话框，保持角色外观一致性，细腻的线条艺术，经典的网点阴影技法，动态的分镜构图
```

#### 英文 + Manga

```
Japanese manga style (black and white with screentones), using English text and speech bubbles, maintain character appearance consistency, detailed line art, classic screentone shading techniques, dynamic panel composition
```

#### 中文 + Comic

```
美式漫画风格，全彩色，清晰线条艺术，使用中文文字和对话框，保持角色外观一致性，鲜艳的色彩，戏剧性的光影效果，英雄主义构图
```

#### 英文 + Comic

```
American comic book style, full color, clean line art, using English text and speech bubbles, maintain character appearance consistency, vibrant colors, dramatic lighting effects, heroic composition
```

#### 中文 + Wuxia

```
中国武侠修仙风格，古风水墨意境，飘逸的服饰，仙气缭绕，山水背景，使用中文文字和对话框，保持角色外观一致性，传统中国画技法，意境深远的构图，灵气氛围
```

#### 英文 + Wuxia

```
Chinese wuxia cultivation style, ancient ink painting atmosphere, flowing robes, ethereal aura, landscape backgrounds, using English text and speech bubbles, maintain character appearance consistency, traditional Chinese painting techniques, profound artistic composition, spiritual atmosphere
```

#### 中文 + Healing

```
治愈系日本动漫风格，温暖柔和的色彩，可爱的角色设计，使用中文文字和对话框，保持角色外观一致性，柔和的光线，温馨的氛围，细腻的情感表达，日常生活场景
```

#### 英文 + Healing

```
Healing Japanese anime style, warm and soft colors, cute character design, using English text and speech bubbles, maintain character appearance consistency, soft lighting, cozy atmosphere, delicate emotional expression, daily life scenes
```

#### 中文 + Manhwa

```
韩国网络漫画风格，现代都市背景，时尚的角色设计，使用中文文字和对话框，保持角色外观一致性，精致的数字绘画技法，现代感强烈，都市生活场景，流行文化元素
```

#### 英文 + Manhwa

```
Korean webtoon style, modern urban background, fashionable character design, using English text and speech bubbles, maintain character appearance consistency, refined digital painting techniques, strong modern feel, urban life scenes, pop culture elements
```

#### 中文 + Cinematic

```
电影级视觉风格，写实主义，电影摄影构图，使用中文文字和对话框，保持角色外观一致性，专业的光影效果，景深控制，电影级色彩分级，戏剧性的视角
```

#### 英文 + Cinematic

```
Cinematic visual style, photorealism, cinematographic composition, using English text and speech bubbles, maintain character appearance consistency, professional lighting effects, depth of field control, cinematic color grading, dramatic perspectives
```

### 输出格式

```json
{
  "success": true,
  "generatedPanel": {
    "panelNumber": 1,
    "image": "图像数据或URL",
    "modelUsed": "使用的AI模型"
  }
}
```

---

## 6. 风格配置系统 (Style Configuration)

### 风格配置文件

位置：`src/lib/styleConfig.ts`

### 支持的10种风格

#### 1. Manga (日式漫画)

```typescript
manga: {
  name: "日式漫画",
  description: "传统日本漫画风格，黑白配网点",
  promptPrefix: {
    zh: "日式漫画风格，黑白配网点，细腻线条，经典网点阴影，动态分镜构图",
    en: "Japanese manga style, black and white with screentones, detailed line art, classic screentone shading, dynamic panel composition"
  }
}
```

#### 2. Comic (美式漫画)

```typescript
comic: {
  name: "美式漫画",
  description: "美式超级英雄漫画风格，全彩色",
  promptPrefix: {
    zh: "美式漫画风格，全彩色，清晰线条，鲜艳色彩，戏剧性光影，英雄主义构图",
    en: "American comic book style, full color, clean line art, vibrant colors, dramatic lighting, heroic composition"
  }
}
```

#### 3. Wuxia (武侠修仙)

```typescript
wuxia: {
  name: "武侠修仙",
  description: "中国武侠修仙风格，古风意境",
  promptPrefix: {
    zh: "中国武侠修仙画风，古风水墨意境，飘逸流畅线条，写意构图，灵动氛围",
    en: "Chinese wuxia painting style, ancient ink aesthetics, flowing expressive lines, poetic composition, ethereal atmosphere"
  }
}
```

#### 4. Healing (治愈系日漫)

```typescript
healing: {
  name: "治愈系日漫",
  description: "温暖治愈的日本动漫风格",
  promptPrefix: {
    zh: "治愈系动漫画风，温暖柔和色彩，轻快线条，柔和光影，温馨氛围",
    en: "Healing anime style, warm soft colors, gentle lines, soft lighting, cozy atmosphere"
  }
}
```

#### 5. Manhwa (韩漫风格)

```typescript
manhwa: {
  name: "韩漫风格",
  description: "韩国网络漫画风格，现代都市",
  promptPrefix: {
    zh: "韩国网络漫画画风，现代感强烈，精致数字绘制，时尚色彩搭配，流畅构图",
    en: "Korean webtoon style, strong modern aesthetic, refined digital painting, stylish color palette, smooth composition"
  }
}
```

#### 6. Cinematic (电影风格)

```typescript
cinematic: {
  name: "电影风格",
  description: "电影级视觉效果，写实风格",
  promptPrefix: {
    zh: "电影级画风，写实主义，电影摄影构图，专业光影，景深控制，电影级色彩分级",
    en: "Cinematic style, photorealism, cinematographic composition, professional lighting, depth of field, cinematic color grading"
  }
}
```

#### 7. Shojo (少女漫画)

```typescript
shojo: {
  name: "少女漫画",
  description: "梦幻唯美的少女漫画风格",
  promptPrefix: {
    zh: "少女漫画风格，梦幻唯美，纤细线条，浪漫氛围，花瓣星光点缀，柔和色调，情感细腻",
    en: "Shojo manga style, dreamy and romantic, delicate line art, romantic atmosphere, decorative elements like petals/stars, soft tones, emotional delicacy"
  }
}
```

#### 8. Seinen (青年漫画)

```typescript
seinen: {
  name: "青年漫画",
  description: "写实硬朗的青年向漫画风格",
  promptPrefix: {
    zh: "青年漫画风格，写实硬朗，细致线条光影，成熟主题，复杂场景，强烈氛围张力",
    en: "Seinen manga style, realistic and gritty, detailed linework and shading, mature themes, complex settings, strong atmospheric tension"
  }
}
```

#### 9. Chibi (Q版漫画)

```typescript
chibi: {
  name: "Q版漫画",
  description: "夸张可爱的Q版超变形风格",
  promptPrefix: {
    zh: "Q版漫画风格，夸张可爱，圆润线条，表情夸张，卡通感强烈，轻松幽默氛围",
    en: "Chibi comic style, exaggeratedly cute, rounded line art, over-expressive faces, strong cartoonish feel, light and humorous tone"
  }
}
```

#### 10. Fantasy (奇幻史诗)

```typescript
fantasy: {
  name: "奇幻史诗",
  description: "宏大背景的奇幻史诗风格",
  promptPrefix: {
    zh: "奇幻史诗风格，宏大背景设定，华丽服饰道具，史诗感构图，神秘光影，魔法元素点缀",
    en: "Fantasy epic style, grand backgrounds, elaborate costumes and props, epic compositions, mystical lighting, magical elements"
  }
}
```

### 风格应用函数

```typescript
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
```

### 关键改进

#### 风格一致性

- 统一的 `promptPrefix` 配置，避免风格冲突
- 重绘时使用 `prefix` 而不是 `panel` 类型，防止黑白色偏见
- 所有风格都有完整的中英文配置

#### 语言本地化

- 每种风格都有中文和英文版本的提示词
- 根据用户语言自动选择对应的风格描述
- 保持风格特色的同时适应不同语言的表达习惯

---

## 7. AI模型选择逻辑

### 支持的模型

- `auto`: 自动选择（基于语言）
- `nanobanana`: Google Gemini 2.5 Flash Image Preview
- `volcengine`: VolcEngine Doubao Seedream 4.0

### 自动选择规则

```javascript
function selectAIModel(language, userPreference) {
  // 用户明确选择时优先使用用户选择
  if (userPreference && userPreference !== "auto") {
    return userPreference;
  }
  
  // 基于语言的自动选择
  if (language === "zh") {
    return "volcengine"; // 中文支持更好
  } else {
    return "nanobanana"; // 英文支持更好
  }
}
```

### 语言检测

```javascript
function detectLanguage(text) {
  const chineseRegex = /[\u4e00-\u9fff]/;
  const chineseMatches = text.match(chineseRegex);
  
  if (chineseMatches && chineseMatches.length > 0) {
    const chineseRatio = chineseMatches.length / text.length;
    return chineseRatio > 0.1 ? "zh" : "en";
  }
  
  return "en";
}
```

### NanoBanana (Gemini) 增强提示词

#### 中文

```
漫画风格插画：${prompt}。风格要求：清晰的线条艺术，动态构图，富有表现力的角色，清晰的视觉叙事。使用中文文字和对话框。重点突出戏剧性角度和典型的漫画视觉效果。
```

#### 英文

```
Manga style illustration: ${prompt}. Style requirements: Clean line art, dynamic composition, expressive characters, clear visual storytelling. Use English text and speech bubbles. Focus on dramatic angles and typical manga visual effects.
```

### VolcEngine 增强提示词

#### 中文

```
漫画风格插画：${prompt}。风格要求：一致的美式漫画风格，全彩色，清晰的线条艺术，动态构图，富有表现力的角色，清晰的视觉叙事。使用中文文字和对话框。保持角色外观一致性。重点突出戏剧性角度和典型的漫画视觉效果。
```

#### 英文

```
Comic book style illustration: ${prompt}. Style requirements: Consistent American comic book style, full color, clean line art, dynamic composition, expressive characters, clear visual storytelling. Use English text and speech bubbles. Maintain character appearance consistency. Focus on dramatic angles and typical comic visual effects.
```

### 参考图片处理

- 最多支持4张参考图片
- 角色参考图片优先（最多2张）
- 场景参考图片补充（剩余槽位）
- 自动转换base64格式
- 支持CORS代理处理

### 错误处理和回退

- 主模型失败时自动尝试备用模型
- 详细的错误日志记录
- 支持内容安全过滤检测
- 图像格式验证（URL、base64、代理URL）

---

## 8. 语言本地化系统

### 支持的语言

- **中文 (zh)**: 完整的中文提示词和界面
- **英文 (en)**: 完整的英文提示词和界面

### 语言检测和切换

#### 自动语言检测

```javascript
// 基于浏览器语言自动检测
const detectLanguage = () => {
  const browserLang = navigator.language || navigator.languages[0];
  return browserLang.startsWith('zh') ? 'zh' : 'en';
};
```

#### 手动语言切换

- 界面右上角的语言切换器
- 实时切换界面语言
- 保存用户语言偏好到 localStorage

### 提示词本地化

#### 故事分析提示词

```javascript
const prompt = language === 'zh' ? `
分析这个故事并提取主要角色、设定和具体场景：
故事："${story}"
风格：${style}
请提供：...
请用中文回答所有内容。
` : `
Analyze this story and extract the main characters, setting, and specific scenes:
Story: "${story}"
Style: ${style}
Please provide:...
Provide all content in English.
`;
```

#### 面板生成提示词

```javascript
const promptStart = language === 'zh'
  ? `创建一个图像，风格：${stylePrefix}。
全局设定：${setting.location}，${setting.timePeriod}，氛围：${setting.mood}`
  : `Create an image in ${stylePrefix}.
Global Setting: ${setting.location}, ${setting.timePeriod}, mood: ${setting.mood}`;
```

#### 角色生成提示词

```javascript
const prompt = `Character reference sheet: ${stylePrefix}. Create a character design for ${character.name}. Focus on: ${character.physicalDescription}. Character personality: ${character.personality}. Role: ${character.role}. ${settingDescription} Full body character reference sheet with multiple angles and expressions.`;
```

### 风格本地化

每种风格都有对应的中英文描述：

```typescript
export const STYLE_CONFIGS: Record<ComicStyle, StyleConfig> = {
  manga: {
    promptPrefix: {
      zh: "日式漫画风格，黑白配网点，细腻线条，经典网点阴影，动态分镜构图",
      en: "Japanese manga style, black and white with screentones, detailed line art, classic screentone shading, dynamic panel composition"
    }
  }
  // ... 其他风格
};
```

### AI 生成内容本地化

#### 结构化输出语言控制

- 使用 JSON Schema 确保输出结构一致
- 通过提示词指定输出语言
- 自动验证生成内容的语言正确性

#### 对话和文本处理

- 根据用户语言生成对应语言的对话
- 自动清理对话中的角色名字
- 支持中英文标点符号的正确处理

### 界面本地化

#### React i18next 集成

```javascript
import { useTranslation } from 'react-i18next';

const { t, i18n } = useTranslation();

// 使用翻译
<button>{t('generate_panel')}</button>

// 切换语言
i18n.changeLanguage(newLanguage);
```

#### 动态内容本地化

- 错误消息本地化
- 状态提示本地化
- 用户反馈本地化

### 技术实现

#### 语言参数传递

```javascript
// API 调用时传递语言参数
const response = await fetch('/api/generate-panel', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ...panelData,
    language: currentLanguage
  })
});
```

#### 提示词动态构建

```javascript
// 根据语言动态选择提示词模板
const getPromptTemplate = (language: 'zh' | 'en', type: string) => {
  return language === 'zh' ? chineseTemplates[type] : englishTemplates[type];
};
```

### 质量保证

#### 语言一致性检查

- 确保所有 API 端点都支持语言参数
- 验证生成内容与请求语言匹配
- 自动测试不同语言的提示词效果

#### 文化适应性

- 中文用户获得符合中文表达习惯的内容
- 英文用户获得地道的英文表达
- 风格描述适应不同文化背景

---

## 总结

Story to Manga Enhanced 使用了多层次的AI提示词系统：

1. **故事分析**：提取结构化的角色、设定和场景信息，支持重试机制和备用方案
2. **故事分解**：智能分割为最优数量的面板（2-50个），支持场景一致性
3. **角色生成**：创建一致性参考图像，支持用户上传参考，动态角色匹配
4. **面板生成**：结合所有信息生成最终漫画面板，支持10种风格
5. **图像重绘**：重新生成已有图片，保持风格一致性，支持参数修改
6. **批量生成**：高效的批量面板生成，优化大型项目性能
7. **语言本地化**：完整的中英文双语支持系统
8. **风格配置**：统一的风格管理和提示词系统

### 核心特性

- **10种漫画风格**：manga、comic、wuxia、healing、manhwa、cinematic、shojo、seinen、chibi、fantasy
- **完整双语支持**：中英文界面和AI生成内容完全本地化
- **多AI模型支持**：Google Gemini 2.5 Flash、VolcEngine Doubao Seedream 4.0
- **智能网络容错**：重试机制、超时控制、自动模型切换
- **灵活图片尺寸**：6种预设尺寸，支持VolcEngine的1K/2K/4K配置
- **高级参考图片**：支持角色和场景参考图片上传，动态匹配
- **高效分页显示**：20个面板一页，优化大型项目性能
- **智能图片优化**：自动压缩和格式优化
- **场景一致性**：基于场景ID的视觉连贯性保证
- **角色一致性**：动态角色参考匹配，确保角色外观统一

### 技术亮点

- **高级提示词工程**：精心设计的多层次、多语言提示词系统
- **风格一致性保护**：统一的风格配置，防止风格冲突和偏见
- **智能错误处理**：完善的重试机制、自动模型切换、错误恢复
- **性能优化**：批量生成、分页显示、图片缓存、智能预加载
- **用户体验**：直观的界面、实时进度、多语言支持、错误提示
- **角色一致性**：动态角色参考匹配，确保视觉连贯性
- **场景管理**：基于场景ID的环境一致性保证
- **语言本地化**：完整的中英文双语系统，包括AI生成内容
- **对话清理**：智能清理提示词中的角色名字，防止文字干扰
- **类型安全**：完整的TypeScript类型定义，生产就绪

### v2.2.1 版本特性

- **生产就绪**：解决所有TypeScript构建错误，支持无缝部署
- **类型安全**：增强的类型安全性，防止运行时错误
- **优化构建**：主路由优化到116kB，完整构建237kB First Load JS
- **错误边界**：健壮的错误处理和优雅降级机制
- **GitHub集成**：正确的仓库链接和Issue报告系统

系统通过详细的提示词工程、多模型支持和完整的本地化，确保生成质量和一致性，为用户提供专业级的漫画创作体验。现在已完全生产就绪，可以部署到任何生产环境。

---

## 6. 技术实现细节

### 面板数量限制

当前系统在故事分解阶段设置了2-15个面板的限制：

```javascript
// 在 /api/chunk-story 中
Create 2-15 panels based on the story's complexity and pacing needs.
Choose the optimal number of panels to tell this story effectively -
simple stories may need fewer panels (2-6),
while complex narratives may require more (8-12).
```

**如需生成更多面板，可以修改此限制：**

1. 调整提示词中的数量范围
2. 考虑API响应时间和模型处理能力
3. 实现分批生成机制

### 继续生成和角色一致性

#### 当前实现

- 每次生成都使用角色参考图片确保一致性
- 通过`characterReferences`数组传递角色设计
- 支持最多4张参考图片（角色+场景）

#### 扩展建议

```javascript
// 实现继续生成功能的建议结构
{
  "continueFrom": {
    "lastPanelNumber": 15,
    "characterStates": [
      {
        "name": "角色名",
        "lastAppearance": "最后出现的面板描述",
        "currentState": "当前状态描述"
      }
    ],
    "storyContext": "前面故事的总结"
  },
  "newStorySegment": "要继续的故事内容"
}
```

### JSON Schema 配置

#### 故事分析 Schema

```javascript
responseSchema: {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          physicalDescription: { type: Type.STRING },
          personality: { type: Type.STRING },
          role: { type: Type.STRING }
        },
        propertyOrdering: ["name", "physicalDescription", "personality", "role"]
      }
    },
    setting: {
      type: Type.OBJECT,
      properties: {
        timePeriod: { type: Type.STRING },
        location: { type: Type.STRING },
        mood: { type: Type.STRING }
      },
      propertyOrdering: ["timePeriod", "location", "mood"]
    }
  },
  propertyOrdering: ["title", "characters", "setting"]
}
```

#### 故事分解 Schema

```javascript
responseSchema: {
  type: Type.OBJECT,
  properties: {
    panels: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          panelNumber: { type: Type.NUMBER },
          characters: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          sceneDescription: { type: Type.STRING },
          dialogue: { type: Type.STRING },
          cameraAngle: { type: Type.STRING },
          visualMood: { type: Type.STRING }
        },
        propertyOrdering: [
          "panelNumber", "characters", "sceneDescription",
          "dialogue", "cameraAngle", "visualMood"
        ]
      }
    }
  },
  propertyOrdering: ["panels"]
}
```

### 模型配置参数

#### Gemini 配置

```javascript
// 故事分解使用思考预算
config: {
  thinkingConfig: {
    thinkingBudget: 8192 // 给模型更多思考时间
  },
  responseMimeType: "application/json",
  responseSchema: {...}
}

// 角色和面板生成
model: "gemini-2.5-flash-image-preview"
```

#### VolcEngine 配置

```javascript
request: {
  prompt: enhancedPrompt,
  image: imageRefs, // 最多4张参考图片
  sequential_image_generation: "auto",
  sequential_image_generation_options: {
    max_images: 1
  },
  response_format: "url",
  size: "2K",
  stream: false,
  watermark: true
}
```

### 图像处理流程

#### 输入图像格式

```javascript
// Base64 格式检测和转换
function prepareImageForGemini(base64Image) {
  const base64Data = base64Image.replace(/^data:image\/[^;]+;base64,/, "");
  return {
    inlineData: {
      data: base64Data,
      mimeType: "image/jpeg"
    }
  };
}
```

#### 输出图像格式

- **NanoBanana**: `data:image/jpeg;base64,{base64数据}`
- **VolcEngine**: `/api/image-proxy?url={编码后的URL}`

#### 图像验证

```javascript
const isValidUrl = imageData.startsWith('http://') || imageData.startsWith('https://');
const isValidBase64 = imageData.startsWith('data:image/') || /^[A-Za-z0-9+/]+=*$/.test(imageData);
const isValidProxyUrl = imageData.startsWith('/api/image-proxy?url=');
```

### 错误处理机制

#### 内容安全过滤

```javascript
if (error.message.includes("PROHIBITED_CONTENT")) {
  return NextResponse.json({
    error: "Content was blocked by safety filters",
    errorType: "PROHIBITED_CONTENT"
  }, { status: 400 });
}
```

#### 模型回退逻辑

```javascript
// 主模型失败时的回退机制
const fallbackModel = selectedModel === "volcengine" ? "nanobanana" : "volcengine";
console.log(`Attempting fallback to ${fallbackModel}`);
```

### 日志记录系统

#### API请求日志

```javascript
logApiRequest(logger, endpoint);
logApiResponse(logger, endpoint, success, duration, metadata);
logError(logger, error, context, additionalData);
```

#### 详细调试信息

```javascript
logger.debug({
  panel_number: panel.panelNumber,
  prompt_length: prompt.length,
  character_refs_attached: characterReferences.length,
  reference_images_count: referenceImages.length,
  language: language,
  ai_model: aiModel
}, "Processing panel generation");
```
