import { getFeedbackBindings, isFeedbackWriteEnabled } from "@/db/runtime";
import {
  handleFeedbackDelete,
  handleFeedbackGet,
  handleFeedbackPost,
} from "./service.mjs";

export async function GET() {
  try {
    return await handleFeedbackGet(await getFeedbackBindings());
  } catch {
    return serviceUnavailable();
  }
}

export async function POST(request: Request) {
  if (!request.headers.get("oai-authenticated-user-email")) {
    return Response.json({ error: "sign_in_required" }, { status: 401 });
  }
  try {
    if (!(await isFeedbackWriteEnabled())) {
      return Response.json({ error: "feedback_write_disabled" }, { status: 503 });
    }
    const bindings = await getFeedbackBindings();
    return await handleFeedbackPost(request, bindings);
  } catch {
    return serviceUnavailable();
  }
}

export async function DELETE(request: Request) {
  try {
    return await handleFeedbackDelete(request, await getFeedbackBindings());
  } catch {
    return serviceUnavailable();
  }
}

function serviceUnavailable() {
  return Response.json({ error: "feedback_unavailable" }, { status: 503 });
}
