import { z } from 'zod';
import { msg } from '../messages/index.js';
import { CATEGORY_TYPES } from '../constants.js';
import { colorSchema, idSchema } from './primitives.js';

const categoryNameSchema = z
  .string({ error: msg('validation.categoryNameRequired') })
  .trim()
  .min(1, msg('validation.categoryNameRequired'))
  .max(100, msg('validation.nameTooLong', { max: 100 }));

const categoryTypeSchema = z.enum(CATEGORY_TYPES, { error: msg('validation.categoryTypeInvalid') });

const iconSchema = z.string().trim().min(1).max(50, msg('validation.iconTooLong'));

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
    message: msg('validation.atLeastOneField'),
  });
export type UpdateCategoryInput = z.input<typeof updateCategorySchema>;
export type UpdateCategoryData = z.output<typeof updateCategorySchema>;

export const listCategoriesQuerySchema = z.object({
  type: categoryTypeSchema.optional(),
});
