// 物理模拟模块 - 封装所有Matter.js物理模拟逻辑
// 负责分子动力学模拟的渲染和更新

let engine, render, world;
let particles = [];
let piston = null;
let container = null;
let walls = {
    top: null,
    bottom: null,
    left: null,
    right: null // 活塞
};

// 模拟参数 - 固定舞台大小，永远不变
const SIMULATION_CONFIG = {
    width: 400,  // 固定canvas宽度，永远不变
    height: 250, // 固定canvas高度，永远不变
    particleRadius: 5,    // 增加分子半径，使其更加明显
    pistonThickness: 30,  // 增加活塞厚度以提高物理稳定性
    wallThickness: 20     // 增加墙体厚度以提高物理稳定性
};

// 体积到活塞位置的映射配置
const VOLUME_MAPPING = {
    minVolume: 10,   // 最小体积 (L)
    maxVolume: 50,   // 最大体积 (L)
    minX: 100,       // 活塞最左位置（初始值，会在initPhysicsEngine中重新计算）
    maxX: 300        // 活塞最右位置（初始值，会在initPhysicsEngine中重新计算）
};

// 检查Matter.js是否可用
function isMatterAvailable() {
    return typeof Matter !== 'undefined';
}

// 创建降级模拟显示
function createFallbackSimulation(containerElement) {
    containerElement.innerHTML = `
        <div style="
            width: ${SIMULATION_CONFIG.width}px;
            height: ${SIMULATION_CONFIG.height}px;
            background: #f8f9fa;
            border: 2px solid #6c757d;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            color: #6c757d;
            text-align: center;
            line-height: 1.4;
            overflow: hidden;
        ">
            <div>
                <div style="margin-bottom: 8px;">⚛️</div>
                <div>分子动力学模拟</div>
                <div style="font-size: 12px; margin-top: 4px;">
                    (物理库加载中...)
                </div>
            </div>
        </div>
    `;
}

// 初始化物理模拟
export function init(containerElement, initialState) {
    console.log('物理模拟器初始化');
    
    container = containerElement;
    
    // 检查Matter.js是否可用，如果不可用则等待加载
    if (!isMatterAvailable()) {
        console.warn('Matter.js未加载，使用降级显示并等待加载...');
        createFallbackSimulation(containerElement);
        
        // 多次重试初始化
        let retryCount = 0;
        const maxRetries = 5;
        const retryInterval = setInterval(() => {
            retryCount++;
            if (isMatterAvailable()) {
                console.log('Matter.js加载完成，重新初始化物理模拟');
                clearInterval(retryInterval);
                initPhysicsEngine(initialState);
            } else if (retryCount >= maxRetries) {
                console.error('Matter.js加载失败，保持降级显示');
                clearInterval(retryInterval);
            }
        }, 500);
        return;
    }
    
    initPhysicsEngine(initialState);
}

