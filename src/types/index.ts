export type Destination = 'TATOPANI' | 'KERUNG' | 'TATOPANI - KERUNG' | 'KERUNG - TATOPANI' | 'NYLAM' | 'KYIRONG';

export type ConsignmentStatus =
  | 'On the way to Lhasa'
  | 'At Lhasa'
  | 'On the way to Nylam'
  | 'At Nylam'
  | 'On the way to Tatopani'
  | 'At Tatopani port'
  | 'Tatopani Delivered'
  | 'On the way to Kerung'
  | 'At Kerung port'
  | 'Kerung Delivered';

export const DESTINATIONS: Destination[] = ['TATOPANI', 'KERUNG', 'TATOPANI - KERUNG', 'KERUNG - TATOPANI', 'NYLAM'];

export const STATUSES: ConsignmentStatus[] = [
  'On the way to Lhasa',
  'At Lhasa',
  'On the way to Nylam',
  'At Nylam',
  'On the way to Tatopani',
  'At Tatopani port',
  'Tatopani Delivered',
  'On the way to Kerung',
  'At Kerung port',
  'Kerung Delivered',
];

export interface KerungDetails {
  dispatchedFromNylam: string;
  loadedCTN: number | null;
  nylamContainer: string;
  status: 'On the way to Kerung' | 'At Kerung port' | 'Kerung Delivered' | '';
  receivedCTN: number | null;
  arrivalDate: string;
}

export interface TatopaniDetails {
  dispatchedFromNylam: string;
  loadedCTN: number | null;
  nylamContainer: string;
  status: 'On the way to Tatopani' | 'At Tatopani port' | 'Tatopani Delivered' | '';
  receivedCTN: number | null;
  arrivalDate: string;
}

export interface LhasaDetails {
  nylamContainer: string;
  dispatchedFromLhasa: string;
  loadedCTN: number | null;
  arrivedAtNylam?: string;
}

export interface Consignment {
  id: string;
  date: string;
  consignmentNo: string;
  marka: string;
  totalCTN: number;
  cbm: number;
  gw: number;
  destination: Destination;
  status: ConsignmentStatus | '';
  client: string;
  remarks: string;
  createdBy: string;
  updatedBy: string;
  updatedAt: string;
}

export interface LoadingListEntry extends Consignment {
  lotNo: string;
  dispatchedFrom: string;
  container: string;
  arrivalDateNylam: string;
  arrivalAtLhasa: string;
  lhasaContainer: string;
  dispatchedFromLhasa: string;
  lhasa: LhasaDetails[];
  kerung: KerungDetails[];
  tatopani: TatopaniDetails[];
  onTheWay: number | null;
  missingCTN: number | null;
  remainingCTNNylam: number | null;
  remainingCTNLhasa: number | null;
  loadedCTNS: number | null;
  receivedCTNLhasa: number | null;
  receivedCTNNylam: number | null;
  followUp: boolean;
  origin: 'guangzhou' | 'yiwu';
  createdBy: string;
  updatedBy: string;
}

export interface OldNylamEntry {
  id: string;
  date: string;
  consignmentNo: string;
  marka: string;
  totalCTN: number;
  ctnRemainingNylam: number;
  loadedCTN: number;
  cbm: number;
  gw: number;
  destination: string;
  dispatchedFromNylam: string;
  nylamContainer: string;
  arrivalLocation: string;
  arrivalDate: string;
  client: string;
  followUp: boolean;
  updatedAt: string;
}

export interface LotEntry {
  id: string;
  lotNo: string;
  containerNo: string;
  totalConsignments: number;
  dispatchedDate: string;
  dispatchedFrom: string;
  arrivalDate: string;
  arrivalLocation: string;
}

export interface ContainerEntry {
  id: string;
  containerNo: string;
  totalConsignments: number;
  dispatchedDate: string;
  dispatchedFrom: string;
  arrivalDate: string;
  arrivalLocation: string;
}

export interface RemainingCTNEntry {
  id: string;
  date: string;
  consignmentNo: string;
  marka: string;
  totalCTN: number;
  cbm: number;
  gw: number;
  destination: string;
  remainingCTN: number;
  remainingCTNLocation: string;
  client: string;
  createdBy: string;
  updatedBy: string;
  updatedAt: string;
}

export function isKerungDestination(dest: string): boolean {
  return dest === 'KERUNG' || dest === 'KYIRONG' || dest === 'TATOPANI - KERUNG' || dest === 'KERUNG - TATOPANI';
}

export function getStatusClass(status: string): string {
  if (status.includes('Lhasa')) return 'status-lhasa';
  if (status.includes('Nylam')) return 'status-nylam';
  if (status.includes('Tatopani')) return 'status-tatopani';
  if (status.includes('Kerung')) return 'status-kerung';
  if (status.includes('Delivered')) return 'status-delivered';
  if (status.includes('way')) return 'status-onway';
  return '';
}

export function getDestinationClass(dest: string): string {
  if (isKerungDestination(dest)) return 'dest-kerung';
  return '';
}
