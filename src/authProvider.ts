import bcrypt from "bcrypt";
import { sign, verify } from "jsonwebtoken";

interface Config {
  PASSWORD_SALT_ROUNDS: number;
  AUTH_TOKEN_SECRET: string;
}

type UserData = any;

interface AuthProvider {
  hashPassword: (password: string) => Promise<string | void>;
  checkPassword: (
    newPassword: string,
    originalHashedPassword: string
  ) => Promise<boolean | void>;
  generateToken: (data: UserData) => string;
  decodeToken: (accessToken: string) => UserData;
}

type CreateAuthProviderFn = (config: Config) => AuthProvider;

export const createAuthProvider: CreateAuthProviderFn = ({
  PASSWORD_SALT_ROUNDS,
  AUTH_TOKEN_SECRET
}) => {
  const hashPassword = async password => {
    const hashedPassword = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

    return hashedPassword;
  };

  const checkPassword = async (newPassword, originalHashedPassword) => {
    const arePasswordsEqual = await bcrypt.compare(
      newPassword,
      originalHashedPassword
    );

    return arePasswordsEqual;
  };

  const generateToken = userData => {
    return sign(userData, AUTH_TOKEN_SECRET);
  };

  const decodeToken = accessToken => {
    return verify(accessToken, AUTH_TOKEN_SECRET);
  };

  return {
    hashPassword,
    checkPassword,
    generateToken,
    decodeToken
  };
};
