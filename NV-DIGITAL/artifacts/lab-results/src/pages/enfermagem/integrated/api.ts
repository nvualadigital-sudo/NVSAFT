import { type Bootstrap } from "./model";
export interface NursingConnection {
  baseUrl?: string;
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
}
export class ClinicalApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function clinicalRequest(
  connection: NursingConnection,
  path: string,
  payload?: unknown,
): Promise<Bootstrap> {
  const token = await connection.getAccessToken?.();
  const response = await fetch(
    `${connection.baseUrl || "/api/nursing"}${path}`,
    {
      method: payload ? "POST" : "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload
          ? { "Content-Type": "application/json", "X-Nursing-Request": "1" }
          : {}),
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    },
  );
  const data = await response
    .json()
    .catch(() => ({ error: "Resposta do servidor inválida." }));
  if (!response.ok)
    throw new ClinicalApiError(
      data.error || "Não foi possível contactar o serviço clínico.",
      response.status,
    );
  return data;
}
