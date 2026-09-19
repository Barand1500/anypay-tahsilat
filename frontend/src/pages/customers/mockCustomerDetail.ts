/** Müşteri detay — kullanıcılar & adresler (mock) */

import { formatPhoneLive } from './mockCustomers';

export type CustomerUser = {
  id: string;
  customerId: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  lastLogin: string | null;
};

export type CustomerAddress = {
  id: string;
  customerId: string;
  label: string;
  address: string;
  contactName: string;
  isDefault: boolean;
  country?: string;
  province?: string;
  district?: string;
  quarter?: string;
  neighborhood?: string;
  street?: string;
  directions?: string;
};

const USERS_KEY = 'anypay_tahsilat_customer_users_v1';
const ADDR_KEY = 'anypay_tahsilat_customer_addresses_v1';

const SEED_USERS: CustomerUser[] = [
  {
    id: 'cu-c1-1',
    customerId: 'c1',
    name: 'Sinan Olca',
    email: 'sinanolcs@gmail.com',
    phone: '5523562384',
    active: true,
    lastLogin: null,
  },
];

const SEED_ADDR: CustomerAddress[] = [
  {
    id: 'ca-c1-1',
    customerId: 'c1',
    label: 'EV',
    address: 'Yunusemre Mah Barbaros Sok. Lalezar Apt. Kat:6 No:11 Zile, Zile, Tokat, Türkiye',
    contactName: 'Sinan Olca',
    isDefault: true,
  },
];

function readUsers(): CustomerUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) {
      localStorage.setItem(USERS_KEY, JSON.stringify(SEED_USERS));
      return [...SEED_USERS];
    }
    const parsed = JSON.parse(raw) as CustomerUser[];
    return Array.isArray(parsed) ? parsed : [...SEED_USERS];
  } catch {
    return [...SEED_USERS];
  }
}

function writeUsers(list: CustomerUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(list));
}

function readAddresses(): CustomerAddress[] {
  try {
    const raw = localStorage.getItem(ADDR_KEY);
    if (!raw) {
      localStorage.setItem(ADDR_KEY, JSON.stringify(SEED_ADDR));
      return [...SEED_ADDR];
    }
    const parsed = JSON.parse(raw) as CustomerAddress[];
    return Array.isArray(parsed) ? parsed : [...SEED_ADDR];
  } catch {
    return [...SEED_ADDR];
  }
}

function writeAddresses(list: CustomerAddress[]) {
  localStorage.setItem(ADDR_KEY, JSON.stringify(list));
}

export function getCustomerUsers(customerId: string) {
  return readUsers().filter((u) => u.customerId === customerId);
}

export function setCustomerUsers(customerId: string, users: CustomerUser[]) {
  const others = readUsers().filter((u) => u.customerId !== customerId);
  writeUsers([...users, ...others]);
}

export function getCustomerAddresses(customerId: string) {
  return readAddresses().filter((a) => a.customerId === customerId);
}

export function setCustomerAddresses(customerId: string, list: CustomerAddress[]) {
  const others = readAddresses().filter((a) => a.customerId !== customerId);
  writeAddresses([...list, ...others]);
}

export function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export { formatPhoneLive };
