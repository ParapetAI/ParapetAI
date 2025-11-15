import type { FC } from 'react';
import { useState } from 'react';
import CodeSnippet from '../../components/ui/CodeSnippet';

const ToggleExamples: FC = () => {
  const [variant, setVariant] = useState<'curl' | 'node-fetch' | 'python' | 'openai-node'>('curl');

  const curlLines: string[] = [
    'curl -sS http://localhost:8000/v1/chat/completions \\',
    '  -H "Authorization: Bearer $PARAPET_SERVICE_MYAPP_TOKEN" \\',
    '  -H "Content-Type: application/json" \\',
    '  -d "{\\"model\\":\\"gpt-4o-mini\\",\\"messages\\":[{\\"role\\":\\"user\\",\\"content\\":\\"Hello\\"}]}"',
  ];

  const nodeFetchLines: string[] = [
    'import fetch from "node-fetch"; // or use global fetch in Node 18+',
    '',
    'const resp = await fetch("http://localhost:8000/v1/chat/completions", {',
    '  method: "POST",',
    '  headers: {',
    '    "Content-Type": "application/json",',
    '    Authorization: `Bearer ${process.env.PARAPET_SERVICE_MYAPP_TOKEN}`',
    '  },',
    '  body: JSON.stringify({',
    '    model: "gpt-4o-mini",',
    '    messages: [{ role: "user", content: "Hello" }]',
    '  })',
    '});',
    'const data = await resp.json();',
    'console.log(data);',
  ];

  const pythonLines: string[] = [
    'import requests',
    'import os',
    '',
    'url = "http://localhost:8000/v1/chat/completions"',
    'token = os.getenv("PARAPET_SERVICE_MYAPP_TOKEN")',
    '',
    'resp = requests.post(url, json={',
    '  "model": "gpt-4o-mini",',
    '  "messages": [{ "role": "user", "content": "Hello" }]',
    '}, headers={',
    '  "Authorization": f"Bearer {token}"',
    '})',
    'data = resp.json()',
    'print(data)',
  ];

  const openAINodeLines: string[] = [
    'import openai from "openai";',
    '',
    'const openai = new OpenAI({',
    '  baseURL: "http://localhost:8000/v1",',
    '  apiKey: process.env.PARAPET_SERVICE_MYAPP_TOKEN',
    '});',
    '',
    'const response = await openai.chat.completions.create({',
    '  model: "gpt-4o-mini",',
    '  messages: [{ role: "user", content: "Hello" }]',
    '})',
    'console.log(response)',
  ];

  const isCurl = variant === 'curl';
  const isNodeFetch = variant === 'node-fetch';
  const isPython = variant === 'python';
  const isOpenAINode = variant === 'openai-node';

  const headerRight = (
    <div className="inline-flex rounded-none border-[3px] border-border p-1">
      <button
        type="button"
        className={`px-3 py-1 text-xs ${isCurl ? 'bg-surface text-text' : 'text-muted'}`}
        onClick={() => setVariant('curl')}
      >
        cURL
      </button>
      <button
        type="button"
        className={`px-3 py-1 text-xs ${isNodeFetch ? 'bg-surface text-text' : 'text-muted'}`}
        onClick={() => setVariant('node-fetch')}
      >
        Node (fetch)
      </button>
      <button
        type="button"
        className={`px-3 py-1 text-xs ${isOpenAINode ? 'bg-surface text-text' : 'text-muted'}`}
        onClick={() => setVariant('openai-node')}
      >
        OpenAI (Node)
      </button>
      <button
        type="button"
        className={`px-3 py-1 text-xs ${isPython ? 'bg-surface text-text' : 'text-muted'}`}
        onClick={() => setVariant('python')}
      >
        Python
      </button>
    </div>
  );

  return (
    <CodeSnippet
      headerRight={headerRight}
      lines={isCurl ? curlLines : isNodeFetch ? nodeFetchLines : isPython ? pythonLines : openAINodeLines}
    />
  );
};

export default ToggleExamples;


