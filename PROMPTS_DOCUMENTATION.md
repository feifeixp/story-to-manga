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
  "style": "manga | comic" // 漫画风格选择
}
```

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
  "style": "manga | comic"
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
  "style": "manga | comic",
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
  "style": "manga | comic",
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
日式漫画风格（黑白配网点），使用中文文字和对话框，保持角色外观一致性
```

#### 英文 + Manga
```
Japanese manga visual style (black and white with screentones), use English text and speech bubbles, maintain character appearance consistency
```

#### 中文 + Comic
```
美式漫画风格，全彩色，清晰线条艺术，使用中文文字和对话框，保持角色外观一致性
```

#### 英文 + Comic
```
American comic book style, full color, clean line art, use English text and speech bubbles, maintain character appearance consistency
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

1. **故事分析**：提取结构化的角色和设定信息
2. **故事分解**：智能分割为最优数量的面板
3. **角色生成**：创建一致性参考图像
4. **面板生成**：结合所有信息生成最终漫画面板

系统支持中英双语、多种AI模型、用户上传参考图片，并通过详细的提示词工程确保生成质量和一致性。

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
