/**
 * ChatPanel.js
 * 聊天面板模块 - 负责实验记录与反馈面板的管理
 * 包括聊天记录显示、输入区域和按钮控制
 */

// 模块级变量
let onSendMessage = null;
let currentInputPhase = null;
let inputAreaInitialized = false;
let lastChatHistoryHash = null;
let lastScrollPosition = null;
let isUserScrolling = false;

/**
 * 初始化聊天面板
 * @param {Function} sendMessageCallback - 发送消息回调
 */
export function initChat(sendMessageCallback) {
    console.log('🎯 ChatPanel.initChat被调用');
    onSendMessage = sendMessageCallback;
    
    // 检查必需的DOM元素是否存在
    const chatLog = document.getElementById('chat-log');
    const chatInputArea = document.getElementById('chat-input-area');
    
    if (!chatLog) {
        console.error('❌ ChatPanel: chat-log元素不存在！');
    } else {
        console.log('✅ ChatPanel: chat-log元素找到');
    }
    
    if (!chatInputArea) {
        console.error('❌ ChatPanel: chat-input-area元素不存在！');
    } else {
        console.log('✅ ChatPanel: chat-input-area元素找到');
    }
    
    // V3.6: 初始化时只设置输入区域，聊天记录容器已在HTML中预定义
    updateInputArea('welcome');
    console.log('✅ ChatPanel初始化完成');
}

/**
 * V3.6: 职责A - 渲染聊天记录（只追加，永不销毁）
 * @param {Array} chatHistory - 聊天历史数组
 */
function renderChatLog(chatHistory) {
    const chatLog = document.getElementById('chat-log');
    if (!chatLog) {
        console.error('V3.6: chat-log容器未找到！');
        return;
    }
    
    // 获取当前DOM中的消息数量
    const currentMessages = chatLog.querySelectorAll('.chat-message');
    const currentCount = currentMessages.length;
    const newCount = Array.isArray(chatHistory) ? chatHistory.length : 0;
    
    // 只追加新消息，永不清空或重建
    if (newCount > currentCount) {
        const newMessages = chatHistory.slice(currentCount);
        newMessages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `chat-message ${msg.type}`;
            messageDiv.innerHTML = `
                <div class="message-content">${msg.content}</div>
                <div class="message-time">${msg.timestamp}</div>
            `;
            chatLog.appendChild(messageDiv);
        });
        
        // 自动滚动到底部
        chatLog.scrollTop = chatLog.scrollHeight;
        console.log(`V3.6: 追加了 ${newMessages.length} 条新消息`);
    }
    
    // 设置滚动检测（如果还没有设置）
    if (!chatLog.hasScrollDetection) {
        setupScrollDetection();
        chatLog.hasScrollDetection = true;
    }
}

/**
 * V3.8: 优化输入区域更新 - 避免不必要的HTML重建
 * @param {string} experimentPhase - 当前实验阶段
 */
function updateInputArea(experimentPhase) {
    const chatInputArea = document.getElementById('chat-input-area');
    if (!chatInputArea) {
        console.error('V3.6: chat-input-area容器未找到！');
        return;
    }
    
    const currentState = window.getState ? window.getState() : { experimentEnded: false, isThinking: false };
    const isEnded = currentState.experimentEnded;
    const isThinking = currentState.isThinking;
    const shouldDisable = isEnded || isThinking;
    
    // V3.8: 检查是否需要重建HTML结构
    const needsRebuild = !inputAreaInitialized || currentInputPhase !== experimentPhase;
    
    if (needsRebuild) {
        console.log(`V3.8: 重建输入区域HTML，阶段: ${experimentPhase}`);
        
        if (experimentPhase === 'free') {
            // 自由探究阶段：双重提交按钮
            chatInputArea.innerHTML = `
                <textarea id="chat-input" placeholder="记录您的观察和思考..."></textarea>
                <div class="dual-button-area">
                    <button id="ask-ai-btn" class="action-btn secondary">向AI提问</button>
                    <button id="submit-final-report-btn" class="action-btn primary">提交最终总结并结束</button>
                </div>
            `;
            
            // 绑定事件监听器
            document.getElementById('ask-ai-btn').addEventListener('click', askAI);
            document.getElementById('submit-final-report-btn').addEventListener('click', submitFinalReport);
        } else {
            // V3.8: 所有阶段都显示AI提问按钮 + 发送按钮
            chatInputArea.innerHTML = `
                <textarea id="chat-input" placeholder="记录您的观察和思考..."></textarea>
                <div class="dual-button-area">
                    <button id="ask-ai-btn" class="action-btn secondary">向AI提问</button>
                    <button id="send-btn" class="action-btn primary">发送</button>
                </div>
            `;
            
            // 绑定事件监听器
            document.getElementById('ask-ai-btn').addEventListener('click', askAI);
            document.getElementById('send-btn').addEventListener('click', sendChatMessage);
        }
        
        // 通用键盘事件
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    // V3.1: 检查实验是否结束或AI是否在思考
                    const currentState = window.getState ? window.getState() : { experimentEnded: false, isThinking: false };
                    const shouldDisable = currentState.experimentEnded || currentState.isThinking;
                    
                    if (shouldDisable) {
                        return; // 实验结束或AI思考时不响应键盘输入
                    }
                    
                    // V3.8: 所有阶段默认都是向AI提问
                    askAI();
                }
            });
        }
        
        currentInputPhase = experimentPhase;
        inputAreaInitialized = true;
    }
    
    // V3.8: 只更新状态相关的属性，不重建HTML
    const chatInput = document.getElementById('chat-input');
    const askBtn = document.getElementById('ask-ai-btn');
    const submitBtn = document.getElementById('submit-final-report-btn');
    const sendBtn = document.getElementById('send-btn');
    
    if (chatInput) {
        const inputPlaceholder = isThinking ? "AI正在思考中..." : "记录您的观察和思考...";
        chatInput.placeholder = inputPlaceholder;
        chatInput.disabled = shouldDisable;
    }
    
    // V3.8: AI提问按钮在所有阶段都存在
    const askBtnText = isThinking ? "思考中..." : "向AI提问";
    if (askBtn) {
        askBtn.textContent = askBtnText;
        askBtn.disabled = shouldDisable;
    }
    
    if (experimentPhase === 'free') {
        // 自由探究阶段：更新提交最终反馈按钮
        const submitBtnText = isThinking ? "思考中..." : "提交最终总结并结束";
        if (submitBtn) {
            submitBtn.textContent = submitBtnText;
            submitBtn.disabled = shouldDisable;
        }
    } else {
        // 其他阶段：更新发送按钮
        const sendBtnText = isThinking ? "思考中..." : "发送";
        if (sendBtn) {
            sendBtn.textContent = sendBtnText;
            sendBtn.disabled = shouldDisable;
        }
    }
    
    console.log(`V3.8: 输入区域状态更新完成，阶段: ${experimentPhase}, 禁用: ${shouldDisable}`);
}

