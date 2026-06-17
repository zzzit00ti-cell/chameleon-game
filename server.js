const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

// Game State Storage
const rooms = {};

// Built-in topics (Expanded for randomness)
const CATEGORIES = {
    'Movies': [
        'The Matrix', 'Inception', 'Titanic', 'Avatar', 'Jaws', 'Rocky', 'Star Wars', 'Jurassic Park',
        'Toy Story', 'Gladiator', 'The Godfather', 'E.T.', 'Alien', 'Terminator', 'Die Hard', 'Lion King',
        'Pulp Fiction', 'Forrest Gump', 'The Avengers', 'Spider-Man', 'Batman', 'Superman', 'Interstellar',
        'The Shining', 'Psycho', 'Goodfellas', 'Fight Club', 'The Lord of the Rings', 'Harry Potter',
        'Braveheart', 'Schindlers List', 'The Silence of the Lambs', 'Se7en', 'The Usual Suspects',
        'Back to the Future', 'Raiders of the Lost Ark', 'Casablanca', 'Gone with the Wind', 'The Wizard of Oz',
        'Citizen Kane', 'The Dark Knight', 'Incredibles', 'Finding Nemo', 'Shrek', 'Up', 'WALL-E'
    ],
    'Animals': [
        'Lion', 'Tiger', 'Elephant', 'Giraffe', 'Zebra', 'Dolphin', 'Shark', 'Whale',
        'Penguin', 'Kangaroo', 'Koala', 'Panda', 'Eagle', 'Hawk', 'Snake', 'Crocodile',
        'Alligator', 'Hippopotamus', 'Rhinoceros', 'Cheetah', 'Leopard', 'Panther', 'Bear', 'Wolf',
        'Fox', 'Deer', 'Moose', 'Elk', 'Bison', 'Buffalo', 'Gorilla', 'Chimpanzee', 'Monkey', 'Baboon',
        'Orangutan', 'Sloth', 'Armadillo', 'Ostrich', 'Emu', 'Flamingo', 'Peacock', 'Parrot', 'Owl',
        'Frog', 'Toad', 'Salamander', 'Turtle', 'Tortoise', 'Lizard', 'Iguana', 'Chameleon'
    ],
    'Food': [
        'Pizza', 'Burger', 'Sushi', 'Pasta', 'Taco', 'Salad', 'Steak', 'Soup',
        'Pancakes', 'Waffles', 'Sandwich', 'Curry', 'Ramen', 'Ice Cream', 'Cake', 'Pie',
        'Burrito', 'Enchilada', 'Quesadilla', 'Nachos', 'Fajitas', 'Hot Dog', 'Sausage', 'Bacon',
        'Eggs', 'Omelette', 'Cereal', 'Oatmeal', 'Bagel', 'Croissant', 'Muffin', 'Donut', 'Cookie',
        'Brownie', 'Cupcake', 'Cheesecake', 'Pudding', 'Jello', 'Yogurt', 'Cheese', 'Butter',
        'Bread', 'Rice', 'Noodles', 'Spaghetti', 'Macaroni', 'Lasagna', 'Ravioli', 'Risotto'
    ],
    'Countries': [
        'USA', 'Canada', 'Mexico', 'Brazil', 'UK', 'France', 'Germany', 'Italy',
        'Spain', 'Japan', 'China', 'India', 'Australia', 'Egypt', 'South Africa', 'Russia',
        'Argentina', 'Chile', 'Colombia', 'Peru', 'Venezuela', 'Cuba', 'Jamaica', 'Haiti',
        'South Korea', 'North Korea', 'Vietnam', 'Thailand', 'Indonesia', 'Malaysia', 'Philippines',
        'New Zealand', 'Nigeria', 'Kenya', 'Ethiopia', 'Morocco', 'Algeria', 'Turkey', 'Iran', 'Iraq',
        'Saudi Arabia', 'Israel', 'Greece', 'Sweden', 'Norway', 'Finland', 'Denmark', 'Ireland', 'Portugal', 'Poland'
    ],
    'Video Games': [
        'Mario', 'Zelda', 'Tetris', 'Minecraft', 'Pokemon', 'Halo', 'Call of Duty', 'GTA',
        'Fortnite', 'Roblox', 'Apex Legends', 'Overwatch', 'Valorant', 'League of Legends', 'Dota 2', 'CSGO',
        'Sonic', 'Final Fantasy', 'World of Warcraft', 'Skyrim', 'Fallout', 'Resident Evil', 'Silent Hill',
        'Street Fighter', 'Mortal Kombat', 'Smash Bros', 'Animal Crossing', 'Sims', 'Stardew Valley',
        'Terraria', 'Destiny', 'Gears of War', 'Tomb Raider', 'Uncharted', 'God of War', 'The Last of Us',
        'Red Dead Redemption', 'Cyberpunk', 'Witcher', 'Dark Souls', 'Elden Ring', 'Bloodborne'
    ]
};

