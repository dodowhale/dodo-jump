import { audio } from './AudioEngine';

export type GameState = 'READY' | 'PLAYING' | 'GAME_OVER';

export interface Character {
    id: string;
    name: string;
    price: number;
    color: string;
    innerColor: string;
    trailColor: string;
    skillName: string;
    skillDesc: string;
    cooldown: number;
}

export const CHARACTERS: Character[] = [
    {
        id: 'neon_orb',
        name: 'NEON ORB',
        price: 0,
        color: '#00F2FE', // Cyan
        innerColor: '#4FACFE',
        trailColor: 'rgba(0, 242, 254, 0.45)',
        skillName: 'CRYSTAL MAGNET',
        skillDesc: 'PASSIVE: 상시 크리스탈 자석 범위 확대 (120px)',
        cooldown: 0
    },
    {
        id: 'nova_core',
        name: 'NOVA CORE',
        price: 20,
        color: '#ff7675', // Crimson pink
        innerColor: '#fd79a8',
        trailColor: 'rgba(255, 118, 117, 0.5)',
        skillName: 'STAR SHIELD',
        skillDesc: 'ACTIVE: 5초간 보호막 생성. 추락 시 직전 발판으로 복귀 (S/Shift)',
        cooldown: 20000
    },
    {
        id: 'nebula_ring',
        name: 'NEBULA RING',
        price: 40,
        color: '#9c27b0', // Royal purple
        innerColor: '#e040fb',
        trailColor: 'rgba(156, 39, 176, 0.5)',
        skillName: 'SUPER BOUNCE',
        skillDesc: 'ACTIVE: 즉시 1.5배 속도로 하늘을 향해 강하게 수직 점프 (S/Shift)',
        cooldown: 15000
    },
    {
        id: 'pulsar_cube',
        name: 'PULSAR CUBE',
        price: 60,
        color: '#FFDD00', // Yellow
        innerColor: '#f1c40f',
        trailColor: 'rgba(255, 221, 0, 0.5)',
        skillName: 'SOLAR FLARE',
        skillDesc: 'ACTIVE: 화면에 보이는 모든 크리스탈을 즉시 자동 흡수 (S/Shift)',
        cooldown: 18000
    },
    {
        id: 'blackhole',
        name: 'BLACKHOLE',
        price: 80,
        color: '#e67e22', // Orange accretion disk
        innerColor: '#2c3e50', // dark core
        trailColor: 'rgba(230, 126, 34, 0.5)',
        skillName: 'EVENT HORIZON',
        skillDesc: 'ACTIVE: 6초간 중력장 생성. 모든 발판을 중앙(X=240)으로 당김 (S/Shift)',
        cooldown: 25000
    }
];

interface Platform {
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    type: 'normal' | 'velo' | 'slim' | 'bouncy' | 'phantom';
    speed: number;
    direction: number;
    offset: number;
    range: number;
    originX: number;
    landCount: number;
    opacity: number;
    fadeSpeed: number;
    steppedOn?: boolean;
    crystal?: {
        relX: number; // relative to platform center
        collected: boolean;
    } | null;
}

interface FloatingCrystal {
    x: number;
    y: number;
    vy: number;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    color: string;
    life: number;
    decay: number;
}

interface FloatingText {
    x: number;
    y: number;
    text: string;
    color: string;
    life: number;
    vy: number;
}

interface Star {
    x: number;
    y: number;
    size: number;
    parallax: number;
    opacity: number;
    pulseSpeed: number;
    time: number;
}

