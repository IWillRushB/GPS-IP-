export interface IpInfo {
  ip: string;
  city: string;
  region: string;
  country: string;
  org: string;
}

export interface AddressInfo {
  formattedAddress: string;
  poiName?: string;
}

export interface GpsCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export enum LocationStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  DENIED = 'DENIED'
}
