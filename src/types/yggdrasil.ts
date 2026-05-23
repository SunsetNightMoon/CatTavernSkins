// Yggdrasil API 相关类型定义

export interface AuthenticateRequest {
  username: string;
  password: string;
  clientToken?: string;
  requestUser?: boolean;
  agent?: {
    name: string;
    version: number;
  };
}

export interface AuthenticateResponse {
  accessToken: string;
  clientToken: string;
  availableProfiles: Profile[];
  selectedProfile?: Profile;
  user?: User;
}

export interface RefreshRequest {
  accessToken: string;
  clientToken?: string;
  requestUser?: boolean;
  selectedProfile?: Profile;
}

export interface RefreshResponse {
  accessToken: string;
  clientToken: string;
  selectedProfile?: Profile;
  user?: User;
}

export interface ValidateRequest {
  accessToken: string;
  clientToken?: string;
}

export interface InvalidateRequest {
  accessToken: string;
  clientToken?: string;
}

export interface SignoutRequest {
  username: string;
  password: string;
}

export interface JoinServerRequest {
  accessToken: string;
  selectedProfile: string;
  serverId: string;
}

export interface HasJoinedQuery {
  username: string;
  serverId: string;
  ip?: string;
}

export interface Profile {
  id: string;  // UUID (无符号)
  name: string;
  properties?: Property[];
}

export interface Property {
  name: string;
  value: string;
  signature?: string;
}

export interface User {
  id: string;  // UUID (无符号)
  properties?: Property[];
}

export interface TexturesProperty {
  timestamp: number;
  profileId: string;
  profileName: string;
  textures?: {
    SKIN?: {
      url: string;
      metadata?: {
        model: 'default' | 'slim';
      };
    };
    CAPE?: {
      url: string;
    };
  };
}

export interface ErrorResponse {
  error: string;
  errorMessage: string;
  cause?: string;
}
