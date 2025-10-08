/**
 * CollisionMonitor.js
 * V2.2: 器壁碰撞监视器模块 - 显示微观碰撞数据
 * 负责展示碰撞频率和平均冲量，建立微观-宏观联系
 */

// 碰撞数据历史记录
let collisionHistory = {
    frequency: [],  // 碰撞频率 (Hz)
    impulse: []     // 平均冲量
};

// 图表实例
let collisionChart = null;

// 数据采样配置
const SAMPLING_INTERVAL = 1000; // 每秒采样一次
const MAX_DATA_POINTS = 30;     // 最多保留30个数据点

// 碰撞统计
let collisionStats = {
    count: 0,
    totalImpulse: 0,
    lastSampleTime: Date.now()
};

/**
 * 初始化碰撞监视器
 */
export function initCollisionMonitor() {
    console.log('器壁碰撞监视器初始化');
    
    const container = document.getElementById('collision-monitor-chart');
    if (!container) {
        console.warn('未找到碰撞监视器容器');
        return;
    }
    
    // 检查Chart.js是否可用
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js未加载，碰撞监视器无法初始化');
        return;
    }
    
    // 创建canvas元素
    const canvas = document.createElement('canvas');
    canvas.id = 'collision-chart-canvas';
    canvas.style.width = '100%';
    canvas.style.height = '120px';
    container.appendChild(canvas);
    
    // 初始化图表
    const ctx = canvas.getContext('2d');
    collisionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '碰撞频率 (Hz)',
                data: [],
                borderColor: '#F59E0B',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 0,
                yAxisID: 'y'  // 使用左侧Y轴
            }, {
                label: '平均冲量 (×10⁻⁶)',
                data: [],
                borderColor: '#8B5CF6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 0,
                yAxisID: 'y1'  // 使用右侧Y轴
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0  // 禁用动画以提高性能
            },
            scales: {
                x: {
                    display: false  // 隐藏x轴标签
                },
                y: {  // 碰撞频率的Y轴
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    max: 15,  // 设置最大值为15Hz
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            size: 10
                        },
                        color: '#6B7280'
                    }
                },
                y1: {  // 平均冲量的Y轴
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    grid: {
                        drawOnChartArea: false // 只显示一个网格
                    },
                    ticks: {
                        font: {
                            size: 10
                        },
                        color: '#8B5CF6'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 11
                        },
                        color: '#374151',
                        boxWidth: 12,
                        boxHeight: 12
                    }
                },
                tooltip: {
                    enabled: false  // 禁用tooltip以提高性能
                }
            }
        }
    });
    
    // 启动数据采样定时器
    startSampling();
}

/**
 * 启动数据采样
 */
function startSampling() {
    setInterval(() => {
        const now = Date.now();
        const elapsed = (now - collisionStats.lastSampleTime) / 1000; // 秒
        
        // 计算碰撞频率 (Hz)
        const frequency = collisionStats.count / elapsed;
        
        // 计算平均冲量
        const avgImpulse = collisionStats.count > 0 
            ? collisionStats.totalImpulse / collisionStats.count 
            : 0;
        
        // 更新历史数据
        collisionHistory.frequency.push(frequency);
        collisionHistory.impulse.push(avgImpulse * 1e6); // 转换为 ×10⁻⁶ 单位
        
        // 限制数据点数量
        if (collisionHistory.frequency.length > MAX_DATA_POINTS) {
            collisionHistory.frequency.shift();
            collisionHistory.impulse.shift();
        }
        
        // 更新图表
        updateChart();
        
        // 重置统计
        collisionStats.count = 0;
        collisionStats.totalImpulse = 0;
        collisionStats.lastSampleTime = now;
    }, SAMPLING_INTERVAL);
}

/**
 * 记录一次碰撞事件
 * @param {number} impulse - 碰撞冲量
 */
export function recordCollision(impulse) {
    collisionStats.count++;
    collisionStats.totalImpulse += Math.abs(impulse);
}

/**
 * 更新图表显示
 */
function updateChart() {
    if (!collisionChart) return;
    
    // 生成时间标签
    const labels = collisionHistory.frequency.map((_, index) => `${index}s`);
    
    // 更新数据
    collisionChart.data.labels = labels;
    collisionChart.data.datasets[0].data = collisionHistory.frequency;
    collisionChart.data.datasets[1].data = collisionHistory.impulse;
    
    collisionChart.update('none');  // 使用'none'模式以提高性能
}

/**
 * 更新监视器显示（由外部调用）
 * @param {Object} state - 全局状态
 */
export function updateMonitor(state) {
    // 当前此函数主要用于未来扩展
    // 碰撞数据通过recordCollision()实时记录
}

/**
 * 重置监视器数据
 */
export function resetMonitor() {
    collisionHistory.frequency = [];
    collisionHistory.impulse = [];
    collisionStats.count = 0;
    collisionStats.totalImpulse = 0;
    collisionStats.lastSampleTime = Date.now();
    
    if (collisionChart) {
        updateChart();
    }
}


