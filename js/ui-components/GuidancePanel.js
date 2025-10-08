/**
 * GuidancePanel.js
 * 引导面板模块 - 负责引导内容的初始化和更新
 * 显示当前实验阶段的指导信息和操作按钮
 */

// 常量定义
const FEEDBACK_HINT_TEXT = '请先在下方的【实验记录与反馈】窗口中提交您的观察和思考，然后再继续。';

// 图标常量 - Base64编码的SVG图标
const ICONS = {
    welcome: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiByeD0iMTAiIGZpbGw9IiNmNWY1ZjciLz4KPHN2ZyB4PSIzMCIgeT0iMzAiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjMDA3MWUzIj4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBjbGFzcz0ic2l6ZS02Ij4KICA8cGF0aCBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGQ9Ik0xMC41IDZhNy41IDcuNSAwIDEgMCAwIDE1IDcuNSA3LjUgMCAwIDAgMC0xNVoiIC8+CiAgPHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJtMTMuNSAxMC41IDYgNiIgLz4KICA8cGF0aCBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGQ9Im0xMy41IDEwLjUgNiA2IiAvPgo8L3N2Zz4KPC9zdmc+Cjwvc3ZnPg==',
    isothermal: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiByeD0iMTAiIGZpbGw9IiNmNWY1ZjciLz4KPGNpcmNsZSBjeD0iNjAiIGN5PSI2MCIgcj0iMzAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwNzFlMyIgc3Ryb2tlLXdpZHRoPSIzIi8+Cjx0ZXh0IHg9IjYwIiB5PSI2NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjMDA3MWUzIj5UPWNvbnN0PC90ZXh0Pgo8L3N2Zz4=',
    isobaric: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiByeD0iMTAiIGZpbGw9IiNmNWY1ZjciLz4KPGNpcmNsZSBjeD0iNjAiIGN5PSI2MCIgcj0iMzAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2RjMzU0NSIgc3Ryb2tlLXdpZHRoPSIzIi8+Cjx0ZXh0IHg9IjYwIiB5PSI2NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjZGMzNTQ1Ij5QPWNvbnN0PC90ZXh0Pgo8L3N2Zz4=',
    isochoric: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiByeD0iMTAiIGZpbGw9IiNmNWY1ZjciLz4KPGNpcmNsZSBjeD0iNjAiIGN5PSI2MCIgcj0iMzAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzI4YTc0NSIgc3Ryb2tlLXdpZHRoPSIzIi8+Cjx0ZXh0IHg9IjYwIiB5PSI2NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjMjhhNzQ1Ij5WPWNvbnN0PC90ZXh0Pgo8L3N2Zz4=',
    freeExplore: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiByeD0iMTAiIGZpbGw9IiNmNWY1ZjciLz4KPHN2ZyB4PSIzMCIgeT0iMzAiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjMjhhNzQ1Ij4KICA8cGF0aCBkPSJNMTIgMmwtMy4wOSA2LjI2TDIgOS4yN2w1IDQuODctMS4xOCA2Ljg4TDEyIDIxbDYuMTgtLjk4TDIzIDE0LjE0bC01LTQuODdMMjEuMDkgMi4yNnoiLz4KPC9zdmc+Cjwvc3ZnPg=='
};

// 回调函数引用
let onFlowAction = null;

/**
 * 初始化引导面板
 * @param {Function} flowActionCallback - 流程动作回调
 */
export function initGuidance(flowActionCallback) {
    console.log('🎯 GuidancePanel.initGuidance被调用');
    console.log('flowActionCallback类型:', typeof flowActionCallback);
    
    onFlowAction = flowActionCallback;
    
    // 初始化全局引用
    guidanceContentElement = document.getElementById('guidance-content');
    
    if (!guidanceContentElement) {
        console.error('❌ GuidancePanel: guidance-content元素未找到！');
        // 等待DOM加载完成后重试
        setTimeout(() => {
            guidanceContentElement = document.getElementById('guidance-content');
            if (guidanceContentElement) {
                console.log('✅ GuidancePanel: 重试成功，找到guidance-content元素');
                initGuidanceContent();
            } else {
                console.error('❌ GuidancePanel: 重试失败，仍然找不到guidance-content元素');
            }
        }, 100);
        return;
    }
    
    console.log('✅ GuidancePanel: guidance-content元素找到');
    initGuidanceContent();
}

