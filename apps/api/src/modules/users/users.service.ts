import type { UpdateProfileInput, UserDto } from '@income-expenses/shared';
import { errors } from '../../lib/errors.js';
import { type CurrenciesService, currenciesService } from '../currencies/currencies.service.js';
import { toUserDto } from './users.mapper.js';
import { type UsersRepository, usersRepository } from './users.repository.js';

interface UsersServiceDeps {
  users: UsersRepository;
  currencies: CurrenciesService;
}

export function createUsersService({ users, currencies }: UsersServiceDeps) {
  return {
    async getById(userId: bigint): Promise<UserDto> {
      const user = await users.findById(userId);
      if (!user) {
        // The token is valid but the account is gone (deleted after login).
        throw errors.unauthorized();
      }
      return toUserDto(user);
    },

    async updateProfile(userId: bigint, input: UpdateProfileInput): Promise<UserDto> {
      if (input.defaultCurrency) {
        await currencies.assertExists(input.defaultCurrency);
      }
      const user = await users.update(userId, input);
      return toUserDto(user);
    },
  };
}

export type UsersService = ReturnType<typeof createUsersService>;

export const usersService = createUsersService({
  users: usersRepository,
  currencies: currenciesService,
});
