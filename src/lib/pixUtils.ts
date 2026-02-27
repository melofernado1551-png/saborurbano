/**
 * PIX EMV QR Code / Copia e Cola utilities
 * Parses a base PIX EMV string, inserts/replaces the transaction amount (ID 54),
 * and recalculates the CRC16 (ID 63).
 */

// CRC16-CCITT (polynomial 0x1021)
function crc16ccitt(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

interface EmvField {
  id: string;
  value: string;
}

/**
 * Parse an EMV TLV string into an array of {id, value} objects.
 */
function parseEmv(emv: string): EmvField[] {
  const fields: EmvField[] = [];
  let pos = 0;
  while (pos < emv.length) {
    if (pos + 4 > emv.length) break;
    const id = emv.substring(pos, pos + 2);
    const len = parseInt(emv.substring(pos + 2, pos + 4), 10);
    if (isNaN(len)) break;
    const value = emv.substring(pos + 4, pos + 4 + len);
    fields.push({ id, value });
    pos += 4 + len;
  }
  return fields;
}

/**
 * Serialize EMV fields back to a TLV string.
 */
function serializeEmv(fields: EmvField[]): string {
  return fields
    .map((f) => `${f.id}${f.value.length.toString().padStart(2, "0")}${f.value}`)
    .join("");
}

/**
 * Given a base PIX EMV string (without amount) and a numeric amount,
 * generate a new valid PIX EMV string with the amount embedded and CRC recalculated.
 */
export function generatePixWithAmount(basePixCode: string, amount: number): string {
  const trimmed = basePixCode.trim();
  let fields = parseEmv(trimmed);

  // Remove existing CRC (ID 63) and amount (ID 54)
  fields = fields.filter((f) => f.id !== "63" && f.id !== "54");

  // Format amount: "123.45"
  const amountStr = amount.toFixed(2);

  // Insert amount (ID 54) before the end
  // Find the position to insert: after ID 52 (or after all merchant fields) but before any trailing fields
  const insertIdx = fields.findIndex((f) => parseInt(f.id, 10) > 54);
  if (insertIdx >= 0) {
    fields.splice(insertIdx, 0, { id: "54", value: amountStr });
  } else {
    fields.push({ id: "54", value: amountStr });
  }

  // Serialize without CRC
  let payload = serializeEmv(fields);

  // Append CRC placeholder: "6304"
  payload += "6304";

  // Calculate CRC
  const crc = crc16ccitt(payload);

  return payload + crc;
}

/**
 * Validate if a string looks like a valid PIX EMV code
 */
export function isValidPixEmv(code: string): boolean {
  if (!code || code.length < 20) return false;
  // Must start with "00" (Payload Format Indicator)
  if (!code.startsWith("0002")) return false;
  // Must contain Merchant Account Information (ID 26)
  if (!code.includes("26")) return false;
  return true;
}
