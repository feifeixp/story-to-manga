const { GoogleGenAI, Type } = require("@google/genai");

const apiKey = "AIzaSyDkN7ISWA0oen2w2psrJC_CQ4L5fe97JXU";
const genAI = new GoogleGenAI({ apiKey });
const model = "gemini-2.5-flash";

async function testWithSchema() {
    console.log("🔄 Testing with JSON Schema...");
    const startTime = Date.now();
    
    const prompt = `
分析故事并提取关键信息：

故事："小明在公园里遇到了一只迷路的小猫，他决定帮助它找到主人。经过一番寻找，他们终于找到了小猫的家。"
风格：healing

请提供：
1. 标题（简洁有吸引力）
2. 主要角色（1-4个）：姓名、外貌、性格、角色
3. 设定：时代、地点、氛围  
4. 场景（2-6个）：ID、名称、描述、位置、时间、氛围、视觉元素

确保描述适合healing风格的视觉表现。
`;
    
    try {
        const result = await genAI.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
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
                                    role: { type: Type.STRING },
                                },
                            },
                        },
                        setting: {
                            type: Type.OBJECT,
                            properties: {
                                timePeriod: { type: Type.STRING },
                                location: { type: Type.STRING },
                                mood: { type: Type.STRING },
                            },
                        },
                        scenes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    name: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    location: { type: Type.STRING },
                                    timeOfDay: { type: Type.STRING },
                                    mood: { type: Type.STRING },
                                    visualElements: {
                                        type: Type.ARRAY,
                                        items: { type: Type.STRING },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        
        const duration = Date.now() - startTime;
        console.log(`✅ With Schema successful in ${duration}ms`);
        console.log("Response length:", result.text?.length || 0);
        console.log("Response:", result.text?.substring(0, 500) + "...");
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ With Schema failed after ${duration}ms:`, error.message);
    }
}

async function testWithoutSchema() {
    console.log("\n🔄 Testing without JSON Schema...");
    const startTime = Date.now();
    
    const prompt = `
分析故事并提取关键信息：

故事："小明在公园里遇到了一只迷路的小猫，他决定帮助它找到主人。经过一番寻找，他们终于找到了小猫的家。"
风格：healing

请提供JSON格式的分析结果，包含：
1. 标题（简洁有吸引力）
2. 主要角色（1-4个）：姓名、外貌、性格、角色
3. 设定：时代、地点、氛围  
4. 场景（2-6个）：ID、名称、描述、位置、时间、氛围、视觉元素

确保描述适合healing风格的视觉表现。
`;
    
    try {
        const result = await genAI.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            },
        });
        
        const duration = Date.now() - startTime;
        console.log(`✅ Without Schema successful in ${duration}ms`);
        console.log("Response length:", result.text?.length || 0);
        console.log("Response:", result.text?.substring(0, 500) + "...");
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ Without Schema failed after ${duration}ms:`, error.message);
    }
}

async function runTests() {
    await testWithSchema();
    await testWithoutSchema();
}

runTests();
