/**
 * FloatingWindows.js
 * 浮动窗口模块 - 负责操作日志浮窗和欢迎弹窗的管理
 */

// 回调函数引用
let onFlowAction = null;

/**
 * 初始化浮动操作日志
 */
export function initFloatingLog() {
    // 操作日志浮窗初始化逻辑
    console.log('浮动日志窗口初始化');
}

/**
 * 更新浮动日志内容
 * @param {Object} state - 全局状态
 */
export function updateFloatingLog(state) {
    const logContent = document.getElementById('log-content');
    if (!logContent) return;
    
    // 安全检查：确保log存在且是数组
    if (!state || !Array.isArray(state.log)) {
        console.warn('FloatingWindows: state.log不存在或不是数组');
        return;
    }
    
    // 只显示最近10条日志
    const recentLogs = state.log.slice(-10);
    
    logContent.innerHTML = recentLogs.map(entry => `
        <div class="log-entry">
            <span class="log-time">[${entry.timestamp}]</span>
            <span class="log-text">${entry.text}</span>
        </div>
    `).join('');
    
    // 滚动到底部
    logContent.scrollTop = logContent.scrollHeight;
}

/**
 * 初始化欢迎弹窗
 * @param {Function} flowActionCallback - 流程动作回调
 */
export function initWelcomeModal(flowActionCallback) {
    onFlowAction = flowActionCallback;
    
    const modal = document.getElementById('welcome-modal');
    const okBtn = document.getElementById('welcome-ok-btn');
    
    if (okBtn) {
        okBtn.addEventListener('click', () => {
            showWelcomeModal(false);
            if (onFlowAction) {
                onFlowAction({ type: 'start_experiment' });
            }
        });
    }
}

/**
 * 显示或隐藏欢迎弹窗
 * @param {boolean} show - 是否显示
 */
export function showWelcomeModal(show) {
    const modal = document.getElementById('welcome-modal');
    if (modal) {
        if (show) {
            modal.classList.remove('hidden');
            modal.style.visibility = 'visible';
            modal.style.opacity = '1';
        } else {
            modal.classList.add('hidden');
            // 延迟隐藏以配合过渡动画
            setTimeout(() => {
                modal.style.visibility = 'hidden';
                modal.style.opacity = '0';
            }, 300);
        }
    }
}

