import React, { useState, useEffect, useMemo } from 'react';
import { Share2, Users, Play, ShieldAlert, CheckCircle2, XCircle, Crown, EyeOff, RefreshCw } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, updateDoc, getDoc } from 'firebase/firestore';

// --- FIREBASE INITIALIZATION ---
// Rule 3: Auth Before Queries & Rule 1: Strict Paths
const firebaseConfig = {

  apiKey: "AIzaSyB9AgE1MQ6YK4TLnuqyBeHQk3SV2UkKN6I",

  authDomain: "chameleon-game-da38a.firebaseapp.com",

  projectId: "chameleon-game-da38a",

  storageBucket: "chameleon-game-da38a.firebasestorage.app",

  messagingSenderId: "577963272079",

  appId: "1:577963272079:web:de60a657b0ec7fc9504dfa",

  measurementId: "G-B6S9LJFQ4M"

};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'my-chameleon-game'; // You can name this whatever you want


// --- GAME DATA ---
const CATEGORIES = {
  "Animals": ["Dog", "Cat", "Elephant", "Lion", "Tiger", "Bear", "Wolf", "Fox", "Deer", "Monkey", "Zebra", "Giraffe", "Hippo", "Rhino", "Snake", "Crocodile"],
  "Vehicles": ["Car", "Bus", "Train", "Bicycle", "Motorcycle", "Airplane", "Helicopter", "Boat", "Ship", "Submarine", "Truck", "Van", "Scooter", "Skateboard", "Tractor", "Rocket"],
  "Food": ["Pizza", "Burger", "Sushi", "Pasta", "Salad", "Taco", "Sandwich", "Soup", "Steak", "Pancake", "Waffle", "Curry", "Omelet", "Noodles", "Rice", "Bread"],
  "Professions": ["Doctor", "Teacher", "Engineer", "Artist", "Chef", "Pilot", "Police", "Firefighter", "Farmer", "Musician", "Scientist", "Nurse", "Writer", "Actor", "Lawyer", "Astronaut"]
};

const SHAPES = ['star', 'hexagon', 'diamond', 'octagon', 'circle', 'square', 'triangle', 'pentagon'];
const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

// --- HELPERS ---
const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();
const getRandomInt = (max) => Math.floor(Math.random() * max);

// SVG Shape Generator
const Shape = ({ type, color, size = 64, className = "" }) => {
  const center = size / 2;
  const radius = size * 0.45;
  let points = "";

  if (type === 'star') {
    const numPoints = 5;
    const innerRadius = radius * 0.4;
    for (let i = 0; i < numPoints * 2; i++) {
      const r = i % 2 === 0 ? radius : innerRadius;
      const angle = (Math.PI * i) / numPoints - Math.PI / 2;
      points += `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)} `;
    }
    return <svg width={size} height={size} className={className}><polygon points={points.trim()} fill={color} stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" /></svg>;
  }
  
  if (type === 'circle') {
    return <svg width={size} height={size} className={className}><circle cx={center} cy={center} r={radius} fill={color} stroke="#ffffff" strokeWidth="2" /></svg>;
  }

  let numSides = 4;
  let rotation = 0;
  if (type === 'hexagon') numSides = 6;
  if (type === 'octagon') numSides = 8;
  if (type === 'triangle') numSides = 3;
  if (type === 'pentagon') numSides = 5;
  if (type === 'square') { numSides = 4; rotation = Math.PI / 4; }
  if (type === 'diamond') { numSides = 4; }

  for (let i = 0; i < numSides; i++) {
    const angle = rotation + (Math.PI * 2 * i) / numSides - Math.PI / 2;
    points += `${center + radius * Math.cos(angle)},${center + radius * Math.sin(angle)} `;
  }

  return <svg width={size} height={size} className={className}><polygon points={points.trim()} fill={color} stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" /></svg>;
};

