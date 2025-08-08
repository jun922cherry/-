// 流程控制模块 - 封装实验流程控制逻辑（引导、自由探究）
// 负责管理实验阶段的转换和引导内容

let onPhaseChange = null;

// 实验阶段定义
const EXPERIMENT_PHASES = {
    welcome: {
        name: '欢迎阶段',
        guidance: '欢迎来到理想气体定律探究沙箱！请点击"我明白了"开始您的探究之旅。',
        lockedVar: 'T',
        allowedActions: ['start_experiment']
    },
    guided_1: {
        name: '引导实验1：等温过程',
        guidance: '现在开始第一个引导实验：等温过程。请点击"温度(T)"旁的锁形图标将其锁定，然后拖动体积滑块，观察压强的变化。根据波义耳定律，在温度不变时，气体的压强与体积成反比。',
        lockedVar: null,
        allowedActions: ['control_change', 'record_point', 'next_step', 'skip_guide', 'lock_toggle']
    },
    guided_2: {
        name: '引导实验2：等压过程',
        guidance: '现在开始第二个引导实验：等压过程。请点击"压强(P)"旁的锁形图标将其锁定，然后拖动温度滑块，观察体积的变化。根据查理定律，在压强不变时，气体的体积与温度成正比。',
        lockedVar: null,
        allowedActions: ['control_change', 'record_point', 'next_step', 'skip_guide', 'lock_toggle']
    },
    guided_3: {
        name: '引导实验3：等容过程',
        guidance: '现在开始第三个引导实验：等容过程。请点击"体积(V)"旁的锁形图标将其锁定，然后拖动温度滑块，观察压强的变化。根据盖-吕萨克定律，在体积不变时，气体的压强与温度成正比。',
        lockedVar: null,
        allowedActions: ['control_change', 'record_point', 'next_step', 'skip_guide', 'lock_toggle']
    },
    free: {
        name: '自由探究',
        guidance: '恭喜您完成了所有引导实验！现在您可以自由探究理想气体定律。尝试改变不同的变量，观察它们之间的关系，记录您的发现。',
        lockedVar: null,
        allowedActions: ['control_change', 'record_point', 'lock_toggle', 'reset']
    }
};

// 初始化流程控制器
export function init(phaseChangeCallback) {
    console.log('流程控制器初始化');
    onPhaseChange = phaseChangeCallback;
}

// 推进实验阶段
export function advancePhase(currentState, action) {
    const currentPhase = currentState.experimentPhase;
    const phaseConfig = EXPERIMENT_PHASES[currentPhase];
    
    // 检查动作是否被允许
    if (!isActionAllowed(action.type, currentPhase)) {
        console.warn(`动作 ${action.type} 在阶段 ${currentPhase} 中不被允许`);
        return currentState;
    }
    
    // 根据动作类型处理阶段转换
    let newPhase = currentPhase;
    let updates = {};
    
    switch (action.type) {
        case 'start_experiment':
            if (currentPhase === 'welcome') {
                newPhase = 'guided_1';
            }
            break;
            
        case 'next_step':
            newPhase = getNextPhase(currentPhase);
            
            // 阶段转换时解锁控制面板，允许用户在新阶段进行实验
            if (newPhase !== currentPhase) {
                updates.isExperimentLocked = false; // 解锁，允许用户在新阶段进行实验
                console.log(`🚀 阶段转换: ${currentPhase} → ${newPhase}, 控制面板已解锁`);
                console.log(`🔓 设置 isExperimentLocked = false`);
            }
            break;
            
        case 'skip_guide':
            newPhase = 'free';
            break;
            
        case 'control_change':
            // control_change现在由physics.js处理，这里不再处理
            console.log('control_change动作已转移到physics.js处理');
            break;
            
        case 'lock_toggle':
            // 只在自由探究阶段允许切换锁定
            if (currentPhase === 'free') {
                updates.lockedVar = action.payload.var;
            }
            break;
            
        case 'reset':
            // 重置到初始状态
            updates = {
                P: 101.325,
                V: 22.4,
                T: 273.15,
                n: 1.0,
                history: []
            };
            break;
            
        case 'record_point':
            // 记录当前状态到历史
            const currentHistory = Array.isArray(currentState.history) ? currentState.history : [];
            const newHistory = [...currentHistory];
            newHistory.push({
                P: currentState.P,
                V: currentState.V,
                T: currentState.T,
                n: currentState.n,
                timestamp: Date.now()
            });
            updates.history = newHistory;
            break;
    }
    
    // 如果阶段发生变化，更新相关状态
    if (newPhase !== currentPhase) {
        const newPhaseConfig = EXPERIMENT_PHASES[newPhase];
        updates.experimentPhase = newPhase;
        updates.currentGuidance = newPhaseConfig.guidance;
        // 不再自动设置lockedVariable，由用户主导
        
        // 重置反馈提交状态
        updates.currentStep = { feedbackSubmitted: false };
        
        // 触发阶段变化事件
        if (onPhaseChange) {
            setTimeout(() => onPhaseChange(), 0);
        }
    }
    
    return updates;
}

// 获取当前引导文本
export function getCurrentGuidance(phase) {
    const phaseConfig = EXPERIMENT_PHASES[phase];
    return phaseConfig ? phaseConfig.guidance : '';
}

// 检查动作是否被允许
export function isActionAllowed(action, phase) {
    const phaseConfig = EXPERIMENT_PHASES[phase];
    return phaseConfig && phaseConfig.allowedActions.includes(action);
}

// 获取下一个阶段
function getNextPhase(currentPhase) {
    switch (currentPhase) {
        case 'welcome':
            return 'guided_1';
        case 'guided_1':
            return 'guided_2';
        case 'guided_2':
            return 'guided_3';
        case 'guided_3':
            return 'free';
        default:
            return currentPhase;
    }
}

// 旧的calculateNewState函数已移除，现在使用physics.js中的实现

// 获取所有实验阶段信息
export function getAllPhases() {
    return EXPERIMENT_PHASES;
}