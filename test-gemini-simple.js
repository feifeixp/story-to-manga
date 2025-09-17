// 测试最简单的Gemini API调用
const { GoogleGenAI } = require("@google/genai");

const apiKey = "AIzaSyDkN7ISWA0oen2w2psrJC_CQ4L5fe97JXU";
const genAI = new GoogleGenAI({ apiKey });

async function testSimpleGemini() {
    console.log("🚀 Testing simple Gemini call...");
    
    const startTime = Date.now();
    
    try {
        // 最简单的文本生成，不使用JSON schema
        const result = await genAI.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Say hello in one word"
        });
        
        const duration = Date.now() - startTime;
        console.log(`✅ Success! Duration: ${duration}ms`);
        console.log(`Response: ${result.text}`);
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ Error after ${duration}ms:`, error.message);
    }
}

async function testWithTimeout() {
    console.log("\n🚀 Testing with 10 second timeout...");
    
    const startTime = Date.now();
    
    try {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout after 10 seconds')), 10000);
        });
        
        const apiCallPromise = genAI.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Say hello in one word"
        });
        
        const result = await Promise.race([apiCallPromise, timeoutPromise]);
        
        const duration = Date.now() - startTime;
        console.log(`✅ Success! Duration: ${duration}ms`);
        console.log(`Response: ${result.text}`);
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ Error after ${duration}ms:`, error.message);
    }
}

async function runTests() {
    await testSimpleGemini();
    await testWithTimeout();
}

runTests();
