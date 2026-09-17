export type ConnectorCapability =
  | "CREATE"
  | "READ"
  | "UPDATE"
  | "DELETE"
  | "PUBLISH"
  | "PAUSE"
  | "ACTIVATE"
  | "SYNC"
  | "UPLOAD_PHOTO"
  | "UPLOAD_VIDEO"
  | "LEADS"
  | "WEBHOOKS";

export type CanonicalVehicle = {
  id: string;
  storeId: string;
  internalCode: number | null;
  brand: string | null;
  model: string | null;
  version: string | null;
  manufactureYear: number | null;
  modelYear: number | null;
  priceCents: number | null;
  mileageKm: number | null;
  color: string | null;
  fuel: string | null;
  transmission: string | null;
  bodyType: string | null;
  doors: number | null;
  optionalFeatures: string[];
  description: string | null;
  plate: string | null;
  vin: string | null;
  status: "DRAFT" | "AVAILABLE" | "RESERVED" | "SOLD" | "ARCHIVED";
  photos: string[];
  videos: string[];
  recordVersion: number;
};

export type ConnectorErrorCategory =
  | "VALIDATION"
  | "AUTHENTICATION"
  | "AUTHORIZATION"
  | "RATE_LIMIT"
  | "TEMPORARY_PROVIDER"
  | "PERMANENT_PROVIDER"
  | "NETWORK"
  | "UNSUPPORTED"
  | "INTERNAL";

export type ConnectorResult = {
  ok: boolean;
  externalId?: string;
  externalStatus?: string;
  httpStatus?: number;
  retryAfterSeconds?: number;
  error?: { category: ConnectorErrorCategory; code?: string; message: string };
};

export interface VehicleConnector {
  readonly id: string;
  readonly version: string;
  readonly capabilities: ReadonlySet<ConnectorCapability>;
  validateConfiguration(configuration: unknown): Promise<string[]>;
  create(vehicle: CanonicalVehicle): Promise<ConnectorResult>;
  read(externalId: string): Promise<ConnectorResult>;
  update(externalId: string, vehicle: CanonicalVehicle): Promise<ConnectorResult>;
  delete(externalId: string): Promise<ConnectorResult>;
  publish(externalId: string): Promise<ConnectorResult>;
  pause(externalId: string): Promise<ConnectorResult>;
  activate(externalId: string): Promise<ConnectorResult>;
  sync(externalId: string | null, vehicle: CanonicalVehicle): Promise<ConnectorResult>;
  uploadPhoto(externalId: string, photoUrl: string): Promise<ConnectorResult>;
  uploadVideo(externalId: string, videoUrl: string): Promise<ConnectorResult>;
  verifyAndParseWebhook(request: Request): Promise<unknown>;
}

export function unsupported(operation: ConnectorCapability): ConnectorResult {
  return {
    ok: false,
    error: {
      category: "UNSUPPORTED",
      code: "UNSUPPORTED_OPERATION",
      message: `${operation} não é suportado por este conector.`,
    },
  };
}