const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const passport = require('./config/passport'); // Assuming this path is correct
const connectDB = require('./config/db');     // Assuming this path is correct
const Session = require('./models/Session');  // Assuming this path is correct
const User = require('./models/User');        // Assuming you have a User model for user details

// Load env vars
require('dotenv').config();

// --- MongoDB Session Operations with Retries ---
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function createOrUpdateMongoSession(sessionId, sessionData, hostUserId) {
    let retries = 0;
    while (retries < MAX_RETRIES) {
        try {
            let sessionDoc = await Session.findOne({ sessionId });
            if (sessionDoc) {
                // Only update fields that exist in sessionData (non-song related)
                if (sessionData.participants) sessionDoc.participants = sessionData.participants;
                if (sessionData.drawingPermissions) sessionDoc.drawingPermissions = sessionData.drawingPermissions;
                if (sessionData.messages) sessionDoc.messages = sessionData.messages;
                if (sessionData.whiteboardStrokes) sessionDoc.whiteboardStrokes = sessionData.whiteboardStrokes;
                if (sessionData.polls) sessionDoc.polls = sessionData.polls;
                sessionDoc.name = sessionData.name || sessionDoc.name;
                sessionDoc.isPrivate = typeof sessionData.isPrivate === 'boolean' ? sessionData.isPrivate : sessionDoc.isPrivate; // Update isPrivate
                sessionDoc.sessionKey = sessionData.sessionKey || sessionDoc.sessionKey; // Update sessionKey

                await sessionDoc.save();
                return sessionDoc;
            } else {
                // Create new session if not found
                return await Session.create({
                    ...sessionData,
                    sessionId,
                    host: hostUserId,
                    participants: hostUserId ? [hostUserId] : [], // Initialize with host if provided
                    drawingPermissions: hostUserId ? { [hostUserId]: true } : {}, // Host gets drawing permission
                    // isPrivate and sessionKey are now part of sessionData coming from frontend
                });
            }
        } catch (error) {
            console.error(`MongoDB create/update attempt ${retries + 1} failed for session ${sessionId}:`, error);
            retries++;
            if (retries === MAX_RETRIES) throw error;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
    }
}

async function getMongoSession(sessionId) {
    let retries = 0;
    while (retries < MAX_RETRIES) {
        try {
            // Populate 'host' and 'participants' to get user names
            return await Session.findOne({ sessionId })
                .populate('host', 'name') // Populate host name
                .populate('participants', 'name'); // Populate participants' names
        } catch (error) {
            console.error(`MongoDB get attempt ${retries + 1} failed for session ${sessionId}:`, error);
            retries++;
            if (retries === MAX_RETRIES) throw error;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
    }
}

async function updateSessionInMongoDB(sessionId, updateData) {
    let retries = 0;
    while (retries < MAX_RETRIES) {
        try {
            await Session.findOneAndUpdate(
                { sessionId },
                { $set: updateData },
                { new: true, upsert: false }
            );
            return true;
        } catch (error) {
            console.error(`MongoDB update attempt ${retries + 1} failed for session ${sessionId}:`, error);
            retries++;
            if (retries === MAX_RETRIES) throw error;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
    }
}

async function addParticipantToMongoSession(sessionId, userId) {
    let retries = 0;
    while(retries < MAX_RETRIES) {
        try {
            const sessionDoc = await Session.findOne({ sessionId });
            if (sessionDoc && !sessionDoc.participants.includes(userId)) {
                sessionDoc.participants.push(userId);
                await sessionDoc.save();
                return true;
            }
            return false;
        } catch (error) {
            console.error(`MongoDB add participant attempt ${retries + 1} failed for session ${sessionId}, user ${userId}:`, error);
            retries++;
            if (retries === MAX_RETRIES) throw error;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
    }
    return false;
}

async function removeParticipantFromMongoSession(sessionId, userId) {
    let retries = 0;
    while(retries < MAX_RETRIES) {
        try {
            const sessionDoc = await Session.findOne({ sessionId });
            if (sessionDoc) {
                sessionDoc.participants = sessionDoc.participants.filter(id => id.toString() !== userId.toString());
                if (sessionDoc.drawingPermissions) {
                    delete sessionDoc.drawingPermissions[userId];
                }
                await sessionDoc.save();
                return true;
            }
            return false;
        } catch (error) {
            console.error(`MongoDB remove participant attempt ${retries + 1} failed for session ${sessionId}, user ${userId}:`, error);
            retries++;
            if (retries === MAX_RETRIES) throw error;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
    }
    return false;
}


async function deleteMongoSession(sessionId) {
    let retries = 0;
    while (retries < MAX_RETRIES) {
        try {
            const sessionDoc = await Session.findOne({ sessionId });
            if (!sessionDoc) return false;

            await Session.deleteOne({ sessionId });
            console.log(`MongoDB session ${sessionId} deleted`); // Updated log
            return true;
        } catch (error) {
            console.error(`MongoDB delete attempt ${retries + 1} failed to delete session ${sessionId}:`, error);
            retries++;
            if (retries === MAX_RETRIES) throw error;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
    }
}

// Clean up empty sessions on server start
async function cleanupEmptySessions() {
    try {
        console.log('🧹 Checking for empty sessions to clean up...');
        const allSessions = await Session.find({});
        let cleanedCount = 0;

        for (const sessionDoc of allSessions) {
            if (!sessionDoc.participants || sessionDoc.participants.length === 0) {
                await Session.deleteOne({ _id: sessionDoc._id });
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            console.log(`🗑️ Cleaned up ${cleanedCount} empty sessions`);
        } else {
            console.log('✨ No empty sessions found to clean up');
        }
    } catch (error) {
        console.error('Error cleaning up empty sessions:', error);
    }
}

// Import routes
const authRoutes = require('./routes/authRoutes');
const sessionRoutes = require('./routes/sessionRoutes');

const app = express();
const server = http.createServer(app);

// Essential middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'https://collaborative-white-board-rose.vercel.app'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors({
  origin: 'https://collaborative-white-board-rose.vercel.app',
  credentials: true
}));

app.use(express.json());

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Session middleware (for Google OAuth)
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'your-secret-key',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
    })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Connect to database
connectDB();

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);

// Serve static files from the React app
if (process.env.NODE_ENV === 'production') {
    const staticPath = path.resolve(__dirname, '../frontend/build');
    app.use(express.static(staticPath));
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, '../frontend/build', 'index.html'));
    });
} else {
    app.get('/', (req, res) => {
        res.send('SyncWave API is running (Whiteboard Only)'); // Updated message
    });
}

