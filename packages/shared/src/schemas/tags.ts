import { z } from 'zod';
import { msg } from '../messages/index.js';

export const tagNameSchema = z
  .string({ error: msg('validation.tagNameRequired') })
  .trim()
  .min(1, msg('validation.tagNameRequired'))
  .max(50, msg('validation.nameTooLong', { max: 50 }));

export const createTagSchema = z.object({ name: tagNameSchema });
export type CreateTagInput = z.infer<typeof createTagSchema>;

export const updateTagSchema = z.object({ name: tagNameSchema });
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
