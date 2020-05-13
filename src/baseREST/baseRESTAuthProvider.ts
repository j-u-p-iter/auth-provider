import { makeUrl } from "@j.u.p.iter/node-utils";
import axios from "axios";

interface UserData {
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
}

export type CreateAuthProviderFn = (params: {
  host: string;
  protocol?: string;
  apiVersion?: string;
  port?: number | null;
}) => AuthProvider;

export const LOCAL_STORAGE_KEY = "authProvider:accessToken";

const handleRequest = async requestCall => {
  let response;

  try {
    response = await requestCall;
  } catch (err) {
    response = err.response;
  }

  const {
    data: { error, data }
  } = response;

  return { error, data };
};

export const createBaseRESTAuthProvider: CreateAuthProviderFn = ({
  host,
  port = null,
  protocol = "https",
  apiVersion = "v1"
}) => {
  type MakeOAuthURL = (oauthClientName: OAuthClientName) => string;
  const makeOAuthURL: MakeOAuthURL = oauthClientName => {
    const path = getOAuthPath(`${oauthClientName}/sign-in`);

    return makeUrl({
      host,
      port,
      protocol,
      path
    });
  };

  type GetPath = (basePath: string) => string;
  const getPath: GetPath = basePath => `api/${apiVersion}/auth/${basePath}`;
  const getOAuthPath: GetPath = basePath =>
    `api/${apiVersion}/oauth/${basePath}`;

  const signUp = async userData => {
    const url = makeUrl({
      host,
      port,
      protocol,
      path: getPath("sign-up")
    });

    const { data, error } = await handleRequest(axios.post(url, userData));

    if (error) {
      return { error };
    }

    const { user, accessToken } = data;

    localStorage.setItem(LOCAL_STORAGE_KEY, accessToken);

    return { data: user };
  };

  const signIn = async params => {
    let error;
    let data;

    if (params.oauthClientName) {
      const url = makeOAuthURL(params.oauthClientName);

      ({ error, data } = await handleRequest(
        axios.post(url, { code: params.code })
      ));
    } else {
      const url = makeUrl({
        host,
        port,
        protocol,
        path: getPath("sign-in")
      });

      ({ error, data } = await handleRequest(axios.post(url, params.userData)));
    }

    if (error) {
      return { error };
    }

    const { user, accessToken } = data;

    localStorage.setItem(LOCAL_STORAGE_KEY, accessToken);

    return { data: user };
  };

  const signOut = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  const getAccessToken = () => {
    return localStorage.getItem(LOCAL_STORAGE_KEY);
  };

  const isSignedIn = () => {
    return Boolean(getAccessToken());
  };

  type GetRequestParams = () => { headers: { Authorization: string } };
  const getRequestParams: GetRequestParams = () => {
    const accessToken = getAccessToken();

    return {
      headers: { Authorization: `Bearer ${accessToken}` }
    };
  };

  const getCurrentUser = async () => {
    if (!isSignedIn()) {
      return { data: null, error: null };
    }

    const url = makeUrl({
      host,
      port,
      protocol,
      path: getPath("current-user")
    });

    const { error, data } = await handleRequest(
      axios.get(url, getRequestParams())
    );

    if (error) {
      return { error };
    }

    const { user } = data;

    return { data: user };
  };

  const updateCurrentUser = async dataToUpdate => {
    const url = makeUrl({
      host,
      port,
      protocol,
      path: getPath("current-user")
    });

    const { error, data } = await handleRequest(
      axios.put(url, dataToUpdate, getRequestParams())
    );

    if (error) {
      return { error };
    }

    const { user } = data;

    return { data: user };
  };

  return {
    signUp,
    signIn,
    signOut,
    isSignedIn,
    getCurrentUser,
    updateCurrentUser,
    getAccessToken
  };
};
