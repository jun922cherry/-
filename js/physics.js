// 物理计算核心模块 - V2.1: 支持理想气体定律和范德华方程
// 负责所有物理状态的计算和验证

// 理想气体常数 (J/(mol·K))
const R = 8.314;

// V2.1: 预设气体的范德华常数
// 来源：物理化学标准数据
const GAS_CONSTANTS = {
    ideal: { a: 0, b: 0, name: '理想气体' },
    N2: { a: 140.8, b: 0.0391, name: '氮气 (N₂)' },
    O2: { a: 138.3, b: 0.0318, name: '氧气 (O₂)' },
    CO2: { a: 364.3, b: 0.0427, name: '二氧化碳 (CO₂)' },
    H2: { a: 24.7, b: 0.0266, name: '氢气 (H₂)' },
    custom: { a: 0, b: 0, name: '自定义气体' }
};

/**
 * V2.1: 获取气体的范德华常数
 * @param {string} gasType - 气体类型
 * @returns {Object} - {a, b}
 */
export function getGasConstants(gasType) {
    return GAS_CONSTANTS[gasType] || GAS_CONSTANTS.ideal;
}

/**
 * V2.1: 计算真实气体压强（范德华方程）
 * 范德华方程: [P + a(n/V)²](V - nb) = nRT
 * 求解P: P = nRT/(V - nb) - a(n/V)²
 * @param {number} V - 体积 (L)
 * @param {number} T - 温度 (K)
 * @param {number} n - 物质的量 (mol)
 * @param {number} a - 范德华常数a (L²·kPa/mol²)
 * @param {number} b - 范德华常数b (L/mol)
 * @returns {number} - 压强 (kPa)
 */
export function calculateRealGasPressure(V, T, n, a, b) {
    // 将理想气体常数R从 J/(mol·K) 转换为 L·kPa/(mol·K)
    const R_kPa = R; // 8.314 J/(mol·K) = 8.314 L·kPa/(mol·K)
    
    // 防止除零错误：如果V - nb接近0，使用理想气体公式
    const effectiveVolume = V - n * b;
    if (effectiveVolume <= 0.1) {
        console.warn('警告：有效体积过小，使用理想气体近似');
        return (n * R_kPa * T) / V;
    }
    
    // 范德华方程计算压强
    const idealTerm = (n * R_kPa * T) / effectiveVolume;
    const attractionTerm = a * Math.pow(n / V, 2);
    
    return idealTerm - attractionTerm;
}

/**
 * V2.1: 计算真实气体体积（范德华方程）
 * 这是一个三次方程，需要数值解法
 * @param {number} P - 压强 (kPa)
 * @param {number} T - 温度 (K)
 * @param {number} n - 物质的量 (mol)
 * @param {number} a - 范德华常数a
 * @param {number} b - 范德华常数b
 * @returns {number} - 体积 (L)
 */
export function calculateRealGasVolume(P, T, n, a, b) {
    const R_kPa = R;
    
    // 使用牛顿迭代法求解
    // 初始猜测：使用理想气体体积
    let V = (n * R_kPa * T) / P;
    
    // 迭代求解
    for (let i = 0; i < 100; i++) {
        const effectiveVolume = V - n * b;
        if (effectiveVolume <= 0) {
            V = n * b + 0.1; // 确保有效体积为正
            continue;
        }
        
        // f(V) = P - [nRT/(V-nb) - a(n/V)²]
        const f = P - (n * R_kPa * T) / effectiveVolume + a * Math.pow(n / V, 2);
        
        // f'(V) = nRT/(V-nb)² - 2a(n²/V³)
        const df = (n * R_kPa * T) / Math.pow(effectiveVolume, 2) - 2 * a * Math.pow(n, 2) / Math.pow(V, 3);
        
        if (Math.abs(df) < 1e-10) break; // 防止除以零
        
        const V_new = V - f / df;
        
        if (Math.abs(V_new - V) < 1e-6) {
            return V_new; // 收敛
        }
        
        V = V_new;
    }
    
    return V;
}

// 物理量的边界值定义
const BOUNDS = {
    P: { min: 50, max: 200 },    // 压强 (kPa)
    V: { min: 10, max: 50 },     // 体积 (L)
    T: { min: 200, max: 400 },   // 温度 (K)
    n: { min: 0.5, max: 3 }      // 物质的量 (mol)
};

/**
 * 检查物理状态是否在有效边界内
 * @param {Object} state - 包含P, V, T, n的状态对象
 * @returns {boolean} - 状态是否有效
 */
export function isStateValid(state) {
    const { P, V, T, n } = state;
    
    return (
        P >= BOUNDS.P.min && P <= BOUNDS.P.max &&
        V >= BOUNDS.V.min && V <= BOUNDS.V.max &&
        T >= BOUNDS.T.min && T <= BOUNDS.T.max &&
        n >= BOUNDS.n.min && n <= BOUNDS.n.max
    );
}

