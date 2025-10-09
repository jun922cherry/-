/**
 * ControlPanel.js
 * 控制面板模块 - 负责实验参数控制面板的初始化和更新
 * 包括所有滑块、锁定按钮和重置按钮
 */

/**
 * 节流函数 - 限制函数调用频率
 * @param {Function} func - 要节流的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function} 节流后的函数
 */
function throttle(func, delay) {
    let lastCall = 0;
    let timeoutId = null;
    
    return function(...args) {
        const now = Date.now();
        const timeSinceLastCall = now - lastCall;
        
        // 清除之前的待执行调用
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        
        if (timeSinceLastCall >= delay) {
            // 如果距离上次调用已超过延迟时间，立即执行
            lastCall = now;
            func.apply(this, args);
        } else {
            // 否则，延迟执行以确保最后一次调用会被执行
            timeoutId = setTimeout(() => {
                lastCall = Date.now();
                func.apply(this, args);
            }, delay - timeSinceLastCall);
        }
    };
}

/**
 * 初始化控制面板
 * @param {Function} onControlChange - 控件变化回调
 * @param {Function} onFlowAction - 流程动作回调
 * @param {Function} onLockToggle - 锁定切换回调
 */
export function initControls(onControlChange, onFlowAction, onLockToggle) {
    const controlsContainer = document.getElementById('controls-container');
    
    controlsContainer.innerHTML = `
        <div class="controls-grid">
            <!-- V2.2.1: P,V,T,n 在上方2x2网格 -->
            <div class="control-group">
                <div class="control-label-with-lock">
                    <label for="pressure-control">压强 (kPa)</label>
                    <button class="lock-btn" id="pressure-lock" data-variable="P" title="点击锁定压强">🔓</button>
                </div>
                <div class="control-wrapper">
                    <input type="range" id="pressure-control" min="50" max="200" step="1" value="101.325">
                    <span id="pressure-value">101.3</span>
                </div>
            </div>
            
            <div class="control-group">
                <div class="control-label-with-lock">
                    <label for="volume-control">体积 (L)</label>
                    <button class="lock-btn" id="volume-lock" data-variable="V" title="点击锁定体积">🔓</button>
                </div>
                <div class="control-wrapper">
                    <input type="range" id="volume-control" min="10" max="50" step="0.1" value="22.4">
                    <span id="volume-value">22.4</span>
                </div>
            </div>
            
            <div class="control-group">
                <div class="control-label-with-lock">
                    <label for="temperature-control">温度 (K)</label>
                    <button class="lock-btn" id="temperature-lock" data-variable="T" title="点击锁定温度">🔓</button>
                </div>
                <div class="control-wrapper">
                    <input type="range" id="temperature-control" min="200" max="400" step="1" value="273.15">
                    <span id="temperature-value">273</span>
                </div>
            </div>
            
            <div class="control-group">
                <label for="moles-control">物质的量 (mol)</label>
                <div class="control-wrapper">
                    <input type="range" id="moles-control" min="0.5" max="3" step="0.1" value="1.0">
                    <span id="moles-value">1.0</span>
                </div>
            </div>
        </div>
        
        <!-- V2.2.1: 气体选择区域，独立成行，放在底部 -->
        <div class="gas-selection-row" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 20px; padding: 16px; background: rgba(248, 250, 252, 0.8); border-radius: 12px; border: 1px solid rgba(226, 232, 240, 0.6);">
            <div class="control-group" style="margin: 0;">
                <label for="gas-type-select" style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; display: block;">气体类型</label>
                <select id="gas-type-select" style="width: 100%; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 14px; background: white; cursor: pointer;">
                    <option value="ideal" selected>理想气体</option>
                    <option value="N2">氮气 (N₂)</option>
                    <option value="O2">氧气 (O₂)</option>
                    <option value="CO2">二氧化碳 (CO₂)</option>
                    <option value="H2">氢气 (H₂)</option>
                    <option value="custom">自定义气体</option>
                </select>
            </div>
            
            <div class="control-group" style="margin: 0;">
                <label for="a-control" style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; display: block;">范德华常数 a (L²·kPa/mol²)</label>
                <div class="control-wrapper" style="margin: 0;">
                    <input type="range" id="a-control" min="0" max="500" step="1" value="0" disabled>
                    <span id="a-value">0</span>
                </div>
            </div>
            
            <div class="control-group" style="margin: 0;">
                <label for="b-control" style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; display: block;">范德华常数 b (L/mol)</label>
                <div class="control-wrapper" style="margin: 0;">
                    <input type="range" id="b-control" min="0" max="0.1" step="0.001" value="0" disabled>
                    <span id="b-value">0.000</span>
                </div>
            </div>
        </div>
        
        <div class="control-actions">
            <button id="reset-btn" class="action-btn secondary">重置</button>
        </div>
    `;
    
    // 绑定事件监听器
    bindControlEvents(onControlChange, onFlowAction, onLockToggle);
    
    // 检查滑块状态并确保它们未被意外禁用
    setTimeout(() => {
        checkSliderStatus();
        
        // 如果实验未结束，确保滑块可用
        if (window.getState && !window.getState().experimentEnded) {
            console.log('实验未结束，确保滑块可用');
            unlockAllControls();
        }
    }, 100);
}