// 初始化物理引擎
function initPhysicsEngine(initialState) {
    // 清除降级显示内容
    if (container) {
        container.innerHTML = '';
    }
    
    // 获取父容器的实际尺寸
    const containerRect = container.getBoundingClientRect();
    const canvasWidth = Math.max(400, containerRect.width - 20); // 最小400px，减去padding
    const canvasHeight = Math.max(250, containerRect.height - 20); // 最小250px，减去padding
    
    // 更新SIMULATION_CONFIG以反映实际canvas尺寸
    SIMULATION_CONFIG.width = canvasWidth;
    SIMULATION_CONFIG.height = canvasHeight;
    
    // 重新计算体积映射范围，确保在可视区域内
    // 考虑墙体厚度和活塞厚度，留出安全边距
    const safeMargin = SIMULATION_CONFIG.wallThickness + SIMULATION_CONFIG.pistonThickness;
    VOLUME_MAPPING.minX = safeMargin + SIMULATION_CONFIG.width * 0.15;  // 左边界 + 15%
    VOLUME_MAPPING.maxX = SIMULATION_CONFIG.width - safeMargin - SIMULATION_CONFIG.width * 0.05; // 右边界 - 5%
    
    // ★V2.7 重构：分离物理与视觉的引擎★
    // 创建Matter.js引擎 - 用于碰撞检测和边界控制
    engine = Matter.Engine.create({
        // 明确禁用引擎自带的迭代，因为我们将手动处理
        positionIterations: 0,
        velocityIterations: 0,
        constraintIterations: 0
    });
    
    engine.world.gravity.y = 0;   // 无重力
    engine.enableSleeping = false; // 绝对禁止休眠
    engine.world.slop = 0;       // 零重叠容忍
    
    // 确保时间尺度为1，防止能量损失
    engine.timing.timeScale = 1;
    
    // 调整Baumgarte稳定系数 - 更强的位置修正强度
    engine.constraintDefaults = engine.constraintDefaults || {};
    engine.constraintDefaults.baumgarte = { x: 0.9, y: 0.9 }; // 更强的稳定系数
    
    // ★关键：设置碰撞检测的精度参数★
    // 设置更宽松的碰撞容差，避免微小振荡
    engine.broadphase.bucketWidth = 64;
    engine.broadphase.bucketHeight = 64;
    
    // 设置更稳定的时间步长
    engine.timing.delta = 16.666; // 固定60FPS的时间步长
    
    world = engine.world;
    
    // ★V2.7 核心：初始化引擎边界★
    // 这是新方案的基础 - 使用engine.world.bounds来控制模拟空间
    const initialMaxX = calculatePistonPosition(initialState.V);
    engine.world.bounds = {
        min: { x: 0, y: 0 },
        max: { x: initialMaxX, y: SIMULATION_CONFIG.height }
    };
    
    console.log(`🌍 初始化引擎边界: maxX = ${initialMaxX}`);
    
    // 使用Matter.js原生弹性碰撞处理（restitution: 1）
    
    // ★能量守恒修复：移除破坏性边界检查★
    // 原边界检查逻辑使用Math.abs()强制修正速度，破坏了弹性碰撞的能量守恒
    // Matter.js的内置碰撞检测已经能够正确处理墙体碰撞，无需额外干预
    // 注释掉原有的beforeUpdate边界检查，让物理引擎自然处理碰撞
    
    // ★V3.7 核心：基于速度的墙壁驱动系统★
    Matter.Events.on(engine, 'beforeUpdate', function() {
        // 在每一帧物理计算之前，检查墙壁是否需要移动
        
        // 1. 获取当前状态
        const state = window.getState ? window.getState() : null;
        const rightWall = walls.right;
        
        if (!rightWall || !state) return;
        
        // V3.8: 如果用户正在手动拖拽，则跳过所有自动墙壁移动逻辑
        if (state.isDragging) {
            return; // 立即退出，让用户完全控制
        }
        
        // 2. 计算目标位置
        const targetX = calculateTargetXFromVolume(state.V);
        
        // 3. 计算当前位置与目标的距离
        const currentX = rightWall.position.x;
        const distance = targetX - currentX;
        
        // 4. 如果距离足够小，就停止运动并固定位置，防止抖动或过冲
        if (Math.abs(distance) < 0.5) {
            Matter.Body.setVelocity(rightWall, { x: 0, y: 0 });
            // 精确修正最后位置，避免微小偏差
            if (Math.abs(distance) > 0.1) {
                Matter.Body.setPosition(rightWall, { x: targetX, y: rightWall.position.y });
            }
        } else {
            // 5. 核心逻辑：给墙壁一个与其到目标距离成正比的速度
            // 阻尼系数0.2可以调整墙壁移动的快慢和"手感"
            const velocity = distance * 0.2;
            Matter.Body.setVelocity(rightWall, { x: velocity, y: 0 });
        }
    });
    
    // 创建渲染器 - 使用动态计算的尺寸
    render = Matter.Render.create({
        element: container,
        engine: engine,
        options: {
            width: SIMULATION_CONFIG.width,
            height: SIMULATION_CONFIG.height,
            wireframes: false,
            background: 'transparent',
            showVelocity: false,
            showAngleIndicator: false,
            showDebug: false,
            pixelRatio: window.devicePixelRatio || 1
        }
    });
    
    // 设置容器样式，确保填满父面板
    container.style.overflow = 'hidden';
    container.style.width = '100%';
    container.style.height = '100%';
    
    // 手动创建四面墙体
    createStaticWalls();
    
    // 创建活塞（可移动的右墙）
    createPiston(initialState.V);
    
    // 创建分子
    createParticles(initialState.n, initialState.T);
    
    // ★V2.0 自定义弹性碰撞引擎 - 接管核心★
    // 碰撞效果追踪
    const collisionEffects = new Map();
    
    // 挂载collisionStart事件监听器 - 这是我们新引擎的入口点
    Matter.Events.on(engine, 'collisionStart', function(event) {
        const pairs = event.pairs;
        
        // 遍历所有在这一帧发生的碰撞对
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            handleCustomCollision(pair.bodyA, pair.bodyB);
        }
    });
    
    // 判断是否为垂直墙体的辅助函数
    function isVerticalWall(bodyId) {
        return (walls.left && walls.left.id === bodyId) || 
               (walls.right && walls.right.id === bodyId);
    }
    
    // ★核心函数：自定义碰撞处理★
    function handleCustomCollision(bodyA, bodyB) {
        // 判断是否为墙体的辅助函数
        function isWall(body) {
            return body.isStatic || 
                   (walls.left && body.id === walls.left.id) ||
                   (walls.right && body.id === walls.right.id) ||
                   (walls.top && body.id === walls.top.id) ||
                   (walls.bottom && body.id === walls.bottom.id);
        }
        
        // 情况A：分子与墙体的碰撞（包括静态墙体和非静态活塞）
        if (isWall(bodyA) || isWall(bodyB)) {
            const molecule = isWall(bodyA) ? bodyB : bodyA;
            const wall = isWall(bodyA) ? bodyA : bodyB;
            
            // 只处理分子与墙体的碰撞，跳过墙体之间的碰撞
            if (!particles.includes(molecule)) {
                return;
            }
            
            // 添加碰撞效果
            collisionEffects.set(molecule.id, { time: Date.now(), intensity: 1 });
            
            // 物理原理：只反转垂直于边界的速度分量，保持平行于边界的速度分量不变
            // 垂直墙体（左墙/右墙）：垂直于边界=水平方向(x)，平行于边界=垂直方向(y)
            // 水平墙体（上墙/下墙）：垂直于边界=垂直方向(y)，平行于边界=水平方向(x)
            if (isVerticalWall(wall.id)) {
                // 垂直墙体碰撞：只反转垂直于边界的速度分量(x方向)，保持平行分量(y方向)不变
                Matter.Body.setVelocity(molecule, {
                    x: -molecule.velocity.x,  // 反转垂直于边界的分量
                    y: molecule.velocity.y    // 保持平行于边界的分量
                });
                console.log(`垂直墙体碰撞: 分子${molecule.id}与墙体${wall.id}碰撞，反转垂直于边界的速度分量(x方向)`);
            } else { // 水平墙体
                // 水平墙体碰撞：只反转垂直于边界的速度分量(y方向)，保持平行分量(x方向)不变
                Matter.Body.setVelocity(molecule, {
                    x: molecule.velocity.x,   // 保持平行于边界的分量
                    y: -molecule.velocity.y   // 反转垂直于边界的分量
                });
                console.log(`水平墙体碰撞: 分子${molecule.id}与墙体${wall.id}碰撞，反转垂直于边界的速度分量(y方向)`);
            }
            
        // 情况B：两个分子之间的碰撞 (核心物理)
        } else if (particles.includes(bodyA) && particles.includes(bodyB)) {
            // 添加碰撞效果
            collisionEffects.set(bodyA.id, { time: Date.now(), intensity: 1 });
            collisionEffects.set(bodyB.id, { time: Date.now(), intensity: 1 });
            
            resolveElasticCollision(bodyA, bodyB);
        }
    }
    
    // ★★★ 核心物理计算 ★★★
    function resolveElasticCollision(body1, body2) {
        const v1 = body1.velocity;
        const v2 = body2.velocity;
        const m1 = body1.mass;
        const m2 = body2.mass;
        const x1 = body1.position;
        const x2 = body2.position;
        
        // 计算碰撞法线向量 (从 body1 指向 body2)
        const collisionNormal = { x: x2.x - x1.x, y: x2.y - x1.y };
        
        // 计算单位法线向量
        const distance = Math.sqrt(collisionNormal.x**2 + collisionNormal.y**2);
        if (distance === 0) return; // 避免除零错误
        
        const unitNormal = { x: collisionNormal.x / distance, y: collisionNormal.y / distance };
        
        // 计算单位切线向量
        const unitTangent = { x: -unitNormal.y, y: unitNormal.x };
        
        // 1. 将速度投影到法线和切线方向
        const v1n = unitNormal.x * v1.x + unitNormal.y * v1.y;
        const v1t = unitTangent.x * v1.x + unitTangent.y * v1.y;
        const v2n = unitNormal.x * v2.x + unitNormal.y * v2.y;
        const v2t = unitTangent.x * v2.x + unitTangent.y * v2.y;
        
        // 2. 计算碰撞后新的法线方向速度 (使用一维弹性碰撞公式)
        const v1n_new = (v1n * (m1 - m2) + 2 * m2 * v2n) / (m1 + m2);
        const v2n_new = (v2n * (m2 - m1) + 2 * m1 * v1n) / (m1 + m2);
        
        // 切线方向速度不变
        const v1t_new = v1t;
        const v2t_new = v2t;
        
        // 3. 将新的法线和切线速度转换回 x, y 坐标系
        const new_v1n_vec = { x: v1n_new * unitNormal.x, y: v1n_new * unitNormal.y };
        const new_v1t_vec = { x: v1t_new * unitTangent.x, y: v1t_new * unitTangent.y };
        const new_v2n_vec = { x: v2n_new * unitNormal.x, y: v2n_new * unitNormal.y };
        const new_v2t_vec = { x: v2t_new * unitTangent.x, y: v2t_new * unitTangent.y };
        
        const final_v1 = { x: new_v1n_vec.x + new_v1t_vec.x, y: new_v1n_vec.y + new_v1t_vec.y };
        const final_v2 = { x: new_v2n_vec.x + new_v2t_vec.x, y: new_v2n_vec.y + new_v2t_vec.y };
        
        // 4. ★立即应用新的速度★
        Matter.Body.setVelocity(body1, final_v1);
        Matter.Body.setVelocity(body2, final_v2);
    }

    // ★第三阶段：部署"碰撞事件监视器"——最终诊断工具★
    // 历史动能变量
    let previousTotalKE = 0;
    
    // 创建动能计算函数
    function calculateTotalKineticEnergy() {
        let totalKE = 0;
        // 遍历世界中的所有物体
        engine.world.bodies.forEach(body => {
            // 我们只关心非静态的物体（即分子）
            if (!body.isStatic) {
                // 动能公式: 0.5 * m * v^2
                const velocitySquared = body.velocity.x**2 + body.velocity.y**2;
                const kineticEnergy = 0.5 * body.mass * velocitySquared;
                totalKE += kineticEnergy;
            }
        });
        return totalKE;
    }

    // ★终极能量监视器 - 捕捉异常能量损失★
    Matter.Events.on(engine, 'afterUpdate', () => {
        // ★最高优先级：边界完整性检查 - 万无一失的最终防线★
        enforceAllBoundaries();
        
        const currentTotalKE = calculateTotalKineticEnergy();
        
        // 计算能量变化率
        const deltaKE = currentTotalKE - previousTotalKE;
        
        // 设定一个非常小的、可接受的误差阈值
        const tolerance = -0.001; // 允许极小的负向浮点误差
        
        // 如果能量下降超过了我们的容忍度
        if (deltaKE < tolerance) {
            // 这就是一个"可疑事件"，我们在控制台打印详细警告
            console.warn(`[KE Anomaly] Significant energy drop detected!`, {
                timestamp: engine.timing.timestamp,
                dropAmount: deltaKE,
                previousKE: previousTotalKE,
                currentKE: currentTotalKE
            });
        }
        
        // 更新历史动能值，为下一帧做准备
        previousTotalKE = currentTotalKE;
        
        // 定期打印总动能（每100帧一次，避免控制台刷屏）
        if (engine.timing.timestamp % 1000 < 16.666) {
            console.log("Total Kinetic Energy:", currentTotalKE.toFixed(4));
        }
    });
    
    // 添加自定义渲染事件，为分子和墙体添加渐变效果
    Matter.Events.on(render, 'afterRender', function() {
        const canvas = render.canvas;
        const ctx = canvas.getContext('2d');
        const currentTime = Date.now();
        
        // 绘制墙体渐变效果
        function drawWallGradient(wall, isVertical = false) {
            if (!wall) return;
            
            const bounds = wall.bounds;
            const width = bounds.max.x - bounds.min.x;
            const height = bounds.max.y - bounds.min.y;
            
            let gradient;
            if (isVertical) {
                gradient = ctx.createLinearGradient(bounds.min.x, 0, bounds.max.x, 0);
            } else {
                gradient = ctx.createLinearGradient(0, bounds.min.y, 0, bounds.max.y);
            }
            
            gradient.addColorStop(0, 'rgba(147, 197, 253, 0.6)');
            gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.4)');
            gradient.addColorStop(1, 'rgba(147, 197, 253, 0.6)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(bounds.min.x, bounds.min.y, width, height);
            
            // 添加边框
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
            ctx.lineWidth = 2;
            ctx.strokeRect(bounds.min.x, bounds.min.y, width, height);
        }
        
        // 绘制活塞渐变效果
        function drawPistonGradient(piston) {
            if (!piston) return;
            
            const bounds = piston.bounds;
            const width = bounds.max.x - bounds.min.x;
            const height = bounds.max.y - bounds.min.y;
            
            const gradient = ctx.createLinearGradient(bounds.min.x, 0, bounds.max.x, 0);
            gradient.addColorStop(0, 'rgba(236, 72, 153, 0.8)');
            gradient.addColorStop(0.5, 'rgba(219, 39, 119, 0.6)');
            gradient.addColorStop(1, 'rgba(236, 72, 153, 0.8)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(bounds.min.x, bounds.min.y, width, height);
            
            // 添加边框
            ctx.strokeStyle = 'rgba(219, 39, 119, 0.9)';
            ctx.lineWidth = 3;
            ctx.strokeRect(bounds.min.x, bounds.min.y, width, height);
        }
        
        // 绘制墙体
        drawWallGradient(walls.top, false);
        drawWallGradient(walls.bottom, false);
        drawWallGradient(walls.left, true);
        drawPistonGradient(walls.right);
        
        // 为每个分子绘制渐变效果
        particles.forEach(particle => {
            const pos = particle.position;
            const radius = SIMULATION_CONFIG.particleRadius;
            
            // 检查碰撞效果
            const collision = collisionEffects.get(particle.id);
            let glowIntensity = 0;
            if (collision) {
                const elapsed = currentTime - collision.time;
                if (elapsed < 200) { // 200ms 闪烁效果
                    glowIntensity = (1 - elapsed / 200) * collision.intensity;
                } else {
                    collisionEffects.delete(particle.id);
                }
            }
            
            // 根据速度计算颜色强度
            const velocity = Math.sqrt(particle.velocity.x ** 2 + particle.velocity.y ** 2);
            const speedFactor = Math.min(1, velocity / 10); // 归一化速度
            
            // 如果有碰撞效果，添加外发光
            if (glowIntensity > 0) {
                const glowGradient = ctx.createRadialGradient(
                    pos.x, pos.y, 0,
                    pos.x, pos.y, radius * (1 + glowIntensity * 2)
                );
                glowGradient.addColorStop(0, `rgba(255, 255, 255, ${glowIntensity * 0.8})`);
                glowGradient.addColorStop(0.5, `rgba(236, 72, 153, ${glowIntensity * 0.6})`);
                glowGradient.addColorStop(1, 'rgba(236, 72, 153, 0)');
                
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, radius * (1 + glowIntensity * 2), 0, 2 * Math.PI);
                ctx.fillStyle = glowGradient;
                ctx.fill();
            }
            
            // 创建径向渐变（根据速度调整颜色）
            const gradient = ctx.createRadialGradient(
                pos.x, pos.y, 0,
                pos.x, pos.y, radius
            );
            
            const centerAlpha = 0.9 + speedFactor * 0.1;
            const midAlpha = 0.8 + speedFactor * 0.2;
            const edgeAlpha = 0.6 + speedFactor * 0.3;
            
            gradient.addColorStop(0, `rgba(255, 182, 193, ${centerAlpha})`); // 浅粉色中心
            gradient.addColorStop(0.7, `rgba(236, 72, 153, ${midAlpha})`); // 粉色
            gradient.addColorStop(1, `rgba(219, 39, 119, ${edgeAlpha})`); // 深粉色边缘
            
            // 绘制分子
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI);
            ctx.fillStyle = gradient;
            ctx.fill();
            
            // 添加高光效果
            const highlightGradient = ctx.createRadialGradient(
                pos.x - radius * 0.3, pos.y - radius * 0.3, 0,
                pos.x - radius * 0.3, pos.y - radius * 0.3, radius * 0.6
            );
            highlightGradient.addColorStop(0, `rgba(255, 255, 255, ${0.6 + speedFactor * 0.2})`);
            highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.beginPath();
            ctx.arc(pos.x - radius * 0.3, pos.y - radius * 0.3, radius * 0.6, 0, 2 * Math.PI);
            ctx.fillStyle = highlightGradient;
            ctx.fill();
        });
    });
    
    // 启动渲染和引擎
    Matter.Render.run(render);
    Matter.Runner.run(engine);
    
    // V3.8: 添加鼠标约束，支持拖拽交互
    const mouse = Matter.Mouse.create(render.canvas);
    const mouseConstraint = Matter.MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: {
            stiffness: 0.2,
            render: {
                visible: false
            }
        },
        // V3.8: 设置碰撞过滤器，只允许拖拽墙体
        collisionFilter: {
            category: 0x0001,
            mask: 0x0001
        }
    });
    
    Matter.World.add(world, mouseConstraint);
    
    // V3.8: 绑定拖拽状态锁事件
    Matter.Events.on(mouseConstraint, 'startdrag', () => {
        window.stateManager.updateState({ isDragging: true });
        console.log('V3.8: Dragging started, state lock ON.');
    });
    
    Matter.Events.on(mouseConstraint, 'enddrag', () => {
        window.stateManager.updateState({ isDragging: false });
        console.log('V3.8: Dragging ended, state lock OFF.');
        
        // 关键同步步骤：将墙壁的最终位置同步回体积滑块
        const rightWall = engine.world.bodies.find(b => b.label === 'wall-right');
        if (rightWall) {
            const newVolume = calculateVolumeFromWallPosition(rightWall.position.x);
            window.stateManager.updateState({ volume: newVolume });
            const volumeControl = document.getElementById('volume-control');
            if (volumeControl) {
                volumeControl.value = newVolume;
            }
        }
    });
    
    // 保持鼠标与渲染器同步
    render.mouse = mouse;
    
    console.log('物理模拟器启动完成');
}

