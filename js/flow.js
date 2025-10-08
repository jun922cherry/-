// 流程控制模块 - 封装实验流程控制逻辑（引导、自由探究）
// 负责管理实验阶段的转换和引导内容

let onPhaseChange = null;

// V2.2: 探究式学习叙事 - 实验阶段定义
const EXPERIMENT_PHASES = {
    welcome: {
        name: 'Phase 0: 欢迎与定位',
        guidance: '您是否想过，为何理想气体定律在现实中总有偏差？\n\n📚 在教科书中，我们学习了完美的理想气体定律 PV=nRT。但真实世界的气体分子并非理想的"质点"——它们有体积，彼此间有引力。\n\n🔬 本平台将引导您通过可视化和互动，亲手验证**范德华方程**如何修正理想气体模型，揭示真实气体的秘密。\n\n💡 您将不仅学会如何使用工具，更重要的是，您将学会像科学家一样思考：观察现象、寻找规律、建立模型。\n\n准备好开启这场探索之旅了吗？',
        lockedVar: null,
        allowedActions: ['start_experiment']
    },
    guided_1: {
        name: 'Phase 1: 观察与偏差 - 寻找真实气体的"破绽"',
        guidance: '🎯 **任务：寻找偏差**\n\n理想气体定律 **PV = nRT** 是个完美的数学模型，但现实并非如此。让我们亲手创造一个"认知冲突"：\n\n**第一步 - 建立对比**：\n• 在左侧控制面板底部选择一种真实气体（推荐：**二氧化碳 CO₂**，它的偏差最明显）\n• 观察图表：<span style="color:#3B82F6">蓝色曲线</span>代表真实气体（遵循范德华方程），<span style="color:#94A3B8">灰色虚线</span>代表理想气体\n\n**范德华方程**：[P + a(n/V)²](V - nb) = nRT\n其中 a 是分子间吸引力参数，b 是分子体积参数\n\n**第二步 - 制造极端条件**：\n• 点击"温度(T)"旁的🔓图标将其锁定（等温过程）\n• 缓慢减小体积V（向左拖动），模拟高压环境\n\n**第三步 - 观察与思考**：\n❓ 在何种条件下，蓝色曲线与灰色线的偏差最大？\n❓ 这种偏差是系统性的（总是偏上或偏下），还是随机的？\n❓ 如果继续压缩，偏差会继续增大吗？\n\n💬 **请在下方反馈区，用您自己的话描述您发现的规律**。不要担心用词是否专业，重要的是您的真实观察和思考。',
        lockedVar: null,
        allowedActions: ['control_change', 'record_point', 'next_step', 'skip_guide', 'lock_toggle'],
        requirements: {
            requiredLock: 'T',
            requiredSlider: 'V'
        }
    },
    guided_2: {
        name: 'Phase 1: 观察与偏差 - 继续探索',
        guidance: '🔍 **继续观察：温度的影响**\n\n您刚才观察了高压下的偏差。现在让我们从另一个角度验证：\n\n**范德华方程回顾**：\n[P + a(n/V)²](V - nb) = nRT\n当 a=0, b=0 时，退化为理想气体定律 PV=nRT\n\n**实验设置**：\n• 保持当前的真实气体选择\n• 切换锁定：点击"体积(V)"旁的🔓图标将其锁定\n• 切换图表：点击上方的"P-T"按钮\n\n**操作与观察**：\n• 从低温（200K）向高温（400K）拖动温度滑块\n• 仔细观察蓝色曲线的轨迹是如何偏离灰色基准线的\n\n**关键问题**：\n❓ 在低温时，偏差大还是小？\n❓ 在高温时，真实气体是否更接近理想气体？\n❓ 您能总结出一个规律吗："在___条件下，真实气体接近理想气体；在___条件下，偏差最大。"\n\n💬 **请继续记录您的观察结果**。',
        lockedVar: null,
        allowedActions: ['control_change', 'record_point', 'next_step', 'skip_guide', 'lock_toggle'],
        requirements: {
            requiredLock: 'V',
            requiredSlider: 'T'
        }
    },
    guided_3: {
        name: 'Phase 2: 解释与模型 - 范德华的智慧',
        guidance: '🎓 **解开谜团：为何会有偏差？**\n\n您观察到的偏差并非测量误差，而是源于理想气体模型的两个"简化假设"：\n\n1️⃣ **假设一（被推翻）**：分子是没有体积的"质点"\n   • **真相**：分子有体积，当压缩到极限时，分子体积不可忽略\n   • **结果**：气体可压缩的"有效空间"比理想模型预测的要小\n\n2️⃣ **假设二（被推翻）**：分子间无相互作用\n   • **真相**：分子间有吸引力（范德华力）\n   • **结果**：分子撞击器壁前会被同伴"拉住"，实际压强比理想模型预测的要小\n\n**范德华方程的诞生**：\n```\n[P + a(n/V)²] × (V - nb) = nRT\n     ↑              ↑\n  引力修正      体积修正\n```\n\n📊 **动手验证**：\n• 选择"二氧化碳(CO₂)"，查看其 a=364.3, b=0.0427（数值较大）\n• 切换到"氢气(H₂)"，查看其 a=24.7, b=0.0266（数值较小）\n• 观察：哪种气体的偏差更明显？这与a, b的大小有何关系？\n\n🎮 **自由实验**：\n• 选择"自定义气体"，亲手调节参数 a 和 b\n• 先将 a 调到最大，观察曲线变化（引力效应）\n• 再将 b 调到最大，观察曲线变化（体积效应）\n\n💬 **请描述您的发现**：参数 a 和 b 分别如何影响偏差？您能用"分子间作用力"和"分子体积"这两个概念来解释吗？',
        lockedVar: null,
        allowedActions: ['control_change', 'record_point', 'next_step', 'skip_guide', 'lock_toggle'],
        requirements: {
            requiredLock: 'V',
            requiredSlider: 'T'
        }
    },
    free: {
        name: 'Phase 3: 探索与深化 - 成为气体科学家',
        guidance: '🎉 **恭喜！您已掌握真实气体的核心模型。**\n\n现在，整个实验平台向您全面开放。您可以像真正的科学家一样，提出假设、设计实验、验证理论。\n\n🔬 **建议探索的开放性问题**：\n\n1️⃣ **气体的"个性"**\n   ❓ 不同气体的 a, b 值差异意味着什么？为何CO₂的a值远大于H₂？\n   ❓ 能否找到一种气体，它的行为几乎与理想气体无异？\n\n2️⃣ **极端条件探索**\n   ❓ 在极低温下，范德华方程是否仍然有效？\n   ❓ 如果无限增大压强，会发生什么？（提示：观察活塞的极限位置）\n\n3️⃣ **微观-宏观联系**（进阶）\n   ❓ 观察左下方的"分子模拟器"，分子的运动速度与温度有何关系？\n   ❓ 器壁碰撞的频率与宏观压强有何关联？\n\n4️⃣ **模型的局限**\n   ❓ 范德华方程是终极真理吗？在何种条件下它也会失效？\n\n💡 **提示**：使用下方的AI助手，它可以帮您解答疑惑、验证猜想，甚至提供更深入的物理背景知识。\n\n📝 **记录您的探索旅程**，这些思考和发现比任何标准答案都更有价值。',
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
            console.log('处理next_step事件，当前阶段:', currentPhase);
            newPhase = getNextPhase(currentPhase);
            console.log('下一阶段:', newPhase);
            
            // 阶段转换时解锁控制面板，允许用户在新阶段进行实验
            if (newPhase !== currentPhase) {
                updates.isExperimentLocked = false; // 解锁，允许用户在新阶段进行实验
                console.log(`🚀 阶段转换: ${currentPhase} → ${newPhase}, 控制面板已解锁`);
                console.log(`🔓 设置 isExperimentLocked = false`);
                
                // V2.2.6: 确保重置所有步骤标志位
                updates.currentStep = {
                    feedbackSubmitted: false,
                    hasCorrectLock: false,
                    selected_real_gas: false,
                    locked_temperature: false,
                    adjusted_volume: false,
                    switched_gas: false,
                    locked_volume: false,
                    adjusted_temperature: false,
                    selected_custom_gas: false,
                    adjusted_a: false,
                    adjusted_b: false
                };
            }
            break;
            
        case 'skip_guide':
            newPhase = 'free';
            break;
            
        case 'control_change':
            // V2.2.6: 处理步骤追踪标志位
            const { var: changedVar, value, gasType } = action.payload;
            
            // 更新相应的标志位
            if (gasType) {
                if (gasType === 'custom') {
                    updates.currentStep = {
                        ...currentState.currentStep,
                        selected_custom_gas: true
                    };
                } else if (gasType !== 'ideal') {
                    if (!currentState.currentStep.selected_real_gas) {
                        updates.currentStep = {
                            ...currentState.currentStep,
                            selected_real_gas: true
                        };
                    } else {
                        updates.currentStep = {
                            ...currentState.currentStep,
                            switched_gas: true
                        };
                    }
                }
            } else if (changedVar === 'a' || changedVar === 'b') {
                updates.currentStep = {
                    ...currentState.currentStep,
                    [changedVar === 'a' ? 'adjusted_a' : 'adjusted_b']: true
                };
            } else if (changedVar === 'V') {
                updates.currentStep = {
                    ...currentState.currentStep,
                    adjusted_volume: true
                };
            } else if (changedVar === 'T') {
                updates.currentStep = {
                    ...currentState.currentStep,
                    adjusted_temperature: true
                };
            }
            break;
            
        case 'lock_toggle':
            // V2.2.6: 处理锁定状态追踪
            const lockedVar = action.payload.var;
            updates.lockedVar = lockedVar;
            
            // 更新相应的标志位
            if (lockedVar === 'T') {
                updates.currentStep = {
                    ...currentState.currentStep,
                    locked_temperature: true
                };
            } else if (lockedVar === 'V') {
                updates.currentStep = {
                    ...currentState.currentStep,
                    locked_volume: true
                };
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
        
        // V2.2.6: 重置所有步骤追踪标志位
        updates.currentStep = {
            feedbackSubmitted: false,
            hasCorrectLock: false,
            
            // 第一阶段标志位
            selected_real_gas: false,
            locked_temperature: false,
            adjusted_volume: false,
            
            // 第二阶段标志位
            switched_gas: false,
            locked_volume: false,
            adjusted_temperature: false,
            
            // 第三阶段标志位
            selected_custom_gas: false,
            adjusted_a: false,
            adjusted_b: false
        };
        
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

// 获取指定阶段的要求
export function getPhaseRequirements(phase) {
    return EXPERIMENT_PHASES[phase]?.requirements || null;
}