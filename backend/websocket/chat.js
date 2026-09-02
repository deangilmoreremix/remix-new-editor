import { WebSocketServer } from 'ws';
import ChatDb from '../db/chatDb.js';

function setupChatWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/chat' });

  wss.on('connection', (ws, req) => {
    const params = new URLSearchParams(req.url.split('?')[1]);
    const token = params.get('token') || '';

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'send_message') {
          const conversationId = msg.conversationId;
          const userMessage = {
            id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            role: 'user',
            content: msg.content,
            status: 'complete',
            createdAt: Date.now(),
          };
          ChatDb.addMessage(conversationId, userMessage);
          ws.send(JSON.stringify({ type: 'message', data: userMessage }));
          ws.send(JSON.stringify({ type: 'status', status: 'streaming' }));

          try {
            const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
            const response = await fetch(`${backendUrl}/functions/v1/muapi-proxy`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': msg.apiKey || '',
              },
              body: JSON.stringify({
                endpoint: msg.model || 'gpt-5-mini',
                params: {
                  prompt: msg.content,
                  system_prompt: msg.systemPrompt,
                  temperature: msg.temperature ?? 0.7,
                  max_tokens: msg.maxTokens ?? 1024,
                  stream: true,
                },
                generationType: 'text',
                studioType: 'chat',
              }),
            });

            if (!response.ok) {
              throw new Error(`muapi proxy returned ${response.status}`);
            }

            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('text/event-stream')) {
              const reader = response.body.getReader();
              const decoder = new TextDecoder();
              let buffer = '';
              let fullText = '';

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') {
                      const assistantMsg = {
                        id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                        role: 'assistant',
                        content: fullText,
                        status: 'complete',
                        createdAt: Date.now(),
                      };
                      ChatDb.addMessage(conversationId, assistantMsg);
                      ws.send(JSON.stringify({ type: 'message', data: assistantMsg }));
                      ws.send(JSON.stringify({ type: 'status', status: 'complete' }));
                      return;
                    }
                    try {
                      const parsed = JSON.parse(data);
                      const delta = parsed.choices?.[0]?.delta?.content || parsed.text || parsed.delta || '';
                      if (delta) {
                        fullText += delta;
                        ws.send(JSON.stringify({ type: 'delta', delta }));
                      }
                    } catch { /* skip */ }
                  }
                }
              }
            } else {
              const data = await response.json();
              const text = data.text || data.output?.text || data.response || '';
              const assistantMsg = {
                id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                role: 'assistant',
                content: text,
                status: 'complete',
                createdAt: Date.now(),
              };
              ChatDb.addMessage(conversationId, assistantMsg);
              ws.send(JSON.stringify({ type: 'message', data: assistantMsg }));
              ws.send(JSON.stringify({ type: 'status', status: 'complete' }));
            }
          } catch (err) {
            ws.send(JSON.stringify({ type: 'error', error: err.message }));
          }
        }

        if (msg.type === 'stop') {
          ws.send(JSON.stringify({ type: 'status', status: 'cancelled' }));
        }
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', error: e.message }));
      }
    });

    ws.on('close', () => {});
    ws.on('error', (err) => console.error('Chat WS error:', err));
  });
}

export default setupChatWebSocket;