// 初始化引导内容
function initGuidanceContent() {
    if (!guidanceContentElement) {
        console.error('❌ GuidancePanel: guidance-content元素未找到！');
        return;
    }
    
    // 设置初始的欢迎内容，确保页面加载时有内容显示
    guidanceContentElement.innerHTML = `
        <img src="${ICONS.welcome}" alt="欢迎图标" class="guidance-illustration">
        <h4 class="guidance-title">欢迎来到理想气体实验室！</h4>
        <p class="guidance-text">
            您将通过三个引导实验逐步探索理想气体定律：<br>
            <strong>第一步</strong>：波义耳定律（等温过程）<br>
            <strong>第二步</strong>：查理定律（等压过程）<br>
            <strong>第三步</strong>：盖-吕萨克定律（等容过程）
        </p>
        <p class="guidance-text" style="color: #dc3545; font-weight: bold;">
            请按照引导完成每个实验，在下方记录观察，然后点击"下一步"继续！
        </p>
        <div class="guidance-buttons">
            <button id="start-experiment-btn" class="action-btn primary">开始实验</button>
        </div>
    `;
    
    // 使用事件委托绑定按钮事件
    guidanceContentElement.addEventListener('click', (event) => {
        const target = event.target;
        
        if (target.id === 'start-experiment-btn') {
            console.log('🔔 开始实验按钮被点击');
            console.log('onFlowAction存在:', !!onFlowAction);
            if (onFlowAction) {
                console.log('📡 调用onFlowAction({ type: "start_experiment" })');
                onFlowAction({ type: 'start_experiment' });
            } else {
                console.error('❌ onFlowAction未定义，无法处理按钮点击');
            }
        }
    });
    
    console.log('✅ GuidancePanel.initGuidance完成，初始内容已设置');
}

/**
 * V2.2.6: 增强版步骤管理 - 检查多条件
 * @param {Object} currentStep - 当前步骤状态
 * @param {boolean} isExperimentLocked - 实验是否被锁定
 * @returns {string} 按钮HTML字符串
 */
function generateGuidanceButtons(currentStep, isExperimentLocked = false, experimentPhase) {
    console.log('生成引导按钮，当前步骤状态:', currentStep, '当前阶段:', experimentPhase);
    
    // 根据不同阶段检查不同条件
    let conditionsMet = false;
    let hintText = '';
    
    switch (experimentPhase) {
        case 'guided_1':
            conditionsMet = currentStep.selected_real_gas && 
                          currentStep.locked_temperature && 
                          currentStep.adjusted_volume &&
                          currentStep.feedbackSubmitted;
            if (!conditionsMet) {
                hintText = !currentStep.selected_real_gas ? '请先选择一种真实气体' :
                          !currentStep.locked_temperature ? '请锁定温度(T)' :
                          !currentStep.adjusted_volume ? '请尝试减小体积(V)观察变化' :
                          !currentStep.feedbackSubmitted ? '请描述您观察到的现象' : '';
            }
            break;
            
        case 'guided_2':
            conditionsMet = currentStep.switched_gas && 
                          currentStep.locked_volume && 
                          currentStep.adjusted_temperature &&
                          currentStep.feedbackSubmitted;
            if (!conditionsMet) {
                hintText = !currentStep.switched_gas ? '请切换到另一种气体' :
                          !currentStep.locked_volume ? '请锁定体积(V)' :
                          !currentStep.adjusted_temperature ? '请尝试改变温度观察变化' :
                          !currentStep.feedbackSubmitted ? '请记录您的发现' : '';
            }
            break;
            
        case 'guided_3':
            conditionsMet = currentStep.selected_custom_gas && 
                          (currentStep.adjusted_a || currentStep.adjusted_b) &&
                          currentStep.feedbackSubmitted;
            if (!conditionsMet) {
                hintText = !currentStep.selected_custom_gas ? '请选择"自定义气体"' :
                          !(currentStep.adjusted_a || currentStep.adjusted_b) ? '请尝试调节a值或b值' :
                          !currentStep.feedbackSubmitted ? '请记录您的实验结论' : '';
            }
            break;
            
        default:
            conditionsMet = currentStep.feedbackSubmitted;
            if (!conditionsMet) {
                hintText = '请提交您的反馈';
            }
    }
    
    const isDisabled = !conditionsMet || isExperimentLocked;
    
    // V2.2.6: 改进按钮生成逻辑
    const showNextButton = currentStep.feedbackSubmitted || conditionsMet;
    console.log('是否显示下一步按钮:', showNextButton, '是否禁用:', isDisabled);
    
    return `
        <div class="guidance-buttons">
            ${showNextButton ? 
                `<button id="next-step-btn" class="action-btn primary" ${isDisabled ? 'disabled' : ''}>
                    下一步
                </button>` : 
                ''
            }
            ${(isDisabled || !showNextButton) && hintText ? 
                `<div class="next-step-hint is-visible">${hintText}</div>` : 
                ''
            }
        </div>
    `;
}

