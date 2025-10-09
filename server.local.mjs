import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;
const MOCK = process.env.MOCK_EVAL === '1';

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态资源服务（整个项目根目录）
app.use(express.static(__dirname));

// API: chat 直接转发到现有 handler
app.post('/api/chat', async (req, res) => {
  try {
    const mod = await import(path.join(__dirname, 'api', 'chat.js'));
    return mod.default(req, res);
  } catch (e) {
    console.error('Local server chat route error:', e);
    return res.status(500).json({ error: 'Local server error for /api/chat' });
  }
});

// API: evaluate-experiment 支持 MOCK_EVAL=1 返回示例评价
app.post('/api/evaluate-experiment', async (req, res) => {
  try {
    if (MOCK) {
      const mock = {
        evaluation_summary: '该实验报告总体表现良好，观察敏锐且能初步建立模型框架。',
        dimensions: {
          systematic_exploration: { score: 7, justification: '有明确的变量控制，但少数步骤不够连贯。' },
          critical_data_coverage: { score: 6, justification: '覆盖了部分关键区域，低温探索不足。' },
          observational_acuity: { score: 8, justification: '能较准确描述真实与理想曲线的偏离现象。' },
          hypothesis_testing: { score: 5, justification: '提出了初步假设，但验证步骤偏少。' },
          tool_utilization: { score: 7, justification: '使用了监视器与图表，但综合分析可进一步加强。' }
        },
        overall_score: 6.6,
        suggestions_for_improvement: '下一次请在关键区域做更系统的扫描，并明确提出可验证的假设与步骤。'
      };
      return res.status(200).json(mock);
    }
    const mod = await import(path.join(__dirname, 'api', 'evaluate-experiment.js'));
    return mod.default(req, res);
  } catch (e) {
    console.error('Local server evaluate route error:', e);
    return res.status(500).json({ error: 'Local server error for /api/evaluate-experiment' });
  }
});

app.listen(PORT, () => {
  console.log(`Local dev server running at http://localhost:${PORT}/`);
  console.log(`Static: http://localhost:${PORT}/isos_of_gas/index.html`);
  console.log(`MOCK_EVAL=${MOCK ? 'ON' : 'OFF'}`);
});