function initRoom(roomId) {
    if (!rooms[roomId]) {
        rooms[roomId] = {
            id: roomId,
            players: [], // { id: socket.id, name: string, isHost: boolean, role: string, score: number, clue: string }
            state: 'LOBBY',
            gameMode: 'classic', // "classic", "blindfold", "rapid"
            categoryName: '',
            words: [],
            secretWordIndex: -1,
            dice: { d6: 1, d8: 1 },
            turnIndex: 0,
            votes: {}, // voterSocketId -> targetSocketId
            timerInterval: null,
            timeRemaining: 0,
            chameleonCaught: false,
            guessProcessed: false
        };
    }
}

function getRandomWords(pool, count) {
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

function getRoomState(room) {
    // Return sanitized room state to broadcast
    return {
        id: room.id,
        players: room.players.map(p => ({
            id: p.id,
            name: p.name,
            isHost: p.isHost,
            score: p.score,
            clue: p.clue,
            hasVoted: !!room.votes[p.id]
        })),
        state: room.state,
        gameMode: room.gameMode,
        // Hide category if blindfold mode and state is roles/clues/discuss logic is mostly frontend, 
        // but let's hide it backend too if someone intercepts socket.
        // Actually, we must tell Humans the category. So we tell everyone, but frontend hides it for chameleon.
        categoryName: room.categoryName, 
        words: room.words,
        turnIndex: room.turnIndex,
        timeRemaining: room.timeRemaining,
        votes: room.state === 'REVEAL' ? room.votes : {}, // Only show votes at reveal
        chameleonCaught: room.chameleonCaught
    };
}

// Ensure turn logic proceeds smoothly
function nextTurn(room) {
    room.turnIndex++;
    if (room.turnIndex >= room.players.length) {
        startVotingPhase(room);
    } else {
        io.to(room.id).emit('stateUpdate', getRoomState(room));
    }
}

function startVotingPhase(room) {
    room.state = 'DISCUSSION_AND_VOTING';
    room.timeRemaining = room.gameMode === 'rapid' ? 30 : 60;
    
    if (room.timerInterval) clearInterval(room.timerInterval);

    room.timerInterval = setInterval(() => {
        room.timeRemaining--;
        io.to(room.id).emit('timerUpdate', room.timeRemaining);
        if (room.timeRemaining <= 0) {
            clearInterval(room.timerInterval);
            evaluateVotes(room);
        }
    }, 1000);

    io.to(room.id).emit('stateUpdate', getRoomState(room));
}

function checkVotesAndEvaluate(room) {
    if (Object.keys(room.votes).length >= room.players.length) {
        if (room.timerInterval) clearInterval(room.timerInterval);
        evaluateVotes(room);
    } else {
        io.to(room.id).emit('stateUpdate', getRoomState(room));
    }
}

function evaluateVotes(room) {
    room.state = 'REVEAL';
    
    // Tally votes
    const voteCounts = {};
    for (let target of Object.values(room.votes)) {
        voteCounts[target] = (voteCounts[target] || 0) + 1;
    }

    // Find player with most votes
    let maxVotes = 0;
    let votedOutId = null;
    for (let [id, count] of Object.entries(voteCounts)) {
        if (count > maxVotes) {
            maxVotes = count;
            votedOutId = id;
        } else if (count === maxVotes) {
            votedOutId = null; // Tie
        }
    }

    const chameleon = room.players.find(p => p.role === 'chameleon');
    // Edge case: Chameleon disconnected before reveal
    if (!chameleon) {
        room.chameleonCaught = true;
        io.to(room.id).emit('stateUpdate', getRoomState(room));
        io.to(room.id).emit('revealResult', {
            chameleonId: null,
            caught: true,
            chameleonName: "Disconnected Chameleon"
        });
        setTimeout(() => applyScoring(room), 4000);
        return;
    }

    room.chameleonCaught = (votedOutId === chameleon.id);

    io.to(room.id).emit('stateUpdate', getRoomState(room));
    io.to(room.id).emit('revealResult', {
        chameleonId: chameleon.id,
        caught: room.chameleonCaught,
        chameleonName: chameleon.name
    });

    if (room.chameleonCaught) {
        io.to(chameleon.id).emit('requestChameleonGuess');
    } else {
        setTimeout(() => applyScoring(room), 5000);
    }
}

function applyScoring(room, chameleonGuessedCorrectly = false) {
    room.state = 'SCORING';
    
    room.players.forEach(p => {
        if (p.role === 'chameleon') {
            if (!room.chameleonCaught) {
                p.score += 2; // Escaped
            } else if (chameleonGuessedCorrectly) {
                p.score += 1; // Caught but guessed right
            }
        } else {
            if (room.chameleonCaught && !chameleonGuessedCorrectly) {
                p.score += 2; // Caught and didn't guess right
            } else if (room.chameleonCaught) {
                p.score += 1; // Caught but guessed it right (consolation for catching)
            }
        }
    });

    io.to(room.id).emit('stateUpdate', getRoomState(room));

    setTimeout(() => {
        if (room.state === 'SCORING') {
            room.state = 'LOBBY';
            room.categoryName = '';
            room.words = [];
            room.players.forEach(p => p.clue = null); // Reset clues
            io.to(room.id).emit('stateUpdate', getRoomState(room));
        }
    }, 8000);
}

io.on('connection', (socket) => {
    socket.on('joinRoom', ({ roomId, playerName }) => {
        initRoom(roomId);
        const room = rooms[roomId];
        
        let isHost = room.players.length === 0;
        room.players.push({
            id: socket.id,
            name: playerName,
            isHost: isHost,
            role: null,
            score: 0,
            clue: null
        });

        socket.join(roomId);
        io.to(roomId).emit('stateUpdate', getRoomState(room));
    });

    socket.on('changeGameMode', ({ roomId, mode }) => {
        const room = rooms[roomId];
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        if (player && player.isHost && room.state === 'LOBBY') {
            room.gameMode = mode;
            io.to(roomId).emit('stateUpdate', getRoomState(room));
        }
    });

    socket.on('startGame', (roomId) => {
        const room = rooms[roomId];
        if (!room || room.state !== 'LOBBY' || room.players.length < 3) return;

        // ROLE_ASSIGNMENT Phase
        room.state = 'ROLE_ASSIGNMENT';
        room.players.forEach(p => p.clue = null);
        room.votes = {};
        room.guessProcessed = false;

        // Select category and random 16 words
        const categoryNames = Object.keys(CATEGORIES);
        room.categoryName = categoryNames[Math.floor(Math.random() * categoryNames.length)];
        
        // Randomly pick 16 words
        room.words = getRandomWords(CATEGORIES[room.categoryName], 16);

        room.secretWordIndex = Math.floor(Math.random() * 16);
        
        // Random Coordinate (D6 and D8 visual flavor)
        room.dice.d6 = Math.floor(Math.random() * 6) + 1;
        room.dice.d8 = Math.floor(Math.random() * 8) + 1;

        // Select Chameleon
        const chameleonIndex = Math.floor(Math.random() * room.players.length);
        room.players.forEach((p, i) => {
            p.role = (i === chameleonIndex) ? 'chameleon' : 'human';
        });

        io.to(roomId).emit('stateUpdate', getRoomState(room));

        // Send private info
        room.players.forEach(p => {
            if (p.role === 'chameleon') {
                io.to(p.id).emit('privateInfo', { role: 'chameleon' });
            } else {
                io.to(p.id).emit('privateInfo', { 
                    role: 'human', 
                    secretWord: room.words[room.secretWordIndex],
                    dice: room.dice
                });
            }
        });

        // Auto transition to Clue Giving after 5-8 seconds to read roles
        const delay = room.gameMode === 'rapid' ? 5000 : 8000;
        setTimeout(() => {
            if (room.state === 'ROLE_ASSIGNMENT') {
                room.state = 'CLUE_GIVING';
                room.players.sort(() => Math.random() - 0.5);
                room.turnIndex = 0;
                io.to(roomId).emit('stateUpdate', getRoomState(room));
            }
        }, delay);
    });

    socket.on('submitClue', ({ roomId, clue }) => {
        const room = rooms[roomId];
        if (!room || room.state !== 'CLUE_GIVING') return;

        const currentPlayer = room.players[room.turnIndex];
        if (currentPlayer.id !== socket.id) return;

        currentPlayer.clue = clue.trim().split(' ')[0]; // Enforce 1 word
        nextTurn(room);
    });

    socket.on('submitVote', ({ roomId, targetId }) => {
        const room = rooms[roomId];
        if (!room || room.state !== 'DISCUSSION_AND_VOTING') return;

        room.votes[socket.id] = targetId;
        checkVotesAndEvaluate(room);
    });



    socket.on('chameleonGuess', ({ roomId, word }) => {
        const room = rooms[roomId];
        if (!room || room.state !== 'REVEAL' || !room.chameleonCaught || room.guessProcessed) return;

        room.guessProcessed = true; // Prevent double-clicks hitting the scoring multiple times!

        const isCorrect = (word === room.words[room.secretWordIndex]);
        io.to(roomId).emit('chameleonGuessResult', { word, isCorrect, secretWord: room.words[room.secretWordIndex] });
        
        // Rapid mode speeds up end sequence
        const delay = room.gameMode === 'rapid' ? 2500 : 4000;
        setTimeout(() => applyScoring(room, isCorrect), delay);
    });



    // Handles player disconnecting gracefully
    socket.on('disconnect', () => {
        for (let roomId in rooms) {
            let room = rooms[roomId];
            const pIndex = room.players.findIndex(p => p.id === socket.id);
            if (pIndex !== -1) {
                const wasCurrentTurn = (room.state === 'CLUE_GIVING' && room.turnIndex === pIndex);
                
                room.players.splice(pIndex, 1);

                if (room.players.length === 0) {
                    // Clean up timer if any
                    if (room.timerInterval) clearInterval(room.timerInterval);
                    delete rooms[roomId];
                } else {
                    // Reassign host if host left
                    if (!room.players.some(p => p.isHost)) {
                        room.players[0].isHost = true;
                    }

                    // Edge Case: Player leaves during Clue Giving
                    if (room.state === 'CLUE_GIVING') {
                        // If they were before current turn, shift turnIndex down to stay on the correct active player
                        if (pIndex < room.turnIndex) {
                            room.turnIndex--;
                        } 
                        // If it was THEIR turn, the turn index is now naturally pointing to the NEXT player
                        // However, we need to check if we just exceeded the array bounds
                        if (room.turnIndex >= room.players.length) {
                            startVotingPhase(room);
                        } else if (wasCurrentTurn) {
                            io.to(roomId).emit('stateUpdate', getRoomState(room));
                        } else {
                            io.to(roomId).emit('stateUpdate', getRoomState(room));
                        }
                    } 
                    // Edge Case: Player leaves during Voting
                    else if (room.state === 'DISCUSSION_AND_VOTING') {
                        delete room.votes[socket.id];
                        checkVotesAndEvaluate(room);
                    } 
                    else {
                        io.to(roomId).emit('stateUpdate', getRoomState(room));
                    }
                }
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
