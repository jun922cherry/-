// UI管理模块 - 封装所有DOM操作和UI更新逻辑
// 负责控制面板、图表、引导、聊天等UI组件的更新

let chart = null;
let onControlChange = null;
let onPlotSwitch = null;
let onSendMessage = null;
let onFlowAction = null;
let onLockToggle = null;

// 初始化UI模块
export function init(controlChangeCallback, plotSwitchCallback, sendMessageCallback, flowActionCallback, lockToggleCallback) {
    console.log('UI管理器初始化');
    
    // 保存回调函数
    onControlChange = controlChangeCallback;
    onPlotSwitch = plotSwitchCallback;
    onSendMessage = sendMessageCallback;
    onFlowAction = flowActionCallback;
    onLockToggle = lockToggleCallback;
    
    // 初始化各个UI组件
    initControls();
    initPlot();
    initGuidance();
    initChat();
    initFloatingLog();
    initWelcomeModal();
    
    console.log('UI组件初始化完成');
}

// V3.8: 修复关键BUG - 避免频繁重建聊天界面
let lastChatUpdateState = null;
let lastInputAreaState = null;

// 主更新函数
export function update(currentState) {
    updateControls(currentState);
    updatePlot(currentState);
    updateGuidance(currentState);
    
    // V3.8: 只在聊天相关状态真正改变时才更新聊天界面
    const chatRelevantState = {
        experimentPhase: currentState.experimentPhase,
        experimentEnded: currentState.experimentEnded,
        isThinking: currentState.isThinking
    };
    
    const chatStateChanged = !lastChatUpdateState || 
        JSON.stringify(chatRelevantState) !== JSON.stringify(lastChatUpdateState);
    
    if (chatStateChanged) {
        console.log('V3.8: 聊天状态改变，更新界面');
        updateChatInterface();
        lastChatUpdateState = { ...chatRelevantState };
    } else {
        // V3.8: 即使聊天界面不更新，也要检查输入区域是否需要更新
        const inputRelevantState = {
            experimentPhase: currentState.experimentPhase,
            experimentEnded: currentState.experimentEnded,
            isThinking: currentState.isThinking
        };
        
        const inputStateChanged = !lastInputAreaState || 
            JSON.stringify(inputRelevantState) !== JSON.stringify(lastInputAreaState);
        
        if (inputStateChanged) {
            console.log('V3.8: 输入区域状态改变，仅更新输入区域');
            updateInputArea(currentState.experimentPhase);
            lastInputAreaState = { ...inputRelevantState };
        }
    }
    
    updateChat(currentState);
    updateFloatingLog(currentState);
}

