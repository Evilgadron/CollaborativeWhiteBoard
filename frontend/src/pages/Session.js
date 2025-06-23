// components/Session.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import Whiteboard from './Whiteboard';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faPaperPlane,
    faShare,
    faUsers,
    faPencilAlt,
    faBan,
    faLock,
    faUnlockAlt
} from '@fortawesome/free-solid-svg-icons';

import './Session.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function Session() {
    const { sessionId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [participantCount, setParticipantCount] = useState(0);
    const [participants, setParticipants] = useState([]);
    const [showParticipants, setShowParticipants] = useState(true);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [sessionName, setSessionName] = useState('');
    const [showCopyMessage, setShowCopyMessage] = useState(false);

    const [sessionOwnerId, setSessionOwnerId] = useState(null);
    const [drawingPermissions, setDrawingPermissions] = useState({});
    const [isSessionPrivate, setIsSessionPrivate] = useState(false);

    const [whiteboardData, setWhiteboardData] = useState([]);
    // liveStrokes now specifically holds only the CURRENTLY ONGOING strokes from other users
    const [liveStrokes, setLiveStrokes] = useState({});

    const [color, setColor] = useState("#000000");
    const [size, setSize] = useState(4);
    const [tool, setTool] = useState("pen");
    const [shape, setShape] = useState(null);

    const messagesEndRef = useRef(null);
    const socketRef = useRef(null);

    const isCurrentUserOwner = user && sessionOwnerId && user._id === sessionOwnerId;
    const currentUserCanDraw = isCurrentUserOwner || drawingPermissions[user?._id];

    const handleWhiteboardUpdate = useCallback((data) => {
        // This is for full canvas updates (e.g., clear, undo/redo)
        setWhiteboardData(data.strokes || []);
        setLiveStrokes({}); // Clear all live strokes as the full state is synced
    }, []);


    // MODIFIED: handleWhiteboardPoint to correctly manage live strokes
    const handleWhiteboardPoint = useCallback((data) => {
        const { userId: fromUserId, points, color: pColor, size: pSize, tool: pTool, isEnd, shape: pShape, text_content: pTextContent } = data;

        if (fromUserId === user._id) {
            return; // Ignore points from self, as local Whiteboard.js handles its own drawing feedback
        }

        setLiveStrokes(prev => {
            const newLiveStrokes = { ...prev };
            const existingLiveStroke = newLiveStrokes[fromUserId]; // Get the current ongoing stroke for this user

            // Ensure the points received have the full style information
            // 'points' array received from emitDrawingPoint is either [single_point] or [full_stroke_array]
            const pointsWithStyle = points.map(pt => ({
                ...pt,
                color: pColor,
                size: pSize,
                tool: pTool,
                shape: pShape,
                text_content: pTextContent
            }));

            if (isEnd) {
                // This indicates the completion of a stroke for this user.
                // Combine any existing live points with the received points, then add to whiteboardData
                const finalizedStroke = existingLiveStroke ? [...existingLiveStroke, ...pointsWithStyle] : pointsWithStyle;
                setWhiteboardData(prevStrokes => [...prevStrokes, finalizedStroke]);
                delete newLiveStrokes[fromUserId]; // Clear the live stroke for this user
            } else {
                // This is an ongoing point for a stroke.
                // Condition to determine if we should START A NEW live stroke for this user.
                // This happens if there's no existing live stroke for this user, OR
                // if the properties (tool, shape, color, size) of the new point differ from the start of the existing live stroke.
                // The check `pointsWithStyle.length === 1` helps distinguish single points from full strokes (which should only happen on 'isEnd').
                const isNewSegmentStart = (
                    !existingLiveStroke ||
                    existingLiveStroke.length === 0 || // If no existing stroke, it's a new one
                    existingLiveStroke[0].tool !== pTool ||
                    existingLiveStroke[0].shape !== pShape ||
                    existingLiveStroke[0].color !== pColor ||
                    existingLiveStroke[0].size !== pSize
                );

                if (isNewSegmentStart) {
                    newLiveStrokes[fromUserId] = pointsWithStyle; // Start a completely new stroke
                } else {
                    newLiveStrokes[fromUserId] = [...existingLiveStroke, ...pointsWithStyle]; // Append to the ongoing stroke
                }
            }
            return newLiveStrokes;
        });
    }, [user._id]);


    const handleDrawingPermissionsUpdated = useCallback((permissionsData) => {
        setDrawingPermissions(permissionsData.drawingPermissions);
    }, []);

    const handleSessionNameUpdated = useCallback((data) => {
        setSessionName(data.sessionName);
    }, []);

    const handleChatMessage = useCallback((message) => {
        setMessages((prev) => [...prev, { ...message, isSelf: message.sender === user._id }]);
    }, [user._id]);

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

    const handleUserLeft = useCallback((data) => {
        setParticipantCount(data.participantCount);
        setParticipants(prev => prev.filter(p => p.id !== data.userId));
        // If owner changed, update state
        if (data.newOwnerId) {
            setSessionOwnerId(data.newOwnerId);
        }
    }, []);

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
            alert(`Failed to join session: ${data.message}`);
            navigate('/home');
        });

        socket.on('session-not-found', () => {
            alert('Session not found. Please check the session ID and try again.');
            navigate('/home');
        });

        const initialSessionKey = searchParams.get('key');
        socket.emit('join-session', {
            sessionId,
            userId: user._id,
            username: user.name,
            sessionName: searchParams.get('name'),
            sessionKey: initialSessionKey
        });

        socket.on('participant-count', setParticipantCount);
        socket.on('session-name-updated', handleSessionNameUpdated);
        socket.on('session-state', (data) => {
            console.log("Initial session state received:", data);
            setSessionName(data.sessionName);
            setParticipantCount(data.participantCount);
            setParticipants(data.participants || []);
            setWhiteboardData(data.whiteboardStrokes || []);
            setMessages(data.messages || []);
            setSessionOwnerId(data.ownerId);
            setDrawingPermissions(data.drawingPermissions || {});
            setIsSessionPrivate(data.isPrivate || false);
            setLiveStrokes({}); // Clear live strokes on initial state sync
        });

        socket.on('chat-message', handleChatMessage);
        socket.on('user-joined', handleUserJoined);
        socket.on('user-left', handleUserLeft);
        socket.on('whiteboard-update', handleWhiteboardUpdate); // Listen for full whiteboard updates (clear, undo/redo)
        socket.on('whiteboard-point', handleWhiteboardPoint); // Listen for live drawing points
        socket.on('drawing-permissions-updated', handleDrawingPermissionsUpdated);

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
            socket.off('drawing-permissions-updated');
            socket.disconnect();
        };
    }, [sessionId, user, searchParams, navigate, handleChatMessage,
        handleUserJoined, handleUserLeft, handleWhiteboardUpdate, handleWhiteboardPoint,
        handleSessionNameUpdated, handleDrawingPermissionsUpdated]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

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

    const handleWhiteboardChange = useCallback((newStrokes) => {
        if (socketRef.current) {
            socketRef.current.emit('whiteboard-update', {
                sessionId,
                strokes: newStrokes,
            });
        }
        setWhiteboardData(newStrokes);
    }, [sessionId]);

    const emitDrawingPoint = useCallback((points, isEnd) => {
        if (socketRef.current && currentUserCanDraw) {
            // 'points' argument here is either:
            // - A single point array like [{x,y,...}] when mouse down/move (isEnd: false)
            // - The full currentStroke array when mouse up (isEnd: true)
            socketRef.current.emit('whiteboard-point', {
                sessionId,
                userId: user._id,
                points, // This array will be processed by handleWhiteboardPoint on other clients
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
        ...Object.values(liveStrokes).flat(), // Flatten all arrays of points from liveStrokes
    ];


    const toggleDrawingPermission = useCallback((targetUserId) => {
        if (!isCurrentUserOwner || !socketRef.current) return;
        const currentPermission = drawingPermissions[targetUserId];
        const newPermission = !currentPermission;
        socketRef.current.emit('set-drawing-permission', { sessionId, targetUserId, hasPermission: newPermission });
        setDrawingPermissions(prev => ({ ...prev, [targetUserId]: newPermission }));
    }, [isCurrentUserOwner, drawingPermissions, socketRef, sessionId]);

    const grantAllDrawingPermissions = useCallback(() => {
        if (!isCurrentUserOwner || !socketRef.current) return;
        socketRef.current.emit('grant-all-drawing-permissions', { sessionId });
        const newPermissions = {};
        participants.forEach(p => { if (p.id !== sessionOwnerId) { newPermissions[p.id] = true; } });
        setDrawingPermissions(newPermissions);
    }, [isCurrentUserOwner, participants, socketRef, sessionId, sessionOwnerId]);

    const revokeAllDrawingPermissions = useCallback(() => {
        if (!isCurrentUserOwner || !socketRef.current) return;
        socketRef.current.emit('revoke-all-drawing-permissions', { sessionId });
        const newPermissions = {};
        participants.forEach(p => { if (p.id !== sessionOwnerId) { newPermissions[p.id] = false; } });
        setDrawingPermissions(newPermissions);
    }, [isCurrentUserOwner, participants, socketRef, sessionId, sessionOwnerId]);

    const handleShareClick = () => {
        const currentOrigin = window.location.origin;
        const sessionKeyParam = isSessionPrivate ? `&key=${searchParams.get('key') || ''}` : ''; // Ensure key is passed if private
        const sessionUrl = `${currentOrigin}/session/${sessionId}?name=${encodeURIComponent(sessionName)}${sessionKeyParam}`;

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

    const handleLeaveSession = () => {
        if (socketRef.current && sessionId && user) {
            socketRef.current.emit('user-leave-session', { sessionId, userId: user._id });
            setMessages([]);
            setParticipantCount(0);
            setSessionName('');
            setWhiteboardData([]);
            setLiveStrokes({});
            setDrawingPermissions({});
            setSessionOwnerId(null);
            setIsSessionPrivate(false);
            navigate('/home');
        }
    };

    const renderMessage = (message, index) => {
        if (message.type === 'chat') {
            return (
                <div
                    key={index}
                    className={`message ${message.sender === user._id ? 'self' : 'other'}`}
                >
                    {message.sender !== user._id && (
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
            <header className="session-header">
                <div className="flex flex-col">
                    <h1 className="text-xl md:text-2xl font-bold text-gray-800 truncate max-w-[200px] sm:max-w-none">
                        Session: {sessionName || 'Loading...'}
                        {isSessionPrivate ? <FontAwesomeIcon icon={faLock} className="ml-2 text-red-500" title="Private Session" /> : <FontAwesomeIcon icon={faUnlockAlt} className="ml-2 text-green-500" title="Public Session" />}
                    </h1>
                    <div className="id-and-share flex items-center">
                        <span className="mr-2">ID: <span className="font-mono text-gray-700">{sessionId}</span></span>
                        <button
                            onClick={handleShareClick}
                            className="share-button"
                            title="Share session link"
                        >
                            <FontAwesomeIcon icon={faShare} className="mr-1" />
                            <span className="hidden sm:inline">Share</span>
                            {showCopyMessage && (
                                <span className="copy-message show">
                                    Link copied!
                                </span>
                            )}
                        </button>
                    </div>
                </div>
                <div className="flex-grow flex justify-center items-center">
                    <span className="text-3xl font-extrabold text-blue-600 tracking-tight">SyncBoard</span>
                </div>
                <button
                    onClick={handleLeaveSession}
                    className="leave-session-btn"
                >
                    Leave Session
                </button>
            </header>

            <main className="main-workspace">
                <div className="participants-panel">
                    <div className="panel-header">
                        <h2 className="text-xl font-bold text-gray-800">Participants</h2>
                        <button
                            className="participants-toggle-btn"
                            onClick={() => setShowParticipants(!showParticipants)}
                            title="Toggle Participant List"
                        >
                            <FontAwesomeIcon icon={faUsers} className="mr-2" />
                            <span>{participantCount}</span>
                        </button>
                    </div>

                    {currentUserCanDraw ? (
                        <p className="text-green-600 font-bold text-center mb-4">
                            You have drawing permission.
                        </p>
                    ) : (
                        <p className="text-red-600 font-bold text-center mb-4">
                            You do NOT have drawing permission.
                        </p>
                    )}

                    {showParticipants && (
                        <div className="participant-list-container">
                            <ul className="text-sm">
                                {participants.map((participant) => (
                                    <li key={participant.id} className="py-2 flex justify-between items-center border-b last:border-b-0 border-gray-100">
                                        <span>
                                            {participant.name}
                                            {participant.id === sessionOwnerId && " (Owner)"}
                                            {participant.isCurrentUser ? " (You)" : ""}
                                        </span>
                                        {isCurrentUserOwner && participant.id !== sessionOwnerId && (
                                            <button
                                                onClick={() => toggleDrawingPermission(participant.id)}
                                                className={`p-2 rounded-full text-white text-xs ${drawingPermissions[participant.id] ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} transition-colors duration-200 shadow-sm`}
                                                title={drawingPermissions[participant.id] ? "Revoke drawing" : "Grant drawing"}
                                            >
                                                <FontAwesomeIcon icon={drawingPermissions[participant.id] ? faBan : faPencilAlt} />
                                            </button>
                                        )}
                                        {participant.id !== sessionOwnerId && !isCurrentUserOwner && (
                                            <span className={drawingPermissions[participant.id] ? 'text-green-500 font-semibold' : 'text-red-500 font-semibold'}>
                                                {drawingPermissions[participant.id] ? 'Drawing Enabled' : 'Drawing Disabled'}
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {isCurrentUserOwner && (
                        <div className="owner-controls mt-6 p-4 bg-blue-50 rounded-lg shadow-sm">
                            <h4 className="text-md font-semibold mb-3 text-blue-800 text-center">Owner Actions</h4>
                            <button
                                onClick={grantAllDrawingPermissions}
                                className="w-full bg-blue-600 text-white py-2 px-3 rounded-lg text-sm hover:bg-blue-700 transition-colors duration-200 shadow mb-2"
                            >
                                Grant All Drawing Access
                            </button>
                            <button
                                onClick={revokeAllDrawingPermissions}
                                className="w-full bg-red-600 text-white py-2 px-3 rounded-lg text-sm hover:bg-red-700 transition-colors duration-200 shadow"
                            >
                                Revoke All Drawing Access
                            </button>
                        </div>
                    )}
                </div>

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

                <div className="chat-panel">
                    <div className="chat-header">
                        <h2 className="text-xl font-bold text-gray-800">Chat</h2>
                    </div>

                    <div className="messages-container">
                        {messages.map((message, index) => renderMessage(message, index))}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="message-input">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(e)}
                            placeholder="Type a message..."
                            className="message-input-field"
                        />
                        <button
                            className="send-message-btn"
                            onClick={handleSendMessage}
                            title="Send Message"
                        >
                            <FontAwesomeIcon icon={faPaperPlane} />
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default Session;