export class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    
    public width = 480;
    public height = 720;
    
    // Physics constants
    private gravity = -1100;
    private minJumpVelocity = 400;
    private maxJumpVelocity = 880;
    private chargeSpeed = 4.5;
    
    // Game variables
    public score = 0;
    public highScore = 0;
    public combo = 0;
    public state: GameState = 'READY';
    
    // Player
    public player = {
        x: 240,
        y: 100,
        radius: 15,
        vy: 0,
        isCharging: false,
        chargeTime: 0,
        chargeValue: 0,
        chargeDirection: 1,
        trail: [] as { x: number; y: number }[],
        onPlatform: null as Platform | null,
        platformOffset: 0
    };

    // Camera
    public camera = {
        y: 0,
        targetY: 0,
        scrollSpeed: 0.1
    };

    // Lists
    private platforms: Platform[] = [];
    private particles: Particle[] = [];
    private stars: Star[] = [];
    private floatingTexts: FloatingText[] = [];
    private floatingCrystals: FloatingCrystal[] = [];
    
    private platformIdCounter = 0;
    private lastTime = 0;
    private animationFrameId: number | null = null;
    private isRunning = false;

    // Active skin properties
    public activeCharacter = 'neon_orb';
    
    // Skill cooldown status
    private skillCdTimer = 0; // remaining ms

    // Active status effects
    private isShieldActive = false;
    private eventHorizonTimer = 0; // remaining ms
    private lastLandedPlatform: Platform | null = null;

    // Fever System
    private feverGauge = 0; // 0 to 100
    private feverTimer = 0; // remaining ms
    private feverDuration = 6000; // 6 seconds

    // Callbacks
    private onScoreChange: (score: number) => void;
    private onStateChange: (state: GameState) => void;
    private onCoinsChange: (coins: number) => void;
    private onSkillCdChange: (remaining: number, duration: number) => void;
    private onFeverChange: (feverPercent: number) => void;

    constructor(
        canvas: HTMLCanvasElement,
        onScoreChange: (score: number) => void,
        onStateChange: (state: GameState) => void,
        onCoinsChange: (coins: number) => void,
        onSkillCdChange: (remaining: number, duration: number) => void,
        onFeverChange: (feverPercent: number) => void
    ) {
        this.canvas = canvas;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not get 2D context');
        this.ctx = context;

        this.onScoreChange = onScoreChange;
        this.onStateChange = onStateChange;
        this.onCoinsChange = onCoinsChange;
        this.onSkillCdChange = onSkillCdChange;
        this.onFeverChange = onFeverChange;

        this.highScore = Number(localStorage.getItem('lumina_high_score') || 0);

        this.resizeCanvas();
        window.addEventListener('resize', this.resizeBounds);

        this.setupInputs();
        this.initStars();
    }

    private resizeBounds = () => {
        this.resizeCanvas();
    };

    private resizeCanvas() {
        const parent = this.canvas.parentElement;
        if (!parent) return;
        const parentWidth = parent.clientWidth;
        const parentHeight = parent.clientHeight;
        
        const scale = Math.min(parentWidth / this.width, parentHeight / this.height);
        
        this.canvas.style.width = `${this.width * scale}px`;
        this.canvas.style.height = `${this.height * scale}px`;
        
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.scale(dpr, dpr);
        
        this.ctx.textBaseline = 'middle';
        this.ctx.textAlign = 'center';
    }

    private initStars() {
        this.stars = [];
        for (let i = 0; i < 60; i++) {
            this.stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size: Math.random() * 1.8 + 0.5,
                parallax: Math.random() * 0.4 + 0.1,
                opacity: Math.random() * 0.6 + 0.4,
                pulseSpeed: Math.random() * 2 + 1,
                time: Math.random() * 100
            });
        }
    }

    private setupInputs() {
        const handleStart = (e: Event) => {
            if (this.state !== 'PLAYING') return;
            if (this.player.isCharging || this.player.vy !== 0) return;

            if (e.type === 'touchstart' || e.type === 'mousedown' || (e as KeyboardEvent).key === ' ' || (e as KeyboardEvent).code === 'Space') {
                if (e.cancelable) e.preventDefault();
                
                this.player.isCharging = true;
                this.player.chargeTime = 0;
                this.player.chargeValue = 0;
                this.player.chargeDirection = 1;
                
                audio.startCharge();
            }
        };

        const handleEnd = (e: Event) => {
            if (this.state !== 'PLAYING') return;
            if (!this.player.isCharging) return;

            if (e.type === 'touchend' || e.type === 'mouseup' || (e as KeyboardEvent).key === ' ' || (e as KeyboardEvent).code === 'Space') {
                if (e.cancelable) e.preventDefault();
                this.executeJump();
            }
        };

        // Skill triggers
        const handleKeyDown = (e: KeyboardEvent) => {
            if (this.state !== 'PLAYING') return;
            
            // Skill triggers on 's' or 'Shift'
            if (e.key === 's' || e.key === 'S' || e.key === 'Shift') {
                this.useActiveSkill();
            }
            
            handleStart(e);
        };

        window.addEventListener('keydown', handleKeyDown, { passive: false });
        window.addEventListener('keyup', handleEnd, { passive: false });

        this.canvas.addEventListener('mousedown', handleStart);
        window.addEventListener('mouseup', handleEnd);

        this.canvas.addEventListener('touchstart', handleStart, { passive: false });
        window.addEventListener('touchend', handleEnd, { passive: false });
    }

    public setPlayerCharacter(characterId: string) {
        this.activeCharacter = characterId;
        // Turn off shield if we swap skins mid-run (just in case)
        if (this.state !== 'PLAYING') {
            this.isShieldActive = false;
        }
    }

    public useActiveSkill() {
        if (this.state !== 'PLAYING') return;
        if (this.skillCdTimer > 0) return;

        const char = CHARACTERS.find(c => c.id === this.activeCharacter);
        if (!char || char.cooldown === 0) return;

        let triggered = false;

        if (char.id === 'nova_core') {
            // Star Shield
            this.isShieldActive = true;
            this.createFloatingText(this.player.x, this.height - (this.player.y - this.camera.y) - 40, 'SHIELD ACTIVE! 🛡️', '#ff7675');
            audio.playSkill();
            triggered = true;
        } else if (char.id === 'nebula_ring') {
            // Super Bounce
            this.player.isCharging = false;
            audio.stopCharge();
            
            this.player.vy = this.maxJumpVelocity * 1.4;
            this.player.onPlatform = null;
            audio.playSkill();
            audio.playJump(1.0);
            
            this.createBlastParticles(this.player.x, this.player.y - this.player.radius, 25, '#9c27b0');
            this.createFloatingText(this.player.x, this.height - (this.player.y - this.camera.y) - 40, 'SUPER JUMP! ⚡', '#9c27b0');
            triggered = true;
        } else if (char.id === 'pulsar_cube') {
            // Solar Flare (Suck all crystals on screen)
            triggered = this.triggerSolarFlare();
        } else if (char.id === 'blackhole') {
            // Event Horizon gravity
            this.eventHorizonTimer = 6000; // 6 seconds
            this.createFloatingText(this.player.x, this.height - (this.player.y - this.camera.y) - 40, 'EVENT HORIZON! 🕳️', '#e67e22');
            audio.playSkill();
            triggered = true;
        }

        if (triggered) {
            this.skillCdTimer = char.cooldown;
            this.onSkillCdChange(this.skillCdTimer, char.cooldown);
        }
    }

    private triggerSolarFlare(): boolean {
        let count = 0;
        this.platforms.forEach(plat => {
            if (plat.crystal && !plat.crystal.collected) {
                // Convert relative platform crystal position to absolute
                const cy = plat.y + 35;
                const cx = plat.x + plat.width / 2 + plat.crystal.relX;
                
                // Add to floating crystals and remove from platform
                this.floatingCrystals.push({
                    x: cx,
                    y: cy,
                    vy: -150
                });
                plat.crystal = null;
                count++;
            }
        });

        if (count > 0) {
            this.createFloatingText(this.player.x, this.height - (this.player.y - this.camera.y) - 40, `SOLAR MAGNET! 💎 +${count}`, '#FFDD00');
            audio.playSkill();
            return true;
        } else {
            this.createFloatingText(this.player.x, this.height - (this.player.y - this.camera.y) - 40, 'NO CRYSTALS IN SIGHT!', '#b2bec3');
            return false;
        }
    }

    private executeJump() {
        this.player.isCharging = false;
        audio.stopCharge();

        const charge = this.player.chargeValue;
        const jumpVelocity = this.minJumpVelocity + charge * (this.maxJumpVelocity - this.minJumpVelocity);

        this.player.vy = jumpVelocity;
        this.player.onPlatform = null;

        audio.playJump(charge);
        this.createBlastParticles(this.player.x, this.player.y - this.player.radius, 12, '#00F2FE');
    }

    private createBlastParticles(x: number, y: number, count: number, color: string) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 150 + 50;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: Math.random() * 3 + 1.5,
                color,
                life: 1.0,
                decay: Math.random() * 2 + 1.5
            });
        }
    }

    private createFloatingText(x: number, y: number, text: string, color = '#FFFFFF') {
        this.floatingTexts.push({
            x,
            y,
            text,
            color,
            life: 1.0,
            vy: 40
        });
    }

    public startNewGame() {
        audio.init();
        
        this.score = 0;
        this.combo = 0;
        this.feverGauge = 0;
        this.feverTimer = 0;
        this.isShieldActive = false;
        this.eventHorizonTimer = 0;
        this.skillCdTimer = 0;
        this.lastLandedPlatform = null;

        this.onScoreChange(0);
        this.onFeverChange(0);
        this.onSkillCdChange(0, 1);

        // Player initial
        this.player.x = this.width / 2;
        this.player.y = 80;
        this.player.vy = 0;
        this.player.isCharging = false;
        this.player.chargeTime = 0;
        this.player.chargeValue = 0;
        this.player.trail = [];
        this.player.onPlatform = null;
        this.player.platformOffset = 240;

        this.camera.y = 0;
        this.camera.targetY = 0;

        this.platforms = [];
        this.particles = [];
        this.floatingTexts = [];
        this.floatingCrystals = [];
        this.platformIdCounter = 0;

        // Base ground
        const basePlatform: Platform = {
            id: this.platformIdCounter++,
            x: 0,
            y: 50,
            width: this.width,
            height: 30,
            type: 'normal',
            speed: 0,
            direction: 0,
            offset: 0,
            range: 0,
            originX: 240,
            landCount: 0,
            opacity: 1,
            fadeSpeed: 0.8,
            crystal: null
        };
        this.platforms.push(basePlatform);
        this.player.onPlatform = basePlatform;
        this.player.platformOffset = this.player.x - basePlatform.x;
        this.lastLandedPlatform = basePlatform;

        this.generatePlatforms(0, 15);

        this.state = 'PLAYING';
        this.onStateChange('PLAYING');
        this.lastTime = performance.now();
        
        audio.playLand();
    }

    private generatePlatforms(startFromIndex: number, count: number) {
        let currentY = this.platforms.length > 0 ? this.platforms[this.platforms.length - 1]!.y : 50;

        for (let i = 0; i < count; i++) {
            const idx = startFromIndex + i + 1;
            const baseGap = 130;
            const extraGap = Math.min(130, idx * 3.5);
            const gap = baseGap + extraGap + (Math.random() * 25 - 12);
            currentY += gap;

            let type: Platform['type'] = 'normal';
            const rand = Math.random();

            if (idx > 4) {
                if (rand < 0.15) type = 'velo';
                else if (rand < 0.28) type = 'slim';
                else if (rand < 0.35) type = 'bouncy';
                else if (rand < 0.45 && idx > 8) type = 'phantom';
            }

            const baseWidth = 130;
            const shrinkFactor = Math.max(70, baseWidth - (idx * 1.5));
            const width = type === 'slim' ? shrinkFactor * 0.65 : shrinkFactor;
            const height = 18;

            const baseSpeed = 80;
            const scaleSpeed = Math.min(200, idx * 5.0);
            const speed = (baseSpeed + scaleSpeed + Math.random() * 30) * (type === 'velo' ? 1.6 : 1.0);
            const range = (this.width - width) * (0.35 + Math.random() * 0.55);
            
            // Crystal Spawning Logic
            let crystalObj = null;
            // 35% default chance, or 100% during fever
            const isFeverMode = this.feverTimer > 0;
            const crystalChance = isFeverMode ? 1.0 : 0.35;
            
            if (Math.random() < crystalChance && type !== 'phantom') {
                crystalObj = {
                    relX: (Math.random() * 0.6 - 0.3) * width, // offset inside platform width
                    collected: false
                };
            }

            const newPlatform: Platform = {
                id: this.platformIdCounter++,
                x: Math.random() * (this.width - width),
                y: currentY,
                width,
                height,
                type,
                speed,
                direction: Math.random() > 0.5 ? 1 : -1,
                offset: Math.random() * Math.PI * 2,
                range,
                originX: this.width / 2 - width / 2,
                landCount: 0,
                opacity: 1.0,
                fadeSpeed: 0.8,
                crystal: crystalObj
            };

            this.platforms.push(newPlatform);
        }
    }

    public update(timestamp: number) {
        if (this.state !== 'PLAYING') {
            this.lastTime = timestamp;
            return;
        }

        let dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        if (dt > 0.1) dt = 0.1;

        // 1. Skill Cooldown Timer
        if (this.skillCdTimer > 0) {
            this.skillCdTimer -= dt * 1000;
            if (this.skillCdTimer < 0) this.skillCdTimer = 0;
            
            const char = CHARACTERS.find(c => c.id === this.activeCharacter);
            const duration = char ? char.cooldown : 1;
            this.onSkillCdChange(this.skillCdTimer, duration);
        }

        // 2. Fever Timer
        if (this.feverTimer > 0) {
            this.feverTimer -= dt * 1000;
            if (this.feverTimer <= 0) {
                this.feverTimer = 0;
                this.feverGauge = 0;
            }
            this.onFeverChange((this.feverTimer / this.feverDuration) * 100);
        }

        // 3. Event Horizon gravity pull
        if (this.eventHorizonTimer > 0) {
            this.eventHorizonTimer -= dt * 1000;
            if (this.eventHorizonTimer < 0) this.eventHorizonTimer = 0;
        }

        // Stars & Floating text
        this.stars.forEach(star => {
            star.time += dt * star.pulseSpeed;
        });

        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const txt = this.floatingTexts[i]!;
            txt.y += txt.vy * dt;
            txt.life -= dt * 1.2;
            if (txt.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i]!;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= p.decay * dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Oscillation charging
        if (this.player.isCharging) {
            this.player.chargeTime += dt;
            this.player.chargeValue = 0.5 + 0.5 * Math.sin(this.player.chargeTime * this.chargeSpeed - Math.PI / 2);
            audio.updateCharge(this.player.chargeValue);
        }

        // Platforms update
        this.platforms.forEach(plat => {
            if (plat.speed > 0) {
                // If Event Horizon active, pull platforms horizontally to center (X = 240)
                if (this.eventHorizonTimer > 0) {
                    const targetX = 240 - plat.width / 2;
                    const pullFactor = 1 - Math.exp(-10 * dt);
                    plat.x += (targetX - plat.x) * pullFactor; // Smooth slide to middle (frame-rate independent)
                } else {
                    const timeFactor = (timestamp / 1000) * (plat.speed / 150) + plat.offset;
                    plat.x = plat.originX + Math.sin(timeFactor) * plat.range;
                    
                    if (plat.x < 0) plat.x = 0;
                    if (plat.x + plat.width > this.width) plat.x = this.width - plat.width;
                }
            }

            if (plat.type === 'phantom' && plat.steppedOn) {
                plat.opacity -= plat.fadeSpeed * dt;
                if (plat.opacity < 0) {
                    plat.opacity = 0;
                    if (this.player.onPlatform === plat) {
                        this.player.onPlatform = null;
                        this.player.vy = -50;
                    }
                }
            }

            // Magnetic crystal collection (Passive Magnet for NEON ORB or normally closer range)
            if (plat.crystal && !plat.crystal.collected) {
                const cy = plat.y + 35;
                const cx = plat.x + plat.width / 2 + plat.crystal.relX;
                
                const dx = cx - this.player.x;
                const dy = cy - this.player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                // Neon Orb has 120px range, other skins have 40px range. Fever mode boosts range to 240px.
                let magnetRange = this.activeCharacter === 'neon_orb' ? 120 : 40;
                if (this.feverTimer > 0) {
                    magnetRange = 240;
                }
                
                if (dist < magnetRange) {
                    // Detach from platform and convert to floating crystal
                    this.floatingCrystals.push({
                        x: cx,
                        y: cy,
                        vy: -200
                    });
                    plat.crystal = null;
                }
            }
        });

        // Floating Crystals Update
        for (let i = this.floatingCrystals.length - 1; i >= 0; i--) {
            const fc = this.floatingCrystals[i]!;
            
            // Pull directly to player
            const dx = this.player.x - fc.x;
            const dy = this.player.y - fc.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 18) {
                this.collectCrystal();
                this.floatingCrystals.splice(i, 1);
            } else {
                const pullSpeed = 480 * dt;
                fc.x += (dx / dist) * pullSpeed;
                fc.y += (dy / dist) * pullSpeed;
            }
        }

        // Player physics
        if (!this.player.onPlatform) {
            const prevY = this.player.y;
            // Apply gravity (gravity is reduced by 60% during Fever Mode for cosmic high floaty feel)
            const currentGravity = this.feverTimer > 0 ? this.gravity * 0.4 : this.gravity;
            this.player.vy += currentGravity * dt;
            this.player.y += this.player.vy * dt;

            // Trail
            this.player.trail.push({ x: this.player.x, y: this.player.y });
            if (this.player.trail.length > (this.feverTimer > 0 ? 15 : 8)) {
                this.player.trail.shift();
            }

            if (this.player.vy < 0) {
                this.checkCollisions(prevY);
            }
        } else {
            const plat = this.player.onPlatform;
            this.player.x = plat.x + this.player.platformOffset;
            
            if (this.player.x < this.player.radius) {
                this.player.x = this.player.radius;
                this.player.platformOffset = this.player.x - plat.x;
            } else if (this.player.x > this.width - this.player.radius) {
                this.player.x = this.width - this.player.radius;
                this.player.platformOffset = this.player.x - plat.x;
            }

            // Fall-off check: If player is pushed off the platform by the screen boundary
            if (this.player.platformOffset < -this.player.radius || this.player.platformOffset > plat.width + this.player.radius) {
                this.player.onPlatform = null;
                this.player.vy = -50; // Start falling gently
            } else {
                this.player.y = plat.y + plat.height / 2 + this.player.radius;
                this.player.vy = 0;
                this.player.trail = [];
            }
        }

        // Fall check
        if (this.player.y < this.camera.y - 80) {
            if (this.feverTimer > 0) {
                // Fever Rescue: Auto spring back up if player falls during Fever mode
                this.player.vy = this.maxJumpVelocity * 1.3;
                this.player.onPlatform = null;
                const sy = this.height - (this.player.y - this.camera.y);
                this.createFloatingText(this.player.x, sy - 20, 'FEVER RESCUE! ✨', '#ff9f43');
                this.createBlastParticles(this.player.x, this.player.y, 20, '#ff9f43');
            } else if (this.isShieldActive) {
                this.isShieldActive = false;
                this.triggerShieldRescue();
            } else {
                this.triggerGameOver();
            }
        }

        // Camera Scroll
        const targetCameraHeight = Math.max(0, this.player.y - 250);
        if (targetCameraHeight > this.camera.targetY) {
            this.camera.targetY = targetCameraHeight;
        }
        
        // Frame-rate independent camera interpolation
        const cameraFactor = 1 - Math.exp(-6.5 * dt);
        this.camera.y += (this.camera.targetY - this.camera.y) * cameraFactor;

        // Platform generation triggers
        const highestPlatform = this.platforms[this.platforms.length - 1];
        if (highestPlatform && highestPlatform.y < this.camera.y + this.height + 300) {
            this.generatePlatforms(this.platforms.length, 10);
        }

        if (this.platforms.length > 25) {
            this.platforms = this.platforms.filter(plat => plat.y > this.camera.y - 200 || plat.id === 0);
        }
    }

    private triggerShieldRescue() {
        audio.playBouncy();
        const rescuePlatform = this.lastLandedPlatform || this.platforms[0]!;
        
        this.player.x = this.width / 2;
        this.player.y = rescuePlatform.y + rescuePlatform.height / 2 + 100;
        this.player.vy = this.maxJumpVelocity * 1.1; // Spring back up
        this.player.onPlatform = null;
        
        const sy = this.height - (this.player.y - this.camera.y);
        this.createFloatingText(this.player.x, sy - 20, 'SHIELD BROKE! 🛡️💥', '#ff7675');
        this.createBlastParticles(this.player.x, this.player.y, 25, '#ff7675');
    }

    private collectCrystal() {
        audio.playCrystal();
        
        // Land on platform gives crystals, Fever gives double!
        const multiplier = this.feverTimer > 0 ? 2 : 1;
        const currentCoins = Number(localStorage.getItem('flappy-candy-coins') || 0);
        const newCoins = currentCoins + 1 * multiplier;
        localStorage.setItem('flappy-candy-coins', String(newCoins));
        
        this.onCoinsChange(newCoins);

        const sy = this.height - (this.player.y - this.camera.y);
        this.createFloatingText(
            this.player.x + (Math.random() * 40 - 20), 
            sy - 30, 
            multiplier > 1 ? '💎 +2 FEVER!' : '💎 +1', 
            '#00f2fe'
        );
    }

    private checkCollisions(prevY: number) {
        const px = this.player.x;
        const py = this.player.y;
        const r = this.player.radius;

        const prevPlayerBottom = prevY - r;
        const currentPlayerBottom = py - r;

        for (let i = 0; i < this.platforms.length; i++) {
            const plat = this.platforms[i]!;

            if (plat.type === 'phantom' && plat.opacity <= 0) continue;

            const platTop = plat.y + plat.height / 2;
            
            // CCD (Continuous Collision Detection): Checks if player's bottom edge crossed platform top edge this frame.
            if (prevPlayerBottom >= platTop - 2 && currentPlayerBottom <= platTop + 2) {
                if (px + r >= plat.x && px - r <= plat.x + plat.width) {
                    this.landOnPlatform(plat);
                    break;
                }
            }
        }
    }

    private landOnPlatform(plat: Platform) {
        this.player.onPlatform = plat;
        this.lastLandedPlatform = plat;
        this.player.vy = 0;
        this.player.y = plat.y + plat.height / 2 + this.player.radius;
        this.player.platformOffset = this.player.x - plat.x;
        plat.landCount++;

        const platformScoreIndex = plat.id;
        if (platformScoreIndex > this.score) {
            const scoreDiff = platformScoreIndex - this.score;
            this.score = platformScoreIndex;
            this.onScoreChange(this.score);

            const platCenterX = plat.x + plat.width / 2;
            const distFromCenter = Math.abs(this.player.x - platCenterX);
            const isPerfect = distFromCenter < (plat.width * 0.15); // Central 15%

            if (isPerfect) {
                this.combo++;
                const comboBonus = this.combo;
                this.score += comboBonus;
                this.onScoreChange(this.score);

                // Add to Fever Gauge
                if (this.feverTimer <= 0) {
                    this.feverGauge = Math.min(100, this.feverGauge + 25);
                    this.onFeverChange(this.feverGauge);
                    
                    if (this.feverGauge >= 100) {
                        this.activateFeverMode();
                    }
                }

                const sy = this.height - (this.player.y - this.camera.y);
                this.createFloatingText(
                    this.player.x, 
                    sy - 40, 
                    `PERFECT x${this.combo}! +${scoreDiff + comboBonus}`, 
                    '#FF007F'
                );
                audio.playScore();
                this.createBlastParticles(this.player.x, plat.y + plat.height/2, 16, '#FF007F');
            } else {
                this.combo = 0;
                const sy = this.height - (this.player.y - this.camera.y);
                this.createFloatingText(
                    this.player.x, 
                    sy - 30, 
                    `+${scoreDiff}`, 
                    '#00F2FE'
                );
                audio.playLand();
                this.createBlastParticles(this.player.x, plat.y + plat.height/2, 8, '#00F2FE');
            }

            if (this.score > this.highScore) {
                this.highScore = this.score;
                localStorage.setItem('lumina_high_score', this.highScore.toString());
            }
        } else {
            audio.playLand();
            this.createBlastParticles(this.player.x, plat.y + plat.height/2, 6, '#4FACFE');
        }

        // Bouncy Spring
        if (plat.type === 'bouncy') {
            audio.playBouncy();
            const sy = this.height - (this.player.y - this.camera.y);
            this.createFloatingText(this.player.x, sy - 40, 'BOOST!! 🚀', '#00FF87');
            this.createBlastParticles(this.player.x, plat.y, 20, '#00FF87');
            
            this.player.vy = this.maxJumpVelocity * 1.15;
            this.player.onPlatform = null;
            this.player.trail = [];
        }

        // Phantom fade
        if (plat.type === 'phantom') {
            plat.steppedOn = true;
        }
    }

    private activateFeverMode() {
        this.feverTimer = this.feverDuration;
        audio.playScore();
        this.createFloatingText(this.player.x, this.height - (this.player.y - this.camera.y) - 50, '🔥 FEVER TIME ACTIVATED! 🔥', '#ff9f43');
        this.createBlastParticles(this.player.x, this.player.y, 35, '#ff9f43');

        // Launch player upward upon Fever activation
        this.player.vy = this.maxJumpVelocity * 1.5;
        this.player.onPlatform = null;
    }

    private triggerGameOver() {
        this.state = 'GAME_OVER';
        this.onStateChange('GAME_OVER');
        audio.playGameOver();
        
        this.createBlastParticles(this.player.x, this.player.y, 35, '#FF3366');
    }

    public draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // 1. Draw Space Background (Cosmic gradient)
        const bgGrad = this.ctx.createLinearGradient(0, 0, 0, this.height);
        
        // Pitch black / deep violet when Fever active, otherwise normal
        if (this.feverTimer > 0) {
            bgGrad.addColorStop(0, '#0d001a');
            bgGrad.addColorStop(0.5, '#22003d');
            bgGrad.addColorStop(1, '#3b0066');
        } else {
            bgGrad.addColorStop(0, '#020008');
            bgGrad.addColorStop(0.5, '#0B021C');
            bgGrad.addColorStop(1, '#1A0429');
        }
        
        this.ctx.fillStyle = bgGrad;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Pulsating stars
        this.stars.forEach(star => {
            let starScreenY = (star.y - this.camera.y * star.parallax) % this.height;
            if (starScreenY < 0) starScreenY += this.height;

            const sizeMultiplier = 0.8 + 0.3 * Math.sin(star.time);
            const alpha = star.opacity * (0.6 + 0.4 * Math.sin(star.time));
            
            this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            this.ctx.beginPath();
            this.ctx.arc(star.x, starScreenY, star.size * sizeMultiplier, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // Background Grid (synthwave vibe)
        this.drawBackgroundGrid();

        // Screen translation helper
        const toScreenY = (gameY: number) => this.height - (gameY - this.camera.y);

        // 4. Platforms & Crystals drawing
        this.platforms.forEach(plat => {
            const sy = toScreenY(plat.y);
            
            if (sy < -50 || sy > this.height + 50) return;

            this.ctx.save();
            this.ctx.globalAlpha = plat.opacity;

            let glowColor = '#00F2FE';
            let fillGrad = this.ctx.createLinearGradient(plat.x, sy - plat.height/2, plat.x + plat.width, sy + plat.height/2);
            
            switch (plat.type) {
                case 'velo':
                    glowColor = '#FFDD00';
                    fillGrad.addColorStop(0, 'rgba(255, 221, 0, 0.25)');
                    fillGrad.addColorStop(1, 'rgba(255, 170, 0, 0.4)');
                    break;
                case 'slim':
                    glowColor = '#B026FF';
                    fillGrad.addColorStop(0, 'rgba(176, 38, 255, 0.25)');
                    fillGrad.addColorStop(1, 'rgba(100, 20, 200, 0.4)');
                    break;
                case 'bouncy':
                    glowColor = '#00FF87';
                    fillGrad.addColorStop(0, 'rgba(0, 255, 135, 0.3)');
                    fillGrad.addColorStop(1, 'rgba(0, 200, 100, 0.55)');
                    break;
                case 'phantom':
                    glowColor = '#FF3366';
                    fillGrad.addColorStop(0, `rgba(255, 51, 102, ${0.25 * plat.opacity})`);
                    fillGrad.addColorStop(1, `rgba(200, 20, 60, ${0.4 * plat.opacity})`);
                    break;
                default:
                    glowColor = '#00F2FE';
                    fillGrad.addColorStop(0, 'rgba(0, 242, 254, 0.2)');
                    fillGrad.addColorStop(1, 'rgba(79, 172, 254, 0.35)');
            }

            // Draw glass card
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = glowColor;
            
            this.ctx.strokeStyle = glowColor;
            this.ctx.lineWidth = 2.0;
            this.ctx.fillStyle = fillGrad;

            this.ctx.beginPath();
            const radius = 6;
            const px = plat.x;
            const py = sy - plat.height/2;
            
            this.ctx.roundRect(px, py, plat.width, plat.height, radius);
            this.ctx.fill();
            this.ctx.stroke();

            // Spring coil drawing
            if (plat.type === 'bouncy') {
                this.ctx.shadowBlur = 0;
                this.ctx.strokeStyle = '#00FF87';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                const steps = 4;
                const startX = plat.x + plat.width / 2 - 12;
                const endX = plat.x + plat.width / 2 + 12;
                const coilY = sy - plat.height/2;
                this.ctx.moveTo(startX, coilY);
                for (let j = 0; j <= steps; j++) {
                    const cx = startX + (endX - startX) * (j / steps);
                    const cy = coilY - (j % 2 === 0 ? 5 : 0);
                    this.ctx.lineTo(cx, cy);
                }
                this.ctx.stroke();
            }

            // Draw crystal if exists
            if (plat.crystal && !plat.crystal.collected) {
                const cy = sy - 28; // Draw crystal sitting 28px above platform top
                const cx = plat.x + plat.width / 2 + plat.crystal.relX;
                
                this.ctx.save();
                this.ctx.shadowBlur = 12;
                this.ctx.shadowColor = '#00f2fe';
                
                // Pulsate rotation/size slightly
                const pulse = 1 + 0.1 * Math.sin(performance.now() / 200);
                this.ctx.fillStyle = '#00f2fe';
                this.ctx.beginPath();
                
                // Diamond shape
                this.ctx.moveTo(cx, cy - 8 * pulse);
                this.ctx.lineTo(cx + 6 * pulse, cy);
                this.ctx.lineTo(cx, cy + 8 * pulse);
                this.ctx.lineTo(cx - 6 * pulse, cy);
                this.ctx.closePath();
                this.ctx.fill();
                
                this.ctx.restore();
            }

            this.ctx.restore();
        });

        // 5. Draw Floating Crystals
        this.floatingCrystals.forEach(fc => {
            const sy = toScreenY(fc.y);
            this.ctx.save();
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = '#00f2fe';
            this.ctx.fillStyle = '#00f2fe';
            this.ctx.beginPath();
            this.ctx.moveTo(fc.x, sy - 8);
            this.ctx.lineTo(fc.x + 6, sy);
            this.ctx.lineTo(fc.x, sy + 8);
            this.ctx.lineTo(fc.x - 6, sy);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.restore();
        });

        // Particles
        this.particles.forEach(p => {
            const sy = toScreenY(p.y);
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.life;
            this.ctx.beginPath();
            this.ctx.arc(p.x, sy, p.radius, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1.0;

        // Player Jump Trail
        if (this.player.trail.length > 1) {
            this.ctx.save();
            const character = CHARACTERS.find(c => c.id === this.activeCharacter) || CHARACTERS[0]!;
            
            for (let i = 0; i < this.player.trail.length - 1; i++) {
                const t1 = this.player.trail[i]!;
                const t2 = this.player.trail[i + 1]!;
                const sy1 = toScreenY(t1.y);
                const sy2 = toScreenY(t2.y);
                
                const alpha = (i / this.player.trail.length) * 0.45;
                
                // Rainbow trail during Fever mode, otherwise character trail color
                if (this.feverTimer > 0) {
                    const hue = (performance.now() / 5 + i * 20) % 360;
                    this.ctx.strokeStyle = `hsla(${hue}, 100%, 65%, ${alpha})`;
                } else {
                    this.ctx.strokeStyle = character.trailColor;
                }
                
                this.ctx.lineWidth = this.player.radius * 2.0 * (i / this.player.trail.length);
                this.ctx.lineCap = 'round';
                
                this.ctx.beginPath();
                this.ctx.moveTo(t1.x, sy1);
                this.ctx.lineTo(t2.x, sy2);
                this.ctx.stroke();
            }
            this.ctx.restore();
        }

        // Draw Player Orb
        const psy = toScreenY(this.player.y);
        this.ctx.save();
        
        const character = CHARACTERS.find(c => c.id === this.activeCharacter) || CHARACTERS[0]!;
        
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = character.color;

        const radialGrad = this.ctx.createRadialGradient(
            this.player.x - 3, psy - 3, 2,
            this.player.x, psy, this.player.radius
        );
        radialGrad.addColorStop(0, '#FFFFFF');
        radialGrad.addColorStop(0.3, character.color);
        radialGrad.addColorStop(1, character.innerColor);

        this.ctx.fillStyle = radialGrad;
        this.ctx.beginPath();
        this.ctx.arc(this.player.x, psy, this.player.radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Event horizon swirling accretion disk
        if (this.eventHorizonTimer > 0) {
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = '#e67e22';
            this.ctx.strokeStyle = '#e67e22';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            // Swirling ring
            const angle = (performance.now() / 150) % (Math.PI * 2);
            this.ctx.arc(this.player.x, psy, this.player.radius + 10, angle, angle + Math.PI * 1.5);
            this.ctx.stroke();
        }

        // Star Shield Active Ring
        if (this.isShieldActive) {
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = '#ff7675';
            this.ctx.strokeStyle = '#ff7675';
            this.ctx.lineWidth = 2.5;
            this.ctx.beginPath();
            this.ctx.arc(this.player.x, psy, this.player.radius + 8, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        this.ctx.restore();

        // Player Charging Arc Meter
        if (this.player.isCharging) {
            this.ctx.save();
            this.ctx.shadowBlur = 12;
            this.ctx.shadowColor = '#FF007F';

            const chargePercent = this.player.chargeValue;
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + chargePercent * (Math.PI * 2);

            this.ctx.strokeStyle = `hsl(${180 + chargePercent * 180}, 100%, 60%)`;
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            this.ctx.arc(this.player.x, psy, this.player.radius + (this.isShieldActive ? 14 : 9), startAngle, endAngle);
            this.ctx.stroke();

            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 11px Outfit, Inter, sans-serif';
            this.ctx.fillText(`${Math.round(chargePercent * 100)}%`, this.player.x, psy - this.player.radius - 20);

            this.ctx.restore();
        }

        // Floating texts (Screen-space)
        this.floatingTexts.forEach(txt => {
            this.ctx.save();
            this.ctx.globalAlpha = txt.life;
            this.ctx.fillStyle = txt.color;
            this.ctx.font = 'bold 16px Outfit, Inter, sans-serif';
            this.ctx.shadowBlur = 6;
            this.ctx.shadowColor = txt.color;
            
            this.ctx.fillText(txt.text, txt.x, txt.y);
            this.ctx.restore();
        });
        this.ctx.globalAlpha = 1.0;
    }

    private drawBackgroundGrid() {
        this.ctx.save();
        
        const gridSize = 40;
        const scrollOffset = (this.camera.y * 0.2) % gridSize;
        
        // Grid lights up with pink hue in Fever Mode
        if (this.feverTimer > 0) {
            this.ctx.strokeStyle = 'rgba(255, 0, 127, 0.08)';
        } else {
            this.ctx.strokeStyle = 'rgba(79, 172, 254, 0.05)';
        }
        
        this.ctx.lineWidth = 1.0;

        for (let x = 0; x < this.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }

        for (let y = scrollOffset; y < this.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }

    // Start background render loop
    public start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.state = 'READY';
        this.onStateChange('READY');

        const loop = (timestamp: number) => {
            if (!this.isRunning) return;
            
            // Check state to selectively update physics
            this.update(timestamp);
            this.draw();
            
            this.animationFrameId = requestAnimationFrame(loop);
        };
        
        this.animationFrameId = requestAnimationFrame(loop);
    }

    public restartGame() {
        this.startNewGame();
    }

    public stop() {
        this.isRunning = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        window.removeEventListener('resize', this.resizeBounds);
        audio.stopCharge();
        audio.stopBackgroundPad();
    }
}
