/**
 * Notifier.js
 * 全局通知系统 - 提供非侵入式的用户提示功能
 * 支持info、warning、error三种类型的通知
 */

// 通知队列，用于管理多个通知
let notificationQueue = [];
let isProcessing = false;

/**
 * 显示通知
 * @param {string} message - 通知消息内容
 * @param {string} type - 通知类型 ('info', 'warning', 'error')
 * @param {number} duration - 显示时长（毫秒），默认3000ms
 */
export function show(message, type = 'info', duration = 3000) {
    // 将通知加入队列
    notificationQueue.push({ message, type, duration });
    
    // 如果当前没有正在显示的通知，开始处理队列
    if (!isProcessing) {
        processQueue();
    }
}

/**
 * 处理通知队列
 * @private
 */
function processQueue() {
    if (notificationQueue.length === 0) {
        isProcessing = false;
        return;
    }
    
    isProcessing = true;
    const { message, type, duration } = notificationQueue.shift();
    
    // 创建或获取通知容器
    let notifier = document.getElementById('global-notifier');
    if (!notifier) {
        notifier = createNotifierElement();
        document.body.appendChild(notifier);
    }
    
    // 设置通知内容和类型
    notifier.textContent = message;
    notifier.className = `notifier notifier-${type}`;
    
    // 显示通知
    notifier.classList.add('show');
    
    console.log(`📢 [Notifier] 显示${type}通知: ${message}`);
    
    // 自动隐藏
    setTimeout(() => {
        hideNotification(notifier);
        
        // 延迟后处理下一个通知
        setTimeout(() => {
            processQueue();
        }, 300); // 等待淡出动画完成
    }, duration);
}

/**
 * 隐藏通知
 * @param {HTMLElement} notifier - 通知元素
 * @private
 */
function hideNotification(notifier) {
    notifier.classList.remove('show');
}

/**
 * 创建通知DOM元素
 * @returns {HTMLElement} 通知容器
 * @private
 */
function createNotifierElement() {
    const notifier = document.createElement('div');
    notifier.id = 'global-notifier';
    notifier.className = 'notifier';
    
    // 添加样式（如果还没有添加）
    if (!document.getElementById('notifier-styles')) {
        const style = document.createElement('style');
        style.id = 'notifier-styles';
        style.textContent = `
            .notifier {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%) translateY(-100px);
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 10000;
                opacity: 0;
                transition: all 0.3s ease-in-out;
                max-width: 600px;
                text-align: center;
                pointer-events: none;
            }
            
            .notifier.show {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
                pointer-events: auto;
            }
            
            .notifier-info {
                background-color: #3498db;
                color: white;
            }
            
            .notifier-warning {
                background-color: #f39c12;
                color: white;
            }
            
            .notifier-error {
                background-color: #e74c3c;
                color: white;
            }
        `;
        document.head.appendChild(style);
    }
    
    return notifier;
}

/**
 * 清空通知队列
 */
export function clearQueue() {
    notificationQueue = [];
    const notifier = document.getElementById('global-notifier');
    if (notifier) {
        hideNotification(notifier);
    }
    isProcessing = false;
}

