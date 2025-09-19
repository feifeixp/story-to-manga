const { GoogleGenAI, Type } = require("@google/genai");

const apiKey = "AIzaSyDkN7ISWA0oen2w2psrJC_CQ4L5fe97JXU";
const genAI = new GoogleGenAI({ apiKey });
const model = "gemini-2.5-flash";

async function testGeminiAPI() {
    console.log("🔄 Testing Gemini API connection...");
    const startTime = Date.now();
    
    try {
        // 简单的测试请求
        const simplePrompt = "请用一句话描述什么是人工智能。";
        
        console.log("📤 Sending simple test request...");
        const result = await genAI.models.generateContent({
            model: model,
            contents: simplePrompt,
        });
        
        const duration = Date.now() - startTime;
        console.log(`✅ Simple test successful in ${duration}ms`);
        console.log("Response:", result.text?.substring(0, 200) + "...");
        
        // 测试结构化输出
        console.log("\n🔄 Testing structured JSON output...");
        const structuredStartTime = Date.now();
        
        const structuredPrompt = `
分析这个简短故事：
"小明在公园里遇到了一只迷路的小猫，他决定帮助它找到主人。"

请提供JSON格式的分析结果。
`;
        
        const structuredResult = await genAI.models.generateContent({
            model: model,
            contents: structuredPrompt,
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
                                    description: { type: Type.STRING },
                                },
                            },
                        },
                        setting: {
                            type: Type.OBJECT,
                            properties: {
                                location: { type: Type.STRING },
                                mood: { type: Type.STRING },
                            },
                        },
                    },
                },
            },
        });
        
        const structuredDuration = Date.now() - structuredStartTime;
        console.log(`✅ Structured test successful in ${structuredDuration}ms`);
        console.log("Structured response:", structuredResult.text);
        
        // 测试超时情况
        console.log("\n🔄 Testing timeout handling...");
        const timeoutStartTime = Date.now();
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Test timeout after 5 seconds')), 5000);
        });
        
        const longPrompt = `
请详细分析以下故事，提供完整的角色分析、场景描述和情节分析：
"在一个遥远的王国里，年轻的公主艾莉丝发现了一个神秘的魔法花园。花园里住着会说话的动物们，它们告诉她一个古老的预言：只有纯洁的心灵才能拯救即将陷入永恒黑暗的王国。艾莉丝必须通过三个试炼，收集三颗魔法宝石，才能阻止邪恶巫师的诅咒。在她的冒险旅程中，她遇到了勇敢的骑士汤姆、智慧的老法师梅林，以及狡猾但最终善良的盗贼杰克。他们一起面对各种挑战，最终发现真正的力量来自于友谊和爱。"

请提供详细的JSON分析。
`;
        
        const longApiCall = genAI.models.generateContent({
            model: model,
            contents: longPrompt,
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
        
        try {
            const longResult = await Promise.race([longApiCall, timeoutPromise]);
            const longDuration = Date.now() - timeoutStartTime;
            console.log(`✅ Long request successful in ${longDuration}ms`);
            console.log("Long response length:", longResult.text?.length || 0);
        } catch (timeoutError) {
            const timeoutDuration = Date.now() - timeoutStartTime;
            console.log(`⏰ Request timed out after ${timeoutDuration}ms:`, timeoutError.message);
        }
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ API test failed after ${duration}ms:`, error.message);
        console.error("Error details:", error);
    }
}

testGeminiAPI();
