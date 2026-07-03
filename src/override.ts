const AUTHORIZED_USER_ID = "1068324046422413373";

const CODE_EXPIRATION_MS = 5 * 60 * 1000;

const state: {
  pendingCode: { code: string; expiresAt: number } | null;
  activeOverrides: Set<string>;
} = {
  pendingCode: null,
  activeOverrides: new Set(),
};

function generateRandomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const segments: string[] = [];
  for (let i = 0; i < 3; i++) {
    let segment = "";
    for (let j = 0; j < 4; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }
  return segments.join("-");
}

export function isAuthorizedUser(userId: string): boolean {
  return userId === AUTHORIZED_USER_ID;
}

export function generateCode(userId: string): boolean {
  if (!isAuthorizedUser(userId)) return false;
  const code = generateRandomCode();
  const expiresAt = Date.now() + CODE_EXPIRATION_MS;
  state.pendingCode = { code, expiresAt };
  console.log(`[OVERRIDE] Code generated for user ${userId}: ${code}`);
  console.log(`[OVERRIDE] Code expires at: ${new Date(expiresAt).toISOString()}`);
  return true;
}

export function validateCode(
  userId: string,
  code: string,
): { success: boolean; message: string } {
  if (!isAuthorizedUser(userId)) {
    return { success: false, message: "You are not authorized to use override." };
  }
  if (!state.pendingCode) {
    return { success: false, message: "No pending override code. Run `/maintenance` first to generate one." };
  }
  if (Date.now() > state.pendingCode.expiresAt) {
    state.pendingCode = null;
    return { success: false, message: "Override code has expired. Generate a new one with `/maintenance`." };
  }
  if (code.toUpperCase() !== state.pendingCode.code) {
    return { success: false, message: "Invalid override code." };
  }
  state.activeOverrides.add(userId);
  state.pendingCode = null;
  console.log(`[OVERRIDE] Override ACTIVATED for user ${userId}`);
  return { success: true, message: "Override mode activated. You now have access to all commands." };
}

export function deactivate(userId: string): boolean {
  if (!state.activeOverrides.has(userId)) return false;
  state.activeOverrides.delete(userId);
  console.log(`[OVERRIDE] Override DEACTIVATED for user ${userId}`);
  return true;
}

export function hasOverride(userId: string): boolean {
  return state.activeOverrides.has(userId);
}

export function forceOverride(userId: string): boolean {
  if (!isAuthorizedUser(userId)) return false;
  state.activeOverrides.add(userId);
  console.log(`[OVERRIDE] Override FORCE-ACTIVATED for user ${userId} via interlink`);
  return true;
}
