import { OpenAI } from "openai";

const baseUrl = 'http://127.0.0.1:8000/v1/';
const apiKey = '{parapet-service-token}';

const openai = new OpenAI({
  baseURL: baseUrl,
  apiKey: apiKey,
});

setImmediate(async () => {
  console.log("Chat completions test...");
  const chatResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Hello, how are you?" }],
  });
  console.log(JSON.stringify(chatResponse, null, 2));

  console.log("Embeddings test...");
  const embeddingsResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: "Hello, how are you?",
  });
  console.log(JSON.stringify(embeddingsResponse, null, 2));
});

/*
Example 2xx response:
{
  "id": "chatcmpl-CXdz7LoLFQcdFNMM3jFLHHl8rzNXr",
  "object": "chat.completion",
  "created": 1762134561,
  "model": "gpt-4o-mini-2024-07-18,
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! I'm just a program, so I don't have feelings, but I'm here and ready to help you. How can I assist you today?",
        "refusal": null,
        "annotations": []
      },
      "logprobs": null,
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 13,
    "completion_tokens": 29,
    "total_tokens": 42,
    "prompt_tokens_details": {
      "cached_tokens": 0,
      "audio_tokens": 0
    },
    "completion_tokens_details": {
      "reasoning_tokens": 0,
      "audio_tokens": 0,
      "accepted_prediction_tokens": 0,
      "rejected_prediction_tokens": 0
    }
  },
  "service_tier": "default",
  "system_fingerprint": "fp_560af6e559"
}
*/