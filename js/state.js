// 状态管理模块 - 单一事实来源
// 管理整个应用的状态，包含P,V,T,n, lockedVar, experimentPhase, history, log等

export let state = {
    // 物理状态
    P: 101.325, // 压强 (kPa)
    V: 22.4,    // 体积 (L)
    T: 273.15,  // 温度 (K)
    n: 1.0,     // 物质的量 (mol)
    
    // V2.1: 真实气体参数（范德华方程）
    // V2.2.4: 默认选择CO2以显示明显的非理想行为
    gasType: 'CO2',    // 气体类型: 'ideal', 'N2', 'O2', 'CO2', 'H2', 'custom'
    a: 364.3,          // 范德华常数 a (L²·kPa/mol²) - 分子间吸引力参数
    b: 0.0427,         // 范德华常数 b (L/mol) - 分子体积参数
    
    // 实验控制
    lockedVariable: 'P',  // 当前锁定的变量 ('P', 'V', 'T')，单锁模式：必须有且仅有一个被锁定
    experimentPhase: 'welcome', // 实验阶段: 'welcome', 'guided_1', 'guided_2', 'guided_3', 'free'
    experimentEnded: false, // 实验是否已结束（全局锁定状态）
    
    // V2.2.6: 引导状态 - 增强版步骤追踪
    currentStep: {
        feedbackSubmitted: false,  // 当前步骤是否已提交反馈
        hasCorrectLock: false,     // 是否锁定了正确的变量
        
        // 第一阶段追踪
        selected_real_gas: false,  // 是否选择了真实气体
        locked_temperature: false,  // 是否锁定了温度
        adjusted_volume: false,    // 是否调节了体积
        
        // 第二阶段追踪
        switched_gas: false,      // 是否切换了气体
        locked_volume: false,     // 是否锁定了体积
        adjusted_temperature: false, // 是否调节了温度
        
        // 第三阶段追踪
        selected_custom_gas: false,  // 是否选择了自定义气体
        adjusted_a: false,          // 是否调节了a值
        adjusted_b: false,          // 是否调节了b值
        hasOperatedSlider: false   // 是否操作了正确的滑块
    },
    
    // 历史数据
    history: [],     // 存储历史数据点 [{P, V, T, timestamp}, ...]
    
    // UI状态
    currentPlotType: 'PV', // 当前图表类型
    currentGuidance: '',   // 当前引导文本
    
    // V3.3: 持久化聊天状态（状态提升到最高层）
    chatHistory: [],       // 聊天记录 - 持久化，永不丢失
    isThinking: false,     // AI是否正在思考（用于锁定输入控件）
    
    // V3.3: 门控式实验流程状态
    isExperimentLocked: false, // 实验门锁状态：true=需要提交反馈才能继续，false=可以自由操作
    
    // V3.8: 交互状态锁，当用户手动拖拽时为true
    isDragging: false,
    
    // V2.EVAL: 实验评价结果与状态
    evaluationResult: null,   // 后端返回的评价JSON
    isEvaluating: false,      // 是否正在请求评价
    evaluationError: null,    // 评价错误信息（若有）
    
    // V2.EVAL.QA: AI问答记录（用于评价分析）
    qaHistory: [],            // 记录用户向AI提出的问题 [{ question: "..." }, ...]
    
    // 日志
    log: []
};

// 初始化状态
export function initState() {
    console.log('状态管理器初始化');
    
    // 设置初始引导文本
    state.currentGuidance = '欢迎来到理想气体定律探究沙箱！请点击"我明白了"开始您的探究之旅。';
    
    // 添加初始日志
    addLogEntry('应用状态初始化完成');
    
    // 添加初始历史点
    addHistoryPoint();
}

// 唯一更新状态的入口
export function updateState(updates) {
    const oldState = { ...state };
    
    // 深度合并更新，特别处理嵌套对象
    for (const key in updates) {
        if (updates.hasOwnProperty(key)) {
            if (key === 'currentStep' && typeof updates[key] === 'object') {
                // 特殊处理currentStep的更新
                state.currentStep = { ...state.currentStep, ...updates[key] };
            } else {
                state[key] = updates[key];
            }
        }
    }
    
    // 如果物理量发生变化，添加到历史记录
    if (updates.P !== undefined || updates.V !== undefined || 
        updates.T !== undefined || updates.n !== undefined) {
        addHistoryPoint();
    }
    
    // 触发状态更新事件
    document.dispatchEvent(new CustomEvent('stateShouldUpdate', { 
        detail: { oldState, newState: state } 
    }));
    
    console.log('状态已更新:', updates);
}

// 添加日志条目
export function addLogEntry(entryText) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
        timestamp,
        text: entryText,
        id: Date.now()
    };
    
    state.log.push(logEntry);
    
    // 限制日志数量，保持最新的50条
    if (state.log.length > 50) {
        state.log = state.log.slice(-50);
    }
    
    console.log(`[${timestamp}] ${entryText}`);
}

// 添加历史数据点
function addHistoryPoint() {
    const point = {
        P: state.P,
        V: state.V,
        T: state.T,
        n: state.n,
        timestamp: Date.now()
    };
    
    state.history.push(point);
    
    // 限制历史点数量，保持最新的100个点
    if (state.history.length > 100) {
        state.history = state.history.slice(-100);
    }
}

// 获取当前状态的只读副本
export function getState() {
    return { ...state };
}
