document.addEventListener('DOMContentLoaded', () => {
    // Riferimenti DOM
    const modalContainer = document.getElementById('modal-container'),
        loginScreen = document.getElementById('admin-login-screen'),
        dashboard = document.getElementById('admin-dashboard'),
        loginForm = document.getElementById('admin-login-form'),
        passwordInput = document.getElementById('admin-password'),
        notificationCount = document.getElementById('notification-count'),
        onlineUsersEl = document.getElementById('online-users-count'),
        validChannelsEl = document.getElementById('valid-channels-count'),
        activeChannelsEl = document.getElementById('active-channels-count'),
        channelListEl = document.getElementById('channel-list'),
        chatViewerHeader = document.getElementById('chat-viewer-header'),
        chatViewerMessages = document.getElementById('chat-viewer-messages'),
        adminReplyForm = document.getElementById('admin-reply-form'),
        adminReplyInput = document.getElementById('admin-reply-input'),
        createChannelBtn = document.getElementById('create-channel-btn'),
        selfDestructBtn = document.getElementById('self-destruct-btn'),
        destructOverlay = document.getElementById('destruct-overlay'),
        cancelDestructBtn = document.getElementById('cancel-destruct-btn'),
        countdownDisplay = document.getElementById('countdown'),
        advancedModeBtn = document.getElementById('advanced-mode-btn'),
        advancedDashboardOverlay = document.getElementById('advanced-dashboard-overlay'),
        closeAdvancedDashboardBtn = document.getElementById('close-advanced-dashboard'),
        chatViewerTitle = document.getElementById('chat-viewer-title'),
        deleteChannelBtn = document.getElementById('delete-channel-btn'),
        packetInterceptorContent = document.getElementById('packet-interceptor-content'),
        banishmentProtocolContent = document.getElementById('banishment-protocol-content'),
        unbanList = document.getElementById('unban-list'),
        integrityScanLog = document.getElementById('integrity-scan-log'),
        runIntegrityScanBtn = document.getElementById('run-integrity-scan'),
        broadcastForm = document.getElementById('broadcast-form'),
        broadcastInput = document.getElementById('broadcast-input'),
        allChannelsList = document.getElementById('all-channels-list'),
        performanceWidget = document.getElementById('performance-widget'),
        supportTicketsContent = document.getElementById('support-tickets-content');
    
    // Variabili di stato
    let adminSocket, activeChannel = null, unreadMessages = new Map(), countdownInterval, messageLogs = new Map(), map, mapMarkers = [], heartbeatTimer;
    
    const INFO_TEXTS = {
        map: "<strong>Mappa Globale:</strong><br>Visualizza la posizione geografica simulata di ogni operatore. È possibile zoomare e interagire con la mappa.",
        integrity: "<strong>System Integrity:</strong><br>Esegue una scansione simulata dei moduli critici del server.",
        unban: "<strong>Gestione Ban:</strong><br>Mostra la lista degli IP bannati e permette di revocare un ban cliccando su [RIAMMETTI].",
        interceptor: "<strong>Keylogger Etico:</strong><br>Mostra un feed in tempo reale di ogni singolo messaggio che transita sul server.",
        banishment: "<strong>Protocollo Espulsione:</strong><br>Visualizza tutti gli operatori connessi. Cliccando su [BAN], il loro IP verrà bannato.",
        broadcast: "<strong>Messaggio Broadcast:</strong><br>Invia un messaggio di massima priorità a tutti gli utenti connessi.",
        channels: "<strong>Gestione Canali:</strong><br>Visualizza tutti i codici canale validi, anche quelli vuoti, e permette di eliminarli.",
        performance: "<strong>Performance:</strong><br>Monitora in tempo reale l'attività dei messaggi e l'utilizzo simulato di CPU e Memoria del server.",
        support: "<strong>Terminale Assistenza:</strong><br>Visualizza i ticket di assistenza inviati dagli utenti in tempo reale e permette di rispondere creando un canale di supporto dedicato."
    };

    function connectAdmin() {
        adminSocket = new WebSocket('ws://localhost:3000?admin=true');
        startHeartbeat();
        adminSocket.onmessage = event => {
            const data = JSON.parse(event.data);
            resetHeartbeat();
            switch (data.type) {
                case 'ping': break;
                case 'full_state': case 'update': updateDashboard(data.payload); break;
                case 'new_message': handleNewMessage(data.payload); break;
                case 'channel_created': navigator.clipboard.writeText(data.payload).then(() => showModal('CODICE GENERATO', `Copiato negli appunti:<br><br><strong>${data.payload}</strong>`)); break;
                case 'system_shutdown': window.location.href = '/blackout.html'; return;
                case 'new_ticket': handleNewTicket(data.payload); break;
            }
        };
        adminSocket.onclose = () => showModal("CONNESSIONE PERSA", "Disconnesso dal server. Ricarica la pagina.", true);
    }
    
    function startHeartbeat() { heartbeatTimer = setTimeout(() => { window.location.href = '/blackout.html' }, 5000) }
    function resetHeartbeat() { clearTimeout(heartbeatTimer); startHeartbeat() }
    
    function initMap() { if (mapContainer && !map) { map = L.map(mapContainer, { center: [20, 0], zoom: 2 }); L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: null, subdomains: 'abcd', maxZoom: 19 }).addTo(map); } }
    
    function updateMap(clients) {
        if (!map) return;
        mapMarkers.forEach(m => map.removeLayer(m));
        mapMarkers = [];
        const countryCoords = { USA: [39.8, -98.5], RUS: [61.5, 95.7], CHN: [35.8, 104.1], DEU: [51.1, 10.4], GBR: [55.3, -3.4], BRA: [-14.2, -51.9], CAN: [56.1, -106.3], AUS: [-25.2, 133.7], JPN: [36.2, 138.2], ITA: [41.8, 12.5] };
        clients.forEach(c => {
            const coords = countryCoords[c.country] || [20, 0];
            const marker = L.marker(coords).addTo(map);
            marker.bindPopup(`<strong>${c.codename}</strong><br>${c.ip}<br>@ ${c.channel.substring(0, 10)}...`);
            mapMarkers.push(marker);
        });
    }

    function updateDashboard(state) {
        onlineUsersEl.textContent = state.onlineUsers;
        validChannelsEl.textContent = state.validChannelCount;
        activeChannelsEl.textContent = state.channels.length;
        channelListEl.innerHTML = '';
        state.channels.forEach(ch => {
            const unread = unreadMessages.get(ch.name) || 0;
            const div = document.createElement('div');
            div.className = 'channel-item-admin';
            div.dataset.channel = ch.name;
            if (ch.name === activeChannel) div.classList.add('active');
            div.innerHTML = `<span>${ch.name.substring(0, 15)}... (${ch.clientCount} op.)</span><div class="channel-stats"><span>MSG: ${ch.messageCount}</span><span class="unread-badge ${unread > 0 ? '' : 'hidden'}">${unread}</span></div>`;
            div.onclick = () => selectChannel(ch.name);
            channelListEl.appendChild(div);
        });
        updateMap(state.clients);
        banishmentProtocolContent.innerHTML = '';
        state.clients.forEach(c => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `<span><strong>${c.codename}</strong><br><small>${c.ip} @ ${c.channel.substring(0, 10)}...</small></span><button class="action-btn ban-btn" data-ip="${c.ip}">BAN</button>`;
            banishmentProtocolContent.appendChild(item);
        });
        unbanList.innerHTML = '';
        state.bannedIPs.forEach(ip => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `<span>${ip}</span><button class="action-btn unban-btn" data-ip="${ip}">UNBAN</button>`;
            unbanList.appendChild(item);
        });
        allChannelsList.innerHTML = '';
        state.allValidChannels.forEach(ch => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `<span>${ch.substring(0, 25)}...</span><button class="action-btn ban-btn" data-channel="${ch}">DELETE</button>`;
            allChannelsList.appendChild(item);
        });
    }

    function handleNewMessage(message) {
        if (!messageLogs.has(message.channelName)) messageLogs.set(message.channelName, []);
        messageLogs.get(message.channelName).push(message);
        const packet = document.createElement('div');
        packet.className = 'packet';
        packet.innerHTML = `<span class="from">${message.codename}</span> -> <span class="to">${message.channelName.substring(0, 10)}...</span>: ${escapeHTML(message.text)}`;
        packetInterceptorContent.prepend(packet);
        if (packetInterceptorContent.children.length > 50) packetInterceptorContent.lastChild.remove();
        if (message.channelName === activeChannel) {
            const msgDiv = document.createElement('div');
            msgDiv.className = 'message-log-item';
            msgDiv.innerHTML = `<span class="codename">${message.codename}:</span> ${escapeHTML(message.text)}`;
            chatViewerMessages.appendChild(msgDiv);
            chatViewerMessages.scrollTop = chatViewerMessages.scrollHeight;
        } else if (message.channelName !== 'ALL') {
            unreadMessages.set(message.channelName, (unreadMessages.get(message.channelName) || 0) + 1);
            updateNotificationDisplay();
        }
    }
    
    function handleNewTicket(ticket) {
        const ticketEl = document.createElement('div');
        ticketEl.className = 'list-item';
        ticketEl.innerHTML = `<span><strong>${ticket.codename || 'Anonimo'}</strong><br><small>${escapeHTML(ticket.message.substring(0, 30))}...</small></span><button class="action-btn unban-btn" data-ticket='${JSON.stringify(ticket)}'>RISPONDI</button>`;
        supportTicketsContent.prepend(ticketEl);
        notificationCount.textContent = '!!';
        notificationCount.classList.remove('hidden');
    }

    function selectChannel(channelName) {
        document.querySelector('.channel-item-admin.active')?.classList.remove('active');
        activeChannel = channelName;
        document.querySelector(`.channel-item-admin[data-channel="${channelName}"]`)?.classList.add('active');
        chatViewerTitle.textContent = `Monitoraggio: ${channelName}`;
        deleteChannelBtn.classList.remove('hidden');
        adminReplyForm.classList.remove('hidden');
        chatViewerMessages.innerHTML = '';
        (messageLogs.get(channelName) || []).forEach(msg => {
            const msgDiv = document.createElement('div');
            msgDiv.className = 'message-log-item';
            msgDiv.innerHTML = `<span class="codename">${msg.codename}:</span> ${escapeHTML(msg.text)}`;
            chatViewerMessages.appendChild(msgDiv);
        });
        unreadMessages.set(channelName, 0);
        updateNotificationDisplay();
        chatViewerMessages.scrollTop = chatViewerMessages.scrollHeight;
        adminReplyInput.focus();
    }
    
    function updateNotificationDisplay() {
        let total = 0;
        unreadMessages.forEach(c => total += c);
        if (notificationCount.textContent !== '!!') notificationCount.textContent = total;
        notificationCount.classList.toggle('hidden', total === 0 && notificationCount.textContent !== '!!');
        document.querySelectorAll('.channel-item-admin').forEach(item => {
            const badge = item.querySelector('.unread-badge');
            const unread = unreadMessages.get(item.dataset.channel) || 0;
            badge.textContent = unread;
            badge.classList.toggle('hidden', unread === 0);
        });
    }
    
    async function runIntegrityScan() {
        const sleep = ms => new Promise(res => setTimeout(res, ms));
        const steps = ["AVVIO SCANSIONE INTEGRITÀ SISTEMA...", "Verifica moduli core...", "Verifica protocolli di crittografia...", "Analisi firme di connessione...", "Controllo registri di accesso...", "Scansione anomalie di traffico...", "CONTROLLO INTEGRITÀ COMPLETATO. NESSUNA MINACCIA RILEVATA."];
        integrityScanLog.innerHTML = '';
        runIntegrityScanBtn.disabled = true;
        for (const step of steps) {
            const p = document.createElement('p');
            p.textContent = `[${new Date().toLocaleTimeString()}] ${step}`;
            integrityScanLog.appendChild(p);
            integrityScanLog.scrollTop = integrityScanLog.scrollHeight;
            await sleep(700);
        }
        runIntegrityScanBtn.disabled = false;
    }

    loginForm.addEventListener('submit', e => { e.preventDefault(); if (passwordInput.value === 'bombolone82') { loginScreen.classList.add('hidden'); dashboard.classList.remove('hidden'); connectAdmin(); initMap(); } else { showModal("ACCESSO NEGATO", "La chiave di accesso non è corretta.", true); } });
    createChannelBtn.addEventListener('click', () => { if (adminSocket?.readyState === WebSocket.OPEN) adminSocket.send(JSON.stringify({ type: 'CREATE_CHANNEL' })); });
    adminReplyForm.addEventListener('submit', e => { e.preventDefault(); const text = adminReplyInput.value.trim(); if (text && activeChannel && adminSocket?.readyState === WebSocket.OPEN) { const msg = { type: 'ADMIN_REPLY', payload: { channelName: activeChannel, text } }; adminSocket.send(JSON.stringify(msg)); adminReplyInput.value = ''; } });
    deleteChannelBtn.addEventListener('click', () => { if (activeChannel) { showModal("CONFERMA ELIMINAZIONE", `Sei sicuro di voler eliminare permanentemente il canale <strong>${activeChannel.substring(0, 15)}...</strong>?`, true, () => { adminSocket.send(JSON.stringify({ type: 'DELETE_CHANNEL', payload: activeChannel })); chatViewerTitle.textContent = "Seleziona un canale"; chatViewerMessages.innerHTML = ""; adminReplyForm.classList.add('hidden'); deleteChannelBtn.classList.add('hidden'); activeChannel = null; }); } });
    advancedModeBtn.addEventListener('click', () => advancedDashboardOverlay.classList.add('visible'));
    closeAdvancedDashboardBtn.addEventListener('click', () => advancedDashboardOverlay.classList.remove('visible'));
    selfDestructBtn.addEventListener('click', () => { showModal("ATTIVARE PROTOCOLLO EMERGENZA?", "Questa azione è irreversibile e terminerà immediatamente il server.", true, () => { destructOverlay.classList.remove('hidden'); let s = 10; countdownDisplay.textContent = s; countdownInterval = setInterval(() => { s--; countdownDisplay.textContent = s; if (s < 0) { clearInterval(countdownInterval); if (adminSocket?.readyState === WebSocket.OPEN) adminSocket.send(JSON.stringify({ type: 'SELF_DESTRUCT' })); } }, 1000); }).querySelector('.confirm-btn').textContent = "CONFERMA AUTODISTRUZIONE"; });
    cancelDestructBtn.addEventListener('click', () => { clearInterval(countdownInterval); destructOverlay.classList.add('hidden'); });
    
    document.querySelectorAll('.info-icon').forEach(icon => icon.addEventListener('click', e => { e.stopPropagation(); showModal("INFORMAZIONI STRUMENTO", INFO_TEXTS[e.target.dataset.info], false); }));
    
    banishmentProtocolContent.addEventListener('click', e => { if (e.target.classList.contains('ban-btn')) { const ip = e.target.dataset.ip; showModal("CONFERMA ESPULSIONE", `Sei sicuro di voler bannare permanentemente l'IP <strong>${ip}</strong>?`, true, () => { adminSocket.send(JSON.stringify({ type: 'BAN_IP', payload: ip })); }); } });
    unbanList.addEventListener('click', e => { if (e.target.classList.contains('unban-btn')) { const ip = e.target.dataset.ip; showModal("CONFERMA RIAMMISSIONE", `Sei sicuro di voler revocare il ban per l'IP <strong>${ip}</strong>?`, false, () => adminSocket.send(JSON.stringify({ type: 'UNBAN_IP', payload: ip }))).querySelector('.confirm-btn').textContent = "RIAMMETTI"; } });
    allChannelsList.addEventListener('click', e => { if (e.target.classList.contains('ban-btn')) { const ch = e.target.dataset.channel; showModal("CONFERMA ELIMINAZIONE", `Sei sicuro di voler eliminare il canale <strong>${ch.substring(0, 15)}...</strong>?`, true, () => adminSocket.send(JSON.stringify({ type: 'DELETE_CHANNEL', payload: ch }))); } });
    runIntegrityScanBtn.addEventListener('click', runIntegrityScan);
    broadcastForm.addEventListener('submit', e => { e.preventDefault(); const text = broadcastInput.value.trim(); if (text && adminSocket?.readyState === WebSocket.OPEN) { showModal("CONFERMA BROADCAST", `Sei sicuro di voler inviare il messaggio "${text}" a TUTTI gli utenti connessi?`, true, () => { adminSocket.send(JSON.stringify({ type: 'BROADCAST', payload: text })); broadcastInput.value = ''; }); } });
    supportTicketsContent.addEventListener('click', e => {
        if (e.target.classList.contains('unban-btn')) {
            const ticket = JSON.parse(e.target.dataset.ticket);
            showModal("RISPOSTA A TICKET", `Stai per creare un nuovo canale di supporto per rispondere a <strong>${ticket.codename || 'Anonimo'}</strong>. Comunica il codice generato all'utente.`, false, () => {
                if (adminSocket?.readyState === WebSocket.OPEN) adminSocket.send(JSON.stringify({ type: 'CREATE_CHANNEL' }));
            }).querySelector('.confirm-btn').textContent = "CREA CANALE";
        }
    });
});