// --- Socket.io Setup ---
const socketIoServer = new Server(server, {
    cors: corsOptions,
    pingTimeout: 60000, // Added for better disconnect detection
    pingInterval: 25000  // Added for better disconnect detection
});

// Store active sessions data in memory for real-time operations
// Key: sessionId, Value: { name, host, participants: Set<userId>, whiteboardStrokes: [], messages: [], polls: [], drawingPermissions: {}, isPrivate: boolean, sessionKey: string }
const activeSessionsInMemory = new Map();
// Map socket ID to userId and sessionId for disconnect handling
const socketIdToSessionInfo = new Map(); // { socketId: { userId, sessionId } }
// Map userId to active socket for that user (to handle multiple tabs/reconnects)
const activeUserSockets = new Map(); // { userId: socket }

// NEW: Store pending join requests for private sessions
// Key: sessionId, Value: Map<joiningUserId, { username, socketId }>
const pendingJoinRequests = new Map();

// Session cleanup delay (5 minutes)
const SESSION_CLEANUP_DELAY = 5 * 60 * 1000;
const sessionDeletionTimeouts = new Map(); // Track deletion timeouts

// Helper function to cancel pending session deletion
const cancelSessionDeletion = (sessionId) => {
    const timeoutId = sessionDeletionTimeouts.get(sessionId);
    if (timeoutId) {
        clearTimeout(timeoutId);
        sessionDeletionTimeouts.delete(sessionId);
        console.log(`[CLEANUP] Cancelled pending deletion for session ${sessionId}`);
    }
};

// Helper to get detailed participant list with names for session-state
async function getDetailedParticipants(sessionId) {
    const sessionDoc = await getMongoSession(sessionId);
    if (!sessionDoc || !sessionDoc.participants || sessionDoc.participants.length === 0) {
        return [];
    }

    return sessionDoc.participants.map(p => ({
        id: p._id.toString(),
        name: p.name, // Assuming 'name' is populated
    }));
}