// 根据最新state更新模拟器
export function update(currentState) {
    console.log(`🔄 simulation.update 被调用:`, currentState);
    
    if (!isMatterAvailable() || !engine || !world) {
        console.warn('⚠️ simulation.update 退出: 物理引擎未初始化');
        return;
    }
    
    // 更新粒子数量和速度
    updateParticleCountAndSpeed(currentState.n, currentState.T);
    
    // 更新活塞位置
    console.log(`📏 准备更新活塞位置: V = ${currentState.V}`);
    updatePistonPosition(currentState.V);
    
    // 更新活塞曲率（压强效果）
    updatePistonCurvature(currentState.P);
}

// 手动创建四面静态墙体 - 彻底解决角落陷阱问题
function createStaticWalls() {
    if (!isMatterAvailable() || !world) return;
    
    const { width, height, wallThickness } = SIMULATION_CONFIG;
    
    // ★彻底解决角落陷阱：完全分离的墙体设计★
    // 为了避免角落碰撞问题，我们在角落留出明确的间隙
    const cornerGap = wallThickness * 0.5; // 角落间隙
    
    // 上墙：从左边界+间隙开始，到右边界-间隙结束
    const topWallWidth = width - 2 * cornerGap;
    walls.top = Matter.Bodies.rectangle(
        width / 2, 
        wallThickness / 2, 
        topWallWidth, 
        wallThickness, 
        {
            isStatic: true,
            restitution: 1,       // 恢复完全弹性碰撞
            friction: 0,
            frictionAir: 0,
            frictionStatic: 0,
            angle: 0,
            // ★关键修复：设置无限质量，确保碰撞时分子速度不损失★
            mass: Infinity,       // 无限质量
            density: Infinity,    // 无限密度
            inertia: Infinity,    // 无限转动惯量
            inverseMass: 0,       // 双重保险：明确设定质量倒数为0
            // 优化墙体碰撞响应
            slop: 0.01,          // 允许微小重叠，避免过度修正
            // 严格的碰撞过滤
            collisionFilter: {
                category: 0x0001,
                mask: 0x0002
            },
            render: { 
                fillStyle: 'transparent',
                strokeStyle: 'transparent',
                lineWidth: 0
            }
        }
    );
    
    // 下墙：从左边界+间隙开始，到右边界-间隙结束
    const bottomWallWidth = width - 2 * cornerGap;
    walls.bottom = Matter.Bodies.rectangle(
        width / 2, 
        height - wallThickness / 2, 
        bottomWallWidth, 
        wallThickness, 
        {
            isStatic: true,
            restitution: 1,       // 恢复完全弹性碰撞
            friction: 0,
            frictionAir: 0,
            frictionStatic: 0,
            angle: 0,
            // ★关键修复：设置无限质量，确保碰撞时分子速度不损失★
            mass: Infinity,       // 无限质量
            density: Infinity,    // 无限密度
            inertia: Infinity,    // 无限转动惯量
            inverseMass: 0,       // 双重保险：明确设定质量倒数为0
            // 优化墙体碰撞响应
            slop: 0.01,          // 允许微小重叠，避免过度修正
            // 严格的碰撞过滤
            collisionFilter: {
                category: 0x0001,
                mask: 0x0002
            },
            render: { 
                fillStyle: 'transparent',
                strokeStyle: 'transparent',
                lineWidth: 0
            }
        }
    );
    
    // 左墙：从上边界+间隙开始，到下边界-间隙结束
    const leftWallHeight = height - 2 * cornerGap;
    walls.left = Matter.Bodies.rectangle(
        wallThickness / 2, 
        height / 2, 
        wallThickness, 
        leftWallHeight, 
        {
            isStatic: true,
            restitution: 1,       // 恢复完全弹性碰撞
            friction: 0,
            frictionAir: 0,
            frictionStatic: 0,
            angle: 0,
            // ★关键修复：设置无限质量，确保碰撞时分子速度不损失★
            mass: Infinity,       // 无限质量
            density: Infinity,    // 无限密度
            inertia: Infinity,    // 无限转动惯量
            inverseMass: 0,       // 双重保险：明确设定质量倒数为0
            // 优化墙体碰撞响应
            slop: 0.01,          // 允许微小重叠，避免过度修正
            // 严格的碰撞过滤
            collisionFilter: {
                category: 0x0001,
                mask: 0x0002
            },
            render: { 
                fillStyle: 'transparent',
                strokeStyle: 'transparent',
                lineWidth: 0
            }
        }
    );
    
    // 将三面固定墙添加到世界
    Matter.World.add(world, [walls.top, walls.bottom, walls.left]);
}

