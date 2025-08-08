// api.js
const DEEPSEEK_API_KEY = 'sk-4acb4527032a48b9a9fe1a73e544f1e6';
const API_URL = 'https://api.deepseek.com/chat/completions';

export async function getAiResponse(userMessage) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: "你是一个优秀的物理实验辅导员。你的回答必须简洁、专业，并能启发学生思考。请使用中文回答。" },
                    { role: "user", content: userMessage }
                ]
            })
        });
        if (!response.ok) throw new Error(`API request failed`);
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error("AI Response Error:", error);
        return "抱歉，我现在无法回答，请检查网络或稍后再试。";
    }
}