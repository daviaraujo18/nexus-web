export const TEST_PROJECT_ID = 'nexus-test';
export const EMULATOR_HOST = 'localhost';
export const EMULATOR_PORT = 8080;

export async function clearFirestoreEmulator(): Promise<void> {
  const url = `http://${EMULATOR_HOST}:${EMULATOR_PORT}/emulator/v1/projects/${TEST_PROJECT_ID}/databases/(default)/documents`;
  const response = await fetch(url, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Falha ao limpar emulador: ${response.status} ${response.statusText}`);
  }
}

export async function emulatorReady(): Promise<boolean> {
  try {
    const response = await fetch(
      `http://${EMULATOR_HOST}:${EMULATOR_PORT}/`,
      { method: 'GET', signal: AbortSignal.timeout(2000) }
    );
    return response.ok;
  } catch {
    return false;
  }
}
