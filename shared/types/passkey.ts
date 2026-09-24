import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON
} from '@simplewebauthn/server'

interface PasskeySummary {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface PasskeyListResponse {
  items: PasskeySummary[];
  canRegister: boolean;
}

type PasskeyRegistrationExtensions = Pick<
  NonNullable<PublicKeyCredentialCreationOptionsJSON['extensions']>,
  'credProps'
>

interface PasskeyRegistrationPublicKeyOptions extends Omit<PublicKeyCredentialCreationOptionsJSON, 'extensions'> {
  extensions?: PasskeyRegistrationExtensions;
}

interface PasskeyRegistrationOptions {
  ceremonyId: string;
  options: PasskeyRegistrationPublicKeyOptions;
}

interface PasskeyAuthenticationOptions {
  ceremonyId: string;
  options: Pick<PublicKeyCredentialRequestOptionsJSON, 'challenge' | 'timeout' | 'rpId' | 'allowCredentials' | 'userVerification'>;
}

export type { PasskeySummary, PasskeyListResponse, PasskeyRegistrationOptions, PasskeyAuthenticationOptions }
