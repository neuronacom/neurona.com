# server.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests

app = FastAPI()

# Разрешаем вызовы от фронтенда (GitHub Pages либо localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # можно ограничить вашими доменами
    allow_methods=["*"],
    allow_headers=["*"],
)

AI21_API_URL = "https://api.ai21.com/studio/v1/j1-jumbo/complete"
AI21_API_KEY = "1a12d8c7-240e-43ae-a0fd-f13a329ce7a8"

class ChatRequest(BaseModel):
    prompt: str
    numResults: int = 1
    maxTokens: int = 200
    stopSequences: list[str] = None
    temperature: float = 0.7

@app.post("/api/ai21")
async def ai21_chat(req: ChatRequest):
    headers = {
        "Authorization": f"Bearer {AI21_API_KEY}",
        "Content-Type": "application/json"
    }
    body = {
        "prompt": req.prompt,
        "numResults": req.numResults,
        "maxTokens": req.maxTokens,
        "temperature": req.temperature
    }
    if req.stopSequences:
        body["stopSequences"] = req.stopSequences

    resp = requests.post(AI21_API_URL, headers=headers, json=body)
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    data = resp.json()
    text = data["completions"][0]["data"]["text"]
    return {"reply": text.strip()}
