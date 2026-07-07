import { onMount, createSignal, Show, onCleanup, For, createEffect } from 'solid-js';
import { Game, type GameState, CHARACTERS } from './game/Game';
import { audio } from './game/AudioEngine';
import packageInfo from '../package.json';

interface LeaderboardEntry {
    name: string;
    score: number;
}

const App = () => {
    let canvasRef: HTMLCanvasElement | undefined;
    let gameInstance: Game | undefined;

    const [score, setScore] = createSignal(0);
    const [highScore, setHighScore] = createSignal(
        Number(localStorage.getItem('lumina_high_score') || 0)
    );
    const [gameState, setGameState] = createSignal<GameState>('READY');
    const [leaderboard, setLeaderboard] = createSignal<LeaderboardEntry[]>([]);
    const [userName, setUserName] = createSignal(localStorage.getItem('lumina_user_name') || '');
    const [isSubmitting, setIsSubmitting] = createSignal(false);
    const [hasSubmitted, setHasSubmitted] = createSignal(false);

    // Coins / Space Crystals
    const getInitialCoins = () => {
        let stored = localStorage.getItem('lumina_crystals');
        if (stored === null) {
            const legacy = localStorage.getItem('flappy-candy-coins');
            if (legacy !== null) {
                localStorage.setItem('lumina_crystals', legacy);
                stored = legacy;
            }
        }
        return Number(stored || 0);
    };

    const [coins, setCoins] = createSignal(getInitialCoins());
    const [activeCharacter, setActiveCharacter] = createSignal(
        localStorage.getItem('lumina_active_character') || 'neon_orb'
    );
    const [unlockedCharacters, setUnlockedCharacters] = createSignal<string[]>(
        JSON.parse(localStorage.getItem('lumina_unlocked_characters') || '["neon_orb"]')
    );
    const [isShopOpen, setIsShopOpen] = createSignal(false);

    // Skill cooldown signals
    const [skillCdRemaining, setSkillCdRemaining] = createSignal(0);
    const [skillCdDuration, setSkillCdDuration] = createSignal(1);

    // Fever Gauge signals
    const [feverGauge, setFeverGauge] = createSignal(0);

    // Audio state
    const [bgmEnabled, setBgmEnabled] = createSignal(!audio.getMuted());

    // Responsive scaling
    const [scale, setScale] = createSignal(1);

    // PWA deferred installation prompt
    const [deferredPrompt, setDeferredPrompt] = createSignal<any>(null);

    const updateScale = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        // Game dimensions 480x720 + border thickness (8px * 2) = 496x736
        const scaleX = (w - 24) / 496;
        const scaleY = (h - 24) / 736;
        const fitScale = Math.min(1.0, Math.min(scaleX, scaleY));
        setScale(fitScale);
    };

    const isTopScore = () => {
        if (score() === 0) return false;
        if (leaderboard().length < 5) return true;
        return score() > (leaderboard()[leaderboard().length - 1]?.score || 0);
    };

    const syncOfflineScore = async (serverLeaderboard: LeaderboardEntry[]) => {
        const localHigh = Number(localStorage.getItem('lumina_high_score') || 0);
        const name = localStorage.getItem('lumina_user_name');
        if (localHigh === 0 || !name) return;

        // Check if our high score with our name is already on the server leaderboard
        const alreadyExists = serverLeaderboard.some(
            entry => entry.name === name && entry.score === localHigh
        );

        if (!alreadyExists) {
            // Check if high score qualifies for top 5
            const isEntryEligible = serverLeaderboard.length < 5 || localHigh > (serverLeaderboard[serverLeaderboard.length - 1]?.score || 0);
            
            if (isEntryEligible) {
                console.log('Syncing offline high score to server:', name, localHigh);
                try {
                    const res = await fetch('/api/leaderboard', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, score: localHigh })
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.leaderboard) {
                            setLeaderboard(data.leaderboard);
                            localStorage.setItem('lumina_leaderboard_backup', JSON.stringify(data.leaderboard));
                        }
                    }
                } catch (e) {
                    console.warn('Failed to sync offline score to server:', e);
                }
            }
        }
    };

    const fetchLeaderboard = async () => {
        try {
            const res = await fetch('/api/leaderboard');
            if (res.ok) {
                const data = await res.json();
                setLeaderboard(data);
                localStorage.setItem('lumina_leaderboard_backup', JSON.stringify(data));
                await syncOfflineScore(data);
            } else {
                throw new Error("Server response failed");
            }
        } catch (e) {
            console.warn('Leaderboard fetch failed (offline mode):', e);
            const backup = localStorage.getItem('lumina_leaderboard_backup');
            if (backup) {
                setLeaderboard(JSON.parse(backup));
            } else {
                setLeaderboard([
                    { name: userName() || "YOU", score: highScore() }
                ]);
            }
        }
    };

    const submitScore = async () => {
        if (!userName() || isSubmitting() || hasSubmitted()) return;
        
        setIsSubmitting(true);
        localStorage.setItem('lumina_user_name', userName());
        
        try {
            const res = await fetch('/api/leaderboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: userName(), score: score() })
            });
            if (res.ok) {
                setHasSubmitted(true);
                const data = await res.json();
                if (data.leaderboard) {
                    setLeaderboard(data.leaderboard);
                    localStorage.setItem('lumina_leaderboard_backup', JSON.stringify(data.leaderboard));
                } else {
                    await fetchLeaderboard();
                }
            } else {
                throw new Error("Server rejection");
            }
        } catch (e) {
            console.warn('Score submission failed (offline fallback):', e);
            setHasSubmitted(true);
            
            let currentLeaderboard: LeaderboardEntry[] = [];
            const backup = localStorage.getItem('lumina_leaderboard_backup');
            if (backup) {
                try {
                    currentLeaderboard = JSON.parse(backup);
                } catch (_) {}
            }
            if (currentLeaderboard.length === 0) {
                currentLeaderboard = [
                    { name: "NEON", score: 15 },
                    { name: "NOVA", score: 10 },
                    { name: "COSMO", score: 8 },
                    { name: "JUMP", score: 5 },
                    { name: "AURA", score: 3 }
                ];
            }
            
            // Add user score
            currentLeaderboard.push({ name: userName().toUpperCase().slice(0, 8), score: score() });
            currentLeaderboard.sort((a, b) => b.score - a.score);
            currentLeaderboard = currentLeaderboard.slice(0, 5); // Top 5
            
            setLeaderboard(currentLeaderboard);
            localStorage.setItem('lumina_leaderboard_backup', JSON.stringify(currentLeaderboard));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePurchaseOrEquip = (charId: string, price: number) => {
        if (unlockedCharacters().includes(charId)) {
            setActiveCharacter(charId);
            localStorage.setItem('lumina_active_character', charId);
        } else {
            if (coins() >= price) {
                const updatedUnlocked = [...unlockedCharacters(), charId];
                setUnlockedCharacters(updatedUnlocked);
                localStorage.setItem('lumina_unlocked_characters', JSON.stringify(updatedUnlocked));
                
                const newCoins = coins() - price;
                setCoins(newCoins);
                localStorage.setItem('lumina_crystals', String(newCoins));
                
                setActiveCharacter(charId);
                localStorage.setItem('lumina_active_character', charId);
            }
        }
    };

    const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
    };

    onMount(() => {
        // Sanity check
        const currentActive = localStorage.getItem('lumina_active_character') || 'neon_orb';
        const exists = CHARACTERS.some(c => c.id === currentActive);
        if (!exists) {
            localStorage.setItem('lumina_active_character', 'neon_orb');
            setActiveCharacter('neon_orb');
        }

        fetchLeaderboard();
        updateScale();
        window.addEventListener('resize', updateScale);

        // Listen for PWA installation prompt
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        if (canvasRef) {
            const game = new Game(
                canvasRef, 
                (s) => {
                    setScore(s);
                    if (s > highScore()) {
                        setHighScore(s);
                        localStorage.setItem('lumina_high_score', s.toString());
                    }
                },
                (state) => {
                    setGameState(state);
                    if (state === 'PLAYING') {
                        setHasSubmitted(false);
                    }
                },
                (coinsCount) => {
                    setCoins(coinsCount);
                },
                (remaining, duration) => {
                    setSkillCdRemaining(remaining);
                    setSkillCdDuration(duration);
                },
                (gauge) => {
                    setFeverGauge(gauge);
                }
            );

            gameInstance = game;
            game.start();
            game.setPlayerCharacter(activeCharacter());

            createEffect(() => {
                game.setPlayerCharacter(activeCharacter());
            });

            onCleanup(() => {
                game.stop();
                window.removeEventListener('resize', updateScale);
                window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            });
        }
    });

    const triggerSkill = (e: MouseEvent) => {
        e.stopPropagation();
        if (gameInstance) {
            gameInstance.useActiveSkill();
        }
    };

    const installApp = async (e: MouseEvent) => {
        e.stopPropagation();
        const prompt = deferredPrompt();
        if (prompt) {
            prompt.prompt();
            const { outcome } = await prompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
            }
        }
    };

    const currentCharacterData = () => {
        return CHARACTERS.find(c => c.id === activeCharacter()) || CHARACTERS[0]!;
    };

    return (
        <div style={{ 
            position: 'relative', 
            'user-select': 'none',
            display: 'flex',
            'justify-content': 'center',
            'align-items': 'center',
            height: '100vh',
            width: '100vw',
            background: 'radial-gradient(circle at center, #1d0f39 0%, #05020c 100%)',
            'font-family': '"Outfit", "Nunito", sans-serif'
        }}>
            {/* Ambient blur lights */}
            <div class="ambient-glow" />

            <div id="game-container" style={{ 
                position: 'absolute', 
                top: '50%',
                left: '50%',
                width: '480px', 
                height: '720px', 
                overflow: 'hidden', 
                'border-radius': '24px', 
                'border': '4px solid rgba(0, 242, 254, 0.25)', 
                'box-shadow': '0 24px 64px rgba(0, 0, 0, 0.75), 0 0 35px rgba(0, 242, 254, 0.15)',
                'transform': `translate(-50%, -50%) scale(${scale()})`,
                'transform-origin': 'center',
                'transition': 'transform 0.1s ease-out',
                'background': '#020008'
            }}>
                {/* In-game Score Display */}
                <Show when={gameState() === 'PLAYING'}>
                    <div style={{
                        position: 'absolute',
                        top: '18px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        'flex-direction': 'column',
                        'align-items': 'center',
                        'z-index': 10,
                        'pointer-events': 'none'
                    }}>
                        <div style={{
                            'font-size': '38px',
                            'font-weight': '900',
                            'color': '#ffffff',
                            'text-shadow': '0 0 15px rgba(0, 242, 254, 0.6), 0 0 30px rgba(0, 242, 254, 0.3)',
                            'letter-spacing': '1px'
                        }}>
                            {score()}
                        </div>
                        <div style={{
                            'font-size': '10px',
                            'font-weight': '800',
                            'color': 'rgba(255, 255, 255, 0.45)',
                            'letter-spacing': '2px',
                            'margin-top': '-4px',
                            'text-transform': 'uppercase'
                        }}>
                            BEST {highScore()}
                        </div>
                    </div>
                </Show>

                {/* BGM Toggle button */}
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        const isMuted = audio.toggleMute();
                        setBgmEnabled(!isMuted);
                    }}
                    style={{
                        position: 'absolute',
                        top: '80px',
                        right: '16px',
                        background: 'rgba(15, 8, 30, 0.65)',
                        border: '1.5px solid rgba(255, 255, 255, 0.12)',
                        'border-radius': '10px',
                        width: '36px',
                        height: '36px',
                        display: 'flex',
                        'align-items': 'center',
                        'justify-content': 'center',
                        cursor: 'pointer',
                        'font-size': '15px',
                        'z-index': 15,
                        'color': '#fff',
                        'transition': 'all 0.2s ease',
                        'backdrop-filter': 'blur(8px)'
                    }}
                    class="hud-btn-hover"
                >
                    {bgmEnabled() ? '🔊' : '🔇'}
                </button>

                {/* Star Coin Counter (Space Crystals) */}
                <div style={{
                    position: 'absolute',
                    top: '80px',
                    left: '16px',
                    color: '#ffffff',
                    'background': 'rgba(15, 8, 30, 0.65)',
                    'border': '1.5px solid rgba(255, 255, 255, 0.12)',
                    'border-radius': '10px',
                    'padding': '0 12px',
                    'height': '36px',
                    'font-size': '14px',
                    'font-weight': 'bold',
                    'display': 'flex',
                    'align-items': 'center',
                    'gap': '6px',
                    'z-index': 10,
                    'cursor': gameState() !== 'PLAYING' ? 'pointer' : 'default',
                    'backdrop-filter': 'blur(8px)'
                }} onClick={(e) => {
                    e.stopPropagation();
                    if (gameState() !== 'PLAYING') {
                        setIsShopOpen(true);
                    }
                }}
                   class={gameState() !== 'PLAYING' ? "hud-btn-hover" : ""}
                >
                    <span>💎</span>
                    <span>{coins()}</span>
                </div>

                {/* Fever Gauge Overlay during game */}
                <Show when={gameState() === 'PLAYING'}>
                    <div style={{
                        position: 'absolute',
                        bottom: '80px',
                        left: '20px',
                        'z-index': 15,
                        display: 'flex',
                        'flex-direction': 'column',
                        'align-items': 'center'
                    }}>
                        <div style={{
                            width: '100px',
                            height: '14px',
                            background: 'rgba(15, 8, 30, 0.65)',
                            border: '1.5px solid rgba(0, 242, 254, 0.3)',
                            'border-radius': '8px',
                            overflow: 'hidden',
                            position: 'relative',
                            display: 'flex',
                            'align-items': 'center'
                        }}>
                            <div style={{
                                width: `${feverGauge()}%`,
                                height: '100%',
                                background: feverGauge() >= 100 
                                    ? 'linear-gradient(90deg, #ff007f, #ff7675, #ff007f)' 
                                    : 'linear-gradient(90deg, #00f2fe, #4facfe)',
                                'border-radius': '5px',
                                transition: 'width 0.15s ease-out'
                            }} />
                        </div>
                        <span style={{
                            'font-size': '10px',
                            'font-weight': '800',
                            'color': feverGauge() >= 100 ? '#ff007f' : '#00f2fe',
                            'margin-top': '5px',
                            'background': 'rgba(15, 8, 30, 0.8)',
                            'border': '1px solid rgba(0, 242, 254, 0.25)',
                            'padding': '2px 8px',
                            'border-radius': '6px',
                            'text-shadow': feverGauge() >= 100 ? '0 0 6px rgba(255, 0, 127, 0.4)' : 'none',
                            animation: feverGauge() >= 100 ? 'pulse 0.6s infinite alternate' : 'none',
                            'letter-spacing': '1px'
                        }}>
                            {feverGauge() >= 100 ? '🔥 FEVER TIME!' : `FEVER ${Math.round(feverGauge())}%`}
                        </span>
                    </div>
                </Show>

                {/* Active Skill Overlay during game */}
                <Show when={gameState() === 'PLAYING'}>
                    <div style={{
                        position: 'absolute',
                        bottom: '80px',
                        right: '20px',
                        'z-index': 15,
                        display: 'flex',
                        'flex-direction': 'column',
                        'align-items': 'center'
                    }}>
                        <Show when={currentCharacterData().id !== 'neon_orb'} fallback={
                            <div style={{
                                'background': 'rgba(15, 8, 30, 0.8)',
                                'border': '1.5px solid rgba(0, 242, 254, 0.25)',
                                'border-radius': '8px',
                                'padding': '4px 10px',
                                'font-size': '10px',
                                'font-weight': '800',
                                'color': '#00f2fe',
                                'text-align': 'center',
                                'letter-spacing': '0.5px'
                            }}>
                                🧲 PASSIVE MAGNET
                            </div>
                        }>
                            <button 
                                onClick={triggerSkill}
                                disabled={skillCdRemaining() > 0}
                                style={{
                                    width: '56px',
                                    height: '56px',
                                    'border-radius': '50%',
                                    'background': skillCdRemaining() > 0 ? 'rgba(80, 80, 80, 0.6)' : currentCharacterData().color,
                                    'border': '2.5px solid rgba(255, 255, 255, 0.8)',
                                    'box-shadow': skillCdRemaining() > 0 ? 'none' : `0 0 15px ${currentCharacterData().color}`,
                                    'cursor': skillCdRemaining() > 0 ? 'not-allowed' : 'pointer',
                                    'position': 'relative',
                                    'display': 'flex',
                                    'justify-content': 'center',
                                    'align-items': 'center',
                                    'font-size': '24px',
                                    'color': '#fff',
                                    'transition': 'all 0.15s ease'
                                }}
                                class="skill-btn-hover"
                            >
                                {currentCharacterData().id === 'nova_core' ? '🛡️' : 
                                 currentCharacterData().id === 'nebula_ring' ? '🚀' : 
                                 currentCharacterData().id === 'pulsar_cube' ? '⚡' : '🕳️'}

                                {/* Cooldown Overlay */}
                                <Show when={skillCdRemaining() > 0}>
                                    <div style={{
                                        position: 'absolute',
                                        top: '-2.5px',
                                        left: '-2.5px',
                                        width: '56px',
                                        height: '56px',
                                        'border-radius': '50%',
                                        'border': '2.5px solid rgba(0,0,0,0.5)',
                                        'background': `conic-gradient(rgba(0, 0, 0, 0.8) ${ (skillCdRemaining() / Math.max(1, skillCdDuration())) * 360 }deg, rgba(0, 0, 0, 0.2) 0deg)`,
                                        'color': 'white',
                                        'display': 'flex',
                                        'justify-content': 'center',
                                        'align-items': 'center',
                                        'font-size': '13px',
                                        'font-weight': '900'
                                    }}>
                                        {Math.ceil(skillCdRemaining() / 1000)}s
                                    </div>
                                </Show>
                            </button>
                            <span style={{
                                'font-size': '9px',
                                'font-weight': '800',
                                'color': '#ffffff',
                                'margin-top': '5px',
                                'background': 'rgba(15, 8, 30, 0.8)',
                                'border': '1.5px solid rgba(255, 255, 255, 0.15)',
                                'padding': '2px 8px',
                                'border-radius': '6px',
                                'letter-spacing': '0.5px'
                            }}>
                                {currentCharacterData().skillName}
                            </span>
                        </Show>
                    </div>
                </Show>

                {/* Ready / Start Menu Screen */}
                <Show when={gameState() === 'READY'}>
                    <div style={{
                        position: 'absolute',
                        top: '0',
                        left: '0',
                        width: '100%',
                        height: '100%',
                        background: 'rgba(4, 2, 10, 0.82)',
                        'backdrop-filter': 'blur(12px)',
                        'display': 'flex',
                        'flex-direction': 'column',
                        'justify-content': 'center',
                        'align-items': 'center',
                        'padding': '40px 24px',
                        'text-align': 'center',
                        'z-index': 20
                    }}>
                        <h1 class="glow-title" style={{
                            'font-size': '44px',
                            'font-weight': '800',
                            'margin-bottom': '4px',
                            'letter-spacing': '-1.5px',
                            'background': 'linear-gradient(135deg, #00f2fe 0%, #4facfe 50%, #ff007f 100%)',
                            '-webkit-background-clip': 'text',
                            '-webkit-text-fill-color': 'transparent'
                        }}>LUMINA JUMP</h1>
                        <p style={{
                            'font-size': '12px',
                            'color': 'rgba(255, 255, 255, 0.5)',
                            'letter-spacing': '2px',
                            'text-transform': 'uppercase',
                            'margin-bottom': '28px'
                        }}>Cosmic Timing Climber</p>

                        <div style={{
                            width: '100%',
                            background: 'rgba(20, 10, 35, 0.65)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            'border-radius': '16px',
                            'padding': '20px',
                            'margin-bottom': '28px',
                            'text-align': 'left'
                        }}>
                            <h3 style={{
                                'font-size': '14px',
                                'color': '#00f2fe',
                                'margin-bottom': '12px',
                                'text-transform': 'uppercase',
                                'letter-spacing': '1px'
                            }}>조작 방법</h3>
                            
                            <div style={{ display: 'flex', 'align-items': 'center', 'margin-bottom': '10px' }}>
                                <span class="inst-num">1</span>
                                <p style={{ 'font-size': '12px', color: 'rgba(255, 255, 255, 0.8)' }}>
                                    클릭 또는 스페이스바를 <strong>꾹 누르고 있으면</strong> 파워 게이지가 위아래로 충전됩니다.
                                </p>
                            </div>
                            <div style={{ display: 'flex', 'align-items': 'center', 'margin-bottom': '10px' }}>
                                <span class="inst-num">2</span>
                                <p style={{ 'font-size': '12px', color: 'rgba(255, 255, 255, 0.8)' }}>
                                    적절한 힘의 크기일 때 <strong>손을 떼면</strong> 발판을 향해 하늘로 도약합니다.
                                </p>
                            </div>
                            <div style={{ display: 'flex', 'align-items': 'center' }}>
                                <span class="inst-num">3</span>
                                <p style={{ 'font-size': '12px', color: 'rgba(255, 255, 255, 0.8)' }}>
                                    움직이는 발판 중앙에 가깝게 착지할수록 <strong>Perfect 콤보 보너스</strong>와 <strong>피버 에너지</strong>를 획득합니다!
                                </p>
                            </div>
                        </div>

                        {/* Equipped Character Preview on Start */}
                        <div style={{
                            display: 'flex',
                            'align-items': 'center',
                            'background': 'rgba(15, 8, 30, 0.7)',
                            'border': '1.5px solid rgba(0, 242, 254, 0.3)',
                            'border-radius': '16px',
                            'padding': '10px 16px',
                            'margin-bottom': '28px',
                            'gap': '12px',
                            'cursor': 'pointer'
                        }} onClick={() => setIsShopOpen(true)}>
                            <div style={{
                                width: '30px',
                                height: '30px',
                                'border-radius': '50%',
                                'background': `radial-gradient(circle, #fff, ${currentCharacterData().color})`,
                                'box-shadow': `0 0 10px ${currentCharacterData().color}`
                            }} />
                            <div style={{ 'text-align': 'left' }}>
                                <div style={{ 'font-weight': 'bold', 'font-size': '13px', 'color': '#ffffff' }}>
                                    {currentCharacterData().name} (장착중)
                                </div>
                                <div style={{ 'font-size': '10px', 'color': '#ff7675', 'font-weight': 'bold' }}>
                                    {currentCharacterData().skillName}
                                </div>
                            </div>
                        </div>

                        {/* Buttons Row */}
                        <div style={{ display: 'flex', 'flex-direction': 'column', 'gap': '12px', 'width': '100%' }}>
                            <button 
                                onClick={() => {
                                    if (gameInstance) gameInstance.startNewGame();
                                }}
                                style={{
                                    'background': 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
                                    'color': '#03010b',
                                    'border': 'none',
                                    'border-radius': '12px',
                                    'padding': '14px 28px',
                                    'font-size': '16px',
                                    'font-weight': '800',
                                    'letter-spacing': '1px',
                                    'text-transform': 'uppercase',
                                    'cursor': 'pointer',
                                    'box-shadow': '0 8px 24px rgba(0, 242, 254, 0.35)',
                                    'transition': 'all 0.2s'
                                }}
                                class="btn-glow-cyan"
                            >
                                게임 시작하기
                            </button>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button 
                                    onClick={() => setIsShopOpen(true)}
                                    style={{
                                        flex: 1,
                                        'background': 'rgba(15, 8, 30, 0.75)',
                                        'color': '#ffffff',
                                        'border': '1.5px solid rgba(255, 255, 255, 0.15)',
                                        'border-radius': '12px',
                                        'padding': '11px 0',
                                        'font-size': '13px',
                                        'font-weight': 'bold',
                                        'cursor': 'pointer',
                                        'transition': 'all 0.2s'
                                    }}
                                    class="btn-hover-border"
                                >
                                    🍭 코스믹 샵
                                </button>

                                <Show when={deferredPrompt()}>
                                    <button 
                                        onClick={installApp}
                                        style={{
                                            flex: 1,
                                            'background': 'rgba(255, 0, 127, 0.12)',
                                            'color': '#ff007f',
                                            'border': '1.5px solid #ff007f',
                                            'border-radius': '12px',
                                            'padding': '11px 0',
                                            'font-size': '13px',
                                            'font-weight': 'bold',
                                            'cursor': 'pointer',
                                            'box-shadow': '0 0 10px rgba(255, 0, 127, 0.15)',
                                            'transition': 'all 0.2s'
                                        }}
                                        class="btn-hover-pink"
                                    >
                                        📲 앱 설치하기
                                    </button>
                                </Show>
                            </div>
                        </div>
                    </div>
                </Show>

                {/* Game Over Screen Overlay */}
                <Show when={gameState() === 'GAME_OVER'}>
                    <div style={{
                        position: 'absolute',
                        top: '0',
                        left: '0',
                        width: '100%',
                        height: '100%',
                        background: 'rgba(4, 2, 10, 0.85)',
                        'backdrop-filter': 'blur(12px)',
                        'display': 'flex',
                        'flex-direction': 'column',
                        'justify-content': 'center',
                        'align-items': 'center',
                        'padding': '40px 24px',
                        'z-index': 20
                    }}>
                        <div style={{
                            background: 'rgba(15, 8, 30, 0.85)', 
                            padding: '24px',
                            'border-radius': '24px',
                            'border': '1.5px solid rgba(255, 255, 255, 0.08)',
                            'text-align': 'center',
                            'box-shadow': '0 12px 35px rgba(0,0,0,0.5)',
                            width: '320px'
                        }}>
                            <h1 style={{ 
                                'font-size': '32px', 
                                margin: '0 0 8px 0', 
                                color: '#ff3366',
                                'text-shadow': '0 0 12px rgba(255, 51, 102, 0.4)',
                                'font-weight': '800',
                                'letter-spacing': '1px'
                            }}>GAME OVER</h1>
                            
                            {/* Score Display */}
                            <div style={{ 
                                'background': 'rgba(255, 255, 255, 0.03)', 
                                'padding': '12px', 
                                'border-radius': '14px', 
                                'border': '1px solid rgba(255, 255, 255, 0.05)',
                                'margin-bottom': '16px',
                                'display': 'flex',
                                'justify-content': 'space-around'
                            }}>
                                <div>
                                    <div style={{ 'font-size': '10px', 'color': 'rgba(255,255,255,0.45)', 'letter-spacing': '0.5px' }}>SCORE</div>
                                    <div style={{ 'font-size': '22px', 'font-weight': 'bold', 'color': '#ffffff' }}>{score()}</div>
                                </div>
                                <div>
                                    <div style={{ 'font-size': '10px', 'color': 'rgba(255,255,255,0.45)', 'letter-spacing': '0.5px' }}>BEST</div>
                                    <div style={{ 'font-size': '22px', 'font-weight': 'bold', 'color': '#ffdd00' }}>{highScore()}</div>
                                </div>
                            </div>

                            {/* Leaderboard Submission */}
                            <Show when={isTopScore() && !hasSubmitted()}>
                                <div style={{ 
                                    'margin-bottom': '16px', 
                                    'background': 'rgba(0, 242, 254, 0.06)',
                                    'padding': '12px', 
                                    'border-radius': '14px',
                                    'border': '1px solid rgba(0, 242, 254, 0.2)'
                                }}>
                                    <div style={{ 'font-size': '11px', 'margin-bottom': '8px', 'font-weight': 'bold', color: '#00f2fe', 'letter-spacing': '0.5px' }}>
                                        🎉 NEW HIGH SCORE! LEADERBOARD SUBMIT 🎉
                                    </div>
                                    <div style={{ display: 'flex', 'justify-content': 'center', 'align-items': 'center', gap: '8px' }}>
                                        <input 
                                            type="text" 
                                            placeholder="YOUR NAME" 
                                            value={userName()}
                                            onInput={(e) => setUserName(e.currentTarget.value.toUpperCase().slice(0, 8))}
                                            style={{
                                                padding: '8px',
                                                width: '120px',
                                                'border-radius': '8px',
                                                'border': '1px solid rgba(255, 255, 255, 0.15)',
                                                'text-align': 'center',
                                                'font-weight': 'bold',
                                                'color': '#ffffff',
                                                'background': 'rgba(15, 8, 30, 0.9)',
                                                'font-size': '12px',
                                                'font-family': '"Outfit", sans-serif'
                                            }}
                                            class="name-input"
                                        />
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                submitScore();
                                            }}
                                            disabled={isSubmitting() || !userName()}
                                            style={{
                                                padding: '8px 16px',
                                                'background': '#00f2fe',
                                                'color': '#03010b',
                                                'border': 'none',
                                                'border-radius': '8px',
                                                'font-weight': 'bold',
                                                'cursor': 'pointer',
                                                'font-size': '12px',
                                                opacity: isSubmitting() || !userName() ? 0.5 : 1
                                            }}
                                        >
                                            {isSubmitting() ? '...' : 'SEND'}
                                        </button>
                                    </div>
                                </div>
                            </Show>

                            {/* Mini Leaderboard */}
                            <div style={{ 
                                'text-align': 'left', 
                                'font-size': '12px', 
                                'background': 'rgba(255, 255, 255, 0.02)',
                                'padding': '12px', 
                                'border-radius': '14px',
                                'border': '1px solid rgba(255, 255, 255, 0.05)',
                                'color': '#ffffff'
                            }}>
                                <div style={{ 
                                    'font-weight': 'bold', 
                                    'margin-bottom': '6px', 
                                    'border-bottom': '1px solid rgba(255, 255, 255, 0.12)', 
                                    'padding-bottom': '4px',
                                    'text-align': 'center',
                                    'color': '#00f2fe',
                                    'letter-spacing': '1px'
                                }}>
                                    🏆 TOP COSMIC PLAYERS
                                </div>
                                <For each={leaderboard()}>
                                    {(entry, i) => (
                                        <div style={{ display: 'flex', 'justify-content': 'space-between', 'margin-bottom': '4px', 'font-weight': '500' }}>
                                            <span>{i() + 1}. {entry.name}</span>
                                            <span style={{ 'font-weight': 'bold', color: '#ff7675' }}>{entry.score} pts</span>
                                        </div>
                                    )}
                                </For>
                            </div>

                            {/* Footer Buttons inside Game Over */}
                            <div style={{ display: 'flex', 'justify-content': 'space-between', 'margin-top': '18px', gap: '10px' }}>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setIsShopOpen(true); }}
                                    style={{
                                        flex: 1,
                                        'background': 'rgba(15, 8, 30, 0.75)',
                                        'color': '#ffffff',
                                        'border': '1px solid rgba(255, 255, 255, 0.15)',
                                        'border-radius': '10px',
                                        'padding': '10px 0',
                                        'font-weight': 'bold',
                                        'cursor': 'pointer',
                                        'font-size': '13px'
                                    }}
                                >
                                    🍭 샵 가기
                                </button>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (gameInstance) gameInstance.restartGame();
                                    }}
                                    style={{ 
                                        flex: 1.5,
                                        'font-size': '13px', 
                                        'background': 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
                                        'color': '#03010b',
                                        'padding': '10px 0',
                                        'border-radius': '10px',
                                        'border': 'none',
                                        'font-weight': 'bold',
                                        'cursor': 'pointer',
                                        'box-shadow': '0 4px 15px rgba(0, 242, 254, 0.25)'
                                    }}
                                >
                                    🛸 다시 도전하기 🛸
                                </button>
                            </div>
                        </div>
                    </div>
                </Show>

                {/* Character Shop Modal Overlay */}
                <Show when={isShopOpen()}>
                    <div style={{
                        position: 'absolute',
                        top: '0',
                        left: '0',
                        width: '100%',
                        height: '100%',
                        background: 'rgba(4, 2, 10, 0.85)',
                        'z-index': 30,
                        display: 'flex',
                        'justify-content': 'center',
                        'align-items': 'center',
                        'backdrop-filter': 'blur(12px)'
                    }} onClick={(e) => { e.stopPropagation(); setIsShopOpen(false); }}>
                        
                        {/* Shop Panel */}
                        <div style={{
                            background: 'rgba(15, 8, 30, 0.92)',
                            width: '340px',
                            'border-radius': '24px',
                            'border': '1.5px solid rgba(0, 242, 254, 0.3)',
                            'padding': '20px',
                            'box-shadow': '0 25px 50px rgba(0,0,0,0.6)',
                            'color': '#ffffff'
                        }} onClick={(e) => e.stopPropagation()}>
                            
                            {/* Shop Header */}
                            <div style={{ 
                                display: 'flex', 
                                'justify-content': 'space-between', 
                                'align-items': 'center',
                                'border-bottom': '1px solid rgba(255, 255, 255, 0.12)',
                                'padding-bottom': '12px',
                                'margin-bottom': '16px'
                            }}>
                                <h2 style={{ margin: 0, 'font-size': '20px', color: '#00f2fe', 'text-shadow': '0 0 10px rgba(0, 242, 254, 0.3)' }}>
                                    🍭 코스믹 샵
                                </h2>
                                <div style={{
                                    'background': 'rgba(255, 255, 255, 0.05)',
                                    'border': '1px solid rgba(255, 255, 255, 0.15)',
                                    'border-radius': '10px',
                                    'padding': '4px 10px',
                                    'font-weight': 'bold',
                                    'font-size': '13px',
                                    'display': 'flex',
                                    'align-items': 'center',
                                    'gap': '4px'
                                }}>
                                    <span>💎</span> {coins()}
                                </div>
                            </div>

                            {/* Shop List */}
                            <div style={{ 
                                display: 'flex', 
                                'flex-direction': 'column', 
                                gap: '10px',
                                'max-height': '340px',
                                'overflow-y': 'auto',
                                'padding-right': '4px'
                            }}>
                                <For each={CHARACTERS}>
                                    {(char) => {
                                        const isUnlocked = () => unlockedCharacters().includes(char.id);
                                        const isActive = () => activeCharacter() === char.id;

                                        return (
                                            <div style={{
                                                display: 'flex',
                                                'align-items': 'center',
                                                'background': 'rgba(255, 255, 255, 0.02)',
                                                'border': isActive() ? '1.5px solid #00f2fe' : '1.5px solid rgba(255, 255, 255, 0.1)',
                                                'border-radius': '14px',
                                                'padding': '10px',
                                                gap: '12px',
                                                'box-shadow': isActive() ? '0 0 12px rgba(0, 242, 254, 0.25)' : 'none'
                                            }}>
                                                {/* Skin Preview */}
                                                <div style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    'border-radius': '50%',
                                                    'background': `radial-gradient(circle, #fff, ${char.color})`,
                                                    'box-shadow': `0 0 10px ${char.color}`,
                                                    'flex-shrink': 0
                                                }} />

                                                {/* Info */}
                                                <div style={{ flex: 1, 'text-align': 'left' }}>
                                                    <div style={{ 'font-weight': 'bold', 'font-size': '13px' }}>{char.name}</div>
                                                    <div style={{ 'font-size': '9px', 'font-weight': 'bold', color: '#ff7675', 'margin-bottom': '2px' }}>
                                                        {char.skillName}
                                                    </div>
                                                    <div style={{ 'font-size': '9px', color: 'rgba(255,255,255,0.6)', 'line-height': '1.2' }}>
                                                        {char.skillDesc}
                                                    </div>
                                                </div>

                                                {/* Action Button */}
                                                <button
                                                    onClick={() => handlePurchaseOrEquip(char.id, char.price)}
                                                    disabled={!isUnlocked() && coins() < char.price}
                                                    style={{
                                                        'padding': '6px 12px',
                                                        'border-radius': '8px',
                                                        'border': 'none',
                                                        'font-weight': 'bold',
                                                        'font-size': '10px',
                                                        'cursor': (!isUnlocked() && coins() < char.price) ? 'not-allowed' : 'pointer',
                                                        'background': isActive() 
                                                            ? '#00f2fe' 
                                                            : isUnlocked() 
                                                                ? 'rgba(255,255,255,0.1)' 
                                                                : 'linear-gradient(135deg, #f39c12, #d35400)',
                                                        'color': isActive() ? '#03010b' : '#ffffff',
                                                        'flex-shrink': 0,
                                                        'transition': 'all 0.15s'
                                                    }}
                                                >
                                                    {isActive() 
                                                        ? '장착됨' 
                                                        : isUnlocked() 
                                                            ? '장착' 
                                                            : `💎 ${char.price}`}
                                                </button>
                                            </div>
                                        );
                                    }}
                                </For>
                            </div>

                            {/* Modal Close */}
                            <button 
                                onClick={(e) => { e.stopPropagation(); setIsShopOpen(false); }}
                                style={{
                                    'margin-top': '16px',
                                    width: '100%',
                                    'background': 'rgba(255, 255, 255, 0.05)',
                                    'border': '1px solid rgba(255, 255, 255, 0.15)',
                                    'color': '#ffffff',
                                    'border-radius': '12px',
                                    'padding': '10px 0',
                                    'font-weight': 'bold',
                                    'cursor': 'pointer',
                                    'transition': 'all 0.2s',
                                    'font-size': '13px'
                                }}
                                class="btn-hover-border"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </Show>

                {/* Canvas Drawing Layer */}
                <canvas ref={canvasRef} width="480" height="720" style={{ display: 'block', width: '100%', height: '100%' }} />

                {/* Game Version Display */}
                <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '12px',
                    'font-size': '10px',
                    'font-weight': '600',
                    'color': 'rgba(255, 255, 255, 0.35)',
                    'pointer-events': 'none',
                    'z-index': 18,
                    'letter-spacing': '0.5px'
                }}>
                    v{packageInfo.version}
                </div>
            </div>
            
            <style>{`
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }
                
                .glow-title {
                    text-shadow: 0 0 15px rgba(0, 242, 254, 0.35);
                    animation: titlePulse 2.5s ease-in-out infinite alternate;
                }
                
                @keyframes titlePulse {
                    0% { transform: scale(0.98); }
                    100% { transform: scale(1.02); }
                }

                .inst-num {
                    width: 24px;
                    height: 24px;
                    background: rgba(0, 242, 254, 0.12);
                    border: 1px solid rgba(0, 242, 254, 0.3);
                    border-radius: 6px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    margin-right: 10px;
                    flex-shrink: 0;
                    color: #00f2fe;
                    font-weight: bold;
                    font-size: 11px;
                }
                
                .name-input:focus {
                    outline: none;
                    border-color: #00f2fe !important;
                    box-shadow: 0 0 10px rgba(0, 242, 254, 0.35);
                }
                
                .btn-glow-cyan:hover {
                    box-shadow: 0 12px 28px rgba(0, 242, 254, 0.5), 0 0 15px rgba(255, 255, 255, 0.2);
                    transform: translateY(-2px);
                }
                .btn-glow-cyan:active {
                    transform: translateY(1px);
                }

                .btn-hover-border:hover {
                    background: rgba(255, 255, 255, 0.12) !important;
                    border-color: rgba(255, 255, 255, 0.3) !important;
                }
                
                .btn-hover-pink:hover {
                    background: rgba(255, 0, 127, 0.22) !important;
                    box-shadow: 0 0 15px rgba(255, 0, 127, 0.3) !important;
                    transform: translateY(-1px);
                }

                .hud-btn-hover:hover {
                    background: rgba(255, 255, 255, 0.12) !important;
                    border-color: #00f2fe !important;
                    box-shadow: 0 0 10px rgba(0, 242, 254, 0.2);
                }

                .skill-btn-hover:active {
                    transform: scale(0.95);
                }

                .ambient-glow {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: -1;
                    background: 
                        radial-gradient(circle at 15% 20%, rgba(0, 242, 254, 0.15) 0%, transparent 40%),
                        radial-gradient(circle at 85% 75%, rgba(255, 0, 127, 0.15) 0%, transparent 45%);
                    filter: blur(80px);
                }
            `}</style>
        </div>
    );
};

export default App;
