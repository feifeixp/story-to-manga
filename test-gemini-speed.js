// 测试Gemini API速度的简单脚本
const { GoogleGenAI, Type } = require("@google/genai");

const apiKey = "AIzaSyDkN7ISWA0oen2w2psrJC_CQ4L5fe97JXU";
const genAI = new GoogleGenAI({ apiKey });

async function testGeminiSpeed() {
    console.log("🚀 Testing Gemini 2.5 Flash speed...");
    
    const startTime = Date.now();
    
    try {
        // 简单的文本生成测试
        const result = await genAI.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Analyze this simple story and return JSON: A boy named Tom went to school. He met his friend Alice.",
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
                                    description: { type: Type.STRING }
                                }
                            }
                        }
                    }
                }
            }
        });
        
        const duration = Date.now() - startTime;
        console.log(`✅ Success! Duration: ${duration}ms`);
        console.log(`Response: ${result.text?.substring(0, 200)}...`);
        
        if (duration > 10000) {
            console.log("⚠️  Warning: Response took longer than 10 seconds");
        } else if (duration > 5000) {
            console.log("⚠️  Warning: Response took longer than 5 seconds");
        } else {
            console.log("✅ Response time is normal");
        }
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ Error after ${duration}ms:`, error.message);
    }
}

testGeminiSpeed();
