import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

async function proxyToFastAPI(req: NextRequest): Promise<NextResponse> {
  const path = req.nextUrl.pathname.replace("/api/auth", "/api/auth");
  const url = `${API_URL}${path}`;

  const headers: Record<string, string> = {
    "content-type": req.headers.get("content-type") ?? "application/json",
  };

  const cookie = req.headers.get("cookie");
  if (cookie) {
    headers["cookie"] = cookie;
  }

  const body = req.method !== "GET" ? await req.text() : undefined;

  const upstream = await fetch(url, {
    method: req.method,
    headers,
    body,
  });

  const data = await upstream.text();

  const res = new NextResponse(data, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });

  // Forward set-cookie headers from FastAPI
  const setCookies = upstream.headers.getSetCookie();
  for (const c of setCookies) {
    res.headers.append("set-cookie", c);
  }

  return res;
}

export async function POST(req: NextRequest) {
  return proxyToFastAPI(req);
}

export async function GET(req: NextRequest) {
  return proxyToFastAPI(req);
}
