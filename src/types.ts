export interface UserData {
  [key: string]: any;
}

export enum OAuthClientName {
  Google = "google",
  GitHub = "github",
  Apple = "apple"
}

export interface SignInParams {
  oauthClientName?: OAuthClientName;
  code?: string;
  userData?: { email: string; password: string };
}

export interface Response {
  data?: UserData;
  error?: string;
}

export interface AuthProvider {
  signUp: (data: {
    email: string;
    name: string;
    password: string;
  }) => Promise<Response>;
  signIn: (data: SignInParams) => Promise<Response>;
  signOut: () => void;
  isSignedIn: () => boolean;
  getCurrentUser: () => Promise<Response>;
  updateCurrentUser: (data: UserData) => Promise<Response>;
  getAccessToken: () => string;
  askNewPassword: (data: {
    email: string;
  }) => Promise<{ error: string } | void>;
  resetPassword: (data: {
    token: string;
    password: string;
  }) => Promise<{ error: string } | void>;
}

export type GetMethod<P = any, R = any> = (
  url: string,
  params: P
) => { request: Promise<R> };

export type PostMethod<T = any, R = any> = (
  url: string,
  data: T
) => { request: Promise<R> };

export type PutMethod<T = any, R = any> = (
  url: string,
  data: T
) => { request: Promise<R> };

export type DeleteMethod<R = any> = (url: string) => { request: Promise<R> };

export interface Fetcher {
  get: GetMethod;
  post: PostMethod;
  put: PutMethod;
  delete: DeleteMethod;
}

export type CreateAuthProviderFn = (params: {
  fetcher: Fetcher;
  host: string;
  protocol?: string;
  apiVersion?: string;
  port?: number | null;
}) => AuthProvider;
