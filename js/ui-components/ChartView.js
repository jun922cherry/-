/**
 * ChartView.js
 * 图表视图模块 - 负责Chart.js图表的初始化和更新
 * 支持P-V、P-T、V-T三种图表类型的切换
 */

// 图表实例
let chart = null;

/**
 * 检查Chart.js是否可用
 * @returns {boolean}
 */
function isChartAvailable() {
    return typeof Chart !== 'undefined';
}

/**
 * 创建降级图表显示
 * @param {HTMLElement} container - 图表容器
 */
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

/**
 * 初始化图表
 * @param {Function} onPlotSwitch - 图表切换回调
 */
export function initPlot(onPlotSwitch) {
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
    
    // V2.1: 初始化Chart.js - 两条曲线：实验数据（真实气体）和理想气体基准线
    const ctx = canvas.getContext('2d');
    chart = new Chart(ctx, {
        type: 'scatter',
        data: {
        datasets: [{
            label: '实验数据 (真实气体)',
            data: [],
            backgroundColor: 'rgba(239, 68, 68, 0.15)',  // V2.2.4: 红色填充，更明显
            borderColor: '#EF4444',  // V2.2.4: 红色实线，更醒目
            borderWidth: 3,  // V2.2.4: 加粗到3px
            pointRadius: 0,
            pointStyle: 'circle',
            showLine: true,
            type: 'line',
            tension: 0.15
        }, {
            label: '理想气体基准线',
            data: [],
            borderColor: '#3B82F6',  // V2.2.4: 蓝色实线
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            type: 'line',
            pointRadius: 0,
            borderWidth: 2,
            borderDash: [8, 4]  // V2.2.4: 更明显的虚线样式
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
                    },
                    // V2.2.4: 自动调整Y轴范围以放大曲线差异
                    suggestedMin: undefined,
                    suggestedMax: undefined,
                    grace: '5%'  // 在数据范围基础上增加5%的边距
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
    bindPlotSwitchEvents(onPlotSwitch);
}

/**
 * 绑定图表切换事件
 * @param {Function} onPlotSwitch - 图表切换回调
 */
function bindPlotSwitchEvents(onPlotSwitch) {
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

/**
 * V2.2.4: 更新图表 - 显示实验数据（真实气体曲线）和理想气体基准线
 * @param {Object} state - 全局状态
 */
export function updatePlot(state) {
    if (!isChartAvailable() || !chart || !chart.data || !chart.data.datasets) return;
    
    // V2.2.1: 生成真实气体曲线（使用当前的 a 和 b 参数）
    generateRealGasCurve(state);
    
    // V2.1: 生成理想气体基准线（使用a=0, b=0）
    generateIdealGasBaseline(state);
    
    // 更新坐标轴标签
    updateAxisLabels(state.currentPlotType);
    
    // V2.2.4: 动态调整Y轴范围以放大曲线差异
    adjustYAxisRange();
    
    chart.update('none');
}

/**
 * V2.2.1: 生成真实气体曲线（使用范德华方程）
 * 这条线使用当前的 a 和 b 参数计算
 * @param {Object} state - 全局状态
 */
function generateRealGasCurve(state) {
    if (!isChartAvailable() || !chart || !chart.data || !chart.data.datasets || !chart.data.datasets[0]) {
        return;
    }
    
    const points = [];
    const R = 8.314;
    const { a, b, n, T, P, V } = state;
    
    // V2.2.2: 调试日志 - 确认使用的范德华参数
    console.log(`🔵 真实气体曲线生成: a=${a}, b=${b}, gasType=${state.gasType}`);
    
    // 根据图表类型生成范德华曲线
    switch (state.currentPlotType) {
        case 'PV':
            // 保持 T 和 n 不变，计算 P-V 关系
            for (let vol = 10; vol <= 50; vol += 0.5) {
                const effectiveVolume = vol - n * b;
                if (effectiveVolume > 0.1) {
                    const idealTerm = (n * R * T) / effectiveVolume;
                    const attractionTerm = a * Math.pow(n / vol, 2);
                    const pressure = idealTerm - attractionTerm;
                    if (pressure > 0) {
                        points.push({ x: vol, y: pressure });
                    }
                }
            }
            break;
        case 'PT':
            // 保持 V 和 n 不变，计算 P-T 关系
            for (let temp = 200; temp <= 400; temp += 2) {
                const effectiveVolume = V - n * b;
                if (effectiveVolume > 0.1) {
                    const idealTerm = (n * R * temp) / effectiveVolume;
                    const attractionTerm = a * Math.pow(n / V, 2);
                    const pressure = idealTerm - attractionTerm;
                    if (pressure > 0) {
                        points.push({ x: temp, y: pressure });
                    }
                }
            }
            break;
        case 'VT':
            // 保持 P 和 n 不变，计算 V-T 关系
            // 这需要求解范德华方程，使用牛顿迭代法
            for (let temp = 200; temp <= 400; temp += 2) {
                let vol = (n * R * temp) / P; // 初始猜测值
                // 牛顿迭代
                for (let iter = 0; iter < 50; iter++) {
                    const effectiveVolume = vol - n * b;
                    if (effectiveVolume <= 0) {
                        vol = n * b + 0.1;
                        continue;
                    }
                    const f = P - (n * R * temp) / effectiveVolume + a * Math.pow(n / vol, 2);
                    const df = (n * R * temp) / Math.pow(effectiveVolume, 2) - 2 * a * Math.pow(n, 2) / Math.pow(vol, 3);
                    if (Math.abs(df) < 1e-10) break;
                    const vol_new = vol - f / df;
                    if (Math.abs(vol_new - vol) < 1e-6) {
                        vol = vol_new;
                        break;
                    }
                    vol = vol_new;
                }
                if (vol > 0) {
                    points.push({ x: temp, y: vol });
                }
            }
            break;
    }
    
    chart.data.datasets[0].data = points;
}

/**
 * V2.2.2: 生成理想气体基准线
 * 这条线使用理想气体方程（a=0, b=0），作为参考对比
 * @param {Object} state - 全局状态
 */
function generateIdealGasBaseline(state) {
    // 检查chart是否可用
    if (!isChartAvailable() || !chart || !chart.data || !chart.data.datasets || !chart.data.datasets[1]) {
        return;
    }
    
    // V2.2.2: 调试日志 - 确认使用理想气体模型
    console.log(`⚪ 理想气体基准线生成: 使用 a=0, b=0（理想气体模型）`);
    
    const points = [];
    const R = 8.314; // 理想气体常数
    
    // 使用当前状态的 T, n (或 P, n 等) 来计算理想气体基准线
    // 根据不同的图表类型，计算对应的理想气体曲线
    switch (state.currentPlotType) {
        case 'PV':
            // 理想气体: P = nRT/V
            // 保持当前的 T 和 n 不变，绘制 P-V 关系
            for (let V = 10; V <= 50; V += 0.5) {
                const P = (state.n * R * state.T) / V;
                points.push({ x: V, y: P });
            }
            break;
        case 'PT':
            // 理想气体: P = nRT/V
            // 保持当前的 V 和 n 不变，绘制 P-T 关系
            for (let T = 200; T <= 400; T += 2) {
                const P = (state.n * R * T) / state.V;
                points.push({ x: T, y: P });
            }
            break;
        case 'VT':
            // 理想气体: V = nRT/P
            // 保持当前的 P 和 n 不变，绘制 V-T 关系
            for (let T = 200; T <= 400; T += 2) {
                const V = (state.n * R * T) / state.P;
                points.push({ x: T, y: V });
            }
            break;
    }
    
    chart.data.datasets[1].data = points;
}

/**
 * V2.2.4: 动态调整Y轴范围以放大曲线差异
 */
function adjustYAxisRange() {
    if (!isChartAvailable() || !chart || !chart.data || !chart.data.datasets) return;
    
    // 收集所有数据点的Y值
    let allYValues = [];
    chart.data.datasets.forEach(dataset => {
        if (dataset.data && dataset.data.length > 0) {
            dataset.data.forEach(point => {
                if (point && typeof point.y === 'number') {
                    allYValues.push(point.y);
                }
            });
        }
    });
    
    if (allYValues.length === 0) return;
    
    // 计算最小值和最大值
    const minY = Math.min(...allYValues);
    const maxY = Math.max(...allYValues);
    const range = maxY - minY;
    
    // V2.2.6: 进一步缩小Y轴范围以放大差异
    const margin = range * 0.02;  // 从5%减少到2%
    
    // 更新Y轴范围，大幅缩小范围
    if (chart.options.scales && chart.options.scales.y) {
        const center = (maxY + minY) / 2;
        const halfRange = (range + margin * 2) / 2;
        // 将范围缩小到中心点±halfRange的60%（从80%减少到60%）
        chart.options.scales.y.min = center - halfRange * 0.6;
        chart.options.scales.y.max = center + halfRange * 0.6;
        
        // V2.2.6: 确保最小范围，防止图表过度放大
        const minRangeSize = Math.max(maxY * 0.01, 1); // 至少1kPa或最大值的1%
        const currentRange = chart.options.scales.y.max - chart.options.scales.y.min;
        if (currentRange < minRangeSize) {
            const newHalfRange = minRangeSize / 2;
            chart.options.scales.y.min = center - newHalfRange;
            chart.options.scales.y.max = center + newHalfRange;
        }
    }
}

/**
 * 更新坐标轴标签
 * @param {string} plotType - 图表类型 ('PV', 'PT', 'VT')
 */
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

