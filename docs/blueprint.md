# **App Name**: Bounce

## Core Features:

- Arc and Ball Physics: Implements a circular game area with two independently controlled arcs to bounce a ball.
- Score Tracking and Storage: Tracks and displays the player's score (bounce count) during the game and saves the high score to local storage.
- Game Logic and Control: Manages game start, ball release, speed increase on bounce, and end conditions on a miss, using keyboard or touch to manipulate arcs.
- Game Restart: Offers a 'Try Again' option to restart the game after it ends and display current score.

## Style Guidelines:

- Background color: Black (#000000) to create a stark contrast.
- Primary color: White (#FFFFFF) used for all visible elements including arcs, ball, text, and the boundary circle.
- Font: 'Press Start 2P' monospace font to evoke a retro arcade feel for all text elements.
- Circular game board with score display at the top. The arcs will be placed along the edge of the circle and independently controlled by each hand, and the ball's start point should be from the center. Optimized for deployment on Github Pages
- Ball bouncing animation should be smooth and speed up incrementally after each bounce. Use pixelated rendering for a retro look.