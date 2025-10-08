// 理想气体定律探究沙箱 V1.0 - 主入口文件和总协调器
// 负责协调所有模块，实现状态驱动的应用架构

import * as stateManager from './state.js';
import * as simulation from './simulation.js';
import * as flow from './flow.js';
import * as physics from './physics.js';
import { getAiResponse, evaluateExperiment } from './api.js';
import * as Notifier from './Notifier.js';

// UI组件模块（新架构）
import * as ControlPanel from './ui-components/ControlPanel.js';
import * as ChartView from './ui-components/ChartView.js';
import * as GuidancePanel from './ui-components/GuidancePanel.js';
import * as ChatPanel from './ui-components/ChatPanel.js';
import * as FloatingWindows from './ui-components/FloatingWindows.js';
import * as CollisionMonitor from './ui-components/CollisionMonitor.js';

console.log('理想气体定律探究沙箱 V1.0 已加载');

// AI功能计数器
let submissionCount = 0;

// 通知节流机制 - 防止快速拖动时产生大量播报
let pendingNotification = null;
let notificationTimer = null;
const NOTIFICATION_DELAY = 500; // 停止拖动后500ms显示最后一个通知

/**
 * 节流显示通知 - 只显示最后一次通知
 * @param {Object} notification - 通知对象 {message, type}
 */
function throttledNotification(notification) {
    if (!notification) return;
    
    // 保存最新的通知
    pendingNotification = notification;
    
    // 清除之前的定时器
    if (notificationTimer) {
        clearTimeout(notificationTimer);
    }
    
    // 设置新的定时器，延迟显示
    notificationTimer = setTimeout(() => {
        if (pendingNotification) {
            Notifier.show(pendingNotification.message, pendingNotification.type);
            pendingNotification = null;
        }
        notificationTimer = null;
    }, NOTIFICATION_DELAY);
}

// --- 1. 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM 已加载完成');
    
    // 初始化状态管理器
    stateManager.initState();
    let currentState = stateManager.state;
    
    // 初始化所有模块
    simulation.init(document.getElementById('simulation-container'), currentState);
    flow.init(handlePhaseChange);
    
    // 初始化UI组件模块
    ControlPanel.initControls(handleUIAction, handleFlowAction, handleLockToggle); // 修正：传递所有三个参数
    ChartView.initPlot(handlePlotSwitch); // initPlot内部已包含事件绑定
    GuidancePanel.initGuidance(handleFlowAction); // 传递流程动作回调
    ChatPanel.initChat(handleSendMessage);
    FloatingWindows.initFloatingLog();
    FloatingWindows.initWelcomeModal(handleFlowAction);
    
    // V2.2: 初始化碰撞监视器
    CollisionMonitor.initCollisionMonitor();
    simulation.setCollisionRecorder(CollisionMonitor.recordCollision);
    
    // 暴露监视器更新函数到全局
    window.updateCollisionMonitor = CollisionMonitor.updateMonitor;
    
    // 初始化日志浮动窗口
    initLogFloater();
    
    // 首次渲染
    updateAllUI(currentState);
    simulation.update(currentState);
    
    // 显示欢迎弹窗
    FloatingWindows.showWelcomeModal(true);
    
    stateManager.addLogEntry('应用初始化完成');
    
    // 暴露调试函数到全局作用域
    window.updateState = stateManager.updateState;
    window.getState = stateManager.getState;
    // 暴露评价触发到全局（供按钮绑定或调试）
    window.requestEvaluation = handleRequestEvaluation;
});

