// 测试不同复杂度JSON schema的速度
const { GoogleGenAI, Type } = require("@google/genai");

const apiKey = "AIzaSyDkN7ISWA0oen2w2psrJC_CQ4L5fe97JXU";
const genAI = new GoogleGenAI({ apiKey });

async function testSimpleSchema() {
    console.log("🚀 Testing simple JSON schema...");
    
    const startTime = Date.now();
    
    try {
        const result = await genAI.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Analyze: A boy named Tom went to school.",
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        character: { type: Type.STRING }
                    }
                }
            }
        });
        
        const duration = Date.now() - startTime;
        console.log(`✅ Simple schema: ${duration}ms`);
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ Simple schema error after ${duration}ms:`, error.message);
    }
}

async function testComplexSchema() {
    console.log("\n🚀 Testing complex JSON schema (like story analysis)...");
    
    const startTime = Date.now();
    
    try {
        const result = await genAI.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Analyze: A boy named Tom went to school. He met Alice.",
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
                }
            }
        });
        
        const duration = Date.now() - startTime;
        console.log(`✅ Complex schema: ${duration}ms`);
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ Complex schema error after ${duration}ms:`, error.message);
    }
}

async function runTests() {
    await testSimpleSchema();
    await testComplexSchema();
}

runTests();