// 创建活塞（可移动的右墙）
function createPiston(volume) {
    if (!isMatterAvailable() || !world) return;
    
    const pistonX = calculatePistonPosition(volume);
    
    // 移除现有活塞
    if (walls.right) {
        Matter.World.remove(world, walls.right);
    }
    
    // ★彻底解决角落陷阱：活塞也采用相同的间隙设计★
    const cornerGap = SIMULATION_CONFIG.wallThickness * 0.5; // 与其他墙体保持一致的角落间隙
    
    // 活塞：从上边界+间隙开始，到下边界-间隙结束
    const pistonHeight = SIMULATION_CONFIG.height - 2 * cornerGap;
    walls.right = Matter.Bodies.rectangle(
        pistonX,
        SIMULATION_CONFIG.height / 2,
        SIMULATION_CONFIG.pistonThickness,
        pistonHeight, // 与其他墙体保持一致的间隙处理
        {
            // V3.8: 修复关键BUG - 右墙必须设为非静态才能被拖拽
            isStatic: false,
            restitution: 1,       // 恢复完全弹性碰撞
            friction: 0,
            frictionAir: 0,
            frictionStatic: 0,
            angle: 0,
            // V3.8: 修复拖拽问题 - 设置合理质量而非无限质量
            mass: 1000,           // 大质量但非无限，确保碰撞时分子速度不损失
            density: 1,           // 正常密度
            inertia: Infinity,    // 防止旋转
            // 优化墙体碰撞响应
            slop: 0.01,          // 允许微小重叠，避免过度修正
            // 严格的碰撞过滤
            collisionFilter: {
                category: 0x0001,
                mask: 0x0002
            },
            // V3.8: 添加标签以便拖拽时识别
            label: 'wall-right',
            render: { 
                fillStyle: 'transparent',
                strokeStyle: 'transparent',
                lineWidth: 0
            }
        }
    );
    
    // 保存活塞引用以便后续移动
    piston = walls.right;
    
    Matter.World.add(world, walls.right);
}