// 初始化控制面板
function initControls() {
    const controlsContainer = document.getElementById('controls-container');
    
    controlsContainer.innerHTML = `
        <div class="controls-grid">
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
        
        <div class="control-actions">
            <button id="reset-btn" class="action-btn secondary">重置</button>
        </div>
    `;
    
    // 绑定事件监听器
    bindControlEvents();
    
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

// 绑定控制面板事件
function bindControlEvents() {
    console.log('绑定控制面板事件');
    
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
        
        // 滑块变化事件
        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            valueSpan.textContent = value.toFixed(1);
            
            console.log(`🎛️ 滑块事件触发: ${name} (${controlVar}) = ${value}, 是否禁用: ${e.target.disabled}`);
            
            if (e.target.disabled) {
                console.warn(`⚠️ 滑块 ${name} 被禁用，无法响应事件`);
                return;
            }
            
            if (onControlChange) {
                console.log(`📡 调用 onControlChange: ${controlVar} = ${value}`);
                onControlChange({
                    type: 'control_change',
                    payload: { var: controlVar, value }
                });
            } else {
                console.warn('⚠️ onControlChange 回调函数未设置');
            }
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

// 更新控制面板
function updateControls(state) {
    // V3.3: 门控逻辑 - 检查是否需要禁用控件
    const isLocked = state.isExperimentLocked || false;
    
    // 调试信息：详细记录锁定状态
    console.log(`🔍 updateControls 调用 - 阶段: ${state.experimentPhase}, 锁定状态: ${isLocked}, 反馈已提交: ${state.currentStep?.feedbackSubmitted}`);
    
    // 更新滑块值
    document.getElementById('pressure-control').value = state.P;
    document.getElementById('pressure-value').textContent = state.P.toFixed(1);
    
    document.getElementById('volume-control').value = state.V;
    document.getElementById('volume-value').textContent = state.V.toFixed(1);
    
    document.getElementById('temperature-control').value = state.T;
    document.getElementById('temperature-value').textContent = state.T.toFixed(0);
    
    document.getElementById('moles-control').value = state.n;
    document.getElementById('moles-value').textContent = state.n.toFixed(1);
    
    // V3.3: 门控逻辑 - 根据锁定状态禁用/启用所有滑块
    const sliders = ['pressure-control', 'volume-control', 'temperature-control', 'moles-control'];
    sliders.forEach(sliderId => {
        const slider = document.getElementById(sliderId);
        if (slider) {
            const wasDisabled = slider.disabled;
            slider.disabled = isLocked;
            if (wasDisabled !== isLocked) {
                console.log(`🎛️ 滑块 ${sliderId} 状态变化: ${wasDisabled ? '禁用' : '启用'} → ${isLocked ? '禁用' : '启用'}`);
            }
        }
    });
    
    // V3.3: 门控逻辑 - 禁用/启用重置按钮
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.disabled = isLocked;
    }
    
    if (isLocked) {
        console.log('🔒 实验已锁定，控制面板已禁用');
    } else {
        console.log('🔓 实验已解锁，控制面板可用');
    }
    
    // 更新锁定按钮状态
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

// 检查Chart.js是否可用
function isChartAvailable() {
    return typeof Chart !== 'undefined';
}

// 创建降级图表显示
function createFallbackChart(container) {
    container.innerHTML = `
        <div style="
            width: 100%;
            height: 300px;
            background: #f8f9fa;
            border: 2px solid #6c757d;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            color: #6c757d;
            text-align: center;
            line-height: 1.4;
        ">
            <div>
                <div style="margin-bottom: 12px;">📊</div>
                <div>状态图表</div>
                <div style="font-size: 14px; margin-top: 8px;">
                    (图表库加载中...)
                </div>
            </div>
        </div>
    `;
}

// 初始化图表
function initPlot() {
    const plotContainer = document.getElementById('plot-container');
    
    // 检查Chart.js是否可用
    if (!isChartAvailable()) {
        console.warn('Chart.js未加载，使用降级显示');
        createFallbackChart(plotContainer);
        return;
    }
    
    // 创建canvas元素
    const canvas = document.createElement('canvas');
    canvas.id = 'plot-canvas';
    plotContainer.appendChild(canvas);
    
    // 初始化Chart.js
    const ctx = canvas.getContext('2d');
    chart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: '实验数据',
                data: [],
                backgroundColor: '#5B9AFF',
                borderColor: '#FFFFFF',
                borderWidth: 2,
                pointRadius: 6
            }, {
                label: '理论曲线',
                data: [],
                borderColor: '#5B9AFF',
                backgroundColor: 'transparent',
                type: 'line',
                pointRadius: 0,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: { 
                        display: true, 
                        text: '体积 (L)',
                        color: '#718096'
                    },
                    grid: {
                        color: '#E2E8F0'
                    },
                    ticks: {
                        color: '#718096'
                    }
                },
                y: {
                    title: { 
                        display: true, 
                        text: '压强 (kPa)',
                        color: '#718096'
                    },
                    grid: {
                        color: '#E2E8F0'
                    },
                    ticks: {
                        color: '#718096'
                    }
                }
            },
            plugins: {
                legend: { 
                    display: true,
                    labels: {
                        color: '#718096'
                    }
                }
            }
        }
    });
    
    // 绑定图表切换事件
    bindPlotSwitchEvents();
}

