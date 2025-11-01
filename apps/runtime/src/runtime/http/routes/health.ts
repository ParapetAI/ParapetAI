import type http from "node:http";
import { APIResponse, HealthResponse } from "@parapetai/parapet/runtime/core/types";

export function handleHealthRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const response: APIResponse<HealthResponse> = {
        statusCode: 200,
        data: {
            ok: true,
        }
    }

    res.statusCode = response.statusCode;
    res.setHeader("content-type", "application/json");
    res.setHeader("content-length", Buffer.byteLength(JSON.stringify(response), "utf8"));
    res.end(JSON.stringify(response));
}