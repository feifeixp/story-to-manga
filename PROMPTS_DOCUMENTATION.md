# Story to Manga Machine - 提示词文档

本文档详细说明了Story to Manga Machine项目中使用的所有AI提示词，包括参数、格式和生成逻辑。

## 目录

1. [故事分析 (Story Analysis)](#1-故事分析-story-analysis)
2. [故事分解 (Story Chunking)](#2-故事分解-story-chunking)
3. [角色参考生成 (Character Reference Generation)](#3-角色参考生成-character-reference-generation)
4. [漫画面板生成 (Panel Generation)](#4-漫画面板生成-panel-generation)
5. [AI模型选择逻辑](#5-ai模型选择逻辑)

---

## 1. 故事分析 (Story Analysis)

### API端点
`POST /api/analyze-story`

### 功能
分析用户输入的故事，提取主要角色和设定信息。

### 输入参数
```json
{
  "story": "用户输入的故事文本",
  "style": "manga | comic | wuxia | healing | manhwa | cinematic | shojo | seinen | chibi | fantasy" // 漫画风格选择
}
```

### 支持的风格类型
- **manga**: 日式漫画风格（黑白配网点）
- **comic**: 美式漫画风格（全彩色）
- **wuxia**: 武侠修仙风格（古风意境）
- **healing**: 治愈系日漫风格（温暖柔和）
- **manhwa**: 韩漫风格（现代都市）
- **cinematic**: 电影风格（写实主义）
- **shojo**: 少女漫画风格（梦幻唯美）
- **seinen**: 青年漫画风格（写实硬朗）
- **chibi**: Q版漫画风格（夸张可爱）
- **fantasy**: 奇幻史诗风格（宏大背景）

### 提示词模板
```
Analyze this story and extract the main characters with their detailed characteristics:

Story: "${story}"

Style: ${style}

Please provide:
1. A title for this story (create a catchy, appropriate title if one isn't explicitly mentioned)

2. A list of main characters (1-4 maximum, choose based on story complexity) with:
   - Name
   - Physical description (age, build, hair, clothing, distinctive features)
   - Personality traits
   - Role in the story

3. Setting description (time period, location, mood)
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
将故事分解为2-15个漫画面板，每个面板包含详细的视觉描述。

### 输入参数
```json
{
  "story": "故事文本",
  "characters": [角色数组],
  "setting": {设定对象},
  "style": "manga | comic | wuxia | healing | manhwa | cinematic | shojo | seinen | chibi | fantasy"
}
```

### 提示词模板
```
Break down this story into individual comic panels with detailed descriptions.

Story: "${story}"
Characters: ${characterNames}
Setting: ${setting.location}, ${setting.timePeriod}, ${setting.mood}
Style: ${style}

${layoutGuidance}

Create 2-15 panels based on the story's complexity and pacing needs. Choose the optimal number of panels to tell this story effectively - simple stories may need fewer panels (2-6), while complex narratives may require more (8-12).

For each panel, describe:
- Characters present
- Action/scene description
- Dialogue (if any)
- Camera angle (close-up, medium shot, wide shot, etc.)
- Visual mood/atmosphere

Return as a flat array of panels with sequential panel numbers.
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

## 4. 漫画面板生成 (Panel Generation)

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

## 5. AI模型选择逻辑

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

## 总结

Story to Manga Machine使用了多层次的AI提示词系统：

1. **故事分析**：提取结构化的角色和设定信息，支持重试机制和备用方案
2. **故事分解**：智能分割为最优数量的面板（2-15个）
3. **角色生成**：创建一致性参考图像，支持用户上传参考
4. **面板生成**：结合所有信息生成最终漫画面板，支持6种风格
5. **重绘功能**：重新生成已有图片，保持风格一致性
6. **图片尺寸**：支持多种预设尺寸，适应不同创作需求

### 核心特性

- **6种漫画风格**：manga、comic、wuxia、healing、manhwa、cinematic
- **中英双语支持**：完整的多语言提示词系统
- **多AI模型**：Gemini 2.5 Flash、VolcEngine Doubao Seedream 4.0
- **网络容错**：重试机制、超时控制、备用方案
- **图片尺寸**：6种预设尺寸，支持VolcEngine的1K/2K/4K配置
- **参考图片**：支持角色和场景参考图片上传
- **分页显示**：20个面板一页，优化大型项目性能
- **图片优化**：自动压缩和格式优化

### 技术亮点

- **提示词工程**：精心设计的多层次提示词系统
- **风格一致性**：统一的风格配置和提示词结构
- **错误处理**：完善的重试机制和错误恢复
- **性能优化**：分页显示、图片缓存、批量生成
- **用户体验**：直观的界面、实时进度、错误提示

系统通过详细的提示词工程和多模型支持，确保生成质量和一致性，为用户提供专业级的漫画创作体验。

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

---

## 7. 优化建议

### 提高面板数量限制
1. **修改故事分解提示词**：将"2-15"改为"2-50"或更高
2. **实现分批处理**：将长故事分成多个段落处理
3. **添加进度跟踪**：显示生成进度给用户

### 实现继续生成功能
1. **保存生成状态**：记录最后生成的面板和角色状态
2. **上下文传递**：在新的生成请求中包含之前的故事上下文
3. **角色状态更新**：根据故事发展更新角色的外观和状态

### 提升角色一致性
1. **增加参考图片数量**：支持更多角色参考图片
2. **角色特征提取**：从生成的面板中提取角色特征用于后续生成
3. **风格一致性检查**：实现生成后的质量检查机制

### 性能优化
1. **并行生成**：同时生成多个面板
2. **缓存机制**：缓存角色参考图片和常用设定
3. **压缩优化**：优化图像大小和传输效率