/**
 * 绑定控制面板事件
 * @private
 */
function bindControlEvents(onControlChange, onFlowAction, onLockToggle) {
    console.log('绑定控制面板事件');
    
    // V2.1: 绑定气体类型选择事件
    const gasTypeSelect = document.getElementById('gas-type-select');
    gasTypeSelect.addEventListener('change', (e) => {
        const gasType = e.target.value;
        console.log(`🔄 气体类型切换: ${gasType}`);
        
        // 导入physics.js以获取气体常数
        import('../physics.js').then(physics => {
            const gasConstants = physics.getGasConstants(gasType);
            
            // 更新全局状态
            if (onControlChange) {
                onControlChange({
                    type: 'gas_type_change',
                    payload: {
                        gasType: gasType,
                        a: gasConstants.a,
                        b: gasConstants.b
                    }
                });
            }
            
            // 更新a和b滑块的状态
            const aControl = document.getElementById('a-control');
            const bControl = document.getElementById('b-control');
            const aValue = document.getElementById('a-value');
            const bValue = document.getElementById('b-value');
            
            if (gasType === 'custom') {
                // 解锁a和b滑块
                aControl.disabled = false;
                bControl.disabled = false;
            } else {
                // 锁定a和b滑块，并设置为预设值
                aControl.disabled = true;
                bControl.disabled = true;
                aControl.value = gasConstants.a;
                bControl.value = gasConstants.b;
                aValue.textContent = gasConstants.a.toFixed(1);
                bValue.textContent = gasConstants.b.toFixed(3);
            }
        });
    });
    
    // V2.1: 绑定a和b参数滑块事件
    const aControl = document.getElementById('a-control');
    const bControl = document.getElementById('b-control');
    const aValue = document.getElementById('a-value');
    const bValue = document.getElementById('b-value');
    
    aControl.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        aValue.textContent = value.toFixed(1);
        
        if (onControlChange && !e.target.disabled) {
            onControlChange({
                type: 'control_change',
                payload: { var: 'a', value }
            });
        }
    });
    
    bControl.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        bValue.textContent = value.toFixed(3);
        
        if (onControlChange && !e.target.disabled) {
            onControlChange({
                type: 'control_change',
                payload: { var: 'b', value }
            });
        }
    });
    
    const controls = [
        { name: 'pressure', var: 'P' },
        { name: 'volume', var: 'V' },
        { name: 'temperature', var: 'T' },
        { name: 'moles', var: 'n' }
    ];
    
    controls.forEach(({ name, var: controlVar }) => {
        const slider = document.getElementById(`${name}-control`);
        const valueSpan = document.getElementById(`${name}-value`);
        
        console.log(`绑定滑块: ${name}-control, 是否禁用:`, slider ? slider.disabled : '未找到');
        
        // 创建节流版本的状态更新函数（100ms延迟）
        const throttledUpdate = throttle((value, targetElement) => {
            if (targetElement.disabled) {
                console.warn(`⚠️ 滑块 ${name} 被禁用，跳过节流更新`);
                return;
            }
            
            if (onControlChange) {
                console.log(`📡 [节流后] 调用 onControlChange: ${controlVar} = ${value}`);
                onControlChange({
                    type: 'control_change',
                    payload: { var: controlVar, value }
                });
            } else {
                console.warn('⚠️ onControlChange 回调函数未设置');
            }
        }, 100); // 100ms节流延迟
        
        // 滑块变化事件
        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            // 立即更新UI显示（无节流），保持流畅的视觉反馈
            valueSpan.textContent = value.toFixed(1);
            
            console.log(`🎛️ 滑块事件触发: ${name} (${controlVar}) = ${value}, 是否禁用: ${e.target.disabled}`);
            
            // 使用节流函数处理状态更新和物理计算
            throttledUpdate(value, e.target);
        });
    });
    
    // 重置按钮
    document.getElementById('reset-btn').addEventListener('click', () => {
        if (onFlowAction) {
            onFlowAction({ type: 'reset' });
        }
    });
    
    // 锁定按钮事件
    const lockButtons = ['pressure-lock', 'volume-lock', 'temperature-lock'];
    lockButtons.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        button.addEventListener('click', () => {
            const variable = button.dataset.variable;
            if (onLockToggle) {
                onLockToggle({ type: 'lock_toggle', payload: { variable } });
            }
        });
    });
}