// --- 2. 统一的动作处理器 ---
function handleUIAction(action) {
    console.log('UI动作:', action);
    stateManager.addLogEntry(`用户操作: ${action.type}`);
    
    // V2.1: 处理气体类型变化
    if (action.type === 'gas_type_change') {
        const { gasType, a, b } = action.payload;
        console.log(`🔄 main.js 接收到气体类型切换: ${gasType}, a=${a}, b=${b}`);
        stateManager.updateState({ gasType, a, b });
        stateManager.addLogEntry(`气体类型切换: ${gasType}, a=${a}, b=${b}`);
        
        // V2.2.2: 立即触发图表更新以显示新的曲线
        const currentState = stateManager.state;
        ChartView.updatePlot(currentState);
        console.log(`✅ 气体类型切换完成，状态已更新: a=${currentState.a}, b=${currentState.b}`);
        return;
    }
    
    // V2.1: 处理a和b参数变化（只在自定义气体模式下）
    if (action.type === 'control_change' && (action.payload.var === 'a' || action.payload.var === 'b')) {
        const currentState = stateManager.state;
        if (currentState.gasType === 'custom') {
            const updates = {};
            updates[action.payload.var] = action.payload.value;
            stateManager.updateState(updates);
            stateManager.addLogEntry(`参数变更: ${action.payload.var}=${action.payload.value}`);
        }
        return;
    }
    
    // 特殊处理control_change动作，使用新的物理计算模块
    if (action.type === 'control_change') {
        const currentState = stateManager.state;
        const { var: variable, value } = action.payload;
        
        // 使用physics.js计算新状态
        const result = physics.calculateNewState(currentState, { variable, value });
        
        if (result.success) {
            stateManager.updateState(result.newState);
            stateManager.addLogEntry(`控制变更成功: ${variable}=${value}`);
            
            // 在引导阶段，检查是否操作了正确的滑块
            if (currentState.experimentPhase.startsWith('guided_')) {
                const requirements = flow.getPhaseRequirements(currentState.experimentPhase);
                if (requirements && variable === requirements.requiredSlider) {
                    stateManager.updateState({ 
                        currentStep: { hasOperatedSlider: true }
                    });
                    console.log(`✅ 引导阶段：用户已操作正确的滑块 (${variable})`);
                    checkAndUnlockNextButton();
                }
            }
            
            // 显示通知（如果有）- 使用节流防止频繁播报
            if (result.notification) {
                throttledNotification(result.notification);
            }
        } else {
            // 状态无效，恢复滑块位置
            console.warn('无效状态，恢复滑块位置:', result.reason);
            ControlPanel.revertSlider(variable, currentState[variable]);
            stateManager.addLogEntry(`控制变更失败: ${variable}=${value} (${result.reason})`);
            
            // 显示失败通知 - 使用节流防止频繁播报
            if (result.notification) {
                throttledNotification(result.notification);
            }
        }
    } else {
        // 其他动作使用流程控制器处理
        const updates = flow.advancePhase(stateManager.state, action);
        
        if (Object.keys(updates).length > 0) {
            stateManager.updateState(updates);
        }
    }
}

function handlePlotSwitch(action) {
    console.log('图表切换:', action);
    stateManager.addLogEntry(`切换图表类型: ${action.payload.plotType}`);
    stateManager.updateState({ currentPlotType: action.payload.plotType });
}

// V2.EVAL: 触发实验评价 - 收集数据并调用后端
async function handleRequestEvaluation() {
    const current = stateManager.state;
    // 过滤用户反馈：仅保留 type === 'user' 的消息
    const userFeedback = (current.chatHistory || []).filter(m => m && m.type === 'user');
    const operationLog = current.log || [];
    // V2.EVAL.QA: 收集AI问答历史
    const qaHistory = current.qaHistory || [];
    
    console.log('📊 收集评价数据:', { 
        operationLog: operationLog.length, 
        userFeedback: userFeedback.length, 
        qaHistory: qaHistory.length 
    });
    
    // 先展示模态框并进入加载态
    stateManager.updateState({ isEvaluating: true, evaluationError: null });
    showEvaluationModal(true, null);

    try {
        const result = await evaluateExperiment(operationLog, userFeedback, qaHistory);
        stateManager.updateState({ evaluationResult: result });
        showEvaluationModal(true, result);
    } catch (err) {
        stateManager.updateState({ evaluationError: err.message || String(err) });
        Notifier.show('评价失败，请稍后重试', 'error');
        showEvaluationModal(true, null);
    } finally {
        stateManager.updateState({ isEvaluating: false });
    }
}

