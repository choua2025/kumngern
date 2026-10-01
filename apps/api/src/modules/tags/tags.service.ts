import type { TagRefDto } from '@income-expenses/shared';
import { errors } from '../../lib/errors.js';
import { type TagsRepository, tagsRepository } from './tags.repository.js';

const TAG_NOT_FOUND = 'ไม่พบแท็ก';
const DUPLICATE = 'มีแท็กชื่อนี้อยู่แล้ว';

const toTagDto = (tag: { id: bigint; name: string }): TagRefDto => ({
  id: tag.id.toString(),
  name: tag.name,
});

export function createTagsService(tags: TagsRepository) {
  async function getOrThrow(userId: bigint, tagId: bigint): Promise<TagRefDto> {
    const tag = await tags.findById(userId, tagId);
    if (!tag) {
      throw errors.notFound(TAG_NOT_FOUND);
    }
    return toTagDto(tag);
  }

  return {
    async list(userId: bigint): Promise<TagRefDto[]> {
      return (await tags.findAll(userId)).map(toTagDto);
    },

    async create(userId: bigint, name: string): Promise<TagRefDto> {
      if (await tags.findByName(userId, name)) {
        throw errors.conflict(DUPLICATE);
      }
      // A concurrent duplicate still hits uq_tags_user_name → 409 in the error handler.
      return toTagDto(await tags.create(userId, name));
    },

    async rename(userId: bigint, tagId: bigint, name: string): Promise<TagRefDto> {
      const sameName = await tags.findByName(userId, name);
      if (sameName && sameName.id !== tagId) {
        throw errors.conflict(DUPLICATE);
      }
      if (!(await tags.rename(userId, tagId, name))) {
        throw errors.notFound(TAG_NOT_FOUND);
      }
      return getOrThrow(userId, tagId);
    },

    async delete(userId: bigint, tagId: bigint): Promise<void> {
      if (!(await tags.delete(userId, tagId))) {
        throw errors.notFound(TAG_NOT_FOUND);
      }
    },
  };
}

export type TagsService = ReturnType<typeof createTagsService>;

export const tagsService = createTagsService(tagsRepository);