// 创建分子（理想物理模型）
function createParticles(moles, temperature) {
    if (!isMatterAvailable() || !world) return;
    
    // 清除现有分子
    if (particles.length > 0) {
        Matter.World.remove(world, particles);
        particles = [];
    }
    
    // 计算分子数量（简化：1摩尔 = 20个分子用于可视化）
    const particleCount = Math.max(1, Math.round(moles * 20));
    
    const { particleRadius } = SIMULATION_CONFIG;
    
    for (let i = 0; i < particleCount; i++) {
        // 计算安全生成区域，考虑墙体厚度和分子半径
        const safeMargin = SIMULATION_CONFIG.wallThickness + particleRadius + 5; // 额外5px安全距离
        // 使用默认体积值22.4L来计算活塞位置
        const pistonX = calculatePistonPosition(22.4);
        const maxX = pistonX - SIMULATION_CONFIG.pistonThickness/2 - particleRadius - 5;
        
        // 确保在安全区域内生成分子
        const x = Math.random() * (maxX - safeMargin) + safeMargin;
        const y = Math.random() * (SIMULATION_CONFIG.height - 2 * safeMargin) + safeMargin;
        
        const particle = Matter.Bodies.circle(x, y, particleRadius, {
            // ★V2.0 分子"去物理化"设置★
            restitution: 1,        // 虽然我们将自己计算，但保留此项作为备用
            friction: 0,
            frictionAir: 0,
            frictionStatic: 0,
            // 确保分子有正确的质量
            mass: 1,               // 分子质量设为1（标准单位）
            density: 0.001,        // 分子密度
            inertia: Infinity,     // 防止旋转，保持纯平移运动
            // 添加碰撞过滤，确保与墙体正确碰撞
            collisionFilter: {
                category: 0x0002,  // 分子类别
                mask: 0x0001 | 0x0002  // 可以与墙体(0x0001)和其他分子(0x0002)碰撞
            },
            render: {
                fillStyle: 'transparent',
                strokeStyle: 'transparent',
                lineWidth: 0
            }
        });
        
        particles.push(particle);
    }
    
    Matter.World.add(world, particles);
    
    // 使用统一的温度应用函数设置初始速度
    applyTemperatureToMolecules(temperature);
}

