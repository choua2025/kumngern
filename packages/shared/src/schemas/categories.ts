import { z } from 'zod';
import { CATEGORY_TYPES } from '../constants.js';
import { colorSchema, idSchema } from './primitives.js';

const categoryNameSchema = z
  .string({ error: 'กรุณากรอกชื่อหมวด' })
  .trim()
  .min(1, 'กรุณากรอกชื่อหมวด')
  .max(100, 'ชื่อยาวเกินไป (สูงสุด 100 ตัวอักษร)');

const categoryTypeSchema = z.enum(CATEGORY_TYPES, { error: 'ประเภทหมวดไม่ถูกต้อง' });

const iconSchema = z.string().trim().min(1).max(50, 'ชื่อ icon ยาวเกินไป');

export const createCategorySchema = z.object({
  name: categoryNameSchema,
  type: categoryTypeSchema,
  parentId: idSchema.nullable().optional(),
  icon: iconSchema.nullable().optional(),
  color: colorSchema.nullable().optional(),
});
export type CreateCategoryInput = z.input<typeof createCategorySchema>;
export type CreateCategoryData = z.output<typeof createCategorySchema>;

/** `type` is not editable: transactions already filed under it would break rule 2. */
export const updateCategorySchema = z
  .object({
    name: categoryNameSchema.optional(),
    parentId: idSchema.nullable().optional(),
    icon: iconSchema.nullable().optional(),
    color: colorSchema.nullable().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'ต้องระบุอย่างน้อย 1 ฟิลด์ที่จะแก้ไข',
  });
export type UpdateCategoryInput = z.input<typeof updateCategorySchema>;
export type UpdateCategoryData = z.output<typeof updateCategorySchema>;

export const listCategoriesQuerySchema = z.object({
  type: categoryTypeSchema.optional(),
});
