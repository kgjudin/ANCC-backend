"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChatContacts = getChatContacts;
exports.getChatRooms = getChatRooms;
exports.createOrGetDirectRoom = createOrGetDirectRoom;
exports.getRoomMessages = getRoomMessages;
exports.sendMessage = sendMessage;
const db_js_1 = require("../../config/db.js");
// Get list of employee contacts for direct chat (All registered user accounts)
async function getChatContacts(req, res) {
    try {
        const contacts = await (0, db_js_1.query)(`SELECT 
         u.id as user_id,
         u.email,
         COALESCE(e.id, u.id) as id,
         COALESCE(e.full_name, u.email) as full_name,
         COALESCE(e.phone, '') as phone,
         COALESCE(d.name, 'Staff') as department_name,
         COALESCE(des.name, 'Employee') as designation_name,
         COALESCE(e.status, u.status, 'Active') as status
       FROM users u
       LEFT JOIN employees e ON e.user_id = u.id
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN designations des ON e.designation_id = des.id
       ORDER BY full_name ASC`);
        return res.json({
            success: true,
            data: contacts
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: { code: 'CHAT_ERROR', message: error.message || 'Failed to fetch chat contacts' }
        });
    }
}
// Get user's chat rooms (direct & group channels)
async function getChatRooms(req, res) {
    try {
        const rooms = await (0, db_js_1.query)(`SELECT r.*, 
              (SELECT content FROM messages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) as last_message,
              (SELECT created_at FROM messages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) as last_message_at
       FROM chat_rooms r
       ORDER BY last_message_at DESC NULLS LAST, r.created_at DESC`);
        return res.json({
            success: true,
            data: rooms
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: { code: 'CHAT_ERROR', message: error.message || 'Failed to fetch chat rooms' }
        });
    }
}
// Create or get direct chat room with an employee
async function createOrGetDirectRoom(req, res) {
    try {
        const currentUser = req.user;
        const { target_user_id, room_name } = req.body;
        if (target_user_id) {
            // Check existing direct room between currentUser and target_user_id
            const existingRooms = await (0, db_js_1.query)(`SELECT r.id, r.name, r.type
         FROM chat_rooms r
         JOIN chat_members m1 ON m1.room_id = r.id AND m1.user_id = $1
         JOIN chat_members m2 ON m2.room_id = r.id AND m2.user_id = $2
         WHERE r.type = 'direct'`, [currentUser.id, target_user_id]);
            if (existingRooms.length > 0) {
                return res.json({
                    success: true,
                    data: existingRooms[0]
                });
            }
        }
        // Create new room
        const roomId = crypto.randomUUID();
        const isGroup = !target_user_id;
        const name = room_name || (isGroup ? 'Team Group Chat' : 'Direct Message');
        const newRooms = await (0, db_js_1.query)(`INSERT INTO chat_rooms (id, company_id, name, type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`, [roomId, currentUser.company_id, name, isGroup ? 'group' : 'direct']);
        // Add currentUser to room
        await (0, db_js_1.query)(`INSERT INTO chat_members (room_id, user_id) VALUES ($1, $2)`, [roomId, currentUser.id]);
        // Add target_user_id if direct chat
        if (target_user_id) {
            await (0, db_js_1.query)(`INSERT INTO chat_members (room_id, user_id) VALUES ($1, $2)`, [roomId, target_user_id]);
        }
        return res.json({
            success: true,
            data: newRooms[0] || { id: roomId, company_id: currentUser.company_id, name, type: isGroup ? 'group' : 'direct' }
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: { code: 'CHAT_ERROR', message: error.message || 'Failed to create chat room' }
        });
    }
}
// Get message history for a specific chat room
async function getRoomMessages(req, res) {
    try {
        const { roomId } = req.params;
        const messages = await (0, db_js_1.query)(`SELECT m.* 
       FROM messages m
       WHERE m.room_id = $1
       ORDER BY m.created_at ASC`, [roomId]);
        return res.json({
            success: true,
            data: messages
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: { code: 'CHAT_ERROR', message: error.message || 'Failed to fetch messages' }
        });
    }
}
// Send message to a chat room
async function sendMessage(req, res) {
    try {
        const currentUser = req.user;
        const currentEmp = req.employee;
        const { roomId } = req.params;
        const { content } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Message content cannot be empty' }
            });
        }
        const messageId = crypto.randomUUID();
        const senderName = currentEmp?.full_name || currentUser.email.split('@')[0];
        const newMessages = await (0, db_js_1.query)(`INSERT INTO messages (id, room_id, sender_user_id, sender_name, content)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`, [messageId, roomId, currentUser.id, senderName, content.trim()]);
        return res.status(201).json({
            success: true,
            data: newMessages[0] || {
                id: messageId,
                room_id: roomId,
                sender_user_id: currentUser.id,
                sender_name: senderName,
                content: content.trim(),
                created_at: new Date().toISOString()
            }
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: { code: 'CHAT_ERROR', message: error.message || 'Failed to send message' }
        });
    }
}
