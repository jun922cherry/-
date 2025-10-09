// api.js - AI问答接口模块
// 使用代理端点调用DeepSeek API，确保API密钥安全

export async function getAiResponse(userMessage) {
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: "你是一个优秀的物理实验辅导员。你的回答必须简洁、专业，并能启发学生思考。请使用中文回答。" },
                    { role: "user", content: userMessage }
                ]
            })
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API request failed with status ${response.status}:`, errorText);
            throw new Error(`API request failed with status ${response.status}: ${errorText}`);
        }
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error("AI Response Error:", error);
        if (error.message.includes('Failed to fetch')) {
            return "网络连接失败，请检查网络连接后重试。";
        } else if (error.message.includes('401')) {
            return "API密钥无效，请检查配置。";
        } else if (error.message.includes('429')) {
            return "API调用频率过高，请稍后再试。";
        } else {
            return `API调用失败: ${error.message}`;
        }
    }
}

// V2.EVAL: 调用实验评价端点
export async function evaluateExperiment(operationLog, userFeedback, qaHistory) {
    try {
        const response = await fetch('/api/evaluate-experiment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operationLog, userFeedback, qaHistory })
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${text}`);
        }
        return await response.json();
    } catch (err) {
        console.error('evaluateExperiment error:', err);
        throw err;
    }
}