// 绑定图表切换事件
function bindPlotSwitchEvents() {
    const plotSwitcher = document.getElementById('plot-switcher');
    const buttons = plotSwitcher.querySelectorAll('button');
    
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            // 更新按钮状态
            buttons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // 更新图表标题
            const plotType = button.dataset.plotType;
            document.querySelector('#plot-panel .panel-header h2').textContent = `状态图 (${plotType})`;
            
            if (onPlotSwitch) {
                onPlotSwitch({ type: 'plot_switch', payload: { plotType } });
            }
        });
    });
}

// 更新图表
function updatePlot(state) {
    if (!isChartAvailable() || !chart || !chart.data || !chart.data.datasets) return;
    
    // 更新实验数据点 - 永远只显示当前状态的一个点
    let currentPoint;
    switch (state.currentPlotType) {
        case 'PV':
            currentPoint = { x: state.V, y: state.P };
            break;
        case 'PT':
            currentPoint = { x: state.T, y: state.P };
            break;
        case 'VT':
            currentPoint = { x: state.T, y: state.V };
            break;
        default:
            currentPoint = { x: state.V, y: state.P };
    }
    
    // 替换数据点，而不是push新数据点
    if (chart.data.datasets[0]) {
        chart.data.datasets[0].data = [currentPoint];
    }
    
    // 生成理论曲线
    generateTheoreticalCurve(state);
    
    // 更新坐标轴标签
    updateAxisLabels(state.currentPlotType);
    
    chart.update('none');
}

// 生成理论曲线
function generateTheoreticalCurve(state) {
    // 检查chart是否可用
    if (!isChartAvailable() || !chart || !chart.data || !chart.data.datasets || !chart.data.datasets[1]) {
        return;
    }
    
    const points = [];
    const R = 8.314; // 理想气体常数
    
    switch (state.currentPlotType) {
        case 'PV':
            // P = nRT/V
            for (let V = 10; V <= 50; V += 1) {
                const P = (state.n * R * state.T) / V;
                points.push({ x: V, y: P });
            }
            break;
        case 'PT':
            // P = nRT/V
            for (let T = 200; T <= 400; T += 5) {
                const P = (state.n * R * T) / state.V;
                points.push({ x: T, y: P });
            }
            break;
        case 'VT':
            // V = nRT/P
            for (let T = 200; T <= 400; T += 5) {
                const V = (state.n * R * T) / state.P;
                points.push({ x: T, y: V });
            }
            break;
    }
    
    chart.data.datasets[1].data = points;
}

// 更新坐标轴标签
function updateAxisLabels(plotType) {
    // 检查chart是否可用
    if (!isChartAvailable() || !chart || !chart.options || !chart.options.scales) {
        return;
    }
    
    switch (plotType) {
        case 'PV':
            if (chart.options.scales.x && chart.options.scales.x.title) {
                chart.options.scales.x.title.text = '体积 (L)';
            }
            if (chart.options.scales.y && chart.options.scales.y.title) {
                chart.options.scales.y.title.text = '压强 (kPa)';
            }
            break;
        case 'PT':
            if (chart.options.scales.x && chart.options.scales.x.title) {
                chart.options.scales.x.title.text = '温度 (K)';
            }
            if (chart.options.scales.y && chart.options.scales.y.title) {
                chart.options.scales.y.title.text = '压强 (kPa)';
            }
            break;
        case 'VT':
            if (chart.options.scales.x && chart.options.scales.x.title) {
                chart.options.scales.x.title.text = '温度 (K)';
            }
            if (chart.options.scales.y && chart.options.scales.y.title) {
                chart.options.scales.y.title.text = '体积 (L)';
            }
            break;
    }
}