// V2.EVAL: 简易模态框显示/渲染（与index.html结构配合）
function showEvaluationModal(visible, data) {
    const overlay = document.getElementById('evaluation-modal');
    if (!overlay) return;
    const body = overlay.querySelector('.evaluation-body');
    const loading = overlay.querySelector('.evaluation-loading');
    const errorBox = overlay.querySelector('.evaluation-error');
    if (visible) {
        overlay.style.display = 'flex';
        const s = stateManager.state;
        // 加载态
        if (s.isEvaluating) {
            if (loading) loading.style.display = 'block';
            if (body) body.innerHTML = '';
            if (errorBox) errorBox.style.display = 'none';
            return;
        }
        if (loading) loading.style.display = 'none';
        if (s.evaluationError) {
            if (errorBox) {
                errorBox.style.display = 'block';
                errorBox.textContent = s.evaluationError;
            }
            if (body) body.innerHTML = '';
            return;
        }
        if (data && body) {
            body.innerHTML = renderEvaluationHtml(data);
            if (errorBox) errorBox.style.display = 'none';
        }
    } else {
        overlay.style.display = 'none';
    }
}

// V2.EVAL: 将评价JSON渲染为HTML
function renderEvaluationHtml(e) {
    const dims = e?.dimensions || {};
    const row = (key, label) => {
        const d = dims[key] || {}; const score = d.score ?? '-'; const just = d.justification || '';
        return `<div class="eval-row"><div class="eval-label">${label}</div><div class="eval-score">${score}</div><div class="eval-just">${just}</div></div>`;
    };
    const summary = e?.evaluation_summary || '';
    const overall = e?.overall_score ?? '-';
    const sug = e?.suggestions_for_improvement || '';
    return `
        <div class="eval-summary">${summary}</div>
        <div class="eval-overall">综合得分：<strong>${overall}</strong></div>
        <div class="eval-table">
            ${row('systematic_exploration', '探索的系统性')}
            ${row('critical_data_coverage', '关键数据覆盖')}
            ${row('observational_acuity', '观察与描述')}
            ${row('hypothesis_testing', '假设检验与因果')}
            ${row('tool_utilization', '工具使用与综合')}
        </div>
        <div class="eval-suggestions"><strong>改进建议：</strong>${sug}</div>
    `;
}

