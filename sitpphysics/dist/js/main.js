// 理想气体定律探究沙箱 V1.0 - 主入口文件和总协调器
// 负责协调所有模块，实现状态驱动的应用架构

import * as stateManager from './state.js';
import * as simulation from './simulation.js';
import * as ui from './ui.js';
import * as flow from './flow.js';
import * as physics from './physics.js';
import { getAiResponse } from './api.js';

console.log('理想气体定律探究沙箱 V1.0 已加载');

// AI功能计数器
let submissionCount = 0;

// --- 1. 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM 已加载完成');
    
    // 初始化状态管理器
    stateManager.initState();
    let currentState = stateManager.state;
    
    // 初始化所有模块
    simulation.init(document.getElementById('simulation-container'), currentState);
    ui.init(handleUIAction, handlePlotSwitch, handleSendMessage, handleFlowAction, handleLockToggle);
    flow.init(handlePhaseChange);
    
    // 初始化日志浮动窗口
    initLogFloater();
    
    // 首次渲染
    ui.update(currentState);
    simulation.update(currentState);
    
    // 显示欢迎弹窗
    ui.showWelcomeModal(true);
    
    stateManager.addLogEntry('应用初始化完成');
    
    // 暴露调试函数到全局作用域
    window.updateState = stateManager.updateState;
    window.getState = stateManager.getState;
});

// --- 2. 统一的动作处理器 ---
function handleUIAction(action) {
    console.log('UI动作:', action);
    stateManager.addLogEntry(`用户操作: ${action.type}`);
    
    // 特殊处理control_change动作，使用新的物理计算模块
    if (action.type === 'control_change') {
        const currentState = stateManager.state;
        const { var: variable, value } = action.payload;
        
        // 使用physics.js计算新状态
        const result = physics.calculateNewState(currentState, { variable, value });
        
        if (result.success) {
            stateManager.updateState(result.newState);
            stateManager.addLogEntry(`控制变更成功: ${variable}=${value}`);
        } else {
            // 状态无效，恢复滑块位置
            console.warn('无效状态，恢复滑块位置:', result.reason);
            ui.revertSlider(variable, currentState[variable]);
            stateManager.addLogEntry(`控制变更失败: ${variable}=${value} (${result.reason})`);
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
        
        // V3.3: 门控逻辑 - 如果之前是锁定状态，现在解锁
        if (isCurrentlyLocked) {
            stateManager.updateState({ isExperimentLocked: false });
            console.log('V3.3: 用户提交反馈，门锁已解锁');
        }
    } else if (action.type === 'ask_ai') {
        // 自由探究阶段的AI提问
        
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
    const currentLocked = stateManager.state.lockedVariable;
    
    // 单锁模式：如果点击的本就是已锁定的，则不执行任何操作
    if (currentLocked === variable) {
        console.log('点击已锁定的变量，不执行操作');
        return;
    }
    
    // 锁定新变量（自动解锁其他变量）
    stateManager.updateState({ lockedVariable: variable });
    stateManager.addLogEntry(`锁定变量: ${variable}${currentLocked ? ` (自动解锁: ${currentLocked})` : ''}`);
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
    ui.update(newState);
    simulation.update(newState);
    
    stateManager.addLogEntry(`状态更新: P=${newState.P.toFixed(1)}kPa, V=${newState.V.toFixed(1)}L, T=${newState.T.toFixed(0)}K`);
}

function handlePhaseChange() {
    // 流程阶段改变后，也需要更新状态和UI
    const newPhase = stateManager.state.experimentPhase;
    const newGuidance = flow.getCurrentGuidance(newPhase);
    
    stateManager.updateState({ currentGuidance: newGuidance });
    stateManager.addLogEntry(`进入新阶段: ${newPhase}`);
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