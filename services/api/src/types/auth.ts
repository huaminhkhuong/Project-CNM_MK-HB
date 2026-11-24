export type AuthTokenPayload = {
  id?: string | number;
  userId: string;
  email: string;
  role: string;
  [key: string]: any;
};