// Socket.io connection handling
socketIoServer.on('connection', (socket) => {
    // Extract userId and username from handshake (ensure your frontend sends these in query)
    const userId = socket.handshake.query.userId;
    const username = socket.handshake.query.username;
    console.log(`[CONNECT] New client connected: ${socket.id} (User: ${username || 'N/A'}, ID: ${userId || 'N/A'})`);

    // If this user already has an active socket, disconnect the old one
    // This handles cases where a user reloads the page or opens a new tab.
    if (userId && activeUserSockets.has(userId)) {
        const oldSocket = activeUserSockets.get(userId);
        console.log(`[RECONNECT] Disconnecting old socket ${oldSocket.id} for user ${userId}`);
        const oldSessionInfo = socketIdToSessionInfo.get(oldSocket.id);
        if (oldSessionInfo) {
            const { sessionId: oldSessionId } = oldSessionInfo;
            if (activeSessionsInMemory.has(oldSessionId)) {
                const sessionState = activeSessionsInMemory.get(oldSessionId);
                // Only remove participant from in-memory set if there are no other active sockets for this user in this session
                const existingSocketsForUserInSession = Array.from(socketIoServer.sockets.sockets.values())
                    .filter(s => {
                        const info = socketIdToSessionInfo.get(s.id);
                        return info && info.sessionId === oldSessionId && info.userId === userId && s.id !== oldSocket.id;
                    });

                if (existingSocketsForUserInSession.length === 0) {
                    sessionState.participants.delete(userId);
                    console.log(`[RECONNECT] User ${userId} removed from in-memory session ${oldSessionId} due to reconnect.`);
                    socketIoServer.to(oldSessionId).emit('user-left', {
                        userId,
                        participantCount: sessionState.participants.size
                    });
                }
            }
            socketIdToSessionInfo.delete(oldSocket.id);
        }
        oldSocket.disconnect(true);
    }
    if (userId) {
        activeUserSockets.set(userId, socket);
    }

    // Handle session joining
    socket.on('join-session', async (data) => {
        const { sessionId, userId: joiningUserId, username: joiningUsername, sessionName, isPrivate, sessionKey } = data;

        socketIdToSessionInfo.set(socket.id, { userId: joiningUserId, sessionId });

        console.log(`[JOIN] User ${joiningUsername} (${joiningUserId}) attempting to join session: ${sessionId}. Private: ${isPrivate}, Key: ${sessionKey ? 'Provided' : 'N/A'}`);

        let mongoSession;
        try {
            mongoSession = await getMongoSession(sessionId);
        } catch (error) {
            console.error(`[ERROR] Failed to fetch MongoDB session ${sessionId} on join:`, error);
            socket.emit('join-failed', { message: 'Error fetching session data.' });
            return;
        }

        // --- Session Creation or Validation Logic ---
        if (!mongoSession) {
            // Session not found, attempt to create it if sessionName is provided (only from creator's initial join)
            if (sessionName) {
                try {
                    const newSessionData = {
                        name: sessionName,
                        messages: [], polls: [], whiteboardStrokes: [], drawingPermissions: {},
                        isPrivate: isPrivate || false, // Set privacy status
                        sessionKey: isPrivate ? sessionKey : undefined, // Store key only if private
                    };
                    mongoSession = await createOrUpdateMongoSession(sessionId, newSessionData, joiningUserId);
                    console.log(`[JOIN_AUTO_CREATE] Auto-created session ${sessionId} for ${joiningUsername}. Private: ${mongoSession.isPrivate}`);
                } catch (autoCreateError) {
                    console.error(`[ERROR] Auto-creation failed for session ${sessionId}:`, autoCreateError);
                    socket.emit('join-failed', { message: 'Failed to create session on join.' });
                    return;
                }
            } else {
                // Session not found and no name for auto-creation (e.g., direct link join without initial setup)
                console.log(`[JOIN_FAIL] Session not found: "${sessionId}" and no name for auto-creation.`);
                socket.emit('session-not-found', { sessionId });
                return;
            }
        }

        // Session found or newly created, proceed with privacy and approval checks
        if (mongoSession.isPrivate) {
            if (!sessionKey || mongoSession.sessionKey !== sessionKey) {
                console.warn(`[SECURITY] User ${joiningUserId} failed to join private session ${sessionId}: Incorrect or missing key.`);
                socket.emit('join-failed', { message: 'This is a private session. Invalid or missing session key.' });
                return;
            }
            // If key is correct, but it's a private session, request approval from owner
            console.log(`[APPROVAL_REQUEST] User ${joiningUsername} (${joiningUserId}) requesting to join private session ${sessionId}. Awaiting owner approval.`);
            
            // Add user to pending requests
            if (!pendingJoinRequests.has(sessionId)) {
                pendingJoinRequests.set(sessionId, new Map());
            }
            pendingJoinRequests.get(sessionId).set(joiningUserId, { username: joiningUsername, socketId: socket.id });

            // Notify the owner(s)
            const ownerId = mongoSession.host.toString();
            const ownerSocket = activeUserSockets.get(ownerId); // Get the owner's active socket
            if (ownerSocket) {
                ownerSocket.emit('new-join-request', {
                    sessionId,
                    requesterId: joiningUserId,
                    requesterName: joiningUsername,
                    socketId: socket.id // Pass the joining user's socket ID for direct response
                });
                console.log(`[APPROVAL_NOTIFY] Notified owner ${ownerId} of join request from ${joiningUsername}.`);
            } else {
                console.warn(`[APPROVAL_WARN] Owner ${ownerId} of session ${sessionId} is offline. Join request from ${joiningUsername} cannot be processed.`);
                socket.emit('join-failed', { message: 'Session owner is offline. Cannot join private session at this time.' });
                // Clean up pending request if owner is offline and we decide not to queue it
                if (pendingJoinRequests.has(sessionId)) {
                    pendingJoinRequests.get(sessionId).delete(joiningUserId);
                    if (pendingJoinRequests.get(sessionId).size === 0) {
                        pendingJoinRequests.delete(sessionId);
                    }
                }
                return;
            }

            // Emit a special status to the joining client so they know they are waiting
            socket.emit('join-awaiting-approval', { sessionId, sessionName: mongoSession.name });
            return; // IMPORTANT: Do not proceed to join the room yet
        } else {
            console.log(`[JOIN_SUCCESS] User ${joiningUserId} joined public session ${sessionId}.`);
        }

        // --- Continue with existing join logic for approved or public sessions ---
        // Load/initialize in-memory session data from MongoDB
        if (!activeSessionsInMemory.has(sessionId)) {
            activeSessionsInMemory.set(sessionId, {
                name: mongoSession.name,
                host: mongoSession.host.toString(),
                ownerId: mongoSession.host.toString(),
                participants: new Set(), // Will add current participants below
                messages: mongoSession.messages || [],
                polls: mongoSession.polls || [],
                whiteboardStrokes: mongoSession.whiteboardStrokes || [],
                drawingPermissions: mongoSession.drawingPermissions || {},
                isPrivate: mongoSession.isPrivate,      // Load privacy status
                sessionKey: mongoSession.sessionKey,    // Load session key
            });
            console.log(`[INIT_MEMORY] Initialized in-memory state for session ${sessionId}`);
        }
        const sessionState = activeSessionsInMemory.get(sessionId);

        // Add all existing participants from DB to in-memory set (important for count)
        if (mongoSession.participants) {
            mongoSession.participants.forEach(p => sessionState.participants.add(p._id.toString()));
        }

        const isNewParticipant = !sessionState.participants.has(joiningUserId);
        if (isNewParticipant) {
            sessionState.participants.add(joiningUserId);
            await addParticipantToMongoSession(sessionId, joiningUserId);
            console.log(`[ADD_PARTICIPANT] User ${joiningUsername} added to session ${sessionId} in-memory and DB.`);
        }

        // Ensure drawing permissions are set for new participants
        // MODIFIED LOGIC HERE: To implement "all people can draw" by default in public rooms
        if (sessionState.drawingPermissions[joiningUserId] === undefined) { // Check if permission is unset for this user
            if (mongoSession.isPrivate) {
                // For private sessions, default non-owners to false
                if (joiningUserId !== sessionState.ownerId) {
                    sessionState.drawingPermissions[joiningUserId] = false;
                } else {
                    sessionState.drawingPermissions[joiningUserId] = true; // Owner always has drawing in private too
                }
            } else {
                // For public sessions, default ALL to true for drawing
                sessionState.drawingPermissions[joiningUserId] = true;
            }
            await updateSessionInMongoDB(sessionId, { drawingPermissions: sessionState.drawingPermissions });
        }


        socket.join(sessionId);
        console.log(`[ROOM_JOIN] User ${joiningUsername} joined room: ${sessionId}`);

        const detailedParticipants = await getDetailedParticipants(sessionId);
        socket.emit('session-state', {
            sessionName: sessionState.name,
            messages: sessionState.messages,
            polls: sessionState.polls,
            participantCount: sessionState.participants.size,
            participants: detailedParticipants,
            whiteboardStrokes: sessionState.whiteboardStrokes,
            ownerId: sessionState.ownerId,
            drawingPermissions: sessionState.drawingPermissions,
            isPrivate: sessionState.isPrivate, // Send privacy status to frontend
            timestamp: Date.now(),
            serverTime: Date.now(),
        });
        console.log(`[EMIT] Sent session-state to ${joiningUsername} in ${sessionId}`);

        if (isNewParticipant) {
            socket.to(sessionId).emit('user-joined', {
                userId: joiningUserId,
                username: joiningUsername,
                participantCount: sessionState.participants.size
            });
            console.log(`[BROADCAST] Broadcast user-joined for ${joiningUsername} in ${sessionId}`);
        }
    });

    // NEW: Handle owner approving a join request
    socket.on('approve-join-request', async ({ sessionId, requesterId, requesterSocketId }) => {
        const requestingUserId = socketIdToSessionInfo.get(socket.id)?.userId;
        const sessionState = activeSessionsInMemory.get(sessionId);

        // 1. Verify owner
        if (!sessionState || sessionState.ownerId !== requestingUserId) {
            console.warn(`[SECURITY] User ${requestingUserId} attempted to approve join request without being owner.`);
            return;
        }

        // 2. Check if the request is pending
        const sessionPendingRequests = pendingJoinRequests.get(sessionId);
        const requesterInfo = sessionPendingRequests?.get(requesterId);

        if (!requesterInfo) {
            console.warn(`[APPROVAL_WARN] No pending request found for user ${requesterId} in session ${sessionId}.`);
            return;
        }

        // 3. Remove from pending and add to active participants
        sessionPendingRequests.delete(requesterId);
        if (sessionPendingRequests.size === 0) {
            pendingJoinRequests.delete(sessionId);
        }

        // Find the actual socket of the requester (could be different if they reconnected)
        const requesterSocket = socketIoServer.sockets.sockets.get(requesterSocketId);

        if (!requesterSocket) {
            console.warn(`[APPROVAL_WARN] Requester socket ${requesterSocketId} not found for user ${requesterId}. Cannot approve.`);
            return;
        }

        const isNewParticipant = !sessionState.participants.has(requesterId);
        if (isNewParticipant) {
            sessionState.participants.add(requesterId);
            await addParticipantToMongoSession(sessionId, requesterId);
            console.log(`[APPROVAL_SUCCESS] User ${requesterInfo.username} (${requesterId}) approved and added to session ${sessionId}.`);
        }

        // Ensure drawing permissions are set for newly approved participants
        // For private rooms, newly approved non-owners will still default to false unless explicitly granted later by owner.
        // For public rooms, this path should ideally not be taken as they'd join directly.
        if (sessionState.drawingPermissions[requesterId] === undefined && requesterId !== sessionState.ownerId) {
            sessionState.drawingPermissions[requesterId] = false; // Default to false for non-owners in private rooms
            await updateSessionInMongoDB(sessionId, { drawingPermissions: sessionState.drawingPermissions });
        } else if (sessionState.drawingPermissions[requesterId] === undefined && requesterId === sessionState.ownerId) {
             sessionState.drawingPermissions[requesterId] = true; // Owner always has permission
             await updateSessionInMongoDB(sessionId, { drawingPermissions: sessionState.drawingPermissions });
        }


        // 4. Join the requester's socket to the room and send session state
        requesterSocket.join(sessionId);
        const detailedParticipants = await getDetailedParticipants(sessionId);
        requesterSocket.emit('session-state', {
            sessionName: sessionState.name,
            messages: sessionState.messages,
            polls: sessionState.polls,
            participantCount: sessionState.participants.size,
            participants: detailedParticipants,
            whiteboardStrokes: sessionState.whiteboardStrokes,
            ownerId: sessionState.ownerId,
            drawingPermissions: sessionState.drawingPermissions,
            isPrivate: sessionState.isPrivate,
            timestamp: Date.now(),
            serverTime: Date.now(),
        });
        requesterSocket.emit('join-approved', { sessionId, sessionName: sessionState.name }); // Inform the client directly

        // 5. Broadcast user-joined to existing participants
        socketIoServer.to(sessionId).emit('user-joined', {
            userId: requesterId,
            username: requesterInfo.username,
            participantCount: sessionState.participants.size
        });
        console.log(`[BROADCAST] Broadcast user-joined for approved user ${requesterInfo.username} in ${sessionId}.`);
    });

    // NEW: Handle owner rejecting a join request
    socket.on('reject-join-request', async ({ sessionId, requesterId, requesterSocketId }) => {
        const requestingUserId = socketIdToSessionInfo.get(socket.id)?.userId;
        const sessionState = activeSessionsInMemory.get(sessionId);

        // 1. Verify owner
        if (!sessionState || sessionState.ownerId !== requestingUserId) {
            console.warn(`[SECURITY] User ${requestingUserId} attempted to reject join request without being owner.`);
            return;
        }

        // 2. Check if the request is pending
        const sessionPendingRequests = pendingJoinRequests.get(sessionId);
        const requesterInfo = sessionPendingRequests?.get(requesterId);

        if (!requesterInfo) {
            console.warn(`[APPROVAL_WARN] No pending request found for user ${requesterId} in session ${sessionId}. Cannot reject.`);
            return;
        }

        // 3. Remove from pending
        sessionPendingRequests.delete(requesterId);
        if (sessionPendingRequests.size === 0) {
            pendingJoinRequests.delete(sessionId);
        }

        // Find the actual socket of the requester
        const requesterSocket = socketIoServer.sockets.sockets.get(requesterSocketId);
        if (requesterSocket) {
            requesterSocket.emit('join-rejected', { sessionId, message: 'Your request to join was rejected by the owner.' });
            console.log(`[APPROVAL_REJECTED] User ${requesterInfo.username} (${requesterId}) rejected from session ${sessionId}.`);
        } else {
            console.warn(`[APPROVAL_WARN] Requester socket ${requesterSocketId} not found for user ${requesterId}. Cannot inform of rejection.`);
        }
    });


    // NEW: Handle owner kicking a participant
socket.on('kick-participant', async ({ sessionId, targetUserId }) => {
    const requestingUserId = socketIdToSessionInfo.get(socket.id)?.userId;
    const sessionState = activeSessionsInMemory.get(sessionId);

    // 1. Verify sender is the owner
    if (!sessionState || sessionState.ownerId !== requestingUserId) {
        console.warn(`[SECURITY] User ${requestingUserId} attempted to kick ${targetUserId} without being owner in session ${sessionId}.`);
        return;
    }

    // 2. Ensure target user is not the owner themselves
    if (targetUserId === sessionState.ownerId) {
        console.warn(`[SECURITY] Owner ${requestingUserId} attempted to kick themselves from session ${sessionId}.`);
        socket.emit('kick-failed', { message: 'You cannot kick yourself (the session owner).' });
        return;
    }

    // 3. Remove participant from in-memory and database
    if (sessionState.participants.has(targetUserId)) {
        sessionState.participants.delete(targetUserId);
        await removeParticipantFromMongoSession(sessionId, targetUserId);
        console.log(`[KICK] User ${targetUserId} kicked from session ${sessionId}.`);

        // Check if the kicked user was the owner, and if so, assign a new one
        let newOwnerId = sessionState.ownerId; // Default to current owner
        if (sessionState.ownerId === targetUserId && sessionState.participants.size > 0) {
            newOwnerId = sessionState.participants.values().next().value; // Assign first available participant
            sessionState.ownerId = newOwnerId;
            sessionState.drawingPermissions[newOwnerId] = true; // Ensure new owner has drawing perms
            await updateSessionInMongoDB(sessionId, {
                host: newOwnerId, // Update host in DB
                ownerId: newOwnerId,
                drawingPermissions: sessionState.drawingPermissions
            });
            console.log(`[OWNER_CHANGE] Session ${sessionId}: New owner assigned after kick: ${newOwnerId}`);
        }

        // 4. Disconnect all sockets of the kicked user from this session's room
        const socketsToKick = Array.from(socketIoServer.sockets.sockets.values())
            .filter(s => {
                const info = socketIdToSessionInfo.get(s.id);
                return info && info.sessionId === sessionId && info.userId === targetUserId;
            });

        socketsToKick.forEach(s => {
            s.leave(sessionId);
            s.emit('you-were-kicked', { sessionId, message: 'You have been kicked from the session by the owner.' });
            // Optional: Disconnect the socket entirely if desired, or just make them leave the room.
            // s.disconnect(true); // This would disconnect them from the whole server
        });

        // 5. Broadcast user-left to remaining participants
        const currentCount = sessionState.participants.size;
        socketIoServer.to(sessionId).emit('user-left', {
            userId: targetUserId,
            participantCount: currentCount,
            newOwnerId: newOwnerId // Include new owner ID in broadcast for frontend update
        });
        console.log(`[BROADCAST] Broadcast user-left for kicked user ${targetUserId} in ${sessionId}.`);

        // 6. Manage session cleanup if it becomes empty
        if (currentCount === 0) {
            console.log(`[CLEANUP] Scheduling deletion for empty session ${sessionId} after kick in ${SESSION_CLEANUP_DELAY / 1000} seconds`);
            const timeoutId = setTimeout(async () => {
                const currentSessionInMem = activeSessionsInMemory.get(sessionId);
                const currentParticipantsCount = currentSessionInMem?.participants.size || 0;
                if (currentParticipantsCount === 0) {
                    console.log(`[CLEANUP] Removing empty session ${sessionId} after timeout (kick cleanup)`);
                    activeSessionsInMemory.delete(sessionId);
                    sessionDeletionTimeouts.delete(sessionId);
                    try {
                        await deleteMongoSession(sessionId);
                    } catch (error) {
                        console.error(`[ERROR] Error deleting MongoDB session ${sessionId} during cleanup:`, error);
                    }
                }
            }, SESSION_CLEANUP_DELAY);
            sessionDeletionTimeouts.set(sessionId, timeoutId);
        } else {
            // If participants remain, cancel any pending deletion (in case it was set earlier)
            cancelSessionDeletion(sessionId);
        }
    } else {
        console.warn(`[KICK_WARN] User ${targetUserId} not found in session ${sessionId}. Cannot kick.`);
        socket.emit('kick-failed', { message: 'Participant not found in this session.' });
    }
});


    // --- WHITEBOARD SYNCHRONIZATION HANDLERS ---
    socket.on('whiteboard-point', async (data) => {
        const { sessionId, userId, points, color, size, tool, shape, isEnd, text_content } = data; // Added text_content
        const sessionState = activeSessionsInMemory.get(sessionId);

        if (!sessionState) {
            console.warn(`[WHITEBOARD_WARN] Session ${sessionId} not found for whiteboard-point from ${userId}.`);
            return;
        }

        // Security check for drawing permissions
        if (sessionState.ownerId !== userId && !sessionState.drawingPermissions[userId]) {
            console.warn(`[SECURITY] User ${userId} attempted to draw without permission in session ${sessionId}.`);
            return;
        }

        socket.to(sessionId).emit('whiteboard-point', {
            userId,
            points,
            color,
            size,
            tool,
            shape,
            text_content, // Pass text_content
            isEnd
        });

        if (isEnd) {
            // For saving, ensure the complete stroke with all its points and properties is saved
            // If points is an array of single points, collect them. If it's already a full stroke, use it directly.
            // This assumes `points` on `isEnd` is the full stroke, as implemented in the frontend's `emitDrawingPoint`.
            const strokeToSave = {
                points: points, // `points` should be the full stroke array when `isEnd` is true
                color: color,
                size: size,
                tool: tool,
                shape: shape,
                text_content: tool === "text" ? text_content : undefined // Save text content if tool is text
            };
            sessionState.whiteboardStrokes.push(strokeToSave);
            await updateSessionInMongoDB(sessionId, { whiteboardStrokes: sessionState.whiteboardStrokes });
            console.log(`[WHITEBOARD_SAVE] Completed stroke from ${userId} saved to session ${sessionId}.`);
        }
    });

    socket.on('whiteboard-update', async ({ sessionId, strokes }) => {
        const sessionState = activeSessionsInMemory.get(sessionId);

        if (!sessionState) {
            console.warn(`[WHITEBOARD_WARN] Session ${sessionId} not found for whiteboard-update.`);
            return;
        }

        const requestingUserId = socketIdToSessionInfo.get(socket.id)?.userId;
        if (sessionState.ownerId !== requestingUserId) {
            console.warn(`[SECURITY] User ${requestingUserId} attempted full whiteboard update without being owner in session ${sessionId}.`);
            return;
        }

        sessionState.whiteboardStrokes = strokes;
        await updateSessionInMongoDB(sessionId, { whiteboardStrokes: sessionState.whiteboardStrokes });

        socket.to(sessionId).emit('whiteboard-update', { strokes });
        console.log(`[WHITEBOARD_BROADCAST] Broadcast full whiteboard-update for session ${sessionId}.`);
    });

    // --- DRAWING PERMISSION HANDLERS ---
    socket.on('set-drawing-permission', async ({ sessionId, targetUserId, hasPermission }) => {
        const requestingUserId = socketIdToSessionInfo.get(socket.id)?.userId;
        const sessionState = activeSessionsInMemory.get(sessionId);

        if (!sessionState || sessionState.ownerId !== requestingUserId) {
            console.warn(`[SECURITY] User ${requestingUserId} attempted to set drawing permission for ${targetUserId} without being owner.`);
            return;
        }

        sessionState.drawingPermissions[targetUserId] = hasPermission;
        await updateSessionInMongoDB(sessionId, { drawingPermissions: sessionState.drawingPermissions });

        console.log(`[PERMISSION] Drawing permission for ${targetUserId} set to ${hasPermission} in session ${sessionId}`);

        socketIoServer.to(sessionId).emit('drawing-permissions-updated', {
            drawingPermissions: sessionState.drawingPermissions
        });
        console.log(`[BROADCAST] Broadcast updated drawing permissions for session ${sessionId}.`);
    });

    socket.on('grant-all-drawing-permissions', async ({ sessionId }) => {
        const requestingUserId = socketIdToSessionInfo.get(socket.id)?.userId;
        const sessionState = activeSessionsInMemory.get(sessionId);

        if (!sessionState || sessionState.ownerId !== requestingUserId) {
            console.warn(`[SECURITY] User ${requestingUserId} attempted to grant all permissions without being owner.`);
            return;
        }

        sessionState.participants.forEach(pId => {
            sessionState.drawingPermissions[pId] = true;
        });
        sessionState.drawingPermissions[sessionState.ownerId] = true; // Ensure owner always has permission
        await updateSessionInMongoDB(sessionId, { drawingPermissions: sessionState.drawingPermissions });

        console.log(`[PERMISSION] Granted all drawing permissions in session ${sessionId}`);

        socketIoServer.to(sessionId).emit('drawing-permissions-updated', {
            drawingPermissions: sessionState.drawingPermissions
        });
        console.log(`[BROADCAST] Broadcast updated drawing permissions for session ${sessionId}.`);
    });

    socket.on('revoke-all-drawing-permissions', async ({ sessionId }) => {
        const requestingUserId = socketIdToSessionInfo.get(socket.id)?.userId;
        const sessionState = activeSessionsInMemory.get(sessionId);

        if (!sessionState || sessionState.ownerId !== requestingUserId) {
            console.warn(`[SECURITY] User ${requestingUserId} attempted to revoke all permissions without being owner.`);
            return;
        }

        sessionState.drawingPermissions = {}; // Reset all permissions
        sessionState.drawingPermissions[sessionState.ownerId] = true; // Owner always has permission
        sessionState.participants.forEach(pId => {
            if (pId !== sessionState.ownerId) {
                sessionState.drawingPermissions[pId] = false; // Set others to false
            }
        });
        await updateSessionInMongoDB(sessionId, { drawingPermissions: sessionState.drawingPermissions });

        console.log(`[PERMISSION] Revoked all drawing permissions in session ${sessionId}`);

        socketIoServer.to(sessionId).emit('drawing-permissions-updated', {
            drawingPermissions: sessionState.drawingPermissions
        });
        console.log(`[BROADCAST] Broadcast updated drawing permissions for session ${sessionId}.`);
    });


    // --- Remaining Chat/Poll/Participant Handlers ---

    socket.on('chat-message', async (data) => {
        const { sessionId, message } = data;
        console.log(`[CHAT] Chat message in session ${sessionId}: ${JSON.stringify(message)}`);

        const sessionState = activeSessionsInMemory.get(sessionId);
        if (sessionState) {
            sessionState.messages.push(message);
            await updateSessionInMongoDB(sessionId, { messages: sessionState.messages });

            socket.broadcast.to(sessionId).emit('chat-message', message);
        }
    });

    socket.on('user-leave-session', async (data) => {
        const { sessionId, userId } = data;
        console.log(`[LEAVE] User ${userId} is leaving session ${sessionId}`);

        const sessionState = activeSessionsInMemory.get(sessionId);
        if (sessionState) {
            // Remove user from pending join requests if they were waiting
            if (pendingJoinRequests.has(sessionId)) {
                pendingJoinRequests.get(sessionId).delete(userId);
                if (pendingJoinRequests.get(sessionId).size === 0) {
                    pendingJoinRequests.delete(sessionId);
                }
            }

            if (sessionState.participants.has(userId)) {
                sessionState.participants.delete(userId);
                await removeParticipantFromMongoSession(sessionId, userId);

                if (sessionState.ownerId === userId && sessionState.participants.size > 0) {
                    const newOwnerId = sessionState.participants.values().next().value;
                    sessionState.ownerId = newOwnerId;
                    sessionState.drawingPermissions[newOwnerId] = true; // Ensure new owner has drawing perms
                    await updateSessionInMongoDB(sessionId, {
                        host: newOwnerId,
                        ownerId: newOwnerId,
                        drawingPermissions: sessionState.drawingPermissions
                    });
                    console.log(`[OWNER_CHANGE] Session ${sessionId}: New owner assigned: ${newOwnerId}`);
                }

                // Remove the specific socket's info
                socketIdToSessionInfo.delete(socket.id);
                // Only remove from activeUserSockets map if this was the last socket for the user
                if (activeUserSockets.get(userId) === socket) {
                    activeUserSockets.delete(userId);
                }

                const currentCount = sessionState.participants.size;
                socket.to(sessionId).emit('user-left', {
                    userId,
                    participantCount: currentCount,
                    newOwnerId: sessionState.ownerId
                });
                console.log(`[BROADCAST] Broadcast user-left for ${userId} in ${sessionId}`);

                if (currentCount === 0) {
                    console.log(`[CLEANUP] Scheduling deletion for empty session ${sessionId} in ${SESSION_CLEANUP_DELAY / 1000} seconds`);
                    const timeoutId = setTimeout(async () => {
                        const currentSessionInMem = activeSessionsInMemory.get(sessionId);
                        const currentParticipantsCount = currentSessionInMem?.participants.size || 0;
                        if (currentParticipantsCount === 0) {
                            console.log(`[CLEANUP] Removing empty session ${sessionId} after timeout`);
                            activeSessionsInMemory.delete(sessionId);
                            sessionDeletionTimeouts.delete(sessionId);
                            try {
                                await deleteMongoSession(sessionId);
                            } catch (error) {
                                console.error(`[ERROR] Error deleting MongoDB session ${sessionId} during cleanup:`, error);
                            }
                        }
                    }, SESSION_CLEANUP_DELAY);
                    sessionDeletionTimeouts.set(sessionId, timeoutId);
                } else {
                    cancelSessionDeletion(sessionId);
                }
            }
        }
        socket.leave(sessionId);
    });

    socket.on('disconnect', async () => {
        console.log(`[DISCONNECT] Client disconnected: ${socket.id}`);
        const sessionInfo = socketIdToSessionInfo.get(socket.id);

        if (sessionInfo) {
            const { userId: disconnectedUserId, sessionId: disconnectedSessionId } = sessionInfo;
            console.log(`[DISCONNECT] User ${disconnectedUserId} (socket ${socket.id}) disconnected from session ${disconnectedSessionId}`);

            // Remove user from pending join requests if they were waiting
            if (pendingJoinRequests.has(disconnectedSessionId)) {
                pendingJoinRequests.get(disconnectedSessionId).delete(disconnectedUserId);
                if (pendingJoinRequests.get(disconnectedSessionId).size === 0) {
                    pendingJoinRequests.delete(disconnectedSessionId);
                }
            }
            
            // Only remove from activeUserSockets if this specific socket was the one registered
            if (activeUserSockets.get(disconnectedUserId) === socket) {
                activeUserSockets.delete(disconnectedUserId);
            }

            const sessionState = activeSessionsInMemory.get(disconnectedSessionId);
            if (sessionState) {
                // Check if the user has any other active sockets in this session
                const remainingSocketsInSession = Array.from(socketIoServer.sockets.sockets.values())
                    .filter(s => {
                        const info = socketIdToSessionInfo.get(s.id);
                        return info && info.sessionId === disconnectedSessionId && info.userId === disconnectedUserId;
                    });

                if (remainingSocketsInSession.length === 0) {
                    // If no other sockets for this user in this session, then consider them fully "left"
                    sessionState.participants.delete(disconnectedUserId);
                    await removeParticipantFromMongoSession(disconnectedSessionId, disconnectedUserId);

                    if (sessionState.ownerId === disconnectedUserId && sessionState.participants.size > 0) {
                        const newOwnerId = sessionState.participants.values().next().value;
                        sessionState.ownerId = newOwnerId;
                        sessionState.drawingPermissions[newOwnerId] = true; // Ensure new owner has drawing perms
                        await updateSessionInMongoDB(disconnectedSessionId, {
                            host: newOwnerId,
                            ownerId: newOwnerId,
                            drawingPermissions: sessionState.drawingPermissions
                        });
                        console.log(`[OWNER_CHANGE] Session ${disconnectedSessionId}: New owner assigned on disconnect: ${newOwnerId}`);
                    }

                    const currentCount = sessionState.participants.size;
                    socketIoServer.to(disconnectedSessionId).emit('user-left', {
                        userId: disconnectedUserId,
                        participantCount: currentCount,
                        newOwnerId: sessionState.ownerId // Include new owner ID in broadcast
                    });
                    console.log(`[BROADCAST] Broadcast user-left for ${disconnectedUserId} in ${disconnectedSessionId}`);

                    if (currentCount === 0) {
                        console.log(`[CLEANUP] Scheduling deletion for empty session ${disconnectedSessionId} after disconnect in ${SESSION_CLEANUP_DELAY / 1000} seconds`);
                        const timeoutId = setTimeout(async () => {
                            const currentSessionInMem = activeSessionsInMemory.get(disconnectedSessionId);
                            const currentParticipantsCount = currentSessionInMem?.participants.size || 0;
                            if (currentParticipantsCount === 0) {
                                console.log(`[CLEANUP] Removing empty session ${disconnectedSessionId} after timeout (disconnect cleanup)`);
                                activeSessionsInMemory.delete(disconnectedSessionId);
                                sessionDeletionTimeouts.delete(disconnectedSessionId);
                                try {
                                    await deleteMongoSession(disconnectedSessionId);
                                } catch (error) {
                                    console.error(`[ERROR] Error deleting MongoDB session ${disconnectedSessionId} during cleanup:`, error);
                                }
                            }
                        }, SESSION_CLEANUP_DELAY);
                        sessionDeletionTimeouts.set(disconnectedSessionId, timeoutId);
                    } else {
                        cancelSessionDeletion(disconnectedSessionId);
                    }
                } else {
                    console.log(`[DISCONNECT_NOTE] User ${disconnectedUserId} still has other active sockets in session ${disconnectedSessionId}. Not fully leaving.`);
                }
            }
            socketIdToSessionInfo.delete(socket.id); // Always clear this socket's info
        }
    });

});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode.`);
    cleanupEmptySessions(); // Run cleanup on startup
});

// Helper function for session ID generation (moved to bottom for organization)
function generateSessionId() {
    return Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 8);
}

// ✅ Connect without deprecated options
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));