async function handleSendMessage(action) {
    console.log('发送消息:', action);
    const timestamp = new Date().toLocaleTimeString();
    const userMessage = {
        type: 'user',
        content: action.payload,
        timestamp: timestamp
    };
    
    // 确保chatHistory是数组
    const currentHistory = Array.isArray(stateManager.state.chatHistory) ? stateManager.state.chatHistory : [];
    let updatedHistory = [...currentHistory, userMessage];
    
    // V3.3: 门控逻辑 - 检查是否需要解锁
    const isCurrentlyLocked = stateManager.state.isExperimentLocked;
    
    // 根据消息类型处理AI回复
    if (action.type === 'send_message') {
        // 引导阶段的发送消息
        submissionCount++;
        const aiMessage = {
            type: 'system',
            content: '收到',
            timestamp: new Date().toLocaleTimeString()
        };
        updatedHistory = [...updatedHistory, aiMessage];
        
        // 设置当前步骤的反馈已提交状态
        stateManager.updateState({ 
            currentStep: { feedbackSubmitted: true }
        });
        console.log('✅ 用户已提交反馈');
        
        // 检查是否满足所有解锁条件
        checkAndUnlockNextButton();
        
        // V3.3: 门控逻辑 - 如果之前是锁定状态，现在解锁
        if (isCurrentlyLocked) {
            stateManager.updateState({ isExperimentLocked: false });
            console.log('V3.3: 用户提交反馈，门锁已解锁');
        }
    } else if (action.type === 'ask_ai') {
        // 自由探究阶段的AI提问
        
        // V2.EVAL.QA: 记录用户问题到qaHistory
        const currentQaHistory = Array.isArray(stateManager.state.qaHistory) ? stateManager.state.qaHistory : [];
        stateManager.updateState({ 
            qaHistory: [...currentQaHistory, { question: action.payload }]
        });
        console.log('✅ 记录AI提问到qaHistory:', action.payload);
        
        // V3.1: 立即设置isThinking状态为true，锁定输入控件
        stateManager.updateState({ isThinking: true });
        
        // 先显示用户消息
        stateManager.updateState({ chatHistory: updatedHistory });
        
        // 立即显示"思考中"气泡
        const chatLog = document.getElementById('chat-log');
        const thinkingTemplate = document.getElementById('ai-thinking-template');
        const thinkingBubble = thinkingTemplate.cloneNode(true);
        thinkingBubble.id = 'ai-thinking-bubble';
        thinkingBubble.style.display = 'block';
        
        if (chatLog) {
            chatLog.appendChild(thinkingBubble);
            chatLog.scrollTop = chatLog.scrollHeight; // 滚动到底部
        }
        
        try {
            // 延迟一段时间再调用API，模拟思考
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // 调用API获取真实回复
            const aiResponse = await getAiResponse(action.payload);
            
            // 移除思考中气泡
            if (thinkingBubble && thinkingBubble.parentNode) {
                thinkingBubble.parentNode.removeChild(thinkingBubble);
            }
            
            // 添加真实的AI回复
            const aiMessage = {
                type: 'system',
                content: aiResponse,
                timestamp: new Date().toLocaleTimeString()
            };
            updatedHistory = [...updatedHistory, aiMessage];
            
        } catch (error) {
            console.error('AI回复失败:', error);
            
            // 移除思考中气泡
            if (thinkingBubble && thinkingBubble.parentNode) {
                thinkingBubble.parentNode.removeChild(thinkingBubble);
            }
            
            const errorMessage = {
                type: 'system',
                content: '抱歉，我现在无法回答，请检查网络或稍后再试。',
                timestamp: new Date().toLocaleTimeString()
            };
            updatedHistory = [...updatedHistory, errorMessage];
            
            // 显示全局错误通知
            Notifier.show('❌ AI服务暂时不可用，请检查网络连接或稍后重试', 'error', 5000);
        } finally {
            // V3.1: 无论成功还是失败，都要解锁输入控件
            stateManager.updateState({ isThinking: false });
            
            // V3.3: 门控逻辑 - 如果之前是锁定状态，现在解锁
            if (isCurrentlyLocked) {
                stateManager.updateState({ isExperimentLocked: false });
                console.log('V3.3: 用户提交反馈，门锁已解锁');
            }
        }
    } else if (action.type === 'final_report') {
        // 最终反馈提交
        const aiMessage = {
            type: 'system',
            content: '感谢您的反馈！实验已结束。',
            timestamp: new Date().toLocaleTimeString()
        };
        updatedHistory = [...updatedHistory, aiMessage];
        
        // 设置实验结束状态
        stateManager.updateState({ 
            experimentEnded: true,
            currentStep: { feedbackSubmitted: true }
        });
        
        // V3.3: 门控逻辑 - 如果之前是锁定状态，现在解锁
        if (isCurrentlyLocked) {
            stateManager.updateState({ isExperimentLocked: false });
            console.log('V3.3: 用户提交反馈，门锁已解锁');
        }
    }
    
    stateManager.updateState({ chatHistory: updatedHistory });
    stateManager.addLogEntry(`用户记录: ${action.payload.substring(0, 20)}...`);
}

function handleFlowAction(action) {
    console.log('流程动作:', action);
    handleUIAction(action);
}

function handleLockToggle(action) {
    console.log('锁定切换:', action);
    const { variable } = action.payload;
    const currentState = stateManager.state;
    const currentLocked = currentState.lockedVariable;
    
    // 单锁模式：如果点击的本就是已锁定的，则不执行任何操作
    if (currentLocked === variable) {
        console.log('点击已锁定的变量，不执行操作');
        return;
    }
    
    // 锁定新变量（自动解锁其他变量）
    stateManager.updateState({ lockedVariable: variable });
    stateManager.addLogEntry(`锁定变量: ${variable}${currentLocked ? ` (自动解锁: ${currentLocked})` : ''}`);
    
    // 在引导阶段，检查是否锁定了正确的变量
    if (currentState.experimentPhase.startsWith('guided_')) {
        const requirements = flow.getPhaseRequirements(currentState.experimentPhase);
        if (requirements && variable === requirements.requiredLock) {
            stateManager.updateState({ 
                currentStep: { hasCorrectLock: true }
            });
            console.log(`✅ 引导阶段：用户已锁定正确的变量 (${variable})`);
            checkAndUnlockNextButton();
        } else if (requirements) {
            // 锁定了错误的变量，取消标记
            stateManager.updateState({ 
                currentStep: { hasCorrectLock: false }
            });
            console.log(`❌ 引导阶段：用户锁定了错误的变量 (${variable}，应该锁定 ${requirements.requiredLock})`);
        }
    }
}

/**
 * 检查并解锁"下一步"按钮
 * 需要同时满足三个条件：
 * 1. 锁定了正确的变量
 * 2. 操作了正确的滑块
 * 3. 提交了反馈
 */