/**
 * V2.1: 物理计算核心函数 - 支持真实气体和理想气体
 * @param {Object} globalState - 当前全局状态
 * @param {Object} changeInfo - 变化信息 {variable: 'V', value: 25.5}
 * @returns {Object} - {success: boolean, newState?: Object, reason?: string}
 */
export function calculateNewState(globalState, changeInfo) {
    const { P, V, T, n, lockedVariable, a, b } = globalState;
    
    // V2.1: 使用范德华方程还是理想气体方程
    const isRealGas = (a !== 0 || b !== 0);
    
    // 特殊情况：当用户直接拖动"物质的量"滑块时，维持原有逻辑
    if (changeInfo.variable === 'n') {
        return calculateWithDirectMolesChange(globalState, changeInfo, isRealGas);
    }
    
    // 主要逻辑：当用户拖动P, V, T中任意一个滑块时
    return calculateWithMolesAsCoordinator(globalState, changeInfo, isRealGas);
}

/**
 * V2.1: 直接改变物质的量时的计算逻辑（支持真实气体）
 */
function calculateWithDirectMolesChange(globalState, changeInfo, isRealGas) {
    const { P, V, T, n, lockedVariable, a, b } = globalState;
    let newP = P, newV = V, newT = T, newN = changeInfo.value;
    
    // 根据锁定的变量，计算从动变量
    switch (lockedVariable) {
        case 'P': // 定压过程，计算V
            if (isRealGas) {
                newV = calculateRealGasVolume(P, T, newN, a, b);
            } else {
                newV = (newN * R * T) / (P * 1000) * 1000; // 单位转换: kPa->Pa, m³->L
            }
            break;
        case 'V': // 定容过程，计算P
            if (isRealGas) {
                newP = calculateRealGasPressure(V, T, newN, a, b);
            } else {
                newP = (newN * R * T) / (V / 1000) / 1000; // 单位转换: L->m³, Pa->kPa
            }
            break;
        case 'T': // 定温过程，计算P
            if (isRealGas) {
                newP = calculateRealGasPressure(V, T, newN, a, b);
            } else {
                newP = (newN * R * T) / (V / 1000) / 1000; // 单位转换
            }
            break;
        case null: // 无锁定，默认保持V不变，计算P
            if (isRealGas) {
                newP = calculateRealGasPressure(V, T, newN, a, b);
            } else {
                newP = (newN * R * T) / (V / 1000) / 1000; // 单位转换
            }
            break;
    }
    
    const proposedState = { P: newP, V: newV, T: newT, n: newN };
    
    // 直接拖动n时：只要计算出的P, V或T有任何一个超界，操作就直接失败
    if (isStateValid(proposedState)) {
        return { success: true, newState: proposedState };
    } else {
        // 生成详细的失败通知
        const violatedVars = [];
        if (newP < BOUNDS.P.min || newP > BOUNDS.P.max) violatedVars.push('压强');
        if (newV < BOUNDS.V.min || newV > BOUNDS.V.max) violatedVars.push('体积');
        if (newT < BOUNDS.T.min || newT > BOUNDS.T.max) violatedVars.push('温度');
        
        return { 
            success: false, 
            reason: '物质的量变化导致其他变量超出边界',
            notification: {
                message: `⚠️ 物质的量调整失败：会导致${violatedVars.join('、')}超出允许范围`,
                type: 'warning'
            }
        };
    }
}

/**
 * V2.1: 以物质的量作为协调者的计算逻辑（支持真实气体）
 */
