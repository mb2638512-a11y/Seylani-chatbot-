/* ============================================
   NexusAI Chatbot — Core Logic + API + Voice
   ============================================ */

(function () {
    'use strict';

    // ─── Config ───
    const API_KEY = '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';
    const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
    const SYSTEM_PROMPT = `You are NexusAI, a brilliant, friendly, and enthusiastic AI assistant built for a hackathon. You help with coding, debugging, project ideas, tech stack advice, presentations, and general knowledge. You respond in the SAME LANGUAGE the user writes in. If they write in Urdu, respond in Urdu. If Spanish, respond in Spanish. Always be helpful, use emojis to be engaging, and format responses with markdown (bold, lists, code blocks). Keep responses concise but thorough.`;

    // ─── DOM References ───
    const $ = (s) => document.querySelector(s);
    const chatMessages = $('#chatMessages');
    const chatInput = $('#chatInput');
    const sendBtn = $('#sendBtn');
    const welcomeScreen = $('#welcomeScreen');
    const typingIndicator = $('#typingIndicator');
    const sidebar = $('#sidebar');
    const sidebarOverlay = $('#sidebarOverlay');
    const menuBtn = $('#menuBtn');
    const sidebarCloseBtn = $('#sidebarCloseBtn');
    const newChatBtn = $('#newChatBtn');
    const chatHistory = $('#chatHistory');
    const clearAllBtn = $('#clearAllBtn');
    const emojiBtn = $('#emojiBtn');
    const emojiPicker = $('#emojiPicker');
    const emojiGrid = $('#emojiGrid');
    const suggestionChips = $('#suggestionChips');
    const bgParticles = $('#bgParticles');
    const modelSelect = $('#modelSelect');
    const voiceBtn = $('#voiceBtn');
    const voiceOutputToggle = $('#voiceOutputToggle');
    const voiceModal = $('#voiceModal');
    const voiceModalClose = $('#voiceModalClose');
    const voiceSettingsBtn = $('#voiceSettingsBtn');
    const voiceSelect = $('#voiceSelect');
    const speechRateInput = $('#speechRate');
    const rateValue = $('#rateValue');
    const autoReadToggle = $('#autoReadToggle');
    const statusText = $('#statusText');
    const themeToggleBtn = $('#themeToggleBtn');
    const themeIcon = $('#themeIcon');

    // ─── State ───
    let conversations = JSON.parse(localStorage.getItem('nexus_conversations') || '{}');
    let activeConversationId = localStorage.getItem('nexus_active_id') || null;
    let isTyping = false;
    let isRecording = false;
    let recognition = null;
    let voiceOutputEnabled = JSON.parse(localStorage.getItem('nexus_voice_output') || 'false');
    let autoRead = JSON.parse(localStorage.getItem('nexus_auto_read') || 'false');
    let speechRate = parseFloat(localStorage.getItem('nexus_speech_rate') || '1');
    let selectedVoice = localStorage.getItem('nexus_voice') || '';
    let currentTheme = localStorage.getItem('nexus_theme') || 'dark';

    // ─── Emoji Data ───
    const emojis = [
        '😀', '😂', '🤣', '😍', '🥰', '😎', '🤩', '🥳',
        '😇', '🤔', '🤗', '🫡', '😏', '😅', '🙃', '😜',
        '👍', '👏', '🙌', '💪', '🔥', '⭐', '💡', '🎯',
        '🚀', '💻', '🤖', '🧠', '⚡', '✨', '🎉', '❤️',
        '💜', '💙', '💚', '🧡', '📝', '📌', '🔗', '👀',
        '🥇', '🏆', '🎓', '📚', '🧪', '🔬', '🎮', '🕹️',
        '🌍', '🌈', '☀️', '🌙', '🍕', '🍔', '☕', '🧃',
        '🐱', '🐶', '🦄', '🐝', '🌸', '🌺', '🍀', '🎵',
        '😢', '😤', '🥺', '😈', '💀', '👻', '🎃', '🤝',
        '✅', '❌', '⚠️', '💯', '🆒', '🔑', '💎', '🪄',
    ];

    // ─── Initialize Voice Recognition ───
    function initVoiceRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            voiceBtn.title = 'Voice not supported in this browser';
            voiceBtn.style.opacity = '0.3';
            return;
        }
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = ''; // auto-detect

        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            chatInput.value = transcript;
            updateSendButton();
            autoResizeTextarea();
        };

        recognition.onend = () => {
            isRecording = false;
            voiceBtn.classList.remove('recording');
            // Auto-send if we got text
            if (chatInput.value.trim()) {
                sendMessage();
            }
        };

        recognition.onerror = (e) => {
            isRecording = false;
            voiceBtn.classList.remove('recording');
            if (e.error !== 'no-speech') {
                console.error('Speech recognition error:', e.error);
            }
        };
    }

    function toggleVoiceRecording() {
        if (!recognition) return;
        if (isRecording) {
            recognition.stop();
        } else {
            chatInput.value = '';
            recognition.start();
            isRecording = true;
            voiceBtn.classList.add('recording');
        }
    }

    // ─── Voice Output (Text-to-Speech) ───
    function speakText(text) {
        if (!voiceOutputEnabled && !autoRead) return;
        // Clean markdown for speech
        const clean = text
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/```[\s\S]*?```/g, ' code block ')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/^[#>•\-\d.]+\s?/gm, '')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.rate = speechRate;

        // Find the selected voice
        const voices = speechSynthesis.getVoices();
        if (selectedVoice) {
            const found = voices.find(v => v.name === selectedVoice);
            if (found) utterance.voice = found;
        }

        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
    }

    function loadVoices() {
        const voices = speechSynthesis.getVoices();
        voiceSelect.innerHTML = '';
        if (voices.length === 0) {
            voiceSelect.innerHTML = '<option value="">Default</option>';
            return;
        }
        voices.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.name;
            opt.textContent = `${v.name} (${v.lang})`;
            if (v.name === selectedVoice) opt.selected = true;
            voiceSelect.appendChild(opt);
        });
    }

    // ─── Dynamic Model Fetching ───
    async function fetchFreeModels() {
        const modelLoading = $('#modelLoading');
        try {
            const res = await fetch('https://openrouter.ai/api/v1/models', {
                headers: { 'Authorization': `Bearer ${API_KEY}` }
            });
            if (!res.ok) throw new Error('Failed to fetch models');
            const data = await res.json();

            // Filter free models (prompt price = 0)
            const freeModels = data.data
                .filter(m => m.pricing && parseFloat(m.pricing.prompt) === 0 && parseFloat(m.pricing.completion) === 0)
                .sort((a, b) => (b.context_length || 0) - (a.context_length || 0))
                .slice(0, 20);

            if (freeModels.length > 0) {
                const group = document.createElement('optgroup');
                group.label = '🆓 Free Models';
                freeModels.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    // Clean up model name
                    const name = (m.name || m.id).replace(/ \(free\)/i, '');
                    opt.textContent = name;
                    group.appendChild(opt);
                });
                modelSelect.appendChild(group);
            }

            if (modelLoading) modelLoading.style.display = 'none';
        } catch (err) {
            console.warn('Could not fetch models:', err);
            if (modelLoading) modelLoading.textContent = 'Using auto mode';
        }
    }

    // ─── Background Particles ───
    function createParticles() {
        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.classList.add('particle');
            const size = Math.random() * 4 + 2;
            const colors = ['#a855f7', '#06b6d4', '#8b5cf6', '#22d3ee', '#7c3aed'];
            particle.style.cssText = `
                width: ${size}px; height: ${size}px;
                left: ${Math.random() * 100}%;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                animation-duration: ${Math.random() * 15 + 10}s;
                animation-delay: ${Math.random() * 10}s;
            `;
            bgParticles.appendChild(particle);
        }
    }

    // ─── Emoji Picker ───
    function initEmojiPicker() {
        emojis.forEach(emoji => {
            const item = document.createElement('button');
            item.classList.add('emoji-item');
            item.textContent = emoji;
            item.addEventListener('click', () => {
                chatInput.value += emoji;
                chatInput.focus();
                toggleEmojiPicker(false);
                updateSendButton();
            });
            emojiGrid.appendChild(item);
        });
    }

    function toggleEmojiPicker(show) {
        emojiPicker.classList.toggle('visible', show !== undefined ? show : !emojiPicker.classList.contains('visible'));
    }

    // ─── Conversation Management ───
    function generateId() {
        return 'conv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    }

    function createNewConversation() {
        const id = generateId();
        conversations[id] = { id, title: 'New Chat', messages: [], apiMessages: [], createdAt: Date.now() };
        activeConversationId = id;
        saveState();
        renderChatHistory();
        clearMessages();
        showWelcomeScreen(true);
        chatInput.focus();
    }

    function getActiveConversation() {
        if (!activeConversationId || !conversations[activeConversationId]) {
            createNewConversation();
        }
        return conversations[activeConversationId];
    }

    function switchConversation(id) {
        if (!conversations[id]) return;
        activeConversationId = id;
        saveState();
        renderChatHistory();
        renderMessages(conversations[id].messages);
        closeSidebar();
    }

    function deleteConversation(id, e) {
        e.stopPropagation();
        delete conversations[id];
        if (activeConversationId === id) {
            const keys = Object.keys(conversations);
            keys.length > 0 ? switchConversation(keys[keys.length - 1]) : createNewConversation();
        }
        saveState();
        renderChatHistory();
    }

    function clearAllConversations() {
        if (!confirm('Clear all chat history? This cannot be undone.')) return;
        conversations = {};
        localStorage.removeItem('nexus_conversations');
        localStorage.removeItem('nexus_active_id');
        createNewConversation();
    }

    function saveState() {
        localStorage.setItem('nexus_conversations', JSON.stringify(conversations));
        localStorage.setItem('nexus_active_id', activeConversationId);
    }

    // ─── Render Chat History ───
    function renderChatHistory() {
        chatHistory.innerHTML = '';
        const sorted = Object.values(conversations).sort((a, b) => b.createdAt - a.createdAt);
        if (sorted.length === 0) {
            chatHistory.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:0.8rem;text-align:center;">No conversations yet</div>';
            return;
        }
        sorted.forEach(conv => {
            const item = document.createElement('div');
            item.classList.add('chat-history-item');
            if (conv.id === activeConversationId) item.classList.add('active');
            item.innerHTML = `
                <svg class="item-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                <span class="item-text">${escapeHtml(conv.title)}</span>
                <button class="delete-chat-btn" aria-label="Delete"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            `;
            item.addEventListener('click', () => switchConversation(conv.id));
            item.querySelector('.delete-chat-btn').addEventListener('click', (e) => deleteConversation(conv.id, e));
            chatHistory.appendChild(item);
        });
    }

    // ─── Render Messages ───
    function renderMessages(messages) {
        clearMessages();
        if (!messages || messages.length === 0) { showWelcomeScreen(true); return; }
        showWelcomeScreen(false);
        messages.forEach(msg => appendMessageDOM(msg.role, msg.content, msg.time, false));
        scrollToBottom();
    }

    function clearMessages() {
        chatMessages.querySelectorAll('.message').forEach(m => m.remove());
    }

    function showWelcomeScreen(show) {
        if (welcomeScreen) welcomeScreen.style.display = show ? 'flex' : 'none';
    }

    function appendMessageDOM(role, content, time, animate = true) {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', role);
        if (!animate) msgDiv.style.animation = 'none';

        const avatarContent = role === 'bot'
            ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>'
            : '👤';

        msgDiv.innerHTML = `
            <div class="message-avatar">${avatarContent}</div>
            <div class="message-content">
                <div class="message-bubble">${formatMessage(content)}</div>
                <span class="message-time">${time}</span>
            </div>
        `;
        chatMessages.appendChild(msgDiv);
        if (animate) scrollToBottom();
    }

    // ─── Format Message ───
    function formatMessage(text) {
        let html = escapeHtml(text);
        html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
        html = html.replace(/^&gt; (.+)$/gm, '<blockquote style="border-left:3px solid var(--accent-start);padding-left:12px;margin:8px 0;color:var(--text-secondary);font-style:italic;">$1</blockquote>');
        html = html.replace(/^[•\-] (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
        html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
        html = html.replace(/\n/g, '<br>');
        return html;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ─── OpenRouter API Call ───
    async function callOpenRouterAPI(conv) {
        const model = modelSelect.value;
        const apiMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...(conv.apiMessages || [])
        ];

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.href,
                'X-Title': 'NexusAI Hackathon Chatbot'
            },
            body: JSON.stringify({
                model: model,
                messages: apiMessages,
                max_tokens: 2048,
                temperature: 0.7,
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`API Error ${response.status}: ${err}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    // ─── Send Message ───
    async function sendMessage(text) {
        const message = (text || chatInput.value).trim();
        if (!message || isTyping) return;

        const conv = getActiveConversation();
        showWelcomeScreen(false);

        if (conv.messages.length === 0) {
            conv.title = message.length > 35 ? message.slice(0, 35) + '...' : message;
        }

        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Add user message
        conv.messages.push({ role: 'user', content: message, time: timeStr });
        if (!conv.apiMessages) conv.apiMessages = [];
        conv.apiMessages.push({ role: 'user', content: message });
        appendMessageDOM('user', message, timeStr);

        chatInput.value = '';
        chatInput.style.height = 'auto';
        updateSendButton();
        saveState();
        renderChatHistory();

        // Show typing
        showTyping(true);
        statusText.textContent = 'Thinking...';

        try {
            const response = await callOpenRouterAPI(conv);
            showTyping(false);
            statusText.textContent = 'Online — AI Powered';

            const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            conv.messages.push({ role: 'bot', content: response, time: botTime });
            conv.apiMessages.push({ role: 'assistant', content: response });

            // Keep API context manageable (last 20 messages)
            if (conv.apiMessages.length > 20) {
                conv.apiMessages = conv.apiMessages.slice(-20);
            }

            appendMessageDOM('bot', response, botTime);
            saveState();

            // Auto-read response aloud
            if (autoRead || voiceOutputEnabled) {
                speakText(response);
            }
        } catch (error) {
            showTyping(false);
            statusText.textContent = 'Online — AI Powered';
            const errMsg = `⚠️ Sorry, I encountered an error: ${error.message}\n\nPlease try again or switch to a different model.`;
            const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            conv.messages.push({ role: 'bot', content: errMsg, time: botTime });
            appendMessageDOM('bot', errMsg, botTime);
            saveState();
        }
    }

    // ─── Typing Indicator ───
    function showTyping(show) {
        isTyping = show;
        typingIndicator.classList.toggle('visible', show);
        if (show) scrollToBottom();
    }

    function scrollToBottom() {
        requestAnimationFrame(() => { chatMessages.scrollTop = chatMessages.scrollHeight; });
    }

    function updateSendButton() {
        const hasText = chatInput.value.trim().length > 0;
        sendBtn.classList.toggle('active', hasText);
        sendBtn.disabled = !hasText;
    }

    function openSidebar() { sidebar.classList.add('open'); sidebarOverlay.classList.add('visible'); }
    function closeSidebar() { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('visible'); }

    function autoResizeTextarea() {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    }

    // ─── Event Listeners ───
    sendBtn.addEventListener('click', () => sendMessage());

    chatInput.addEventListener('input', () => { updateSendButton(); autoResizeTextarea(); });
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    menuBtn.addEventListener('click', openSidebar);
    sidebarCloseBtn.addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);
    newChatBtn.addEventListener('click', createNewConversation);
    clearAllBtn.addEventListener('click', clearAllConversations);

    emojiBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleEmojiPicker(); });
    document.addEventListener('click', (e) => {
        if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) toggleEmojiPicker(false);
    });

    suggestionChips.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (chip) { const msg = chip.getAttribute('data-message'); if (msg) sendMessage(msg); }
    });

    // Voice input
    voiceBtn.addEventListener('click', toggleVoiceRecording);

    // Voice output toggle
    voiceOutputToggle.addEventListener('click', () => {
        voiceOutputEnabled = !voiceOutputEnabled;
        voiceOutputToggle.classList.toggle('voice-active', voiceOutputEnabled);
        localStorage.setItem('nexus_voice_output', JSON.stringify(voiceOutputEnabled));
        if (!voiceOutputEnabled) speechSynthesis.cancel();
    });

    // Voice settings modal
    voiceSettingsBtn.addEventListener('click', () => { voiceModal.classList.add('visible'); closeSidebar(); });
    voiceModalClose.addEventListener('click', () => voiceModal.classList.remove('visible'));
    voiceModal.addEventListener('click', (e) => { if (e.target === voiceModal) voiceModal.classList.remove('visible'); });

    voiceSelect.addEventListener('change', () => {
        selectedVoice = voiceSelect.value;
        localStorage.setItem('nexus_voice', selectedVoice);
    });

    speechRateInput.addEventListener('input', () => {
        speechRate = parseFloat(speechRateInput.value);
        rateValue.textContent = speechRate.toFixed(1) + 'x';
        localStorage.setItem('nexus_speech_rate', speechRate);
    });

    autoReadToggle.addEventListener('change', () => {
        autoRead = autoReadToggle.checked;
        localStorage.setItem('nexus_auto_read', JSON.stringify(autoRead));
    });

    // Model change
    modelSelect.addEventListener('change', () => {
        const selected = modelSelect.options[modelSelect.selectedIndex].text;
        statusText.textContent = `Online — ${selected}`;
    });

    // Theme toggle
    themeToggleBtn.addEventListener('click', () => {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', currentTheme);
        localStorage.setItem('nexus_theme', currentTheme);
        updateThemeIcon();
    });

    function updateThemeIcon() {
        if (!themeIcon) return;
        if (currentTheme === 'light') {
            themeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>';
        } else {
            themeIcon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
        }
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { closeSidebar(); toggleEmojiPicker(false); voiceModal.classList.remove('visible'); }
    });

    // ─── Initialize ───
    function init() {
        createParticles();
        initEmojiPicker();
        initVoiceRecognition();
        fetchFreeModels();

        // Restore theme
        document.documentElement.setAttribute('data-theme', currentTheme);
        updateThemeIcon();

        // Load voices
        loadVoices();
        speechSynthesis.addEventListener('voiceschanged', loadVoices);

        // Restore settings
        speechRateInput.value = speechRate;
        rateValue.textContent = speechRate.toFixed(1) + 'x';
        autoReadToggle.checked = autoRead;
        if (voiceOutputEnabled) voiceOutputToggle.classList.add('voice-active');

        // Load conversations
        if (activeConversationId && conversations[activeConversationId]) {
            renderMessages(conversations[activeConversationId].messages);
        } else {
            createNewConversation();
        }
        renderChatHistory();
        chatInput.focus();

        // Show current model
        const selected = modelSelect.options[modelSelect.selectedIndex].text;
        statusText.textContent = `Online — ${selected}`;
    }

    init();
})();