/**
 * V2.2.6: 更新引导内容 - 新版教学策略
 * @param {Object} state - 全局状态
 */
// 全局引用，避免重复声明
let guidanceContentElement = null;

export function updateGuidance(state) {
    console.log('updateGuidance被调用，当前状态:', state);
    
    // 获取或更新引导内容元素引用
    if (!guidanceContentElement) {
        guidanceContentElement = document.getElementById('guidance-content');
    }
    
    if (!guidanceContentElement) {
        console.error('guidance-content元素未找到！');
        return;
    }
    
    // V3.3: 门控逻辑 - 检查实验是否被锁定
    const isExperimentLocked = state.isExperimentLocked || false;
    
    if (state.experimentPhase === 'welcome') {
        guidanceContentElement.innerHTML = `
            <img src="${ICONS.welcome}" alt="欢迎图标" class="guidance-illustration">
            <h4 class="guidance-title">欢迎来到真实气体探究沙箱！</h4>
            <p class="guidance-text">理想气体定律是一个完美的模型，但现实世界的气体并非如此。您是否想过，它们为何以及如何偏离理想状态？</p>
            <p class="guidance-text">本平台将引导您通过互动实验，亲手发现这种偏差，并利用<strong>范德华方程</strong>解开其背后的秘密。</p>
            <div class="guidance-buttons">
                <button id="start-experiment-btn" class="action-btn primary" ${isExperimentLocked ? 'disabled' : ''}>开启探索之旅</button>
            </div>
        `;
    } else if (state.experimentPhase === 'guided_1') {
        guidanceContentElement.innerHTML = `
            <img src="${ICONS.isothermal}" alt="探究偏差示意图" class="guidance-illustration">
            <h4 class="guidance-title">第一步：基准与偏差</h4>
            <p class="guidance-text">熟悉的等温过程，在真实气体中会有何不同？请先选择一种<strong>真实气体</strong>(如二氧化碳)，再<strong>锁定温度(T)</strong>。</p>
            <p class="guidance-text">然后，通过<strong>减小体积(V)</strong>来增加压强，仔细观察蓝色"实验数据"曲线与灰色"理想气体基准线"是如何分离的。<strong>在高压区域，偏差尤为明显。</strong></p>
            <p class="guidance-text" style="color: #17a2b8; font-weight: bold;">请在下方描述您观察到的现象，以解锁下一步。</p>
            ${generateGuidanceButtons(state.currentStep, isExperimentLocked)}
        `;
    } else if (state.experimentPhase === 'guided_2') {
        guidanceContentElement.innerHTML = `
            <img src="${ICONS.isochoric}" alt="模型解释示意图" class="guidance-illustration">
            <h4 class="guidance-title">第二步：探源与归因</h4>
            <p class="guidance-text">您看到的偏差，源于范德华方程对分子<strong>引力(a)</strong>和<strong>体积(b)</strong>的修正。不同气体的 a, b 值不同，其偏离理想状态的程度也不同。</p>
            <p class="guidance-text">请尝试<strong>切换到另一种真实气体</strong>(如氦气)，保持等容（锁定V）并升高温度，对比它的压力变化与上一步中气体的差异。</p>
            <p class="guidance-text" style="color: #17a2b8; font-weight: bold;">对比不同气体的行为后，请提交您的发现。</p>
            ${generateGuidanceButtons(state.currentStep, isExperimentLocked)}
        `;
    } else if (state.experimentPhase === 'guided_3') {
        guidanceContentElement.innerHTML = `
            <img src="${ICONS.freeExplore}" alt="自定义探究示意图" class="guidance-illustration">
            <h4 class="guidance-title">第三步：固化与应用</h4>
            <p class="guidance-text">现在，让我们亲手"创造"一种气体。请在气体选择器中选择<strong>"自定义气体"</strong>，以解锁 a, b 参数调节功能。</p>
            <p class="guidance-text">尝试<strong>单独增大 a 值（引力）</strong>或<strong>单独增大 b 值（体积）</strong>，观察它们分别对气体行为有何影响。您能创造出比二氧化碳偏离度更大的气体吗？</p>
            <p class="guidance-text" style="color: #17a2b8; font-weight: bold;">完成您的自定义实验后，请记录并提交您的结论。</p>
            ${generateGuidanceButtons(state.currentStep, isExperimentLocked)}
        `;
    } else if (state.experimentPhase === 'free') {
        guidanceContentElement.innerHTML = `
            <img src="${ICONS.freeExplore}" alt="自由探索图标" class="guidance-illustration">
            <h4 class="guidance-title">自由探索模式</h4>
            <p class="guidance-text">恭喜您已掌握真实气体模型的核心！现在您可以自由调节所有参数，深入探索了。</p>
            <p class="guidance-text">试试观察新加入的"器壁碰撞监视器"，它的数据与宏观压强有怎样的联系？或者，不同气体的 a, b 值差异在真实世界中又对应着什么物理特性呢？</p>
            <div class="guidance-buttons">
                <button id="request-evaluation-btn" class="action-btn primary">完成实验并获取评价</button>
            </div>
        `;
    }
    
    // V2.2.6: 优化按钮事件管理 - 使用事件委托
    // 移除旧的事件监听器
    const oldContent = guidanceContentElement.cloneNode(true);
    guidanceContentElement.parentNode.replaceChild(oldContent, guidanceContentElement);
    guidanceContentElement = oldContent;
    
    // 使用事件委托处理按钮点击
    oldContent.addEventListener('click', (event) => {
        const target = event.target;
        
        // 处理"下一步"按钮点击
        if (target.id === 'next-step-btn') {
            console.log('下一步按钮被点击');
            if (onFlowAction && !target.disabled) {
                console.log('触发next_step事件');
                onFlowAction({ type: 'next_step' });
            } else {
                console.log('按钮被禁用或onFlowAction未定义', {
                    onFlowAction: !!onFlowAction,
                    disabled: target.disabled
                });
            }
        }
        
        // 处理"开始实验"按钮点击
        if (target.id === 'start-experiment-btn') {
            console.log('开始实验按钮被点击');
            if (onFlowAction && !target.disabled) {
                console.log('触发start_experiment事件');
                onFlowAction({ type: 'start_experiment' });
            }
        }

        // 触发实验评价
        if (target.id === 'request-evaluation-btn') {
            if (window.requestEvaluation) {
                window.requestEvaluation();
            }
        }
    });
}