/**
 * V2.1: 更新控制面板（支持气体类型和a,b参数）
 * @param {Object} state - 全局状态
 */
export function updateControls(state) {
    // V3.3: 门控逻辑 - 检查是否需要禁用控件
    const isLocked = state.isExperimentLocked || false;
    const isFinalized = !!state.isFinalized;
    
    console.log(`🔍 updateControls 调用 - 阶段: ${state.experimentPhase}, 锁定状态: ${isLocked}, 终末锁定: ${isFinalized}`);
    
    const controlsContainer = document.getElementById('controls-container');
    if (controlsContainer) {
        if (isFinalized) {
            controlsContainer.classList.add('ui-locked');
        } else {
            controlsContainer.classList.remove('ui-locked');
        }
    }
    
    // 原有更新逻辑
    // V2.1: 更新气体类型选择器
    const gasTypeSelect = document.getElementById('gas-type-select');
    if (gasTypeSelect && state.gasType) {
        gasTypeSelect.value = state.gasType;
    }
    
    // V2.1: 更新a和b参数
    const aControl = document.getElementById('a-control');
    const bControl = document.getElementById('b-control');
    const aValue = document.getElementById('a-value');
    const bValue = document.getElementById('b-value');
    
    if (aControl && state.a !== undefined) {
        aControl.value = state.a;
        aValue.textContent = state.a.toFixed(1);
    }
    
    if (bControl && state.b !== undefined) {
        bControl.value = state.b;
        bValue.textContent = state.b.toFixed(3);
    }
    
    // 根据气体类型决定a和b滑块的禁用状态
    if (state.gasType === 'custom') {
        if (aControl) aControl.disabled = false;
        if (bControl) bControl.disabled = false;
    } else {
        if (aControl) aControl.disabled = true;
        if (bControl) bControl.disabled = true;
    }
    
    // 更新滑块值
    document.getElementById('pressure-control').value = state.P;
    document.getElementById('pressure-value').textContent = state.P.toFixed(1);
    
    document.getElementById('volume-control').value = state.V;
    document.getElementById('volume-value').textContent = state.V.toFixed(1);
    
    document.getElementById('temperature-control').value = state.T;
    document.getElementById('temperature-value').textContent = state.T.toFixed(0);
    
    document.getElementById('moles-control').value = state.n;
    document.getElementById('moles-value').textContent = state.n.toFixed(1);
    
    // V3.3/V2.EVAL：根据锁定与终末锁定禁用/启用所有滑块
    const sliders = ['pressure-control', 'volume-control', 'temperature-control', 'moles-control', 'a-control', 'b-control'];
    sliders.forEach(sliderId => {
        const slider = document.getElementById(sliderId);
        if (slider) {
            const prev = slider.disabled;
            slider.disabled = isLocked || isFinalized || slider.disabled; // 如果已是不可用保持不可用
            if (prev !== slider.disabled) {
                console.log(`🎛️ 滑块 ${sliderId} 状态变化: ${prev ? '禁用' : '启用'} → ${slider.disabled ? '禁用' : '启用'}`);
            }
        }
    });
    
    // 禁用所有操作按钮（重置、锁定按钮等）
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) resetBtn.disabled = isLocked || isFinalized;
    
    const lockButtons = ['pressure-lock', 'volume-lock', 'temperature-lock'];
    lockButtons.forEach(id => { const b = document.getElementById(id); if (b) b.disabled = isLocked || isFinalized; });
    
    if (isLocked || isFinalized) {
        console.log('🔒 控制面板已禁用');
    } else {
        console.log('🔓 控制面板可用');
    }
    
    // 更新锁定按钮状态（视觉）
    const lockControls = [
        { var: 'P', buttonId: 'pressure-lock' },
        { var: 'V', buttonId: 'volume-lock' },
        { var: 'T', buttonId: 'temperature-lock' }
    ];
    
    lockControls.forEach(({ var: controlVar, buttonId }) => {
        const lockButton = document.getElementById(buttonId);
        if (state.lockedVariable === controlVar) {
            lockButton.textContent = '🔒';
            lockButton.classList.add('locked');
            lockButton.title = `点击解锁${controlVar === 'P' ? '压强' : controlVar === 'V' ? '体积' : '温度'}`;
        } else {
            lockButton.textContent = '🔓';
            lockButton.classList.remove('locked');
            lockButton.title = `点击锁定${controlVar === 'P' ? '压强' : controlVar === 'V' ? '体积' : '温度'}`;
        }
    });
}

