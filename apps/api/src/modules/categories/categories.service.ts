import type {
  CategoryDto,
  CategoryType,
  CreateCategoryData,
  UpdateCategoryData,
} from '@income-expenses/shared';
import { detail, errors } from '../../lib/errors.js';
import { toBigIntId } from '../../lib/params.js';
import {
  type CategoriesRepository,
  type CategoryRow,
  categoriesRepository,
} from './categories.repository.js';

const CATEGORY_NOT_FOUND = 'errors.categoryNotFound';
const PARENT_NOT_FOUND = 'errors.parentNotFound';

function toCategoryDto(row: CategoryRow): CategoryDto {
  return {
    id: row.id.toString(),
    name: row.name,
    type: row.type as CategoryType,
    icon: row.icon,
    color: row.color,
    parentId: row.parentId?.toString() ?? null,
    isSystem: row.userId === null,
    systemKey: row.systemKey,
    children: [],
  };
}

/** Flat rows → roots with `children`. Rows arrive ordered, so children keep that order. */
export function buildCategoryTree(rows: CategoryRow[]): CategoryDto[] {
  const byId = new Map(rows.map((row) => [row.id, toCategoryDto(row)]));
  const roots: CategoryDto[] = [];
  for (const row of rows) {
    const node = byId.get(row.id);
    const parent = row.parentId === null ? undefined : byId.get(row.parentId);
    if (!node) continue;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export function createCategoriesService(categories: CategoriesRepository) {
  /**
   * Rule 7: sub-categories are one level deep, and must share the parent's type.
   * Returns the parent id to store (or null for a root).
   */
  async function validateParent(
    userId: bigint,
    parentIdInput: string | null | undefined,
    type: string,
    selfId?: bigint,
  ): Promise<bigint | null> {
    const parentId = toBigIntId(parentIdInput);
    if (parentId === null) {
      return null;
    }
    if (parentId === selfId) {
      throw errors.validation(undefined, [detail('parentId', 'validation.parentSelf')]);
    }
    const parent = await categories.findVisibleById(userId, parentId);
    if (!parent) {
      throw errors.notFound(PARENT_NOT_FOUND);
    }
    if (parent.parentId !== null) {
      throw errors.validation(undefined, [detail('parentId', 'validation.parentDepth')]);
    }
    if (parent.type !== type) {
      throw errors.validation(undefined, [detail('parentId', 'validation.parentTypeMismatch')]);
    }
    return parentId;
  }

  /** Visible (own or system) and editable (own). System → 403, other user's → 404. */
  async function findOwnOrThrow(userId: bigint, categoryId: bigint): Promise<CategoryRow> {
    const category = await categories.findVisibleById(userId, categoryId);
    if (!category) {
      throw errors.notFound(CATEGORY_NOT_FOUND);
    }
    if (category.userId === null) {
      throw errors.forbidden('errors.systemCategoryReadOnly');
    }
    return category;
  }

  async function getOrThrow(userId: bigint, categoryId: bigint): Promise<CategoryDto> {
    const category = await categories.findVisibleById(userId, categoryId);
    if (!category) {
      throw errors.notFound(CATEGORY_NOT_FOUND);
    }
    return toCategoryDto(category);
  }

  return {
    async listTree(userId: bigint, type: CategoryType | undefined): Promise<CategoryDto[]> {
      return buildCategoryTree(await categories.findVisible(userId, type));
    },

    async create(userId: bigint, input: CreateCategoryData): Promise<CategoryDto> {
      const parentId = await validateParent(userId, input.parentId, input.type);
      const categoryId = await categories.create({
        userId,
        parentId,
        name: input.name,
        type: input.type,
        icon: input.icon ?? null,
        color: input.color ?? null,
      });
      return getOrThrow(userId, categoryId);
    },

    async update(
      userId: bigint,
      categoryId: bigint,
      input: UpdateCategoryData,
    ): Promise<CategoryDto> {
      const category = await findOwnOrThrow(userId, categoryId);

      let parentId: bigint | null | undefined;
      if (input.parentId !== undefined) {
        parentId = await validateParent(userId, input.parentId, category.type, categoryId);
        if (parentId !== null && (await categories.hasChildren(categoryId))) {
          throw errors.validation(undefined, [detail('parentId', 'validation.parentHasChildren')]);
        }
      }

      await categories.update(userId, categoryId, {
        name: input.name,
        icon: input.icon,
        color: input.color,
        parentId,
      });
      return getOrThrow(userId, categoryId);
    },

    /** Rule 6: in use → 409. */
    async delete(userId: bigint, categoryId: bigint): Promise<void> {
      await findOwnOrThrow(userId, categoryId);
      if (await categories.isInUse(categoryId)) {
        throw errors.conflict('errors.categoryInUse');
      }
      if (!(await categories.delete(userId, categoryId))) {
        throw errors.notFound(CATEGORY_NOT_FOUND);
      }
    },
  };
}

export type CategoriesService = ReturnType<typeof createCategoriesService>;

export const categoriesService = createCategoriesService(categoriesRepository);