// 初始化引导面板
function initGuidance() {
    console.log('initGuidance被调用');
    const guidanceContent = document.getElementById('guidance-content');
    
    if (!guidanceContent) {
        console.error('initGuidance: guidance-content元素未找到！');
        return;
    }
    
    // 设置初始的欢迎内容，确保页面加载时有内容显示
    guidanceContent.innerHTML = `
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
    
    // 绑定开始实验按钮事件
    const startBtn = document.getElementById('start-experiment-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            console.log('开始实验按钮被点击');
            if (onFlowAction) {
                onFlowAction({ type: 'start_experiment' });
            }
        });
    }
    
    console.log('initGuidance完成，初始内容已设置');
}

// 常量定义
const FEEDBACK_HINT_TEXT = '请先在下方的【实验记录与反馈】窗口中提交您的观察和思考，然后再继续。';

// 图标常量
const ICONS = {
    welcome: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiByeD0iMTAiIGZpbGw9IiNmNWY1ZjciLz4KPHN2ZyB4PSIzMCIgeT0iMzAiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjMDA3MWUzIj4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBjbGFzcz0ic2l6ZS02Ij4KICA8cGF0aCBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGQ9Ik0xMC41IDZhNy41IDcuNSAwIDEgMCAwIDE1IDcuNSA3LjUgMCAwIDAgMC0xNVoiIC8+CiAgPHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJtMTMuNSAxMC41IDYgNiIgLz4KICA8cGF0aCBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGQ9Im0xMy41IDEwLjUgNiA2IiAvPgo8L3N2Zz4KPC9zdmc+Cjwvc3ZnPg==',
    isothermal: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiByeD0iMTAiIGZpbGw9IiNmNWY1ZjciLz4KPGNpcmNsZSBjeD0iNjAiIGN5PSI2MCIgcj0iMzAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwNzFlMyIgc3Ryb2tlLXdpZHRoPSIzIi8+Cjx0ZXh0IHg9IjYwIiB5PSI2NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjMDA3MWUzIj5UPWNvbnN0PC90ZXh0Pgo8L3N2Zz4=',
    isobaric: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiByeD0iMTAiIGZpbGw9IiNmNWY1ZjciLz4KPGNpcmNsZSBjeD0iNjAiIGN5PSI2MCIgcj0iMzAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2RjMzU0NSIgc3Ryb2tlLXdpZHRoPSIzIi8+Cjx0ZXh0IHg9IjYwIiB5PSI2NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjZGMzNTQ1Ij5QPWNvbnN0PC90ZXh0Pgo8L3N2Zz4=',
    isochoric: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiByeD0iMTAiIGZpbGw9IiNmNWY1ZjciLz4KPGNpcmNsZSBjeD0iNjAiIGN5PSI2MCIgcj0iMzAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzI4YTc0NSIgc3Ryb2tlLXdpZHRoPSIzIi8+Cjx0ZXh0IHg9IjYwIiB5PSI2NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjMjhhNzQ1Ij5WPWNvbnN0PC90ZXh0Pgo8L3N2Zz4=',
    freeExplore: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiByeD0iMTAiIGZpbGw9IiNmNWY1ZjciLz4KPHN2ZyB4PSIzMCIgeT0iMzAiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjMjhhNzQ1Ij4KICA8cGF0aCBkPSJNMTIgMmwtMy4wOSA2LjI2TDIgOS4yN2w1IDQuODctMS4xOCA2Ljg4TDEyIDIxbDYuMTgtLjk4TDIzIDE0LjE0bC01LTQuODdMMjEuMDkgMi4yNnoiLz4KPC9zdmc+Cjwvc3ZnPg=='
};

// 生成引导按钮的通用函数
function generateGuidanceButtons(feedbackSubmitted, isExperimentLocked = false) {
    // V3.3: 门控逻辑 - 如果实验被锁定，按钮应该被禁用
    const isDisabled = !feedbackSubmitted || isExperimentLocked;
    return `
        <div class="guidance-buttons">
            <button id="next-step-btn" class="action-btn primary" ${isDisabled ? 'disabled' : ''}>下一步</button>
            <div id="next-step-hint" class="next-step-hint ${!feedbackSubmitted ? 'is-visible' : ''}">
                ${FEEDBACK_HINT_TEXT}
            </div>
        </div>
    `;
}

// 更新引导内容
function updateGuidance(state) {
    console.log('updateGuidance被调用，当前状态:', state);
    const guidanceContent = document.getElementById('guidance-content');
    
    if (!guidanceContent) {
        console.error('guidance-content元素未找到！');
        return;
    }
    
    // V3.3: 门控逻辑 - 检查实验是否被锁定
    const isExperimentLocked = state.isExperimentLocked || false;
    
    if (state.experimentPhase === 'welcome') {
        guidanceContent.innerHTML = `
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
                <button id="start-experiment-btn" class="action-btn primary" ${isExperimentLocked ? 'disabled' : ''}>开始实验</button>
            </div>
        `;
    } else if (state.experimentPhase === 'guided_1') {
        guidanceContent.innerHTML = `
            <img src="${ICONS.isothermal}" alt="等温过程示意图" class="guidance-illustration">
            <h4 class="guidance-title">第一步：探索波义耳定律</h4>
            <p class="guidance-text">
                在这个实验中，我们将保持<strong>温度恒定</strong>，就像一个恒温的魔法盒子！请拖动下方的<strong>体积滑块</strong>，仔细观察当您压缩或扩大气体时，它的压强会如何神奇地变化呢？
            </p>
            ${generateGuidanceButtons(state.currentStep.feedbackSubmitted, isExperimentLocked)}
        `;
    } else if (state.experimentPhase === 'guided_2') {
        guidanceContent.innerHTML = `
            <img src="${ICONS.isobaric}" alt="等压过程示意图" class="guidance-illustration">
            <h4 class="guidance-title">第二步：探索查理定律</h4>
            <p class="guidance-text">
                在这个实验中，我们将保持<strong>压强恒定</strong>，就像一个有弹性的气球！请拖动下方的<strong>温度滑块</strong>，仔细观察当您加热或冷却气体时，它的体积会如何变化呢？
            </p>
            ${generateGuidanceButtons(state.currentStep.feedbackSubmitted, isExperimentLocked)}
        `;
    } else if (state.experimentPhase === 'guided_3') {
        guidanceContent.innerHTML = `
            <img src="${ICONS.isochoric}" alt="等容过程示意图" class="guidance-illustration">
            <h4 class="guidance-title">第三步：探索盖-吕萨克定律</h4>
            <p class="guidance-text">
                在这个实验中，我们将保持<strong>体积恒定</strong>，就像一个坚固的密闭容器！请拖动下方的<strong>温度滑块</strong>，仔细观察当您加热或冷却气体时，它的压强会如何变化呢？
            </p>
            ${generateGuidanceButtons(state.currentStep.feedbackSubmitted, isExperimentLocked)}
        `;
    } else if (state.experimentPhase === 'free') {
        guidanceContent.innerHTML = `
            <img src="${ICONS.freeExplore}" alt="自由探索图标" class="guidance-illustration">
            <h4 class="guidance-title">自由探索模式</h4>
            <p class="guidance-text">
                恭喜！现在您可以<strong>自由调节所有参数</strong>，深入探索理想气体定律的各种组合。试试改变物质的量，看看会发生什么神奇的变化！
            </p>
        `;
    }
    
    // 绑定按钮事件
    const nextBtn = document.getElementById('next-step-btn');
    const startBtn = document.getElementById('start-experiment-btn');
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (onFlowAction && !nextBtn.disabled) {
                onFlowAction({ type: 'next_step' });
            }
        });
    }
    
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (onFlowAction) {
                onFlowAction({ type: 'start_experiment' });
            }
        });
    }
}

// 初始化聊天面板
function initChat() {
    // V3.6: 初始化时只设置输入区域，聊天记录容器已在HTML中预定义
    updateInputArea('welcome');
}

// V3.6: 职责A - 渲染聊天记录（只追加，永不销毁）
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

// V3.8: 优化输入区域更新 - 避免不必要的HTML重建
let currentInputPhase = null;
let inputAreaInitialized = false;

// V3.6: 职责B - 切换输入模式（只更新输入区域）
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

// V3.6: 重构后的主更新函数 - 职责分离
function updateChatInterface() {
    const currentState = window.getState ? window.getState() : { experimentPhase: 'welcome', experimentEnded: false, isThinking: false };
    
    // 职责分离：分别更新聊天记录和输入区域
    renderChatLog(currentState.chatHistory || []);
    updateInputArea(currentState.experimentPhase);
    
    console.log('V3.6: 聊天界面更新完成，职责分离');
}

// 发送聊天消息
function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message && onSendMessage) {
        onSendMessage({ type: 'send_message', payload: message });
        input.value = '';
        // 状态更新逻辑已移至main.js的handleSendMessage函数中
    }
}

// ✅ 新的安全版 askAI 函数
async function askAI() {
    const userInput = document.getElementById('chat-input').value;
    if (!userInput.trim()) return;

    // 清空输入框
    document.getElementById('chat-input').value = '';

    // 添加用户消息到聊天历史
    const timestamp = new Date().toLocaleTimeString();
    const userMessage = {
        type: 'user',
        content: userInput,
        timestamp: timestamp
    };

    // 获取当前聊天历史并添加用户消息
    const currentState = window.getState ? window.getState() : { chatHistory: [] };
    const currentHistory = Array.isArray(currentState.chatHistory) ? currentState.chatHistory : [];
    let updatedHistory = [...currentHistory, userMessage];

    // 设置思考状态并更新聊天历史
    if (window.updateState) {
        window.updateState({ 
            isThinking: true,
            chatHistory: updatedHistory 
        });
    }

    // 显示"思考中"气泡
    const chatLog = document.getElementById('chat-log');
    const thinkingTemplate = document.getElementById('ai-thinking-template');
    let thinkingBubble = null;
    
    if (thinkingTemplate) {
        thinkingBubble = thinkingTemplate.cloneNode(true);
        thinkingBubble.id = 'ai-thinking-bubble';
        thinkingBubble.style.display = 'block';
        
        if (chatLog) {
            chatLog.appendChild(thinkingBubble);
            chatLog.scrollTop = chatLog.scrollHeight;
        }
    }

    // API端点指向我们自己的Vercel函数
    const ourApiEndpoint = '/api/ask-ai';

    try {
        // 延迟一段时间模拟思考
        await new Promise(resolve => setTimeout(resolve, 500));

        const response = await fetch(ourApiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: userInput  
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `API call failed with status: ${response.status}`);
        }

        const data = await response.json();
        
        // 从返回的数据中提取AI的回复
        const aiResponse = data.choices[0].message.content;
        
        // 移除思考中气泡
        if (thinkingBubble && thinkingBubble.parentNode) {
            thinkingBubble.parentNode.removeChild(thinkingBubble);
        }
        
        // 添加AI回复到聊天历史
        const aiMessage = {
            type: 'system',
            content: aiResponse,
            timestamp: new Date().toLocaleTimeString()
        };
        updatedHistory = [...updatedHistory, aiMessage];

    } catch (error) {
        console.error('Failed to get response from AI proxy:', error);
        
        // 移除思考中气泡
        if (thinkingBubble && thinkingBubble.parentNode) {
            thinkingBubble.parentNode.removeChild(thinkingBubble);
        }
        
        // 添加错误消息到聊天历史
        const errorMessage = {
            type: 'system',
            content: '抱歉，我现在无法回答，请检查网络或稍后再试。',
            timestamp: new Date().toLocaleTimeString()
        };
        updatedHistory = [...updatedHistory, errorMessage];
    } finally {
        // 更新最终状态
        if (window.updateState) {
            window.updateState({ 
                isThinking: false,
                chatHistory: updatedHistory 
            });
        }
    }
}

// 提交最终反馈（自由探究阶段）
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
        
        // 设置全局锁定状态
        if (window.updateState) {
            window.updateState({ 
                experimentEnded: true,
                currentStep: { feedbackSubmitted: true }
            });
        }
        
        // 锁定所有控件
        lockAllControls();
    }
}

// 锁定所有控件
function lockAllControls() {
    // 锁定所有滑块
    const sliders = document.querySelectorAll('input[type="range"]');
    sliders.forEach(slider => {
        slider.disabled = true;
    });
    
    // 锁定所有锁定按钮
    const lockButtons = document.querySelectorAll('.lock-btn');
    lockButtons.forEach(btn => {
        btn.disabled = true;
    });
    
    // 锁定提交按钮
    const askBtn = document.getElementById('ask-ai-btn');
    const submitBtn = document.getElementById('submit-final-report-btn');
    if (askBtn) askBtn.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
    
    // 停止分子模拟
    if (window.stopSimulation) {
        window.stopSimulation();
    }
    
    console.log('所有控件已锁定，实验结束');
}

// 解锁所有控件（调试用）
function unlockAllControls() {
    // 解锁所有滑块
    const sliders = document.querySelectorAll('input[type="range"]');
    sliders.forEach(slider => {
        slider.disabled = false;
    });
    
    // 解锁所有锁定按钮
    const lockButtons = document.querySelectorAll('.lock-btn');
    lockButtons.forEach(btn => {
        btn.disabled = false;
    });
    
    console.log('所有控件已解锁');
}

// 检查滑块状态
function checkSliderStatus() {
    const sliders = document.querySelectorAll('input[type="range"]');
    console.log('=== 滑块状态检查 ===');
    sliders.forEach(slider => {
        console.log(`滑块 ${slider.id}: 禁用=${slider.disabled}, 值=${slider.value}`);
    });
    console.log('==================');
}

// V3.2: 聊天记录渲染隔离墙 - 使用记忆化技术防止不必要的重渲染
let lastChatHistoryHash = null;
let lastScrollPosition = null;
let isUserScrolling = false;

// 计算聊天历史的哈希值，用于比较是否真正发生变化
function calculateChatHistoryHash(chatHistory) {
    if (!Array.isArray(chatHistory) || chatHistory.length === 0) {
        return 'empty';
    }
    
    // 使用消息数量、最后一条消息的内容和时间戳来生成简单哈希
    const lastMsg = chatHistory[chatHistory.length - 1];
    return `${chatHistory.length}-${lastMsg.content}-${lastMsg.timestamp}`;
}

// 检测用户是否正在手动滚动
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

// V3.6: 更新聊天记录（使用新的renderChatLog函数）
function updateChat(state) {
    console.log("V3.6: updateChat 被调用，使用新的renderChatLog"); // 临时调试日志
    
    // V3.6: 直接使用新的renderChatLog函数，它已经包含了记忆化和智能滚动
    renderChatLog(state.chatHistory || []);
}

// 初始化浮动日志
function initFloatingLog() {
    // 日志功能已在main.js中实现，这里只需要更新内容
}

// 更新浮动日志
function updateFloatingLog(state) {
    const logContent = document.getElementById('log-content');
    
    logContent.innerHTML = state.log.slice(-10).map(entry => `
        <div class="log-entry">
            <span class="log-time">[${entry.timestamp}]</span>
            <span class="log-text">${entry.text}</span>
        </div>
    `).join('');
    
    // 滚动到底部
    logContent.scrollTop = logContent.scrollHeight;
}

// 初始化欢迎弹窗
function initWelcomeModal() {
    const modal = document.getElementById('welcome-modal');
    const okBtn = document.getElementById('welcome-ok-btn');
    
    okBtn.addEventListener('click', () => {
        showWelcomeModal(false);
        if (onFlowAction) {
            onFlowAction({ type: 'start_experiment' });
        }
    });
}

// 显示/隐藏欢迎弹窗
export function showWelcomeModal(show) {
    const modal = document.getElementById('welcome-modal');
    if (show) {
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}

// 导出updateChatInterface函数
export { updateChatInterface };

// 暴露调试函数到全局作用域
window.unlockAllControls = unlockAllControls;
window.checkSliderStatus = checkSliderStatus;
window.lockAllControls = lockAllControls;

// 恢复滑块到原始位置（当物理计算失败时）
export function revertSlider(variable, value) {
    // 根据变量名映射到正确的滑块ID
    const sliderMap = {
        'P': 'pressure-control',
        'V': 'volume-control', 
        'T': 'temperature-control',
        'n': 'moles-control'
    };
    
    const sliderId = sliderMap[variable];
    const slider = document.getElementById(sliderId);
    const valueSpan = document.getElementById(sliderId.replace('-control', '-value'));
    
    if (slider && value !== undefined) {
        slider.value = value;
        if (valueSpan) {
            valueSpan.textContent = variable === 'T' ? value.toFixed(0) : value.toFixed(1);
        }
        console.log(`滑块 ${variable} 已恢复到值: ${value}`);
    }
}
