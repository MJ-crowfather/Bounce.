
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { useIsMobile } from '@/hooks/use-mobile';

// Game Constants - these will be scaled
const BASE_GAME_SIZE = 500;
const BALL_RADIUS_RATIO = 10 / BASE_GAME_SIZE;
const ARC_THICKNESS_RATIO = 10 / BASE_GAME_SIZE;
const ARC_LENGTH_DEGREES = 60;
const PADDLE_SPEED_DEGREES = 3;
const INITIAL_BALL_SPEED_RATIO = 3 / BASE_GAME_SIZE;
const SPEED_INCREASE_ON_BOUNCE = 1.15; // 15% speed increase

const degreesToRadians = (deg: number) => deg * (Math.PI / 180);
const radiansToDegrees = (rad: number) => rad * (180 / Math.PI);

interface Ball {
    id: number;
    pos: { x: number; y: number };
    vel: { dx: number; dy: number };
}

const Game = () => {
    // Game Dimensions
    const [gameSize, setGameSize] = useState(BASE_GAME_SIZE);
    const gameRadius = gameSize / 2;
    const ballRadius = gameSize * BALL_RADIUS_RATIO;
    const arcThickness = gameSize * ARC_THICKNESS_RATIO;
    const initialBallSpeed = gameSize * INITIAL_BALL_SPEED_RATIO;
    const arcRadius = gameRadius - arcThickness / 2;

    // Game State
    const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameOver'>('idle');
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [balls, setBalls] = useState<Ball[]>([]);
    
    // Physics State
    const [arc1Angle, setArc1Angle] = useState(180); // Left half center
    const [arc2Angle, setArc2Angle] = useState(0);   // Right half center

    // Input State & Refs
    const keysPressed = useRef<{ [key: string]: boolean }>({});
    const gameLoopRef = useRef<number>();
    const nextBallId = useRef(0);
    const gameAreaRef = useRef<HTMLDivElement>(null);

    const isMobile = useIsMobile();


    // --- Effects ---

    // Responsive game size
    useEffect(() => {
        const updateSize = () => {
            const size = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.65, 500);
            setGameSize(size);
        };
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    // Load high score
    useEffect(() => {
        const storedHighScore = localStorage.getItem('bounceHighScore');
        if (storedHighScore) setHighScore(parseInt(storedHighScore, 10));
    }, []);

    // Keyboard controls
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => { keysPressed.current[e.key.toLowerCase()] = true; };
        const handleKeyUp = (e: KeyboardEvent) => { keysPressed.current[e.key.toLowerCase()] = false; };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // --- Game Logic ---

    const addNewBall = useCallback(() => {
        const angle = Math.random() * 2 * Math.PI;
        const newBall: Ball = {
            id: nextBallId.current++,
            pos: { x: 0, y: 0 },
            vel: {
                dx: Math.cos(angle) * initialBallSpeed,
                dy: Math.sin(angle) * initialBallSpeed,
            },
        };
        setBalls(prev => [...prev, newBall]);
    }, [initialBallSpeed]);

    const startGame = useCallback(() => {
        setScore(0);
        setBalls([]);
        setArc1Angle(180);
        setArc2Angle(0);
        nextBallId.current = 0;
        addNewBall();
        setGameState('playing');
    }, [addNewBall]);

    const handleArcMove = useCallback((angle: number, arc: 'arc1' | 'arc2') => {
        const halfArc = ARC_LENGTH_DEGREES / 2;
        if (arc === 'arc1') {
            const clampedAngle = Math.max(90 + halfArc, Math.min(270 - halfArc, angle));
            setArc1Angle(clampedAngle);
        } else { // arc2
             let normalizedAngle = angle;
             if (normalizedAngle > 270) normalizedAngle -= 360;
             const clampedAngle = Math.max(-90 + halfArc, Math.min(90 - halfArc, normalizedAngle));
             setArc2Angle(clampedAngle);
        }
    }, []);

    const gameLoop = useCallback(() => {
        if (gameState !== 'playing') return;

        // Keyboard controls (non-mobile)
        if (!isMobile) {
            if (keysPressed.current['d'] || keysPressed.current['a']) {
                const arc1Movement = (keysPressed.current['d'] ? PADDLE_SPEED_DEGREES : 0) - (keysPressed.current['a'] ? PADDLE_SPEED_DEGREES : 0);
                handleArcMove(arc1Angle + arc1Movement, 'arc1');
            }
            if (keysPressed.current['arrowright'] || keysPressed.current['arrowleft']) {
                const arc2Movement = (keysPressed.current['arrowright'] ? PADDLE_SPEED_DEGREES : 0) - (keysPressed.current['arrowleft'] ? PADDLE_SPEED_DEGREES : 0);
                handleArcMove(arc2Angle + arc2Movement, 'arc2');
            }
        }

        let gameOver = false;
        let bouncesThisFrame = 0;

        const updatedBalls = balls.map(ball => {
            if (gameOver) return ball;

            let newPos = { x: ball.pos.x + ball.vel.dx, y: ball.pos.y + ball.vel.dy };
            const distFromCenter = Math.sqrt(newPos.x * newPos.x + newPos.y * newPos.y);

            if (distFromCenter > arcRadius - ballRadius) {
                const ballAngleDegrees = (radiansToDegrees(Math.atan2(newPos.y, newPos.x)) + 360) % 360;

                const isHittingArc1 = () => {
                    const halfArc = ARC_LENGTH_DEGREES / 2;
                    return ballAngleDegrees >= arc1Angle - halfArc && ballAngleDegrees <= arc1Angle + halfArc;
                };

                const isHittingArc2 = () => {
                     const halfArc = ARC_LENGTH_DEGREES / 2;
                     let normalizedAngle = ballAngleDegrees;
                     if (normalizedAngle > 270) normalizedAngle -= 360;
                     return normalizedAngle >= arc2Angle - halfArc && normalizedAngle <= arc2Angle + halfArc;
                };

                if (isHittingArc1() || isHittingArc2()) {
                    bouncesThisFrame++;
                    
                    const normal = { x: newPos.x / distFromCenter, y: newPos.y / distFromCenter };
                    const dot = ball.vel.dx * normal.x + ball.vel.dy * normal.y;
                    let newVelDx = ball.vel.dx - 2 * dot * normal.x;
                    let newVelDy = ball.vel.dy - 2 * dot * normal.y;

                    newVelDx *= SPEED_INCREASE_ON_BOUNCE;
                    newVelDy *= SPEED_INCREASE_ON_BOUNCE;
                    
                    const randomAngle = (Math.random() - 0.5) * degreesToRadians(15);
                    const cos = Math.cos(randomAngle);
                    const sin = Math.sin(randomAngle);
                    const finalVelDx = newVelDx * cos - newVelDy * sin;
                    const finalVelDy = newVelDx * sin + newVelDy * cos;

                    return { 
                        ...ball, 
                        pos: newPos, 
                        vel: { dx: finalVelDx, dy: finalVelDy }
                    };
                } else {
                    gameOver = true;
                    return ball;
                }
            }
            return { ...ball, pos: newPos };
        });

        if (bouncesThisFrame > 0) {
            setScore(prev => prev + bouncesThisFrame);
        }

        if (gameOver) {
            setGameState('gameOver');
            if (score > highScore) {
                setHighScore(score);
                localStorage.setItem('bounceHighScore', score.toString());
            }
        } else {
            setBalls(updatedBalls);
        }

        gameLoopRef.current = requestAnimationFrame(gameLoop);
    }, [score, highScore, arcRadius, ballRadius, gameState, balls, arc1Angle, arc2Angle, handleArcMove, isMobile]);

    useEffect(() => {
        if (gameState === 'playing') {
            gameLoopRef.current = requestAnimationFrame(gameLoop);
        }
        return () => {
            if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
        };
    }, [gameState, gameLoop]);
    
    const Arc = ({ angle, ...props }: { angle: number, [key: string]: any }) => {
        const startAngleRad = degreesToRadians(angle - ARC_LENGTH_DEGREES / 2);
        const endAngleRad = degreesToRadians(angle + ARC_LENGTH_DEGREES / 2);

        const x1 = arcRadius * Math.cos(startAngleRad);
        const y1 = arcRadius * Math.sin(startAngleRad);
        const x2 = arcRadius * Math.cos(endAngleRad);
        const y2 = arcRadius * Math.sin(endAngleRad);

        const d = `M ${x1} ${y1} A ${arcRadius} ${arcRadius} 0 0 1 ${x2} ${y2}`;
        return <path d={d} stroke="white" strokeWidth={arcThickness} fill="none" strokeLinecap="round" {...props} />;
    };

    const halfArc = ARC_LENGTH_DEGREES / 2;

    return (
        <div className="relative flex flex-col items-center justify-center font-headline text-primary select-none w-full">
            <div className="flex justify-around w-full text-center text-lg sm:text-2xl" style={{ maxWidth: gameSize }}>
                <div className="flex-1 px-4">
                    <span>SCORE</span>
                    <div className="mt-2">{score}</div>
                </div>
                <div className="flex-1 px-4">
                    <span>HIGHSCORE</span>
                    <div className="mt-2">{highScore}</div>
                </div>
            </div>

            <div 
                ref={gameAreaRef}
                className="relative mt-4" 
                style={{ width: gameSize, height: gameSize }}
            >
                <svg width={gameSize} height={gameSize} viewBox={`${-gameSize/2} ${-gameSize/2} ${gameSize} ${gameSize}`} className="absolute inset-0">
                    <circle cx="0" cy="0" r={gameRadius - arcThickness / 2} stroke="white" strokeWidth="2" fill="none" />
                </svg>
                <AnimatePresence>
                    {gameState === 'idle' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center z-10">
                            <h1 className="text-4xl sm:text-6xl mb-8 text-primary">BOUNCE</h1>
                            <Button onClick={startGame} size="lg" variant="outline" className="text-lg sm:text-2xl bg-transparent text-primary hover:bg-primary hover:text-background border-2 px-6 py-3">START</Button>
                        </motion.div>
                    )}
                    {gameState === 'gameOver' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/70 rounded-full text-center p-4">
                            <h2 className="text-3xl sm:text-5xl mb-2 text-primary">GAME OVER</h2>
                            <p className="text-xl sm:text-2xl mb-6 text-primary">SCORE: {score}</p>
                            <Button onClick={startGame} size="lg" variant="outline" className="text-base sm:text-xl bg-transparent text-primary hover:bg-primary hover:text-background border-2 px-4 py-2">
                                <RotateCcw className="mr-2 h-5 w-5"/>
                                AGAIN
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="absolute inset-0">
                    {(gameState === 'playing' || gameState === 'gameOver') && (
                        <svg width={gameSize} height={gameSize} viewBox={`${-gameSize/2} ${-gameSize/2} ${gameSize} ${gameSize}`}>
                            <Arc angle={arc1Angle} />
                            <Arc angle={arc2Angle} />
                            {gameState === 'playing' && balls.map(ball => (
                                <circle key={ball.id} cx={ball.pos.x} cy={ball.pos.y} r={ballRadius} fill="white" />
                            ))}
                        </svg>
                    )}
                </div>
            </div>

            {isMobile && gameState === 'playing' && (
                <div className="flex justify-between w-full mt-8 px-4" style={{ maxWidth: gameSize }}>
                    <Slider
                        value={[arc1Angle]}
                        onValueChange={(value) => handleArcMove(value[0], 'arc1')}
                        min={90 + halfArc}
                        max={270 - halfArc}
                        step={1}
                        className="w-[45%]"
                    />
                    <Slider
                        value={[arc2Angle]}
                        onValueChange={(value) => handleArcMove(value[0], 'arc2')}
                        min={-90 + halfArc}
                        max={90 - halfArc}
                        step={1}
                        className="w-[45%]"
                    />
                </div>
            )}

            <div className="mt-6 text-center text-primary/80 text-xs sm:text-sm max-w-md px-4">
                <p className="mb-2">Keyboard: A/D for left, ←/→ for right.</p>
                <p className="mb-2">Touch: Use sliders to move the paddles.</p>
                <p>Don't let the ball escape!</p>
            </div>
        </div>
    );
};
export default Game;