// 更新粒子数量和速度
function updateParticleCountAndSpeed(moles, temperature) {
    if (!isMatterAvailable() || !world) return;
    
    const targetCount = Math.round(moles * 10);
    
    // 调整粒子数量
    if (particles.length < targetCount) {
        // 添加粒子
        const toAdd = targetCount - particles.length;
        for (let i = 0; i < toAdd; i++) {
            // 计算安全生成区域，考虑墙体厚度和分子半径
            const safeMargin = SIMULATION_CONFIG.wallThickness + SIMULATION_CONFIG.particleRadius + 5;
            const pistonX = calculatePistonPosition(22.4);
            const maxX = pistonX - SIMULATION_CONFIG.pistonThickness/2 - SIMULATION_CONFIG.particleRadius - 5;
            
            const x = Math.random() * (maxX - safeMargin) + safeMargin;
            const y = Math.random() * (SIMULATION_CONFIG.height - 2 * safeMargin) + safeMargin;
            
            const particle = Matter.Bodies.circle(x, y, SIMULATION_CONFIG.particleRadius, {
                // ★V2.0 分子"去物理化"设置★
                restitution: 1,        // 虽然我们将自己计算，但保留此项作为备用
                friction: 0,
                frictionAir: 0,
                frictionStatic: 0,
                // 确保分子有正确的质量
                mass: 1,               // 分子质量设为1（标准单位）
                density: 0.001,        // 分子密度
                inertia: Infinity,     // 防止旋转，保持纯平移运动
                // 添加碰撞过滤，确保与墙体正确碰撞
                collisionFilter: {
                    category: 0x0002,  // 分子类别
                    mask: 0x0001 | 0x0002  // 可以与墙体(0x0001)和其他分子(0x0002)碰撞
                },
                render: { 
                    fillStyle: 'transparent',
                    strokeStyle: 'transparent',
                    lineWidth: 0
                }
            });
            
            particles.push(particle);
            Matter.World.add(world, particle);
        }
    } else if (particles.length > targetCount) {
        // 移除粒子
        const toRemove = particles.length - targetCount;
        const removedParticles = particles.splice(-toRemove);
        Matter.World.remove(world, removedParticles);
    }
    
    // 应用温度到所有分子（包括新添加的）
    applyTemperatureToMolecules(temperature);
}

// V3.4: 感官调优配置参数 - 指数级温控速度曲线 (高速版 - 再提升50%速度)
const SPEED_CURVE_CONFIG = {
    SPEED_EXPONENT: 2.5,    // 保持曲线陡峭程度，维持温度差异感
    MIN_SPEED: 0.12,        // 再提升50%: 0.08 → 0.12，低温区更有活力
    MAX_SPEED: 3.3,         // 再提升50%: 2.2 → 3.3，高温区更加狂暴
    TEMP_MIN: 200,          // 温度滑块的最小值 (K)
    TEMP_MAX: 400           // 温度滑块的最大值 (K)
};

