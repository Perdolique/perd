export interface TwitchUser {
  readonly id: string;
  readonly login: string;
  readonly display_name: string;
  readonly type: '' | 'staff' | 'admin' | 'global_mod';
  readonly broadcaster_type: '' | 'affiliate' | 'partner';
  readonly description: string;
  readonly profile_image_url: string;
  readonly offline_image_url: string;
  readonly created_at: string;
  // "user:read:email" scope required
  readonly email?: string;
}

export interface TwitchOAuthTokenResponse {
  readonly access_token: string;
  readonly expires_in: number;
  readonly refresh_token: string;
  readonly token_type: string;
  readonly scope?: string[];
}

export interface TwitchUsersResponse {
  readonly data: TwitchUser[];
}
