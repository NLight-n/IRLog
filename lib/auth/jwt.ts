import jwt, { SignOptions } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

export function signJwt(payload: object, expiresIn: number = 7 * 24 * 60 * 60) {
  const options: SignOptions = { expiresIn };
  return jwt.sign(payload, JWT_SECRET as string, options);
}

export function verifyJwt(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET as string);
  } catch (e) {
    return null;
  }
} 