import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext'; // Assumes AuthContext.js is in src/context/
import Whiteboard from './Whiteboard'; // Assumes Whiteboard.js is in the same directory as SessionPublic.js
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faPaperPlane,
    faShare,
    faUsers,
    faUnlockAlt,
} from '@fortawesome/free-solid-svg-icons';

import './SessionPublic.css'; // Importing the new CSS file

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * SessionPublic component for a public, collaborative whiteboard session.
 * All UI logic and state are managed within this single file, using only native CSS for styling.
 * In this version, all connected users can draw and interact with the whiteboard freely.
 */
function SessionPublic() {
    const { sessionId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user } = useAuth(); // Get user from AuthContext

    // State for general session information
    const [participantCount, setParticipantCount] = useState(0);
    const [participants, setParticipants] = useState([]);
    const [showParticipants, setShowParticipants] = useState(true);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [sessionName, setSessionName] = useState('');
    const [showCopyMessage, setShowCopyMessage] = useState(false);

    // In a public session, all users are implicitly allowed to draw.
    const currentUserCanDraw = true; // Always true for public sessions

    // Whiteboard state
    const [whiteboardData, setWhiteboardData] = useState([]);
    const [liveStrokes, setLiveStrokes] = useState({}); // Stores ongoing strokes from other users

    // Drawing tool states (common for all users)
    const [color, setColor] = useState("#000000");
    const [size, setSize] = useState(4);
    const [tool, setTool] = useState("pen");
    const [shape, setShape] = useState(null);

    const messagesEndRef = useRef(null); // Ref for scrolling chat
    const socketRef = useRef(null); // Ref for socket.io client instance

    /**
     * Callback to update the full whiteboard state (e.g., after clear, undo, redo).
     * @param {Object} data - Contains the full array of strokes.
     */
    const handleWhiteboardUpdate = useCallback((data) => {
        setWhiteboardData(data.strokes || []);
        setLiveStrokes({}); // Clear all live strokes as the full state is synced
    }, []);

    /**
     * Callback to handle individual drawing points from other users.
     * Manages `liveStrokes` to show real-time drawing.
     * @param {Object} data - Contains point data, user ID, and stroke properties.
     */
    const handleWhiteboardPoint = useCallback((data) => {
        const { userId: fromUserId, points, color: pColor, size: pSize, tool: pTool, isEnd, shape: pShape, text_content: pTextContent } = data;

        if (fromUserId === user._id) {
            return; // Ignore points from self, as local Whiteboard.js handles its own drawing feedback
        }

        setLiveStrokes(prev => {
            const newLiveStrokes = { ...prev };
            const existingLiveStroke = newLiveStrokes[fromUserId];

            const pointsWithStyle = points.map(pt => ({
                ...pt,
                color: pColor,
                size: pSize,
                tool: pTool,
                shape: pShape,
                text_content: pTextContent
            }));

            if (isEnd) {
                const finalizedStroke = existingLiveStroke ? [...existingLiveStroke, ...pointsWithStyle] : pointsWithStyle;
                setWhiteboardData(prevStrokes => [...prevStrokes, finalizedStroke]);
                delete newLiveStrokes[fromUserId];
            } else {
                const isNewSegmentStart = (
                    !existingLiveStroke ||
                    existingLiveStroke.length === 0 ||
                    existingLiveStroke[0].tool !== pTool ||
                    existingLiveStroke[0].shape !== pShape ||
                    existingLiveStroke[0].color !== pColor ||
                    existingLiveStroke[0].size !== pSize
                );

                if (isNewSegmentStart) {
                    newLiveStrokes[fromUserId] = pointsWithStyle;
                } else {
                    newLiveStrokes[fromUserId] = [...existingLiveStroke, ...pointsWithStyle];
                }
            }
            return newLiveStrokes;
        });
    }, [user._id]);

    /**
     * Callback to update the session name.
     * @param {Object} data - Contains the updated session name.
     */
    const handleSessionNameUpdated = useCallback((data) => {
        setSessionName(data.sessionName);
    }, []);

    /**
     * Callback to handle incoming chat messages.
     * @param {Object} message - The chat message object.
     */
    const handleChatMessage = useCallback((message) => {
        setMessages((prev) => [...prev, { ...message, isSelf: message.sender === user._id }]);
    }, [user._id]);

    /**
     * Callback to handle a new user joining the session.
     * @param {Object} data - Contains new participant count and user details.
     */
    const handleUserJoined = useCallback((data) => {
        setParticipantCount(data.participantCount);
        setParticipants(prev => {
            if (!prev.some(p => p.id === data.userId)) {
                return [...prev, {
                    id: data.userId,
                    name: data.username,
                    isCurrentUser: data.userId === user._id
                }];
            }
            return prev;
        });
    }, [user._id]);

    /**
     * Callback to handle a user leaving the session.
     * @param {Object} data - Contains updated participant count and left user's ID.
     */
    const handleUserLeft = useCallback((data) => {
        setParticipantCount(data.participantCount);
        setParticipants(prev => prev.filter(p => p.id !== data.userId));
    }, []);

    // Effect for socket connection and event listeners
    useEffect(() => {
        if (!user) {
            navigate('/auth/login');
            return;
        }

        socketRef.current = io(API_URL, {
            query: { userId: user._id, username: user.name }
        });
        const socket = socketRef.current;

        socket.on('join-failed', (data) => {
            console.error(`Failed to join session: ${data.message}`);
            prompt("Failed to join session:", data.message); // Using prompt for simplicity, consider a custom modal
            navigate('/home');
        });

        socket.on('session-not-found', () => {
            console.warn('Session not found.');
            prompt('Session not found. Please check the ID and try again.'); // Using prompt for simplicity
            navigate('/home');
        });

        socket.emit('join-session', {
            sessionId,
            userId: user._id,
            username: user.name,
            sessionName: searchParams.get('name'),
            isPublic: true
        });

        socket.on('participant-count', setParticipantCount);
        socket.on('session-name-updated', handleSessionNameUpdated);
        socket.on('session-state', (data) => {
            console.log("Initial public session state received:", data);
            setSessionName(data.sessionName);
            setParticipantCount(data.participantCount);
            setParticipants(data.participants || []);
            setWhiteboardData(data.whiteboardStrokes || []);
            setMessages(data.messages || []);
            setLiveStrokes({});
        });
        socket.on('chat-message', handleChatMessage);
        socket.on('user-joined', handleUserJoined);
        socket.on('user-left', handleUserLeft);
        socket.on('whiteboard-update', handleWhiteboardUpdate);
        socket.on('whiteboard-point', handleWhiteboardPoint);

        return () => {
            socket.off('join-failed');
            socket.off('participant-count');
            socket.off('session-name-updated');
            socket.off('session-state');
            socket.off('chat-message');
            socket.off('user-joined');
            socket.off('user-left');
            socket.off('whiteboard-update');
            socket.off('whiteboard-point');
            socket.disconnect();
        };
    }, [sessionId, user, searchParams, navigate, handleChatMessage,
        handleUserJoined, handleUserLeft, handleWhiteboardUpdate, handleWhiteboardPoint,
        handleSessionNameUpdated]);

    // Scroll to the latest message in chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    /**
     * Handles sending a chat message.
     * @param {Event} e - The form submission event.
     */
    const handleSendMessage = (e) => {
        e.preventDefault();
        if (newMessage.trim() && socketRef.current) {
            const message = {
                type: 'chat',
                text: newMessage.trim(),
                timestamp: new Date().toISOString(),
                sender: user._id,
                senderName: user.name,
            };
            socketRef.current.emit('chat-message', { sessionId, message: message });
            setMessages((prev) => [...prev, { ...message, isSelf: true }]);
            setNewMessage('');
        }
    };

    /**
     * Handles changes to the whiteboard data (e.g., undo, clear).
     * Emits a full whiteboard update to the server.
     * @param {Array} newStrokes - The updated array of all strokes.
     */
    const handleWhiteboardChange = useCallback((newStrokes) => {
        if (socketRef.current) {
            socketRef.current.emit('whiteboard-update', {
                sessionId,
                strokes: newStrokes,
            });
        }
        setWhiteboardData(newStrokes);
    }, [sessionId]);

    /**
     * Emits individual drawing points to the server for real-time drawing.
     * @param {Array} points - Array of points representing a segment of a stroke.
     * @param {boolean} isEnd - True if this is the last point of a stroke.
     */
    const emitDrawingPoint = useCallback((points, isEnd) => {
        if (socketRef.current && currentUserCanDraw) {
            socketRef.current.emit('whiteboard-point', {
                sessionId,
                userId: user._id,
                points,
                color,
                size,
                tool,
                shape,
                text_content: points.length > 0 && points[0].tool === "text" ? points[0].text_content : undefined,
                isEnd,
            });
        }
    }, [sessionId, user?._id, color, size, tool, shape, currentUserCanDraw]);

    // Combine completed strokes and live strokes from other users for rendering
    const allStrokes = [
        ...whiteboardData,
        ...Object.values(liveStrokes).flat(),
    ];

    /**
     * Handles sharing the session link to the clipboard.
     */
    const handleShareClick = () => {
        const currentOrigin = window.location.origin;
        const sessionUrl = `${currentOrigin}/public-session/${sessionId}?name=${encodeURIComponent(sessionName)}`;

        const tempInput = document.createElement('textarea');
        tempInput.value = sessionUrl;
        document.body.appendChild(tempInput);
        tempInput.select();
        try {
            document.execCommand('copy');
            setShowCopyMessage(true);
            setTimeout(() => setShowCopyMessage(false), 1000);
        } catch (err) {
            console.error("Failed to copy text: ", err);
            prompt("Copy this link manually:", sessionUrl);
        } finally {
            document.body.removeChild(tempInput);
        }
    };

    /**
     * Handles leaving the current session.
     * Emits a 'user-leave-session' event and navigates back to the home page.
     */
    const handleLeaveSession = () => {
        if (socketRef.current && sessionId && user) {
            socketRef.current.emit('user-leave-session', { sessionId, userId: user._id });
            setMessages([]);
            setParticipantCount(0);
            setSessionName('');
            setWhiteboardData([]);
            setLiveStrokes({});
            navigate('/home'); // Navigate to the main home route
        }
    };

    /**
     * Renders a single chat message.
     * @param {Object} message - The message object to render.
     * @param {number} index - The index of the message in the array.
     * @returns {JSX.Element|null} The rendered message or null.
     */
    const renderMessage = (message, index) => {
        if (message.type === 'chat') {
            const isSelf = message.sender === user._id;
            return (
                <div
                    key={index}
                    className={`message ${isSelf ? 'message-self' : 'message-other'}`}
                >
                    {!isSelf && (
                        <div className="message-sender">
                            {message.senderName || 'Unknown User'}
                        </div>
                    )}
                    <div className="message-text">
                        {message.text}
                    </div>
                    <div className="message-time">
                        {new Date(message.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="session-page">
            {/* Header Section */}
            <header className="session-header">
                <div className="header-info">
                    <h1 className="session-title">
                        Session: {sessionName || 'Loading...'}
                        <FontAwesomeIcon icon={faUnlockAlt} className="session-public-icon" title="Public Session" />
                    </h1>
                    <div className="session-id-share">
                        <span className="session-id-label">ID: <span className="session-id-value">{sessionId}</span></span>
                        <button
                            onClick={handleShareClick}
                            className="share-button"
                            title="Share session link"
                        >
                            <FontAwesomeIcon icon={faShare} className="share-icon" />
                            <span className="share-text">Share</span>
                            {showCopyMessage && (
                                <span className="copy-message show">
                                    Link copied!
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                <div className="app-title-container">
                    <span className="app-title">SyncBoard Public</span>
                </div>

                <button
                    onClick={handleLeaveSession}
                    className="leave-session-btn"
                >
                    Leave Session
                </button>
            </header>

            {/* Main Workspace Area */}
            <main className="main-workspace">
                {/* Participants Panel */}
                <div className="participants-panel">
                    <div className="panel-header">
                        <h2 className="panel-title">Participants</h2>
                        <button
                            className="participants-toggle-btn"
                            onClick={() => setShowParticipants(!showParticipants)}
                            title="Toggle Participant List"
                        >
                            <FontAwesomeIcon icon={faUsers} className="participants-icon" />
                            <span>{participantCount}</span>
                        </button>
                    </div>

                    <p className="drawing-permission-info permission-granted">
                        All users have drawing permission.
                    </p>

                    {showParticipants && (
                        <div className="participant-list-container custom-scrollbar">
                            <ul className="participant-list">
                                {participants.map((participant) => (
                                    <li key={participant.id} className="participant-item">
                                        <span>
                                            {participant.name}
                                            {participant.isCurrentUser ? " (You)" : ""}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Whiteboard Area */}
                <div className="whiteboard-area">
                    <Whiteboard
                        strokes={allStrokes}
                        onChange={handleWhiteboardChange}
                        canEdit={currentUserCanDraw}
                        color={color}
                        setColor={setColor}
                        size={size}
                        setSize={setSize}
                        tool={tool}
                        setTool={setTool}
                        shape={shape}
                        setShape={setShape}
                        emitDrawingPoint={emitDrawingPoint}
                    />
                </div>

                {/* Chat Panel */}
                <div className="chat-panel">
                    <div className="chat-header">
                        <h2 className="panel-title">Chat</h2>
                    </div>

                    <div className="messages-container custom-scrollbar">
                        {messages.map((message, index) => renderMessage(message, index))}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleSendMessage} className="message-form">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="message-input-field"
                            aria-label="New chat message"
                        />
                        <button
                            type="submit"
                            className="send-message-btn"
                            title="Send Message"
                        >
                            <FontAwesomeIcon icon={faPaperPlane} />
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}

export default SessionPublic;