function checkAndUnlockNextButton() {
    const currentState = stateManager.getState();
    const { hasCorrectLock, hasOperatedSlider, feedbackSubmitted } = currentState.currentStep;
    
    console.log('🔍 检查解锁条件:', {
        hasCorrectLock,
        hasOperatedSlider,
        feedbackSubmitted
    });
    
    // 三个条件都满足才解锁
    if (hasCorrectLock && hasOperatedSlider && feedbackSubmitted) {
        console.log('✅ 所有条件满足，"下一步"按钮已解锁');
        // 不需要额外操作，GuidancePanel会根据state自动更新按钮状态
    } else {
        console.log('⏳ 条件未全部满足，"下一步"按钮保持锁定');
    }
}

/**
 * 统一的UI更新函数 - 协调所有UI模块
 * @param {Object} state - 全局状态
 */
function updateAllUI(state) {
    ControlPanel.updateControls(state);
    ChartView.updatePlot(state);
    GuidancePanel.updateGuidance(state);
    ChatPanel.updateChat(state);
    FloatingWindows.updateFloatingLog(state);
}

// --- 3. 状态与流程变更处理器 ---
function handleStateChange(event) {
    const { oldState, newState } = event.detail;
    
    // 保存最后一个有效状态，用于滑块恢复
    window.lastValidState = { ...oldState };
    
    // 根据新状态计算物理变化 (PV=nRT)
    const calculatedState = calculatePhysics(newState);
    
    // 如果计算结果与当前状态不同，更新状态
    if (calculatedState && Object.keys(calculatedState).length > 0) {
        Object.assign(newState, calculatedState);
    }
    
    // 数据驱动UI和模拟器更新
    updateAllUI(newState);
    simulation.update(newState);
    
    stateManager.addLogEntry(`状态更新: P=${newState.P.toFixed(1)}kPa, V=${newState.V.toFixed(1)}L, T=${newState.T.toFixed(0)}K`);
}

function handlePhaseChange() {
    // 流程阶段改变后，也需要更新状态和UI
    const newPhase = stateManager.state.experimentPhase;
    const newGuidance = flow.getCurrentGuidance(newPhase);
    
    stateManager.updateState({ 
        currentGuidance: newGuidance,
        currentStep: { 
            feedbackSubmitted: false,    // 重置反馈状态
            hasCorrectLock: false,       // 重置锁定状态
            hasOperatedSlider: false     // 重置滑块操作状态
        }
    });
    stateManager.addLogEntry(`进入新阶段: ${newPhase}`);
    console.log('🔄 阶段切换：所有完成条件已重置，"下一步"按钮已锁定');
}

// 全局监听自定义事件，实现模块解耦
document.addEventListener('stateShouldUpdate', handleStateChange);
document.addEventListener('phaseShouldChange', handlePhaseChange);

// 物理计算函数
function calculatePhysics(state) {
    // PV=nRT的核心计算逻辑已在flow.js中实现
    // 这里主要处理一些边界情况和验证
    const updates = {};
    
    // 确保所有值在合理范围内
    if (state.P < 50) updates.P = 50;
    if (state.P > 200) updates.P = 200;
    if (state.V < 10) updates.V = 10;
    if (state.V > 50) updates.V = 50;
    if (state.T < 200) updates.T = 200;
    if (state.T > 400) updates.T = 400;
    if (state.n < 0.5) updates.n = 0.5;
    if (state.n > 3) updates.n = 3;
    
    return updates;
}

// 日志浮动窗口初始化
function initLogFloater() {
    const toggleBtn = document.getElementById('log-toggle-btn');
    const logContent = document.getElementById('log-content');
    
    toggleBtn.addEventListener('click', function() {
        if (logContent.style.display === 'none') {
            logContent.style.display = 'block';
            toggleBtn.textContent = '-';
        } else {
            logContent.style.display = 'none';
            toggleBtn.textContent = '+';
        }
    });
}

// 导出基础函数供调试使用
window.AppDebug = {
    getState: () => stateManager.getState(),
    updateState: stateManager.updateState,
    addLog: stateManager.addLogEntry
};

// 将updateState、getState和stopSimulation暴露到全局供ui.js使用
window.updateState = stateManager.updateState;
window.getState = stateManager.getState;
window.stopSimulation = simulation.stopSimulation;
