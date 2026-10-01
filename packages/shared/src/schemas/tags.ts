import { z } from 'zod';

export const tagNameSchema = z
  .string({ error: 'กรุณากรอกชื่อแท็ก' })
  .trim()
  .min(1, 'กรุณากรอกชื่อแท็ก')
  .max(50, 'ชื่อแท็กยาวเกินไป (สูงสุด 50 ตัวอักษร)');

export const createTagSchema = z.object({ name: tagNameSchema });
export type CreateTagInput = z.infer<typeof createTagSchema>;

export const updateTagSchema = z.object({ name: tagNameSchema });
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
