import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '../../modules/users/entities/user.entity';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

export function currentUserFactory(
  data: keyof AuthenticatedUser | undefined,
  ctx: ExecutionContext,
): AuthenticatedUser | AuthenticatedUser[keyof AuthenticatedUser] | undefined {
  const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
  const user = request.user;
  if (!user) {
    return undefined;
  }
  return data ? user[data] : user;
}

export const CurrentUser = createParamDecorator(currentUserFactory);