/**
 * V3.6: 重构后的主更新函数 - 职责分离
 * @param {Object} state - 全局状态
 */
export function updateChat(state) {
    // 职责分离：分别更新聊天记录和输入区域
    renderChatLog(state.chatHistory || []);
    updateInputArea(state.experimentPhase);
}

/**
 * 发送聊天消息
 * @private
 */
function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    // 终末锁定后不再允许发送
    const currentState = window.getState ? window.getState() : { isFinalized: false };
    if (currentState.isFinalized) return;
    
    if (message && onSendMessage) {
        onSendMessage({ type: 'send_message', payload: message });
        input.value = '';
    }
}

/**
 * askAI 函数 - 通过回调函数调用main.js的处理逻辑
 * @private
 */
function askAI() {
    const userInput = document.getElementById('chat-input');
    if (!userInput || !userInput.value.trim()) return;

    const currentState = window.getState ? window.getState() : { isFinalized: false };
    if (currentState.isFinalized) return; // 终末锁定后不允许AI交互

    const message = userInput.value;
    // 清空输入框
    userInput.value = '';

    // 通过回调函数调用main.js的handleSendMessage
    if (onSendMessage) {
        onSendMessage({ type: 'ask_ai', payload: message });
    }
}

/**
 * 提交最终反馈（自由探究阶段）
 * @private
 */
function submitFinalReport() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message) {
        alert('请输入您的最终反馈内容');
        return;
    }
    
    // 确认这是最终提交
    const isConfirmed = confirm('确认提交最终反馈并结束实验吗？\n\n提交后将无法继续操作，请确保您已完成所有探究。');
    
    if (isConfirmed && onSendMessage) {
        // 发送最终反馈
        onSendMessage({ type: 'final_report', payload: message });
        input.value = '';
        
        // 设置全局锁定状态与终末锁定
        if (window.updateState) {
            window.updateState({ 
                experimentEnded: true,
                isFinalized: true,
                isExperimentLocked: true,
                currentStep: { feedbackSubmitted: true }
            });
        }
        
        // 锁定所有控件（通过调用已导出的ControlPanel模块）
        try {
            import('./ControlPanel.js').then(mod => {
                if (mod && mod.lockAllControls) mod.lockAllControls();
            });
        } catch (e) {}
        
        // 停止分子模拟
        if (window.stopSimulation) {
            window.stopSimulation();
        }
    }
}

/**
 * 计算聊天历史的哈希值，用于比较是否真正发生变化
 * @param {Array} chatHistory - 聊天历史数组
 * @returns {string} 哈希值
 * @private
 */
function calculateChatHistoryHash(chatHistory) {
    if (!Array.isArray(chatHistory) || chatHistory.length === 0) {
        return 'empty';
    }
    
    // 使用消息数量、最后一条消息的内容和时间戳来生成简单哈希
    const lastMsg = chatHistory[chatHistory.length - 1];
    return `${chatHistory.length}-${lastMsg.content}-${lastMsg.timestamp}`;
}

/**
 * 检测用户是否正在手动滚动
 * @private
 */
function setupScrollDetection() {
    const chatLog = document.getElementById('chat-log');
    if (!chatLog) return;
    
    let scrollTimeout;
    
    chatLog.addEventListener('scroll', () => {
        isUserScrolling = true;
        lastScrollPosition = chatLog.scrollTop;
        
        // 清除之前的超时
        clearTimeout(scrollTimeout);
        
        // 500ms后认为用户停止滚动
        scrollTimeout = setTimeout(() => {
            isUserScrolling = false;
        }, 500);
    });
}

/**
 * 更新聊天界面（V3.6重构版）
 * 用于外部调用，集成了职责分离
 */
export function updateChatInterface() {
    const currentState = window.getState ? window.getState() : { 
        experimentPhase: 'welcome', 
        experimentEnded: false, 
        isThinking: false,
        chatHistory: []
    };
    
    // 职责分离：分别更新聊天记录和输入区域
    renderChatLog(currentState.chatHistory || []);
    updateInputArea(currentState.experimentPhase);
    
    console.log('V3.6: 聊天界面更新完成，职责分离');
}