function calculateWithMolesAsCoordinator(globalState, changeInfo, isRealGas) {
    const { P, V, T, n, lockedVariable, a, b } = globalState;
    
    // 复制当前状态并应用用户的变化
    let newP = P, newV = V, newT = T, newN = n;
    if (changeInfo.variable === 'P') newP = changeInfo.value;
    if (changeInfo.variable === 'V') newV = changeInfo.value;
    if (changeInfo.variable === 'T') newT = changeInfo.value;
    
    // 第一步：根据锁定变量计算从动变量的理论值
    let dependentVariable, theoreticalValue;
    
    switch (lockedVariable) {
        case 'P': // 定压过程
            if (changeInfo.variable === 'T') {
                // 锁P，动T，算V
                dependentVariable = 'V';
                if (isRealGas) {
                    theoreticalValue = calculateRealGasVolume(P, newT, n, a, b);
                } else {
                    theoreticalValue = (n * R * newT) / (P * 1000) * 1000;
                }
            } else if (changeInfo.variable === 'V') {
                // 锁P，动V，算T：需要反向求解
                dependentVariable = 'T';
                // 这里简化处理，使用理想气体近似
                theoreticalValue = (P * 1000 * newV / 1000) / (n * R);
            }
            break;
            
        case 'V': // 定容过程
            if (changeInfo.variable === 'T') {
                // 锁V，动T，算P
                dependentVariable = 'P';
                if (isRealGas) {
                    theoreticalValue = calculateRealGasPressure(V, newT, n, a, b);
                } else {
                    theoreticalValue = (n * R * newT) / (V / 1000) / 1000;
                }
            } else if (changeInfo.variable === 'P') {
                // 锁V，动P，算T：需要反向求解
                dependentVariable = 'T';
                // 简化处理，使用理想气体近似
                theoreticalValue = (newP * 1000 * V / 1000) / (n * R);
            }
            break;
            
        case 'T': // 定温过程
            if (changeInfo.variable === 'V') {
                // 锁T，动V，算P
                dependentVariable = 'P';
                if (isRealGas) {
                    theoreticalValue = calculateRealGasPressure(newV, T, n, a, b);
                } else {
                    theoreticalValue = (n * R * T) / (newV / 1000) / 1000;
                }
            } else if (changeInfo.variable === 'P') {
                // 锁T，动P，算V
                dependentVariable = 'V';
                if (isRealGas) {
                    theoreticalValue = calculateRealGasVolume(newP, T, n, a, b);
                } else {
                    theoreticalValue = (n * R * T) / (newP * 1000) * 1000;
                }
            }
            break;
            
        case null: // 无锁定，默认保持某个变量不变
            if (changeInfo.variable === 'P') {
                // 动P，保持V不变，算T
                dependentVariable = 'T';
                theoreticalValue = (newP * 1000 * V / 1000) / (n * R);
            } else if (changeInfo.variable === 'V') {
                // 动V，保持T不变，算P
                dependentVariable = 'P';
                if (isRealGas) {
                    theoreticalValue = calculateRealGasPressure(newV, T, n, a, b);
                } else {
                    theoreticalValue = (n * R * T) / (newV / 1000) / 1000;
                }
            } else if (changeInfo.variable === 'T') {
                // 动T，保持V不变，算P
                dependentVariable = 'P';
                if (isRealGas) {
                    theoreticalValue = calculateRealGasPressure(V, newT, n, a, b);
                } else {
                    theoreticalValue = (n * R * newT) / (V / 1000) / 1000;
                }
            }
            break;
    }
    
    // 第二步：检查从动变量是否超界
    if (dependentVariable && isValueValid(dependentVariable, theoreticalValue)) {
        // 从动变量在界内，计算成功
        if (dependentVariable === 'P') newP = theoreticalValue;
        if (dependentVariable === 'V') newV = theoreticalValue;
        if (dependentVariable === 'T') newT = theoreticalValue;
        
        return { success: true, newState: { P: newP, V: newV, T: newT, n: newN } };
    }
    
    // 第三步：从动变量超界，进入协调逻辑
    if (dependentVariable) {
        // 钳制从动变量到边界
        const bounds = getBounds(dependentVariable);
        const clampedValue = clamp(theoreticalValue, bounds.min, bounds.max);
        
        if (dependentVariable === 'P') newP = clampedValue;
        if (dependentVariable === 'V') newV = clampedValue;
        if (dependentVariable === 'T') newT = clampedValue;
        
        // 第四步：反向计算新的物质的量
        // V2.1: 对于真实气体，这里简化使用理想气体近似计算n
        // 实际上范德华方程的n求解也比较复杂
        const calculatedN = (newP * 1000 * newV / 1000) / (R * newT); // 单位转换
        
        // 第五步：检查计算出的n是否在边界内
        if (isValueValid('n', calculatedN)) {
            // n在界内，协调成功
            const varNameMap = { 'P': '压强', 'V': '体积', 'T': '温度' };
            const depVarName = varNameMap[dependentVariable];
            const isAtMin = clampedValue === bounds.min;
            const boundaryDesc = isAtMin ? '下限' : '上限';
            
            return { 
                success: true, 
                newState: { P: newP, V: newV, T: newT, n: calculatedN },
                notification: {
                    message: `ℹ️ ${depVarName}已达${boundaryDesc}，系统自动微调物质的量至 ${calculatedN.toFixed(2)} mol 以维持平衡`,
                    type: 'info'
                }
            };
        } else {
            // n也超界了，操作失败
            const varNameMap = { 'P': '压强', 'V': '体积', 'T': '温度' };
            const depVarName = varNameMap[dependentVariable];
            
            return { 
                success: false, 
                reason: `${dependentVariable}超界且物质的量协调失败`,
                notification: {
                    message: `⚠️ 操作受限：${depVarName}超出范围，且物质的量无法协调（已达边界）`,
                    type: 'warning'
                }
            };
        }
    }
    
    // 兜底情况
    return { success: false, reason: '未知计算错误' };
}

/**
 * 获取物理量的边界值
 * @param {string} variable - 变量名 ('P', 'V', 'T', 'n')
 * @returns {Object} - {min, max}
 */
export function getBounds(variable) {
    return BOUNDS[variable] || { min: 0, max: 100 };
}

/**
 * 将值限制在指定范围内
 * @param {number} value - 要限制的值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} - 限制后的值
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * 验证单个物理量是否在有效范围内
 * @param {string} variable - 变量名
 * @param {number} value - 值
 * @returns {boolean} - 是否有效
 */
export function isValueValid(variable, value) {
    const bounds = getBounds(variable);
    return value >= bounds.min && value <= bounds.max;
}