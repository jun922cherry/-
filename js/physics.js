// 物理计算核心模块 - 严格遵循理想气体定律 PV=nRT
// 负责所有物理状态的计算和验证

// 理想气体常数 (J/(mol·K))
const R = 8.314;

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
 * 物理计算核心函数 - 以"物质的量"作为最终协调者
 * @param {Object} globalState - 当前全局状态
 * @param {Object} changeInfo - 变化信息 {variable: 'V', value: 25.5}
 * @returns {Object} - {success: boolean, newState?: Object, reason?: string}
 */
export function calculateNewState(globalState, changeInfo) {
    const { P, V, T, n, lockedVariable } = globalState;
    
    // 特殊情况：当用户直接拖动"物质的量"滑块时，维持原有逻辑
    if (changeInfo.variable === 'n') {
        return calculateWithDirectMolesChange(globalState, changeInfo);
    }
    
    // 主要逻辑：当用户拖动P, V, T中任意一个滑块时
    return calculateWithMolesAsCoordinator(globalState, changeInfo);
}

/**
 * 直接改变物质的量时的计算逻辑（原有逻辑）
 */
function calculateWithDirectMolesChange(globalState, changeInfo) {
    const { P, V, T, n, lockedVariable } = globalState;
    let newP = P, newV = V, newT = T, newN = changeInfo.value;
    
    // 根据锁定的变量，计算从动变量
    switch (lockedVariable) {
        case 'P': // 定压过程，计算V
            newV = (newN * R * T) / (P * 1000) * 1000; // 单位转换: kPa->Pa, m³->L
            break;
        case 'V': // 定容过程，计算P
            newP = (newN * R * T) / (V / 1000) / 1000; // 单位转换: L->m³, Pa->kPa
            break;
        case 'T': // 定温过程，计算P
            newP = (newN * R * T) / (V / 1000) / 1000; // 单位转换
            break;
        case null: // 无锁定，默认保持V不变，计算P
            newP = (newN * R * T) / (V / 1000) / 1000; // 单位转换
            break;
    }
    
    const proposedState = { P: newP, V: newV, T: newT, n: newN };
    
    // 直接拖动n时：只要计算出的P, V或T有任何一个超界，操作就直接失败
    if (isStateValid(proposedState)) {
        return { success: true, newState: proposedState };
    } else {
        return { success: false, reason: '物质的量变化导致其他变量超出边界' };
    }
}

/**
 * 以物质的量作为协调者的计算逻辑
 */
function calculateWithMolesAsCoordinator(globalState, changeInfo) {
    const { P, V, T, n, lockedVariable } = globalState;
    
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
                // 锁P，动T，算V：V = nRT/P
                dependentVariable = 'V';
                theoreticalValue = (n * R * newT) / (P * 1000) * 1000;
            } else if (changeInfo.variable === 'V') {
                // 锁P，动V，算T：T = PV/nR
                dependentVariable = 'T';
                theoreticalValue = (P * 1000 * newV / 1000) / (n * R);
            }
            break;
            
        case 'V': // 定容过程
            if (changeInfo.variable === 'T') {
                // 锁V，动T，算P：P = nRT/V
                dependentVariable = 'P';
                theoreticalValue = (n * R * newT) / (V / 1000) / 1000;
            } else if (changeInfo.variable === 'P') {
                // 锁V，动P，算T：T = PV/nR
                dependentVariable = 'T';
                theoreticalValue = (newP * 1000 * V / 1000) / (n * R);
            }
            break;
            
        case 'T': // 定温过程
            if (changeInfo.variable === 'V') {
                // 锁T，动V，算P：P = nRT/V
                dependentVariable = 'P';
                theoreticalValue = (n * R * T) / (newV / 1000) / 1000;
            } else if (changeInfo.variable === 'P') {
                // 锁T，动P，算V：V = nRT/P
                dependentVariable = 'V';
                theoreticalValue = (n * R * T) / (newP * 1000) * 1000;
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
                theoreticalValue = (n * R * T) / (newV / 1000) / 1000;
            } else if (changeInfo.variable === 'T') {
                // 动T，保持V不变，算P
                dependentVariable = 'P';
                theoreticalValue = (n * R * newT) / (V / 1000) / 1000;
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
        // 使用理想气体状态方程：n = PV/RT
        const calculatedN = (newP * 1000 * newV / 1000) / (R * newT); // 单位转换
        
        // 第五步：检查计算出的n是否在边界内
        if (isValueValid('n', calculatedN)) {
            // n在界内，协调成功
            return { 
                success: true, 
                newState: { P: newP, V: newV, T: newT, n: calculatedN } 
            };
        } else {
            // n也超界了，操作失败
            return { 
                success: false, 
                reason: `${dependentVariable}超界且物质的量协调失败` 
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