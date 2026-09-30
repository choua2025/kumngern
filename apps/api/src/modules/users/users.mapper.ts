import type { UserDto } from '@income-expenses/shared';
import type { User } from '../../generated/prisma/client.js';

/**
 * Whitelist of fields that may leave the server.
 * Never `res.json(user)` directly — it would include password_hash.
 */
export function toUserDto(user: User): UserDto {
  return {
    id: user.id.toString(),
    email: user.email,
    displayName: user.displayName,
    defaultCurrency: user.defaultCurrency,
    timezone: user.timezone,
    createdAt: user.createdAt.toISOString(),
  };
}