// 根据温度设置分子速度（核心温度-速度关联函数）
function applyTemperatureToMolecules(temperature) {
    if (!isMatterAvailable() || !world) return;
    
    // V3.4: 指数级温控速度曲线实现
    // 1. 将温度值归一化到 0.0 - 1.0 的范围
    const normalizedTemp = (temperature - SPEED_CURVE_CONFIG.TEMP_MIN) / 
                          (SPEED_CURVE_CONFIG.TEMP_MAX - SPEED_CURVE_CONFIG.TEMP_MIN);
    
    // 2. 应用指数曲线 - 使用三次方拉大低温和高温的差距
    const curvedValue = Math.pow(Math.max(0, Math.min(1, normalizedTemp)), SPEED_CURVE_CONFIG.SPEED_EXPONENT);
    
    // 3. 使用线性插值，将曲线值映射到我们定义的最小/最大速度之间
    const baseSpeed = SPEED_CURVE_CONFIG.MIN_SPEED + 
                     (SPEED_CURVE_CONFIG.MAX_SPEED - SPEED_CURVE_CONFIG.MIN_SPEED) * curvedValue;
    
    console.log(`🌡️ V3.4 温控曲线: T=${temperature}K, 归一化=${normalizedTemp.toFixed(3)}, 曲线值=${curvedValue.toFixed(3)}, 最终速度=${baseSpeed.toFixed(3)}`);
    
    // 遍历所有物体，只对非静态的物体（即分子）操作
    engine.world.bodies.forEach(body => {
        if (!body.isStatic && particles.includes(body)) {
            // 为每个分子生成一个新的随机方向
            const angle = Math.random() * 2 * Math.PI;
            
            // 计算新的速度向量
            const newVelocity = {
                x: Math.cos(angle) * baseSpeed,
                y: Math.sin(angle) * baseSpeed
            };
            
            // ★核心：直接设置物体的速度，而不是施加力
            Matter.Body.setVelocity(body, newVelocity);
        }
    });
}

// ★终极边界完整性检查函数 - 万无一失的最终防线★
function enforceAllBoundaries() {
    if (!isMatterAvailable() || !world || particles.length === 0) return;
    
    // 获取四面墙的位置和尺寸
    const bounds = {
        left: walls.left ? walls.left.position.x + SIMULATION_CONFIG.wallThickness / 2 : SIMULATION_CONFIG.wallThickness,
        right: walls.right ? walls.right.position.x - SIMULATION_CONFIG.wallThickness / 2 : SIMULATION_CONFIG.width - SIMULATION_CONFIG.wallThickness,
        top: walls.top ? walls.top.position.y + SIMULATION_CONFIG.wallThickness / 2 : SIMULATION_CONFIG.wallThickness,
        bottom: walls.bottom ? walls.bottom.position.y - SIMULATION_CONFIG.wallThickness / 2 : SIMULATION_CONFIG.height - SIMULATION_CONFIG.wallThickness
    };
    
    for (const molecule of particles) {
        if (!molecule || !molecule.position) continue;
        
        const pos = molecule.position;
        const vel = molecule.velocity;
        const radius = SIMULATION_CONFIG.particleRadius;
        let corrected = false;
        let newVelocity = { x: vel.x, y: vel.y };
        
        // 检查并修正X轴边界
        if (pos.x - radius < bounds.left) {
            Matter.Body.setPosition(molecule, { x: bounds.left + radius, y: pos.y });
            // 反弹速度：如果速度指向左边，则反向
            if (vel.x < 0) {
                newVelocity.x = -vel.x;
            }
            corrected = true;
        } else if (pos.x + radius > bounds.right) {
            Matter.Body.setPosition(molecule, { x: bounds.right - radius, y: pos.y });
            // 反弹速度：如果速度指向右边，则反向
            if (vel.x > 0) {
                newVelocity.x = -vel.x;
            }
            corrected = true;
        }
        
        // 检查并修正Y轴边界
        if (pos.y - radius < bounds.top) {
            Matter.Body.setPosition(molecule, { x: pos.x, y: bounds.top + radius });
            // 反弹速度：如果速度指向上边，则反向
            if (vel.y < 0) {
                newVelocity.y = -vel.y;
            }
            corrected = true;
        } else if (pos.y + radius > bounds.bottom) {
            Matter.Body.setPosition(molecule, { x: pos.x, y: bounds.bottom - radius });
            // 反弹速度：如果速度指向下边，则反向
            if (vel.y > 0) {
                newVelocity.y = -vel.y;
            }
            corrected = true;
        }
        
        // 如果进行了位置校正，同时更新速度以避免粘附
        if (corrected) {
            Matter.Body.setVelocity(molecule, newVelocity);
            console.log('边界校正：分子被拉回边界内并反弹', { 
                moleculeId: molecule.id, 
                newPosition: molecule.position,
                newVelocity: newVelocity
            });
        }
    }
}

// ★★★ V2.7 终极墙体控制重构 ★★★
// 根据项目主导者指令，彻底废弃旧的滑块处理代码，实现分离物理与视觉的新方案

// 计算新的边界值的辅助函数
function calculateBoundsXFromSlider(volume) {
    // 使用现有的体积到位置映射逻辑
    return calculatePistonPosition(volume);
}

// 精简版的边界检查函数
function enforceSingleBoundary(boundaryX) {
    if (!particles || particles.length === 0) return;
    
    const wallWidth = SIMULATION_CONFIG.pistonThickness;
    const radius = SIMULATION_CONFIG.particleRadius;
    
    for (const molecule of particles) {
        if (!molecule || !molecule.position) continue;
        
        const pos = molecule.position;
        const maxAllowedX = boundaryX - wallWidth/2 - radius;
        
        // 如果分子超出了新的边界，将其拉回
        if (pos.x + radius > maxAllowedX) {
            Matter.Body.setPosition(molecule, { 
                x: maxAllowedX - radius, 
                y: pos.y 
            });
            console.log('边界矫正：分子被拉回边界内');
        }
    }
}

