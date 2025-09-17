// 测试不使用JSON schema的速度
const { GoogleGenAI } = require("@google/genai");

const apiKey = "AIzaSyDkN7ISWA0oen2w2psrJC_CQ4L5fe97JXU";
const genAI = new GoogleGenAI({ apiKey });

async function testNoSchema() {
    console.log("🚀 Testing without JSON schema...");
    
    const startTime = Date.now();
    
    try {
        const prompt = `Analyze this story and extract the following information in JSON format:

Story: A young warrior named Li Wei lived in the mountains. He practiced martial arts every day. One morning, he met a mysterious old master who taught him ancient techniques.

Please respond with valid JSON only, no additional text. The JSON should have this structure:
{
  "title": "story title",
  "characters": [
    {
      "name": "character name",
      "physicalDescription": "physical description",
      "personality": "personality traits",
      "role": "role in story"
    }
  ],
  "setting": {
    "timePeriod": "time period",
    "location": "location",
    "mood": "overall mood"
  },
  "scenes": [
    {
      "id": "scene1",
      "name": "scene name",
      "description": "scene description",
      "location": "specific location",
      "timeOfDay": "time of day",
      "mood": "scene mood",
      "visualElements": ["element1", "element2"]
    }
  ]
}`;

        const result = await genAI.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt
        });
        
        const duration = Date.now() - startTime;
        console.log(`✅ Success! Duration: ${duration}ms`);
        console.log(`Response length: ${result.text?.length || 0} characters`);
        console.log(`Response preview: ${result.text?.substring(0, 200)}...`);
        
        // 尝试解析JSON
        try {
            const parsed = JSON.parse(result.text || '{}');
            console.log(`✅ JSON parsing successful`);
            console.log(`Characters found: ${parsed.characters?.length || 0}`);
            console.log(`Scenes found: ${parsed.scenes?.length || 0}`);
        } catch (parseError) {
            console.log(`❌ JSON parsing failed: ${parseError.message}`);
        }
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ Error after ${duration}ms:`, error.message);
    }
}

testNoSchema();