// --- MAIN COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [joinError, setJoinError] = useState("");

  // 1. Initialize Auth (Rule 3)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Listen to Room Data
  useEffect(() => {
    if (!user || !roomCode) {
      setRoom(null);
      return;
    }
    
    // Path Rule 1
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    const unsubscribe = onSnapshot(roomRef, 
      (snapshot) => {
        if (snapshot.exists()) {
          setRoom({ id: snapshot.id, ...snapshot.data() });
        } else {
          setRoom(null);
          setJoinError("Room not found or disconnected.");
        }
      },
      (error) => console.error("Room listener error:", error)
    );

    return () => unsubscribe();
  }, [user, roomCode]);

  // --- ACTIONS ---
  const handleCreateRoom = async () => {
    if (!user || !playerName.trim()) return;
    const newCode = generateRoomCode();
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', newCode);
    
    const shape = SHAPES[0];
    const color = COLORS[0];

    await setDoc(roomRef, {
      status: 'LOBBY', // LOBBY, REVEAL, VOTING, GUESSING, OVER
      hostId: user.uid,
      players: [{ id: user.uid, name: playerName, shape, color }],
      category: "",
      secretWord: "",
      chameleonId: "",
      words: [],
      votes: {},
      eliminatedId: "",
      winner: "",
      createdAt: new Date().getTime()
    });

    setRoomCode(newCode);
  };

  const handleJoinRoom = async (codeToJoin) => {
    if (!user || !playerName.trim() || !codeToJoin) return;
    const code = codeToJoin.toUpperCase();
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', code);
    
    try {
      const snap = await getDoc(roomRef);
      if (!snap.exists()) {
        setJoinError("Room does not exist.");
        return;
      }
      
      const data = snap.data();
      if (data.status !== 'LOBBY') {
        setJoinError("Game already in progress.");
        return;
      }

      const existingPlayer = data.players.find(p => p.id === user.uid);
      if (!existingPlayer) {
        // Assign random unused shape/color
        const usedShapes = data.players.map(p => p.shape);
        const usedColors = data.players.map(p => p.color);
        const availShapes = SHAPES.filter(s => !usedShapes.includes(s));
        const availColors = COLORS.filter(c => !usedColors.includes(c));
        
        const shape = availShapes.length > 0 ? availShapes[getRandomInt(availShapes.length)] : SHAPES[getRandomInt(SHAPES.length)];
        const color = availColors.length > 0 ? availColors[getRandomInt(availColors.length)] : COLORS[getRandomInt(COLORS.length)];

        await updateDoc(roomRef, {
          players: [...data.players, { id: user.uid, name: playerName, shape, color }]
        });
      }
      setRoomCode(code);
      setJoinError("");
    } catch (err) {
      console.error(err);
      setJoinError("Error joining room.");
    }
  };

  const startGame = async () => {
    if (user.uid !== room.hostId) return;
    
    const catNames = Object.keys(CATEGORIES);
    const category = catNames[getRandomInt(catNames.length)];
    const words = CATEGORIES[category];
    const secretWord = words[getRandomInt(words.length)];
    const chameleonId = room.players[getRandomInt(room.players.length)].id;

    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id);
    await updateDoc(roomRef, {
      status: 'REVEAL',
      category,
      secretWord,
      words,
      chameleonId,
      votes: {},
      eliminatedId: "",
      winner: ""
    });
  };

  const proceedToVoting = async () => {
    if (user.uid !== room.hostId) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id);
    await updateDoc(roomRef, { status: 'VOTING' });
  };

  const castVote = async (targetId) => {
    if (room.status !== 'VOTING' || room.votes[user.uid]) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id);
    
    const newVotes = { ...room.votes, [user.uid]: targetId };
    await updateDoc(roomRef, { votes: newVotes });

    // Host checks if all votes are in to tally
    if (Object.keys(newVotes).length === room.players.length && user.uid === room.hostId) {
      const voteCounts = {};
      Object.values(newVotes).forEach(id => { voteCounts[id] = (voteCounts[id] || 0) + 1; });
      
      let maxVotes = 0;
      let eliminated = "";
      Object.entries(voteCounts).forEach(([id, count]) => {
        if (count > maxVotes) {
          maxVotes = count;
          eliminated = id;
        }
      });

      // Determine next phase based on who was eliminated
      if (eliminated === room.chameleonId) {
        await updateDoc(roomRef, { eliminatedId: eliminated, status: 'GUESSING' });
      } else {
        await updateDoc(roomRef, { eliminatedId: eliminated, status: 'OVER', winner: 'CHAMELEON' });
      }
    }
  };

  const submitChameleonGuess = async (guessedWord) => {
    if (user.uid !== room.chameleonId || room.status !== 'GUESSING') return;
    
    const isCorrect = guessedWord === room.secretWord;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id);
    await updateDoc(roomRef, { 
      status: 'OVER', 
      winner: isCorrect ? 'CHAMELEON' : 'CREWMATES' 
    });
  };

  const returnToLobby = async () => {
    if (user.uid !== room.hostId) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id);
    await updateDoc(roomRef, { status: 'LOBBY', votes: {}, eliminatedId: "", winner: "" });
  };

  // --- RENDERERS ---

  if (!user) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><div className="animate-pulse">Connecting to Global Servers...</div></div>;
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700">
          <h1 className="text-4xl font-black text-center mb-2 tracking-tight">
            <span className="text-red-500">CHAMELEON</span><span className="text-slate-300">.NET</span>
          </h1>
          <p className="text-center text-slate-400 mb-8 text-sm">Worldwide Multiplayer Node Setup</p>

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Your Alias</label>
              <input 
                type="text" 
                maxLength={12}
                placeholder="Enter Name..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
              />
            </div>
            
            <button 
              onClick={handleCreateRoom}
              disabled={!playerName.trim()}
              className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg flex justify-center items-center gap-2 transition-colors"
            >
              <Users size={20} /> Host New Room
            </button>

            <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-700"></div>
                <span className="flex-shrink-0 mx-4 text-slate-500 text-sm">OR</span>
                <div className="flex-grow border-t border-slate-700"></div>
            </div>

            <div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  maxLength={4}
                  placeholder="ROOM CODE"
                  className="w-2/3 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white uppercase focus:outline-none focus:border-blue-500 transition-colors text-center font-mono tracking-widest text-lg"
                  onChange={e => {
                    setJoinError("");
                    const val = e.target.value.toUpperCase();
                    if (val.length === 4) handleJoinRoom(val);
                  }}
                />
                <button 
                  onClick={() => handleJoinRoom(document.querySelector('input[placeholder="ROOM CODE"]').value)}
                  disabled={!playerName.trim()}
                  className="w-1/3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-colors"
                >
                  Join
                </button>
              </div>
              {joinError && <p className="text-red-400 text-sm mt-2 text-center">{joinError}</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isHost = user.uid === room.hostId;
  const me = room.players.find(p => p.id === user.uid) || {};

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center p-4 md:p-8 font-sans">
      
      {/* Header */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-8 bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div className="flex items-center gap-3">
          <Shape type={me.shape} color={me.color} size={32} />
          <span className="font-bold text-lg">{me.name}</span>
        </div>
        <div className="flex items-center gap-4 bg-slate-900 px-4 py-2 rounded-lg border border-slate-700">
          <span className="text-slate-400 text-sm uppercase tracking-wider font-bold">Room Code</span>
          <span className="text-2xl font-mono text-white tracking-widest">{room.id}</span>
        </div>
      </div>

      {/* --- PHASE: LOBBY --- */}
      {room.status === 'LOBBY' && (
        <div className="w-full max-w-4xl flex flex-col items-center">
          <h2 className="text-3xl font-black mb-8 text-center">WAITING FOR CREW...</h2>
          
          <div className="flex flex-wrap justify-center gap-6 mb-12">
            {room.players.map(p => (
              <div key={p.id} className="flex flex-col items-center animate-fade-in">
                <div className="relative mb-3">
                  <Shape type={p.shape} color={p.color} size={80} />
                  {p.id === room.hostId && (
                    <div className="absolute -top-3 -right-3 bg-amber-500 rounded-full p-1 border-2 border-slate-900">
                      <Crown size={16} className="text-slate-900" />
                    </div>
                  )}
                </div>
                <span className="font-semibold text-lg">{p.name}</span>
              </div>
            ))}
          </div>

          {isHost ? (
            <button 
              onClick={startGame}
              disabled={room.players.length < 3}
              className="bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xl font-bold py-4 px-12 rounded-full shadow-lg hover:shadow-green-500/20 transition-all flex items-center gap-3"
            >
              <Play fill="currentColor" /> {room.players.length < 3 ? "NEED 3+ PLAYERS" : "START MISSION"}
            </button>
          ) : (
            <div className="text-slate-400 flex items-center gap-2 animate-pulse">
              <RefreshCw className="animate-spin" size={20} /> Waiting for Host to start...
            </div>
          )}
        </div>
      )}

      {/* --- PHASE: REVEAL --- */}
      {room.status === 'REVEAL' && (
        <div className="w-full max-w-2xl flex flex-col items-center justify-center flex-grow text-center">
          <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 w-full shadow-2xl relative overflow-hidden">
            {/* Background Shape Accent */}
            <div className="absolute -right-10 -bottom-10 opacity-5 pointer-events-none">
              <Shape type={me.shape} color={me.color} size={300} />
            </div>

            <h3 className="text-xl text-slate-400 font-bold uppercase tracking-widest mb-2">Category</h3>
            <h2 className="text-4xl font-black mb-10 text-white">{room.category}</h2>

            <div className="my-8">
              {user.uid === room.chameleonId ? (
                <div className="animate-fade-in-up">
                  <ShieldAlert size={64} className="mx-auto text-red-500 mb-4" />
                  <h1 className="text-5xl font-black text-red-500 tracking-tighter mb-4">YOU ARE THE CHAMELEON</h1>
                  <p className="text-lg text-slate-300">Blend in. Don't get caught. Listen to the hints to figure out the secret word!</p>
                </div>
              ) : (
                <div className="animate-fade-in-up">
                  <CheckCircle2 size={64} className="mx-auto text-green-500 mb-4" />
                  <h1 className="text-5xl font-black text-green-500 tracking-tighter mb-4">CREWMATE</h1>
                  <p className="text-slate-400 mb-2 uppercase tracking-widest text-sm font-bold">The Secret Word is:</p>
                  <div className="text-6xl font-black text-white bg-slate-900 py-4 px-8 rounded-xl border border-slate-700 inline-block shadow-inner">
                    {room.secretWord}
                  </div>
                  <p className="mt-6 text-slate-400">Give a one-word hint out loud to prove you know it.</p>
                </div>
              )}
            </div>
          </div>
          
          {isHost && (
            <button 
              onClick={proceedToVoting}
              className="mt-8 bg-blue-600 hover:bg-blue-500 text-white text-lg font-bold py-4 px-10 rounded-full shadow-lg transition-all"
            >
              Everyone gave hints? Proceed to Voting
            </button>
          )}
          {!isHost && <p className="mt-8 text-slate-500">Discussing out loud... waiting for host.</p>}
        </div>
      )}

      {/* --- PHASE: VOTING (NODE NETWORK) --- */}
      {room.status === 'VOTING' && (
        <div className="w-full flex flex-col items-center justify-center flex-grow">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black tracking-tight text-white mb-2">ACCUSATION PROTOCOL</h2>
            <p className="text-slate-400">Who is the imposter? Tap a node to lock in your vote.</p>
            {room.votes[user.uid] && <p className="text-green-400 mt-2 font-bold flex items-center justify-center gap-2"><CheckCircle2 size={16}/> Vote locked in.</p>}
          </div>

          <div className="relative w-full max-w-3xl aspect-square max-h-[500px]">
             {/* Center Hub */}
             <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-slate-800 rounded-full border-4 border-slate-600 z-10 flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.5)]">
               <EyeOff className="text-slate-400" />
             </div>

             {/* Dynamic Nodes around circle */}
             {room.players.map((p, index) => {
               const angle = (index / room.players.length) * Math.PI * 2 - Math.PI / 2;
               const radius = 40; // percentage
               const top = `${50 + radius * Math.sin(angle)}%`;
               const left = `${50 + radius * Math.cos(angle)}%`;
               
               // Count votes for this player
               const voteCount = Object.values(room.votes).filter(id => id === p.id).length;
               const hasVotedMe = room.votes[user.uid] !== undefined;

               return (
                 <React.Fragment key={p.id}>
                    {/* SVG Line to center */}
                    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none -z-10">
                      <line 
                        x1="50%" y1="50%" 
                        x2={left} y2={top} 
                        stroke="#475569" strokeWidth="2" strokeDasharray="4 4" 
                        className={room.votes[user.uid] === p.id ? "stroke-red-500 animate-pulse" : ""}
                      />
                    </svg>
                    
                    {/* Player Node */}
                    <div 
                      className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-transform hover:scale-110 cursor-pointer ${hasVotedMe ? 'pointer-events-none' : ''}`}
                      style={{ top, left }}
                      onClick={() => castVote(p.id)}
                    >
                      <div className={`relative ${room.votes[user.uid] === p.id ? 'ring-4 ring-red-500 rounded-full' : ''}`}>
                        <Shape type={p.shape} color={p.color} size={70} />
                        {voteCount > 0 && (
                          <div className="absolute -top-2 -right-2 bg-red-600 text-white font-bold rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-lg">
                            {voteCount}
                          </div>
                        )}
                      </div>
                      <span className="mt-2 font-bold bg-slate-900/80 px-2 py-1 rounded text-sm whitespace-nowrap">{p.name}</span>
                    </div>
                 </React.Fragment>
               );
             })}
          </div>

          <div className="mt-8 text-slate-500">
            Votes cast: {Object.keys(room.votes).length} / {room.players.length}
          </div>
        </div>
      )}

      {/* --- PHASE: GUESSING --- */}
      {room.status === 'GUESSING' && (
        <div className="w-full max-w-4xl flex flex-col items-center text-center">
          <ShieldAlert size={48} className="text-red-500 mb-4 animate-bounce" />
          <h2 className="text-3xl font-black mb-2 text-white">THE CHAMELEON WAS CAUGHT!</h2>
          <p className="text-slate-400 mb-8 text-lg">
            Player <span className="font-bold text-red-400">{room.players.find(p=>p.id===room.eliminatedId)?.name}</span> has one last chance to guess the secret word.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
            {room.words.map(word => (
              <button
                key={word}
                disabled={user.uid !== room.chameleonId}
                onClick={() => submitChameleonGuess(word)}
                className={`p-4 rounded-xl font-bold text-lg transition-all ${
                  user.uid === room.chameleonId 
                    ? 'bg-slate-800 hover:bg-blue-600 text-white border border-slate-600 hover:border-blue-400 cursor-pointer shadow-lg' 
                    : 'bg-slate-800/50 text-slate-500 border border-slate-700 cursor-not-allowed'
                }`}
              >
                {word}
              </button>
            ))}
          </div>
          {user.uid !== room.chameleonId && <p className="mt-8 text-slate-400 animate-pulse">Waiting for the Chameleon to guess...</p>}
        </div>
      )}

      {/* --- PHASE: GAME OVER --- */}
      {room.status === 'OVER' && (
        <div className="w-full max-w-2xl flex flex-col items-center justify-center flex-grow text-center">
          {room.winner === 'CHAMELEON' ? (
            <div className="animate-fade-in-up">
              <ShieldAlert size={80} className="mx-auto text-red-500 mb-6" />
              <h1 className="text-6xl font-black text-red-500 mb-4 tracking-tighter">CHAMELEON WINS!</h1>
              <p className="text-xl text-slate-300">
                {room.eliminatedId !== room.chameleonId 
                  ? "Crewmates voted for the wrong person." 
                  : `The secret word was ${room.secretWord}, and they guessed it!`}
              </p>
            </div>
          ) : (
            <div className="animate-fade-in-up">
              <CheckCircle2 size={80} className="mx-auto text-green-500 mb-6" />
              <h1 className="text-6xl font-black text-green-500 mb-4 tracking-tighter">CREWMATES WIN!</h1>
              <p className="text-xl text-slate-300">The Chameleon was caught and failed to guess the secret word: <strong>{room.secretWord}</strong></p>
            </div>
          )}

          <div className="mt-12 p-6 bg-slate-800 rounded-2xl border border-slate-700 w-full">
            <h3 className="text-slate-400 font-bold mb-4 uppercase tracking-wider">The Imposter Was:</h3>
            <div className="flex items-center justify-center gap-4">
               {(() => {
                 const cham = room.players.find(p => p.id === room.chameleonId);
                 return cham ? (
                   <>
                    <Shape type={cham.shape} color={cham.color} size={48} />
                    <span className="text-2xl font-bold text-white">{cham.name}</span>
                   </>
                 ) : null;
               })()}
            </div>
          </div>

          {isHost && (
            <button 
              onClick={returnToLobby}
              className="mt-10 bg-slate-700 hover:bg-slate-600 text-white text-lg font-bold py-4 px-10 rounded-full shadow-lg transition-all"
            >
              Play Again (Return to Lobby)
            </button>
          )}
          {!isHost && <p className="mt-10 text-slate-500">Waiting for host to restart...</p>}
        </div>
      )}

      {/* Global CSS injected for animations */}
      <style dangerouslySetInnerHTML={{__html:`
        @keyframes fade-in-up {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.5s ease-out forwards; }
        @keyframes fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
      `}} />
    </div>
  );
}
