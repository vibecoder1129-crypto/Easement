const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type ApiError = {
  statusCode?: number;
  message?: string | string[];
  error?: string;
};

async function parseJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const data = await parseJson(res);
  if (!res.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message || data?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}
