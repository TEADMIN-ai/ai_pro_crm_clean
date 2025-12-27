import { User } from 'firebase/auth';

export function assertAuth(user: User | null): user is User {
  return !!user;
}
