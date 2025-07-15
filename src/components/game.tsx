"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

// Game Constants - these will be scaled
const BASE_GAME_SIZE = 500;
const BALL_RADIUS_RATIO = 10 / BASE_GAME_SIZE;
const ARC_RADIUS_OFFSET_RATIO = 15 / BASE_GAME_SIZE;
const ARC_THICKNESS_RATIO = 10 / BASE_GAME_SIZE;
const ARC_LENGTH_DEGREES = 60;
const PADDLE_SPEED_DEGREES = 3;
const INITIAL_BALL_SPEED_RATIO = 3 / BASE_GAME_SIZE;
const SPEED_INCREMENT_RATIO = 0.15 / BASE_GAME_SIZE;

const degreesToRadians = (deg: number) => deg * (Math.PI / 180);
const radiansToDegrees = (rad: number) => rad * (180 / Math.PI);

const Game = () => {
    // Game Dimensions
    const [gameSize, setGameSize] = useState(BASE_GAME_SIZE);
    const gameRadius = gameSize / 2;
    const ballRadius = gameSize * BALL_RADIUS_RATIO;
    const arcThickness = gameSize * ARC_THICKNESS_RATIO;
    const initialBallSpeed = gameSize * INITIAL_BALL_SPEED_RATIO;
    const speedIncrement = gameSize * SPEED_INCREMENT_RATIO;
    const arcRadius = gameRadius - (gameSize * ARC_RADIUS_OFFSET_RATIO);

    // Game State
    const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameOver'>('idle');
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);

    // Physics State
    const [ballPos, setBallPos] = useState({ x: 0, y: 0 }); // Relative to center
    const [ballVel, setBallVel] = useState({ dx: 0, dy: 0 });
    const [arc1Angle, setArc1Angle] = useState(225);
    const [arc2Angle, setArc2Angle] = useState(315);

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
        setBallVel({
            dx: Math.cos(angle) * initialBallSpeed,
            dy: Math.sin(angle) * initialBallSpeed,
        });
        setGameState('playing');
    }, [initialBallSpeed]);

    const gameLoop = useCallback(() => {
        // Update Arc Positions
        setArc1Angle(prev => (prev + (keysPressed.current['d'] ? PADDLE_SPEED_DEGREES : 0) - (keysPressed.current['a'] ? PADDLE_SPEED_DEGREES : 0) + 360) % 360);
        setArc2Angle(prev => (prev + (keysPressed.current['arrowright'] ? PADDLE_SPEED_DEGREES : 0) - (keysPressed.current['arrowleft'] ? PADDLE_SPEED_DEGREES : 0) + 360) % 360);

        // Update Ball Position and Velocity
        let newPos = { ...ballPos };
        let newVel = { ...ballVel };

        newPos.x += newVel.dx;
        newPos.y += newVel.dy;
        
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
                setScore(s => s + 1);

                // Reflect velocity
                const normal = { x: newPos.x / distFromCenter, y: newPos.y / distFromCenter };
                const dot = newVel.dx * normal.x + newVel.dy * normal.y;
                newVel.dx -= 2 * dot * normal.x;
                newVel.dy -= 2 * dot * normal.y;
                
                // Increase speed
                const currentSpeed = Math.sqrt(newVel.dx * newVel.dx + newVel.dy * newVel.dy);
                const newSpeed = currentSpeed + speedIncrement;
                const speedRatio = newSpeed / currentSpeed;
                newVel.dx *= speedRatio;
                newVel.dy *= speedRatio;

                // Move ball away from edge
                newPos.x -= normal.x * 2;
                newPos.y -= normal.y * 2;
            } else if (distFromCenter > gameRadius - ballRadius) {
                setGameState('gameOver');
                if (score > highScore) {
                    setHighScore(score);
                    localStorage.setItem('bounceHighScore', score.toString());
                }
                return;
            }
        }
        
        setBallPos(newPos);
        setBallVel(newVel);

        gameLoopRef.current = requestAnimationFrame(gameLoop);
    }, [ballPos, ballVel, gameRadius, ballRadius, arcRadius, arc1Angle, arc2Angle, score, highScore, speedIncrement]);

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
        const startAngle = degreesToRadians(angle - ARC_LENGTH_DEGREES / 2);
        const endAngle = degreesToRadians(angle + ARC_LENGTH_DEGREES / 2);
        const x1 = arcRadius * Math.cos(startAngle);
        const y1 = arcRadius * Math.sin(startAngle);
        const x2 = arcRadius * Math.cos(endAngle);
        const y2 = arcRadius * Math.sin(endAngle);
        const d = `M ${x1} ${y1} A ${arcRadius} ${arcRadius} 0 0 1 ${x2} ${y2}`;
        return <path d={d} stroke="white" strokeWidth={arcThickness} fill="none" strokeLinecap="round" {...props} />;
    };

    return (
        <div className="relative flex flex-col items-center justify-center font-headline text-primary select-none w-full">
            <div className="flex justify-between w-full text-lg sm:text-2xl" style={{ maxWidth: gameSize }}>
                <span>SCORE: {score}</span>
                <span>HIGH: {highScore}</span>
            </div>

            <div className="relative mt-4 bg-background border-4 border-primary rounded-full" style={{ width: gameSize, height: gameSize }}>
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
