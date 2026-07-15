import { headers } from "next/headers";

export type ChatGPTUser = {
  authenticated: true;
};

const USER_EMAIL_HEADER = "oai-authenticated-user-email";

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (!email) return null;

  return { authenticated: true };
}

export function chatGPTSignInPath(returnTo: string) {
  const safeReturnTo =
    returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  return `/signin-with-chatgpt?return_to=${encodeURIComponent(safeReturnTo)}`;
}