// ★★★ V3.8 修复：正确的墙体移动逻辑 ★★★
function updatePistonPosition(volume) {
    console.log(`🔧 V3.8 updatePistonPosition 被调用: volume = ${volume}`);
    
    if (!isMatterAvailable() || !walls.right || !engine || !engine.world) {
        console.warn('⚠️ updatePistonPosition 退出: Matter.js不可用或墙体不存在');
        return;
    }
    
    // V3.8: 计算墙体的目标位置
    const targetPistonX = calculatePistonPosition(volume);
    const targetWallX = targetPistonX - (SIMULATION_CONFIG.pistonThickness / 2);
    
    // V3.8: 平滑移动墙体到新位置，而不是瞬间传送
    const currentWallX = walls.right.position.x;
    const deltaX = targetWallX - currentWallX;
    
    // 如果位置差异很小，直接设置位置
    if (Math.abs(deltaX) < 1) {
        Matter.Body.setPosition(walls.right, { 
            x: targetWallX, 
            y: walls.right.position.y 
        });
    } else {
        // 使用平滑移动，避免分子被挤压
        const moveSpeed = Math.sign(deltaX) * Math.min(Math.abs(deltaX) * 0.1, 5);
        const newX = currentWallX + moveSpeed;
        Matter.Body.setPosition(walls.right, { 
            x: newX, 
            y: walls.right.position.y 
        });
    }
    
    // V3.8: 更新物理引擎边界以匹配墙体位置
    const actualWallX = walls.right.position.x;
    const actualBoundaryX = actualWallX + (SIMULATION_CONFIG.pistonThickness / 2);
    
    if (!engine.world.bounds) {
        engine.world.bounds = {
            min: { x: 0, y: 0 },
            max: { x: actualBoundaryX, y: SIMULATION_CONFIG.height }
        };
    } else {
        engine.world.bounds.max.x = actualBoundaryX;
    }
    
    // V3.8: 只在墙体向左移动时才检查分子边界，避免粘附
    if (deltaX < 0) {
        // 墙体向左移动，检查是否有分子需要推开
        const safeZone = actualWallX - SIMULATION_CONFIG.pistonThickness / 2 - SIMULATION_CONFIG.particleRadius - 2;
        
        particles.forEach(molecule => {
            if (molecule && molecule.position && molecule.position.x > safeZone) {
                // 给分子一个向左的推力，而不是直接设置位置
                const pushForce = { x: -0.01, y: 0 };
                Matter.Body.applyForce(molecule, molecule.position, pushForce);
            }
        });
    }
    
    // 同步更新piston引用
    piston = walls.right;
    
    console.log(`✅ V3.8 墙体移动完成: 当前位置=${walls.right.position.x}, 目标位置=${targetWallX}`);
}

// 更新活塞曲率（压强效果）
function updatePistonCurvature(pressure) {
    if (!isMatterAvailable() || !piston) return;
    
    // 根据压强调整活塞的视觉效果
    const normalPressure = 101.325; // 标准大气压
    const pressureRatio = Math.max(0.5, Math.min(2, pressure / normalPressure));
    
    // 压强越大，活塞颜色越深（使用粉色渐变）
    const alpha = 0.4 + (pressureRatio - 0.5) * 0.4; // 透明度从0.4到0.8
    piston.render.fillStyle = `rgba(236, 72, 153, ${alpha})`;
    piston.render.strokeStyle = `rgba(219, 39, 119, ${Math.min(1, alpha + 0.2)})`;
}

// 计算活塞位置 - 建立体积到canvas坐标的映射关系
function calculatePistonPosition(volume) {
    // 使用VOLUME_MAPPING配置进行映射
    const { minVolume, maxVolume, minX, maxX } = VOLUME_MAPPING;
    
    // 将体积值限制在有效范围内
    const clampedVolume = Math.max(minVolume, Math.min(maxVolume, volume));
    
    // 线性映射：体积 -> canvas x坐标
    const normalizedVolume = (clampedVolume - minVolume) / (maxVolume - minVolume);
    return minX + normalizedVolume * (maxX - minX);
}

// ★V3.7 新增：计算墙壁目标X坐标的辅助函数★
function calculateTargetXFromVolume(volume) {
    // 计算活塞的目标位置
    const pistonX = calculatePistonPosition(volume);
    
    // 墙壁的中心位置应该是活塞位置减去一半厚度
    // 这样墙壁的右边缘就正好在活塞位置上
    return pistonX - (SIMULATION_CONFIG.pistonThickness / 2);
}

// ★V3.8 新增：从墙壁位置反向计算体积的辅助函数★
function calculateVolumeFromWallPosition(wallX) {
    // 从墙壁中心位置计算活塞位置
    const pistonX = wallX + (SIMULATION_CONFIG.pistonThickness / 2);
    
    // 使用VOLUME_MAPPING配置进行反向映射
    const { minVolume, maxVolume, minX, maxX } = VOLUME_MAPPING;
    
    // 将canvas x坐标限制在有效范围内
    const clampedX = Math.max(minX, Math.min(maxX, pistonX));
    
    // 反向线性映射：canvas x坐标 -> 体积
    const normalizedX = (clampedX - minX) / (maxX - minX);
    const volume = minVolume + normalizedX * (maxVolume - minVolume);
    
    // 确保体积在有效范围内
    return Math.max(minVolume, Math.min(maxVolume, volume));
}

// 停止分子模拟
export function stopSimulation() {
    if (!isMatterAvailable() || !engine) return;
    
    // 停止所有分子的运动
    particles.forEach(particle => {
        Matter.Body.setVelocity(particle, { x: 0, y: 0 });
    });
    
    console.log('分子模拟已停止');
}
