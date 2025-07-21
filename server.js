const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const url = require('url');
const path = require('path'); // Aggiunto per gestire i percorsi dei file

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const channels = new Map();
let adminSocket = null;
const validChannels = new Set();
const bannedIPs = new Set();
let heartbeatInterval;

app.use(express.static(__dirname));

// NUOVO: Gestione delle rotte per Netlify
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/assistenza', (req, res) => res.sendFile(path.join(__dirname, 'assistenza.html')));
app.get('/protocolli', (req, res) => res.sendFile(path.join(__dirname, 'protocolli.html')));
app.get('/blackout', (req, res) => res.sendFile(path.join(__dirname, 'blackout.html')));


wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    if (bannedIPs.has(clientIp)) { ws.close(1008, 'IP bannato permanentemente.'); return; }
    
    const parameters = new URLSearchParams(url.parse(req.url).search);
    const channelName = parameters.get('channel');
    const isAdmin = parameters.get('admin') === 'true';
    const isSupport = parameters.get('support') === 'true';

    if (isAdmin) { handleAdminConnection(ws, req); }
    else if (isSupport) { handleSupportConnection(ws, req); }
    else if (channelName) { if (validChannels.has(channelName)) { handleUserConnection(ws, req, channelName); } else { ws.close(1008, 'Codice canale non valido o inesistente.'); } }
    else { ws.close(1008, 'Richiesta non valida.'); }
});

function handleSupportConnection(ws, req) {
    ws.on('message', (message) => {
        const ticketData = JSON.parse(message);
        if (ticketData.type === 'NEW_TICKET') {
            if (adminSocket && adminSocket.readyState === WebSocket.OPEN) {
                adminSocket.send(JSON.stringify({ type: 'new_ticket', payload: ticketData.payload }));
            }
        }
    });
}

function handleAdminConnection(ws, req) {
    adminSocket = ws;
    ws.send(JSON.stringify({ type: 'full_state', payload: getFullState() }));

    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
        if (adminSocket && adminSocket.readyState === WebSocket.OPEN) {
            adminSocket.send(JSON.stringify({ type: 'ping' }));
        }
    }, 2500);

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        switch (data.type) {
            case 'CREATE_CHANNEL':
                const newCode = `spectre-${Date.now().toString(36)}-${Math.random().toString(36).substring(2,7)}`;
                validChannels.add(newCode);
                if (!channels.has(newCode)) channels.set(newCode, { clients: new Set(), messages: [] });
                ws.send(JSON.stringify({ type: 'channel_created', payload: newCode }));
                updateAdminPanel();
                break;
            case 'ADMIN_REPLY':
                const { channelName, text } = data.payload;
                const adminMessage = { codename: '[ADMIN]', text, timestamp: new Date().toISOString() };
                if (channels.has(channelName)) {
                    const channelData = channels.get(channelName);
                    channelData.messages.push(adminMessage);
                    channelData.clients.forEach(client => client.socket.send(JSON.stringify(adminMessage)));
                    if(adminSocket) adminSocket.send(JSON.stringify({ type: 'new_message', payload: { ...adminMessage, channelName } }));
                }
                break;
            case 'DELETE_CHANNEL':
                const channelToDelete = data.payload;
                if (channels.has(channelToDelete)) {
                    channels.get(channelToDelete).clients.forEach(client => { client.socket.send(JSON.stringify({ type: 'channel_deleted' })); client.socket.close(); });
                    channels.delete(channelToDelete); validChannels.delete(channelToDelete); updateAdminPanel();
                }
                break;
            case 'BAN_IP':
                const ipToBan = data.payload;
                bannedIPs.add(ipToBan);
                channels.forEach(channelData => {
                    channelData.clients.forEach(client => {
                        if (client.ip === ipToBan) client.socket.close(1008, 'Sei stato espulso dal sistema.');
                    });
                });
                updateAdminPanel();
                break;
            case 'UNBAN_IP':
                const ipToUnban = data.payload;
                bannedIPs.delete(ipToUnban);
                updateAdminPanel();
                break;
            case 'BROADCAST':
                const broadcastMessage = { codename: '[BROADCAST]', text: data.payload, timestamp: new Date().toISOString() };
                channels.forEach(channelData => {
                    channelData.messages.push(broadcastMessage);
                    channelData.clients.forEach(client => client.socket.send(JSON.stringify(broadcastMessage)));
                });
                if(adminSocket) adminSocket.send(JSON.stringify({ type: 'new_message', payload: { ...broadcastMessage, channelName: 'ALL' } }));
                break;
            case 'SELF_DESTRUCT':
                wss.clients.forEach(client => client.send(JSON.stringify({ type: 'system_shutdown' })));
                setTimeout(() => process.exit(0), 500);
                break;
        }
    });

    ws.on('close', () => {
        adminSocket = null;
        clearInterval(heartbeatInterval);
    });
}

function handleUserConnection(ws, req, channelName) {
    const channelData = channels.get(channelName);
    if (!channelData) { ws.close(1008, 'Canale non inizializzato.'); return; }
    
    const clientInfo = { socket: ws, ip: req.socket.remoteAddress, country: getCountryFromIp(req.socket.remoteAddress), codename: `Operator-${Math.floor(Math.random()*900)+100}` };
    ws.send(JSON.stringify({ type: 'chat_history', payload: {messages: channelData.messages, codename: clientInfo.codename} }));
    channelData.clients.add(clientInfo);
    updateAdminPanel();

    ws.on('message', (messageAsString) => {
        const messageData = JSON.parse(messageAsString);
        const fullMessage = { ...messageData, timestamp: new Date().toISOString() };
        channelData.messages.push(fullMessage);
        channelData.clients.forEach(client => { if (client.socket !== ws) client.socket.send(JSON.stringify(fullMessage)); });
        if (adminSocket) adminSocket.send(JSON.stringify({ type: 'new_message', payload: { ...fullMessage, channelName } }));
    });
    ws.on('close', () => { channelData.clients.delete(clientInfo); updateAdminPanel(); });
}

function getFullState() {
    const allClients = [];
    channels.forEach((data, channelName) => { data.clients.forEach(c => allClients.push({ip: c.ip, country: c.country, codename: c.codename, channel: channelName}))});
    const activeChannels = Array.from(channels.entries()).map(([name, data]) => ({ name, clientCount: data.clients.size, messageCount: data.messages.length }));
    return { channels: activeChannels, onlineUsers: wss.clients.size-(adminSocket?1:0), validChannelCount: validChannels.size, bannedIPs: Array.from(bannedIPs), clients: allClients, allValidChannels: Array.from(validChannels) };
}

function getCountryFromIp(ip){const c=['USA','RUS','CHN','DEU','GBR','BRA','CAN','AUS','JPN','ITA'];let h=0;for(let i=0;i<ip.length;i++)h=ip.charCodeAt(i)+((h<<5)-h);return c[Math.abs(h)%c.length]}
function updateAdminPanel(){if(adminSocket?.readyState===WebSocket.OPEN)adminSocket.send(JSON.stringify({type:'update',payload:getFullState()}))}

// MODIFICATO: Per funzionare online
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 SPECTRE server operativo sulla porta ${PORT}`));