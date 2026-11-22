import { invoke } from '@tauri-apps/api/core';
import { llmChatReadableStream } from '@/utils/llmClient';
import { collectLegacyApiKeys, clearLegacyApiKeys } from '@/utils/legacyApiKeys';
import { resolveCompanionCredentials } from '@/utils/companionCredentials';
import { builtinAIMembers, type AIMember } from '@/config/aiMembers';
import { builtinProviders, mapProviderToRust } from '@/config/providers';
import { loadAgeProfile } from '@/config/ageProfile';
import { loadKidMemory } from '@/config/kidMemory';
import { buildCompanionSystemPrompt } from '@/config/childPrompt';

const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;
if (isTauri) {
  localStorage.setItem('token', 'local_desktop_token_placeholder');
}
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function toSeedRow(m: AIMember) {
  return {
    id: m.id,
    kind: m.kind,
    name: m.name,
    avatar: m.avatar || null,
    description: m.description || null,
    tags: JSON.stringify(m.tags || []),
    source: m.source,
    config: JSON.stringify({
      providerId: m.providerId,
      model: m.model,
      schedulerTag: m.schedulerTag,
      customPrompt: m.customPrompt,
      stages: m.stages,
    }),
    enabled: 1,
  };
}

function mockResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function request(url: string, options: RequestInit = {}) {
  if (!isTauri) {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    } as any;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers,
    });
  }

  const cleanUrl = url.split('?')[0];

  try {
    if (cleanUrl === '/api/init') {
      try {
        try {
          const alreadyDone = await invoke<boolean>('migration_status');
          if (!alreadyDone) {
            const migrationResult = await invoke<{ migrated: boolean }>('migrate_a_complete', {
              input: { localStorageKeys: collectLegacyApiKeys() },
            });
            if (migrationResult.migrated) {
              clearLegacyApiKeys();
              console.info('[init] PR4 data migration completed');
            }
          }
        } catch (migrationErr) {
          console.error('[init] PR4 migration failed:', migrationErr);
        }

        const dbMembers: { id: string }[] = await invoke('list_ai_members', { kind: 'llm' });
        const existingIds = new Set(dbMembers.map((m: { id: string }) => m.id));
        const missing = builtinAIMembers.filter((b) => !existingIds.has(b.id));
        if (missing.length > 0) {
          await invoke('seed_builtin_ai_members', { members: missing.map(toSeedRow) });
        }

        const dbProviders: { id: string }[] = await invoke('list_providers');
        const existingProviderIds = new Set(dbProviders.map((p) => p.id));
        const missingProviders = builtinProviders.filter((p) => !existingProviderIds.has(p.id));
        if (missingProviders.length > 0) {
          await invoke('seed_builtin_providers', {
            providers: missingProviders.map(mapProviderToRust),
          });
        }
      } catch (e) {
        console.error('Failed to initialize AI members from Tauri SQLite:', e);
      }

      return mockResponse({
        code: 200,
        data: { ok: true },
      });
    }

    if (cleanUrl === '/api/chat') {
      const body = JSON.parse(options.body as string);
      const { message, custom_prompt, history, aiName, index, model, providerId, gamePrompt, imageDataUrl } = body;

      const creds = await resolveCompanionCredentials(model, providerId);

      // 儿童守则统一在这里前置，调用方无法绕过
      const systemPrompt = buildCompanionSystemPrompt({
        aiName,
        companionPrompt: custom_prompt,
        profile: loadAgeProfile(),
        memory: loadKidMemory(),
        gamePrompt,
      });

      const baseMessages: Array<{
        role: string;
        content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
      }> = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-10).map((h: { role: string; content: string }) => ({
          role: h.role === 'user' ? 'user' : 'assistant',
          content: h.content,
        })),
      ];

      const userMessage =
        typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image/')
          ? {
              role: 'user',
              content: [
                { type: 'image_url' as const, image_url: { url: imageDataUrl } },
                { type: 'text' as const, text: (message || '').trim() || '请帮我看看这张图！' },
              ],
            }
          : { role: 'user', content: message };
      if (index === 0) {
        baseMessages.push(userMessage);
      } else {
        baseMessages.splice(baseMessages.length - index, 0, userMessage);
      }

      const readable = await llmChatReadableStream({
        ...creds,
        messages: baseMessages,
        emitDoneMarker: false,
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    return mockResponse({ success: false, message: `Desktop Mock API: ${cleanUrl} not implemented` }, 404);
  } catch (error: any) {
    console.error('Request intercept error:', error);
    return mockResponse({ success: false, message: error.message || 'Tauri operation failed' }, 500);
  }
}
