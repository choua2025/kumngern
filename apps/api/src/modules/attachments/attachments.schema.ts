import { idParamsSchema } from '../../lib/params.js';
import type { RequestSchemas } from '../../middlewares/validate.js';

export const attachmentIdRequest = { params: idParamsSchema } satisfies RequestSchemas;

/** POST /transactions/:id/attachments — the files themselves are checked by the service. */
export const uploadAttachmentsRequest = { params: idParamsSchema } satisfies RequestSchemas;
