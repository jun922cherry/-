// /api/ask-ai.js

// Vercel Serverless Function, 运行在Node.js环境
export default async function handler(request, response) {
    // 从环境变量中安全地读取API密钥
    const apiKey = process.env.AI_PROVIDER_API_KEY;

    // 仅允许POST请求
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    // 从请求体中获取用户输入
    const userPrompt = request.body.prompt;
    if (!userPrompt) {
        return response.status(400).json({ error: 'Bad Request: Missing prompt' });
    }

    try {
        // 向真正的AI服务商API发起请求
        // (请根据我们实际使用的服务修改此处的URL和body结构)
        const apiResponse = await fetch('https://api.openai.com/v1/chat/completions', { // 示例：OpenAI API
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`, // 在此处安全地使用密钥
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: userPrompt }],
            }),
        });

        const data = await apiResponse.json();

        // 将AI的响应返回给我们的前端
        return response.status(200).json(data);

    } catch (error) {
        console.error('Error in Vercel function when calling AI API:', error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}