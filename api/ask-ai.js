// /api/ask-ai.js

// Vercel Serverless Function, 运行在Node.js环境
export default async function handler(request, response) {
    // 从环境变量中安全地读取API密钥
    const apiKey = process.env.AI_PROVIDER_API_KEY;

    // 检查API密钥是否存在
    if (!apiKey) {
        console.error('AI_PROVIDER_API_KEY environment variable is not set');
        return response.status(500).json({ error: 'Server configuration error: API key not found' });
    }

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
        // 向DeepSeek API发起请求
        const apiResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [{ role: "user", content: userPrompt }],
                stream: false
            }),
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error(`DeepSeek API error: ${apiResponse.status} - ${errorText}`);
            return response.status(apiResponse.status).json({ 
                error: `AI service error: ${apiResponse.status}` 
            });
        }

        const data = await apiResponse.json();

        // 验证响应格式
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('Unexpected API response format:', data);
            return response.status(500).json({ error: 'Unexpected response format from AI service' });
        }

        // 将AI的响应返回给我们的前端
        return response.status(200).json(data);

    } catch (error) {
        console.error('Error in Vercel function when calling AI API:', error);
        return response.status(500).json({ 
            error: 'Internal Server Error',
            details: error.message 
        });
    }
}
