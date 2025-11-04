import { OpenAI } from "openai";
import { ChatCompletionChunk, ChatCompletionCreateParamsNonStreaming } from "openai/resources/index.mjs";
import { loadEnvFile } from "node:process";
import fs from "node:fs";
import path from "node:path";

const localEnv = path.resolve('.env');

if (fs.existsSync(localEnv)) {
  loadEnvFile(localEnv);
} else {
  console.error("Local environment file not found");
  process.exit(1);
}

const baseUrl = 'http://127.0.0.1:8000/v1/';
const openAiWithPolicy = process.env["PARAPET_SERVICE_OPENAI_APP_TOKEN"];
const openAiNoPolicy = process.env["PARAPET_SERVICE_OPENAI_APP_NO_POLICY_TOKEN"];

const openai = new OpenAI({
  baseURL: baseUrl,
  apiKey: openAiWithPolicy,
});

setImmediate(async () => {
  const streaming = false;
  console.log("Chat completions test...");
  const chatResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Hello, how are you? test@gmail.com is my email isnt that cool!" }],
    stream: streaming,
  });
  
  if (streaming) {
    console.log("Streaming chunks:");
    for await (const chunk of chatResponse as unknown as AsyncIterable<ChatCompletionChunk>) {
      console.log(JSON.stringify(chunk, null, 2));
    }
  } else {
    console.log(JSON.stringify(chatResponse, null, 2));
  }

  // console.log("Embeddings test...");
  // const embeddingsResponse = await openai.embeddings.create({
  //   model: "text-embedding-3-small",
  //   input: "Hello, how are you?",
  // });
  // console.log(JSON.stringify(embeddingsResponse, null, 2));
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