/**
 * 解锁所有控制面板元素
 */
export function unlockAllControls() {
    const sliders = ['pressure-control', 'volume-control', 'temperature-control', 'moles-control'];
    sliders.forEach(sliderId => {
        const slider = document.getElementById(sliderId);
        if (slider) {
            slider.disabled = false;
            console.log(`✅ 滑块 ${sliderId} 已解锁`);
        }
    });
    
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.disabled = false;
    }
}

/**
 * 锁定所有控制面板元素
 */
export function lockAllControls() {
    const sliders = ['pressure-control', 'volume-control', 'temperature-control', 'moles-control'];
    sliders.forEach(sliderId => {
        const slider = document.getElementById(sliderId);
        if (slider) {
            slider.disabled = true;
            console.log(`🔒 滑块 ${sliderId} 已锁定`);
        }
    });
    
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.disabled = true;
    }
}

/**
 * 检查滑块状态
 * @private
 */
function checkSliderStatus() {
    const sliders = ['pressure-control', 'volume-control', 'temperature-control', 'moles-control'];
    sliders.forEach(sliderId => {
        const slider = document.getElementById(sliderId);
        if (slider) {
            console.log(`滑块 ${sliderId} 状态: 禁用=${slider.disabled}, 值=${slider.value}`);
        }
    });
}

/**
 * 恢复滑块到指定值
 * @param {string} variable - 变量名 ('P', 'V', 'T', 'n')
 * @param {number} value - 要恢复的值
 */
export function revertSlider(variable, value) {
    const controlMap = {
        'P': 'pressure',
        'V': 'volume',
        'T': 'temperature',
        'n': 'moles'
    };
    
    const controlName = controlMap[variable];
    if (!controlName) {
        console.warn(`未知的变量: ${variable}`);
        return;
    }
    
    const slider = document.getElementById(`${controlName}-control`);
    const valueSpan = document.getElementById(`${controlName}-value`);
    
    if (slider && valueSpan) {
        slider.value = value;
        valueSpan.textContent = value.toFixed(variable === 'T' ? 0 : 1);
        console.log(`🔙 滑块 ${controlName} 已恢复到: ${value}`);
    }
}

