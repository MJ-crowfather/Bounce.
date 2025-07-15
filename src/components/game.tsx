"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

// Game Constants - these will be scaled
const BASE_GAME_SIZE = 500;
const BALL_RADIUS_RATIO = 10 / BASE_GAME_SIZE;
const ARC_THICKNESS_RATIO = 10 / BASE_GAME_SIZE;
const ARC_LENGTH_DEGREES = 60; // 1/6th of 360
const PADDLE_SPEED_DEGREES = 3;
const INITIAL_BALL_SPEED_RATIO = 3 / BASE_GAME_SIZE;

const degreesToRadians = (deg: number) => deg * (Math.PI / 180);
const radiansToDegrees = (rad: number) => rad * (180 / Math.PI);

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

    // Physics State
    const [ballPos, setBallPos] = useState({ x: 0, y: 0 }); // Relative to center
    const ballVelRef = useRef({ dx: 0, dy: 0 });
    const [arc1Angle, setArc1Angle] = useState(270); // Starts at bottom of left half
    const [arc2Angle, setArc2Angle] = useState(90); // Starts at bottom of right half

    // Input State & Refs
    const keysPressed = useRef<{ [key: string]: boolean }>({});
    const gameLoopRef = useRef<number>();

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

    const startGame = useCallback(() => {
        setScore(0);
        setBallPos({ x: 0, y: 0 });
        const angle = Math.random() * 2 * Math.PI;
        ballVelRef.current = {
            dx: Math.cos(angle) * initialBallSpeed,
            dy: Math.sin(angle) * initialBallSpeed,
        };
        setGameState('playing');
    }, [initialBallSpeed]);

    const gameLoop = useCallback(() => {
        // Update Arc Positions
        const arc1Movement = (keysPressed.current['d'] ? PADDLE_SPEED_DEGREES : 0) - (keysPressed.current['a'] ? PADDLE_SPEED_DEGREES : 0);
        setArc1Angle(prev => Math.max(180, Math.min(360, prev + arc1Movement)));

        const arc2Movement = (keysPressed.current['arrowright'] ? PADDLE_SPEED_DEGREES : 0) - (keysPressed.current['arrowleft'] ? PADDLE_SPEED_DEGREES : 0);
        setArc2Angle(prev => {
            const nextAngle = (prev + arc2Movement + 360) % 360;
            if (nextAngle >= 0 && nextAngle <= 180) return nextAngle;
            // Handle wrap-around from 0 to 360 for right paddle
            if (prev < 10 && arc2Movement < 0) return 360; // moving left from 0
            if (prev > 350 && arc2Movement > 0) return 0; // moving right from 360
            return prev;
        });

        // Update Ball Position and Velocity
        let newPos = { x: ballPos.x + ballVelRef.current.dx, y: ballPos.y + ballVelRef.current.dy };
        const distFromCenter = Math.sqrt(newPos.x * newPos.x + newPos.y * newPos.y);
        
        if (distFromCenter > arcRadius - ballRadius) {
            const ballAngleDegrees = (radiansToDegrees(Math.atan2(newPos.y, newPos.x)) + 360) % 360;

            const isHittingArc = (arcAngle: number) => {
                const halfArc = ARC_LENGTH_DEGREES / 2;
                let diff = Math.abs(ballAngleDegrees - arcAngle);
                if (diff > 180) diff = 360 - diff;
                return diff <= halfArc;
            };

            if (isHittingArc(arc1Angle) || isHittingArc(arc2Angle)) {
                const newScore = score + 1;
                setScore(newScore);

                // Reflect velocity
                const normal = { x: newPos.x / distFromCenter, y: newPos.y / distFromCenter };
                const dot = ballVelRef.current.dx * normal.x + ballVelRef.current.dy * normal.y;
                let newVelDx = ballVelRef.current.dx - 2 * dot * normal.x;
                let newVelDy = ballVelRef.current.dy - 2 * dot * normal.y;
                
                // Increase speed every 3 bounces
                if (newScore > 0 && newScore % 3 === 0) {
                     newVelDx *= 1.2;
                     newVelDy *= 1.2;
                }

                // Add slight random angle variation on bounce
                const randomAngle = (Math.random() - 0.5) * degreesToRadians(10); // +/- 5 degrees
                const cos = Math.cos(randomAngle);
                const sin = Math.sin(randomAngle);
                const finalVelDx = newVelDx * cos - newVelDy * sin;
                const finalVelDy = newVelDx * sin + newVelDy * cos;
                ballVelRef.current = { dx: finalVelDx, dy: finalVelDy };

                // Move ball away from edge
                newPos.x -= normal.x * 2;
                newPos.y -= normal.y * 2;

            } else {
                setGameState('gameOver');
                if (score > highScore) {
                    setHighScore(score);
                    localStorage.setItem('bounceHighScore', score.toString());
                }
                return;
            }
        }
        
        setBallPos(newPos);
        gameLoopRef.current = requestAnimationFrame(gameLoop);
    }, [ballPos, arcRadius, ballRadius, arc1Angle, arc2Angle, score, highScore]);

    useEffect(() => {
        if (gameState === 'playing') {
            gameLoopRef.current = requestAnimationFrame(gameLoop);
        }
        return () => {
            if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
        };
    }, [gameState, gameLoop]);

    // --- Render ---

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

    return (
        <div className="relative flex flex-col items-center justify-center font-headline text-primary select-none w-full">
            <div className="flex justify-around w-full text-center text-lg sm:text-2xl" style={{ maxWidth: gameSize }}>
                <div>
                    <span>SCORE:</span>
                    <div className="mt-1">{score}</div>
                </div>
                <div>
                    <span>HIGHSCORE:</span>
                    <div className="mt-1">{highScore}</div>
                </div>
            </div>

            <div className="relative mt-4" style={{ width: gameSize, height: gameSize }}>
                <svg width={gameSize} height={gameSize} viewBox={`${-gameSize/2} ${-gameSize/2} ${gameSize} ${gameSize}`} className="absolute inset-0">
                     <circle cx="0" cy="0" r={gameRadius - 2} stroke="white" strokeWidth="4" fill="none" />
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
                            {gameState === 'playing' && (
                                <circle cx={ballPos.x} cy={ballPos.y} r={ballRadius} fill="white" />
                            )}
                        </svg>
                    )}
                </div>
            </div>

            <div className="mt-6 text-center text-primary/80 text-xs sm:text-sm max-w-md px-4">
                <p className="mb-2">A/D for left paddle, ←/→ for right paddle.</p>
                <p>Don't let the ball escape the circle!</p>
            </div>
        </div>
    );
};
export default Game;

    