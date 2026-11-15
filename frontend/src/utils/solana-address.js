const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_INDEX = new Map([...BASE58_ALPHABET].map((character, index) => [character, index]));
const PUBLIC_KEY_BYTES = 32;

export function isCanonicalSolanaAddress(value) {
  if (typeof value !== 'string' || value.length < PUBLIC_KEY_BYTES || value.length > 44) {
    return false;
  }

  let leadingZeroes = 0;
  while (value[leadingZeroes] === '1') leadingZeroes += 1;

  let decoded = 0n;
  for (const character of value) {
    const digit = BASE58_INDEX.get(character);
    if (digit === undefined) return false;
    decoded = (decoded * 58n) + BigInt(digit);
  }

  const body = decoded === 0n ? '' : decoded.toString(16);
  const bodyBytes = Math.ceil(body.length / 2);
  return leadingZeroes + bodyBytes === PUBLIC_KEY_BYTES;
}
