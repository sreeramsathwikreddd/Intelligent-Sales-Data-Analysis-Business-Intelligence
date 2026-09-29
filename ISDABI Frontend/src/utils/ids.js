// Safe identifier helpers for MongoDB _id values and public callId values.
// Never allow undefined/null/object values to become API route parameters.

const INVALID = new Set([
  'undefined',
  'null',
  'nan',
  '[object object]',
  ''
]);

export function isValidId(value) {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number'
  ) {
    return false;
  }

  const s = String(value).trim();

  return (
    !INVALID.has(s.toLowerCase()) &&
    /^[\w-]{1,128}$/.test(s)
  );
}

export function firstValidId(...candidates) {
  const hit = candidates.find(isValidId);

  return hit === undefined
    ? null
    : String(hit).trim();
}

/**
 * Resolve the actual Call identifier.
 *
 * For Report objects:
 *   report.callId is populated with the actual Call document.
 *
 * Therefore we MUST prefer:
 *   populated Call _id
 *
 * before:
 *   Report _id
 *
 * Otherwise the Reports page would incorrectly navigate
 * to /history/<ReportId> instead of /history/<CallId>.
 */
export const callRef = (call) => {
  const populatedCall =
    call?.callId &&
    typeof call.callId === 'object'
      ? call.callId
      : null;

  return firstValidId(
    populatedCall?._id,
    populatedCall?.id,
    call?._id,
    call?.id,
    typeof call?.callId === 'string'
      ? call.callId
      : null
  );
};

export function extractUploadedCallIds(response) {
  const body =
    response?.data || {};

  const data =
    body.data &&
    typeof body.data === 'object'
      ? body.data
      : body;

  const call =
    data.call &&
    typeof data.call === 'object'
      ? data.call
      : data;

  const mongoId = firstValidId(
    call?._id,
    call?.id,
    data?._id,
    data?.id,
    body?._id,
    body?.id
  );

  const publicId = firstValidId(
    call?.callId,
    data?.callId,
    body?.callId
  );

  return {
    mongoId,
    publicId
  };
}

export function extractUploadedCallId(response) {
  const {
    mongoId,
    publicId
  } = extractUploadedCallIds(response);

  return mongoId || publicId || null;
}